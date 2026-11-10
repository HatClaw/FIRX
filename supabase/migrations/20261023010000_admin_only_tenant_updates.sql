-- Direct PostgREST UPDATEs must follow the active tenant's administrator role.
-- RESTRICTIVE policies are ANDed with existing permissive tenant policies, so
-- a broader legacy policy cannot grant edit access to gestor or other roles.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients', 'client_historico', 'services', 'vendedores', 'comissoes',
    'vendedor_desempenho', 'contratos', 'assinaturas', 'contrato_historico',
    'parcelas', 'lancamentos', 'estornos', 'agenda', 'agenda_historico',
    'gm_financial_entries'
  ] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = t AND column_name = 'empresa_id'
       ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I_admin_only_update ON public.%I', t, t);
      EXECUTE format(
        'CREATE POLICY %I_admin_only_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_platform_admin() OR public.empresa_role(empresa_id) = ''admin'') WITH CHECK (public.is_platform_admin() OR public.empresa_role(empresa_id) = ''admin'')',
        t, t
      );
    END IF;
  END LOOP;

  -- Company configuration is editable by the tenant admin. Keep platform
  -- administration separate and preserve the existing SELECT/INSERT/DELETE
  -- policies for companies.
  IF to_regclass('public.empresas') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS empresas_admin_only_update ON public.empresas';
    EXECUTE 'CREATE POLICY empresas_admin_only_update ON public.empresas AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_platform_admin() OR public.empresa_role(id) = ''admin'') WITH CHECK (public.is_platform_admin() OR public.empresa_role(id) = ''admin'')';
  END IF;

  -- Local tenant-linked signature schema only. The deployed owner_id-only
  -- signature_envelopes schema is intentionally left unchanged here.
  IF to_regclass('public.signature_envelopes') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'signature_envelopes' AND column_name = 'empresa_id'
     ) THEN
    EXECUTE 'DROP POLICY IF EXISTS signature_envelopes_admin_only_update ON public.signature_envelopes';
    EXECUTE 'CREATE POLICY signature_envelopes_admin_only_update ON public.signature_envelopes AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_platform_admin() OR public.empresa_role(empresa_id) = ''admin'') WITH CHECK (public.is_platform_admin() OR public.empresa_role(empresa_id) = ''admin'')';
  END IF;

  IF to_regclass('public.signature_signers') IS NOT NULL
     AND to_regclass('public.signature_envelopes') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'signature_envelopes' AND column_name = 'empresa_id'
     ) THEN
    EXECUTE 'DROP POLICY IF EXISTS signature_signers_admin_only_update ON public.signature_signers';
    EXECUTE 'CREATE POLICY signature_signers_admin_only_update ON public.signature_signers AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.signature_envelopes e WHERE e.id = envelope_id AND public.empresa_role(e.empresa_id) = ''admin'')) WITH CHECK (public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.signature_envelopes e WHERE e.id = envelope_id AND public.empresa_role(e.empresa_id) = ''admin''))';
  END IF;

  IF to_regclass('public.signature_events') IS NOT NULL
     AND to_regclass('public.signature_envelopes') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'signature_envelopes' AND column_name = 'empresa_id'
     ) THEN
    EXECUTE 'DROP POLICY IF EXISTS signature_events_admin_only_update ON public.signature_events';
    EXECUTE 'CREATE POLICY signature_events_admin_only_update ON public.signature_events AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.signature_envelopes e WHERE e.id = envelope_id AND public.empresa_role(e.empresa_id) = ''admin'')) WITH CHECK (public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.signature_envelopes e WHERE e.id = envelope_id AND public.empresa_role(e.empresa_id) = ''admin''))';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
