-- Keep signature envelopes in Postgres and allow public signing only through
-- the unguessable signer token embedded in each envelope.
CREATE TABLE IF NOT EXISTS public.signature_envelopes (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signature_envelopes_owner_updated_idx
  ON public.signature_envelopes (owner_id, updated_at DESC);

ALTER TABLE public.signature_envelopes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.signature_envelopes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_envelopes TO authenticated;

DROP POLICY IF EXISTS signature_envelopes_select_own ON public.signature_envelopes;
CREATE POLICY signature_envelopes_select_own ON public.signature_envelopes
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS signature_envelopes_insert_own ON public.signature_envelopes;
CREATE POLICY signature_envelopes_insert_own ON public.signature_envelopes
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS signature_envelopes_update_own ON public.signature_envelopes;
CREATE POLICY signature_envelopes_update_own ON public.signature_envelopes
  FOR UPDATE TO authenticated USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS signature_envelopes_delete_own ON public.signature_envelopes;
CREATE POLICY signature_envelopes_delete_own ON public.signature_envelopes
  FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.get_signature_envelope_by_token(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT e.payload
  FROM public.signature_envelopes e
  WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(e.payload->'signers') AS item(signer)
    WHERE signer->>'token' = p_token
  )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.mark_signature_envelope_viewed(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid; v_payload jsonb; v_signers jsonb; v_events jsonb;
        v_signer jsonb; v_name text; v_email text; v_now timestamptz := now();
BEGIN
  SELECT id, payload INTO v_id, v_payload FROM public.signature_envelopes e
  WHERE e.payload->>'status' NOT IN ('rascunho','cancelado','expirado')
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(e.payload->'signers') AS item(signer) WHERE signer->>'token'=p_token)
  LIMIT 1;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  SELECT signer INTO v_signer FROM jsonb_array_elements(v_payload->'signers') AS item(signer) WHERE signer->>'token'=p_token LIMIT 1;
  IF v_signer->>'status' = 'pending' THEN
    v_name := v_signer->>'nome'; v_email := v_signer->>'email';
    SELECT jsonb_agg(CASE WHEN signer->>'token'=p_token THEN signer || jsonb_build_object('status','viewed','viewedAt',v_now) ELSE signer END)
      INTO v_signers FROM jsonb_array_elements(v_payload->'signers') AS item(signer);
    v_events := COALESCE(v_payload->'events','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'at', v_now, 'type', 'viewed',
      'message', v_name || ' visualizou o documento', 'actor', v_email));
    v_payload := jsonb_set(jsonb_set(jsonb_set(v_payload,'{signers}',v_signers),'{events}',v_events),'{updatedAt}',to_jsonb(v_now));
    UPDATE public.signature_envelopes SET payload=v_payload, updated_at=v_now WHERE id=v_id;
  END IF;
  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_signature_to_envelope(
  p_token text, p_signature_data_url text, p_mode text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid; v_payload jsonb; v_signer jsonb; v_signers jsonb; v_events jsonb;
        v_name text; v_email text; v_now timestamptz := now(); v_status text;
BEGIN
  IF p_mode NOT IN ('canvas','typed','saved') OR length(p_signature_data_url) > 750000
     OR p_signature_data_url NOT LIKE 'data:image/%;base64,%' THEN
    RAISE EXCEPTION 'Assinatura inválida';
  END IF;
  SELECT id, payload INTO v_id, v_payload FROM public.signature_envelopes e
  WHERE e.payload->>'status' IN ('enviado','parcial','concluido')
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(e.payload->'signers') AS item(signer) WHERE signer->>'token'=p_token)
  LIMIT 1;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  SELECT signer INTO v_signer FROM jsonb_array_elements(v_payload->'signers') AS item(signer) WHERE signer->>'token'=p_token LIMIT 1;
  IF v_signer->>'role' <> 'sign' THEN RAISE EXCEPTION 'Este destinatário não pode assinar'; END IF;
  IF v_signer->>'status' = 'signed' THEN RETURN v_payload; END IF;
  v_name := v_signer->>'nome'; v_email := v_signer->>'email';
  SELECT jsonb_agg(CASE WHEN signer->>'token'=p_token THEN signer || jsonb_build_object(
    'status','signed','signedAt',v_now,'signatureDataUrl',p_signature_data_url,'signatureMode',p_mode) ELSE signer END)
    INTO v_signers FROM jsonb_array_elements(v_payload->'signers') AS item(signer);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_signers) AS item(signer) WHERE signer->>'role'='sign' AND signer->>'status'<>'signed') THEN
    v_status := 'concluido';
  ELSE v_status := 'parcial'; END IF;
  v_events := COALESCE(v_payload->'events','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid(), 'at', v_now, 'type', 'signed',
    'message', v_name || ' assinou o documento', 'actor', v_email));
  IF v_status='concluido' THEN
    v_events := v_events || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'at', v_now, 'type', 'completed', 'message', 'Todas as assinaturas coletadas'));
    v_payload := jsonb_set(v_payload,'{completedAt}',to_jsonb(v_now));
  END IF;
  v_payload := jsonb_set(jsonb_set(jsonb_set(jsonb_set(v_payload,'{signers}',v_signers),'{events}',v_events),'{updatedAt}',to_jsonb(v_now)),'{status}',to_jsonb(v_status));
  UPDATE public.signature_envelopes SET payload=v_payload, updated_at=v_now WHERE id=v_id;
  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_signature_envelope_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_signature_envelope_viewed(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_signature_to_envelope(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_signature_envelope_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_signature_envelope_viewed(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_signature_to_envelope(text,text,text) TO anon, authenticated;
