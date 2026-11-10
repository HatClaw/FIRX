-- Persist the service catalog and standalone finance entries used by the UI.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS texto_contrato text,
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_automatico boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bonus_gatilhos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS contratacao_permitida boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bonus_permitido boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exclusao_grupo text;

CREATE TABLE IF NOT EXISTS public.gm_financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente text NOT NULL,
  valor numeric(15,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado')),
  comprovante_path text,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gm_financial_entries_empresa_due_idx
  ON public.gm_financial_entries (empresa_id, vencimento);

ALTER TABLE public.gm_financial_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gm_financial_entries FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gm_financial_entries TO authenticated;

DROP POLICY IF EXISTS gm_financial_entries_select_member ON public.gm_financial_entries;
CREATE POLICY gm_financial_entries_select_member ON public.gm_financial_entries
  FOR SELECT TO authenticated USING (public.is_empresa_member(empresa_id));
DROP POLICY IF EXISTS gm_financial_entries_insert_member ON public.gm_financial_entries;
CREATE POLICY gm_financial_entries_insert_member ON public.gm_financial_entries
  FOR INSERT TO authenticated WITH CHECK (
    public.empresa_role(empresa_id) IN ('admin', 'gestor', 'financeiro')
    AND (criado_por IS NULL OR criado_por = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS gm_financial_entries_update_member ON public.gm_financial_entries;
CREATE POLICY gm_financial_entries_update_member ON public.gm_financial_entries
  FOR UPDATE TO authenticated USING (
    public.empresa_role(empresa_id) IN ('admin', 'gestor', 'financeiro')
  ) WITH CHECK (
    public.empresa_role(empresa_id) IN ('admin', 'gestor', 'financeiro')
  );
DROP POLICY IF EXISTS gm_financial_entries_delete_admin ON public.gm_financial_entries;
CREATE POLICY gm_financial_entries_delete_admin ON public.gm_financial_entries
  FOR DELETE TO authenticated USING (public.empresa_role(empresa_id) = 'admin');

DROP TRIGGER IF EXISTS gm_financial_entries_set_updated_at ON public.gm_financial_entries;
CREATE TRIGGER gm_financial_entries_set_updated_at
  BEFORE UPDATE ON public.gm_financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Existing accounts were created before automatic workspace provisioning was enabled.
-- Give each existing account without a workspace a private default company.
DO $$
DECLARE
  account record;
  new_company_id uuid;
BEGIN
  FOR account IN
    SELECT p.id, p.nome
    FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.empresa_members m
      WHERE m.usuario_id = p.id AND m.status = 'aceito'
    )
  LOOP
    INSERT INTO public.empresas (nome, responsavel_id)
    VALUES (COALESCE(NULLIF(trim(account.nome), ''), 'Minha empresa') || ' - Empresa', account.id)
    RETURNING id INTO new_company_id;

    INSERT INTO public.empresa_members (empresa_id, usuario_id, role, status, aceito_em)
    VALUES (new_company_id, account.id, 'admin', 'aceito', now())
    ON CONFLICT (empresa_id, usuario_id) DO NOTHING;
  END LOOP;
END;
$$;
