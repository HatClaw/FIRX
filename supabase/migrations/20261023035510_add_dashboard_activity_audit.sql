-- Add real dashboard activity for owner-scoped contracts and signatures.
-- No record payload, signer data, financial values, or other sensitive values
-- are copied into the audit log.

CREATE OR REPLACE FUNCTION public.log_owner_workspace_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  row_data jsonb;
  row_id uuid;
  company_id uuid;
  owner_id uuid;
  operation_name text := lower(TG_OP);
  actor_id uuid := auth.uid();
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := to_jsonb(OLD);
  ELSE
    row_data := to_jsonb(NEW);
  END IF;

  row_id := nullif(row_data ->> 'id', '')::uuid;
  company_id := nullif(row_data ->> 'empresa_id', '')::uuid;
  owner_id := coalesce(
    nullif(row_data ->> 'owner_id', '')::uuid,
    nullif(row_data ->> 'user_id', '')::uuid
  );

  -- Authenticated tenant changes to tenant-linked signatures remain visible
  -- only through the existing empresa_id RLS boundary. Owner-only records are
  -- logged only when the authenticated actor is their actual owner.
  IF actor_id IS NOT NULL AND (
    company_id IS NOT NULL OR owner_id = actor_id
  ) THEN
    INSERT INTO public.auditoria
      (empresa_id, usuario_id, acao, entidade, entidade_id, detalhes)
    VALUES
      (company_id, actor_id, TG_TABLE_NAME || '_' || operation_name,
       TG_TABLE_NAME, row_id, jsonb_build_object('operacao', operation_name));
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_owner_workspace_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_gm_contracts_changes ON public.gm_contracts;
CREATE TRIGGER audit_gm_contracts_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.gm_contracts
  FOR EACH ROW EXECUTE FUNCTION public.log_owner_workspace_change();

DROP TRIGGER IF EXISTS audit_signature_envelopes_changes ON public.signature_envelopes;
CREATE TRIGGER audit_signature_envelopes_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.signature_envelopes
  FOR EACH ROW EXECUTE FUNCTION public.log_owner_workspace_change();

-- Existing tenant audit reads remain unchanged. Owner-only activity rows have
-- empresa_id NULL and are visible solely to their authenticated actor.
DROP POLICY IF EXISTS auditoria_personal_select_own ON public.auditoria;
CREATE POLICY auditoria_personal_select_own ON public.auditoria
  FOR SELECT TO authenticated
  USING (
    empresa_id IS NULL
    AND usuario_id = (SELECT auth.uid())
  );

CREATE INDEX IF NOT EXISTS auditoria_empresa_criado_em_idx
  ON public.auditoria (empresa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS auditoria_usuario_pessoal_criado_em_idx
  ON public.auditoria (usuario_id, criado_em DESC)
  WHERE empresa_id IS NULL;

NOTIFY pgrst, 'reload schema';
