-- Public signing is token-authorized. Never disclose another signer's bearer token
-- or signature image in responses to a recipient.
CREATE OR REPLACE FUNCTION public.signature_public_payload(p_payload jsonb, p_token text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_set(
    jsonb_set(
      p_payload - 'createdBy',
      '{signers}',
      COALESCE((
        SELECT jsonb_agg(
          CASE WHEN signer->>'token' = p_token
            THEN signer
            ELSE signer - 'token' - 'signatureDataUrl' - 'email'
          END
          ORDER BY ordinal
        )
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(p_payload->'signers') = 'array'
            THEN p_payload->'signers' ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS item(signer, ordinal)
      ), '[]'::jsonb),
      true
    ),
    '{events}',
    COALESCE((
      SELECT jsonb_agg(event - 'actor' ORDER BY ordinal)
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(p_payload->'events') = 'array'
          THEN p_payload->'events' ELSE '[]'::jsonb END
      ) WITH ORDINALITY AS item(event, ordinal)
    ), '[]'::jsonb),
    true
  );
$$;

REVOKE ALL ON FUNCTION public.signature_public_payload(jsonb, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_signature_envelope_by_token(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.signature_public_payload(e.payload, p_token)
  FROM public.signature_envelopes e
  WHERE p_token ~ '^[a-f0-9]{48}$'
    AND e.payload->>'status' IN ('enviado', 'parcial', 'concluido')
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(e.payload->'signers') = 'array'
          THEN e.payload->'signers' ELSE '[]'::jsonb END
      ) AS item(signer)
      WHERE signer->>'token' = p_token
    )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.mark_signature_envelope_viewed(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_payload jsonb;
  v_signers jsonb;
  v_events jsonb;
  v_signer jsonb;
  v_now timestamptz := now();
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{48}$' THEN RETURN NULL; END IF;

  SELECT e.id, e.payload INTO v_id, v_payload
  FROM public.signature_envelopes e
  WHERE e.payload->>'status' IN ('enviado', 'parcial', 'concluido')
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(e.payload->'signers') = 'array'
          THEN e.payload->'signers' ELSE '[]'::jsonb END
      ) AS item(signer) WHERE signer->>'token' = p_token
    )
  LIMIT 1
  FOR UPDATE;
  IF v_id IS NULL THEN RETURN NULL; END IF;

  SELECT signer INTO v_signer
  FROM jsonb_array_elements(v_payload->'signers') AS item(signer)
  WHERE signer->>'token' = p_token LIMIT 1;
  IF v_signer->>'status' = 'pending' THEN
    SELECT jsonb_agg(
      CASE WHEN signer->>'token' = p_token
        THEN signer || jsonb_build_object('status', 'viewed', 'viewedAt', v_now)
        ELSE signer
      END ORDER BY ordinal
    ) INTO v_signers
    FROM jsonb_array_elements(v_payload->'signers') WITH ORDINALITY AS item(signer, ordinal);
    v_events := COALESCE(v_payload->'events', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'at', v_now, 'type', 'viewed',
      'message', COALESCE(v_signer->>'nome', 'Signatário') || ' visualizou o documento'
    ));
    v_payload := jsonb_set(
      jsonb_set(jsonb_set(v_payload, '{signers}', v_signers), '{events}', v_events),
      '{updatedAt}', to_jsonb(v_now)
    );
    UPDATE public.signature_envelopes SET payload = v_payload, updated_at = v_now WHERE id = v_id;
  END IF;
  RETURN public.signature_public_payload(v_payload, p_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_signature_to_envelope(
  p_token text,
  p_signature_data_url text,
  p_mode text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_payload jsonb;
  v_signer jsonb;
  v_signers jsonb;
  v_events jsonb;
  v_now timestamptz := now();
  v_status text;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{48}$'
     OR p_mode IS NULL OR p_mode NOT IN ('canvas', 'typed', 'saved')
     OR p_signature_data_url IS NULL OR length(p_signature_data_url) > 750000
     OR p_signature_data_url !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$' THEN
    RAISE EXCEPTION 'Assinatura inválida';
  END IF;

  SELECT e.id, e.payload INTO v_id, v_payload
  FROM public.signature_envelopes e
  WHERE e.payload->>'status' IN ('enviado', 'parcial', 'concluido')
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(e.payload->'signers') = 'array'
          THEN e.payload->'signers' ELSE '[]'::jsonb END
      ) AS item(signer) WHERE signer->>'token' = p_token
    )
  LIMIT 1
  FOR UPDATE;
  IF v_id IS NULL THEN RETURN NULL; END IF;

  SELECT signer INTO v_signer
  FROM jsonb_array_elements(v_payload->'signers') AS item(signer)
  WHERE signer->>'token' = p_token LIMIT 1;
  IF v_signer->>'role' IS DISTINCT FROM 'sign' THEN
    RAISE EXCEPTION 'Este destinatário não pode assinar';
  END IF;
  IF v_signer->>'status' = 'signed' THEN
    RETURN public.signature_public_payload(v_payload, p_token);
  END IF;

  SELECT jsonb_agg(
    CASE WHEN signer->>'token' = p_token THEN signer || jsonb_build_object(
      'status', 'signed', 'signedAt', v_now,
      'signatureDataUrl', p_signature_data_url, 'signatureMode', p_mode
    ) ELSE signer END ORDER BY ordinal
  ) INTO v_signers
  FROM jsonb_array_elements(v_payload->'signers') WITH ORDINALITY AS item(signer, ordinal);

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_signers) AS item(signer)
    WHERE signer->>'role' = 'sign' AND signer->>'status' <> 'signed'
  ) THEN
    v_status := 'concluido';
  ELSE
    v_status := 'parcial';
  END IF;

  v_events := COALESCE(v_payload->'events', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid(), 'at', v_now, 'type', 'signed',
    'message', COALESCE(v_signer->>'nome', 'Signatário') || ' assinou o documento'
  ));
  IF v_status = 'concluido' THEN
    v_events := v_events || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'at', v_now, 'type', 'completed',
      'message', 'Todas as assinaturas foram coletadas'
    ));
    v_payload := jsonb_set(v_payload, '{completedAt}', to_jsonb(v_now), true);
  END IF;
  v_payload := jsonb_set(
    jsonb_set(jsonb_set(jsonb_set(v_payload, '{signers}', v_signers), '{events}', v_events), '{updatedAt}', to_jsonb(v_now)),
    '{status}', to_jsonb(v_status)
  );
  UPDATE public.signature_envelopes SET payload = v_payload, updated_at = v_now WHERE id = v_id;
  RETURN public.signature_public_payload(v_payload, p_token);
END;
$$;

-- This narrowly scoped lookup is only for the server-side attachment signer.
CREATE OR REPLACE FUNCTION public.get_signature_attachment_by_token(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'owner_id', e.owner_id,
    'object_path', e.payload->>'arquivoStoragePath'
  )
  FROM public.signature_envelopes e
  WHERE p_token ~ '^[a-f0-9]{48}$'
    AND e.payload->>'status' IN ('enviado', 'parcial', 'concluido')
    AND NULLIF(e.payload->>'arquivoStoragePath', '') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(e.payload->'signers') = 'array'
          THEN e.payload->'signers' ELSE '[]'::jsonb END
      ) AS item(signer) WHERE signer->>'token' = p_token
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_signature_envelope_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_signature_envelope_viewed(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_signature_to_envelope(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_signature_envelope_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_signature_envelope_viewed(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_signature_to_envelope(text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_signature_attachment_by_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_signature_attachment_by_token(text) TO service_role;
