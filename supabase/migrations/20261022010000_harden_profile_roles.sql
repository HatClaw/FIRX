-- Keep tenant roles in profiles separate from platform-admin authorization.
-- The only platform-admin source is public.platform_admins, managed by trusted
-- server-side Supabase tooling. This migration intentionally creates no admins.

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'vendedor';

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_admins FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.platform_admins TO authenticated;
GRANT ALL ON TABLE public.platform_admins TO service_role;
DROP POLICY IF EXISTS "Admins can read own authorization" ON public.platform_admins;
DROP POLICY IF EXISTS platform_admins_select_own ON public.platform_admins;
CREATE POLICY platform_admins_select_own ON public.platform_admins
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.platform_admins AS admins
      WHERE admins.user_id = (SELECT auth.uid())
    );
$$;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(COALESCE(NEW.email, 'usuario'), '@', 1)),
    'vendedor'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.role := 'vendedor';
    ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'profile role cannot be changed by the account owner'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_role ON public.profiles;
DROP TRIGGER IF EXISTS profiles_protect_role_insert ON public.profiles;
DROP TRIGGER IF EXISTS profiles_protect_role_update ON public.profiles;
CREATE TRIGGER profiles_protect_role_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();
CREATE TRIGGER profiles_protect_role_update
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- A user may join their own newly-created company or accept an invitation
-- addressed to their authenticated email. A user cannot self-assign into an
-- unrelated company or change their own membership role/status.
DROP POLICY IF EXISTS members_insert ON public.empresa_members;
CREATE POLICY members_insert ON public.empresa_members FOR INSERT TO authenticated
  WITH CHECK (
    (
      usuario_id = (SELECT auth.uid())
      AND role = 'admin'
      AND status = 'aceito'
      AND EXISTS (
        SELECT 1 FROM public.empresas e
        WHERE e.id = empresa_members.empresa_id AND e.responsavel_id = (SELECT auth.uid())
      )
    )
    OR (
      usuario_id = (SELECT auth.uid())
      AND status = 'aceito'
      AND EXISTS (
        SELECT 1 FROM public.convites c
        WHERE c.empresa_id = empresa_members.empresa_id
          AND c.role = empresa_members.role
          AND c.status = 'pendente'
          AND c.expire_em > now()
          AND lower(c.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
      )
    )
    OR public.empresa_role(empresa_id) IN ('admin', 'gestor')
  );

DROP POLICY IF EXISTS members_update ON public.empresa_members;
CREATE POLICY members_update ON public.empresa_members FOR UPDATE TO authenticated
  USING (public.empresa_role(empresa_id) IN ('admin', 'gestor'))
  WITH CHECK (public.empresa_role(empresa_id) IN ('admin', 'gestor'));

DROP POLICY IF EXISTS convites_all ON public.convites;
DROP POLICY IF EXISTS convites_select_member ON public.convites;
CREATE POLICY convites_select_member ON public.convites FOR SELECT TO authenticated
  USING (public.empresa_role(empresa_id) IN ('admin', 'gestor'));
DROP POLICY IF EXISTS convites_insert_admin ON public.convites;
CREATE POLICY convites_insert_admin ON public.convites FOR INSERT TO authenticated
  WITH CHECK (public.empresa_role(empresa_id) IN ('admin', 'gestor'));
DROP POLICY IF EXISTS convites_update_admin ON public.convites;
CREATE POLICY convites_update_admin ON public.convites FOR UPDATE TO authenticated
  USING (public.empresa_role(empresa_id) IN ('admin', 'gestor'))
  WITH CHECK (public.empresa_role(empresa_id) IN ('admin', 'gestor'));
DROP POLICY IF EXISTS convites_delete_admin ON public.convites;
CREATE POLICY convites_delete_admin ON public.convites FOR DELETE TO authenticated
  USING (public.empresa_role(empresa_id) IN ('admin', 'gestor'));

DROP POLICY IF EXISTS convites_select_invited_user ON public.convites;
CREATE POLICY convites_select_invited_user ON public.convites FOR SELECT TO authenticated
  USING (
    status = 'pendente'
    AND expire_em > now()
    AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );
DROP POLICY IF EXISTS convites_update_invited_user ON public.convites;
CREATE POLICY convites_update_invited_user ON public.convites FOR UPDATE TO authenticated
  USING (
    status = 'pendente'
    AND expire_em > now()
    AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    status = 'aceito'
    AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- Direct invite acceptance only needs to change status. The old table-level
-- ALL grant would override column restrictions, so narrow UPDATE explicitly.
REVOKE UPDATE ON TABLE public.convites FROM authenticated;
GRANT UPDATE (status) ON TABLE public.convites TO authenticated;

-- Initial setup grants table-level ALL. Remove broad profile UPDATE, then
-- allow only editable identity fields. Roles are assigned server-side.
REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (email, nome, telefone, avatar_url) ON TABLE public.profiles TO authenticated;

-- Platform administrators can manage all platform data. Existing tenant
-- policies remain in place; PostgreSQL combines these permissive policies with
-- OR. The list is conditional because deployed projects may have newer tables.
DO $$
DECLARE
  t text;
  policy_name text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'empresas', 'empresa_members', 'convites',
    'clients', 'client_historico', 'services', 'vendedores', 'comissoes',
    'vendedor_desempenho', 'contratos', 'assinaturas', 'contrato_historico',
    'parcelas', 'lancamentos', 'estornos', 'agenda', 'agenda_historico',
    'gm_contracts', 'gm_files', 'gm_financial_entries',
    'signature_envelopes', 'signature_signers', 'signature_events'
  ] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      policy_name := t || '_platform_admin_all';
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin())',
        policy_name, t);
      IF t = 'signature_envelopes' THEN
        EXECUTE 'GRANT ALL ON TABLE public.signature_envelopes TO authenticated';
      END IF;
    END IF;
  END LOOP;

  -- Audit data is append-only for tenant users and platform admins. Global
  -- audit reads use admin_list_audit; the Edge Function writes with service role.
  IF to_regclass('public.auditoria') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS auditoria_platform_admin_all ON public.auditoria';
    EXECUTE 'DROP POLICY IF EXISTS auditoria_tenant_all ON public.auditoria';
    EXECUTE 'DROP POLICY IF EXISTS auditoria_platform_admin_select ON public.auditoria';
    EXECUTE 'DROP POLICY IF EXISTS auditoria_tenant_select ON public.auditoria';
    EXECUTE 'DROP POLICY IF EXISTS auditoria_tenant_insert ON public.auditoria';
    EXECUTE 'CREATE POLICY auditoria_platform_admin_select ON public.auditoria FOR SELECT TO authenticated USING (public.is_platform_admin())';
    EXECUTE 'CREATE POLICY auditoria_tenant_select ON public.auditoria FOR SELECT TO authenticated USING (public.is_empresa_member(empresa_id))';
    EXECUTE 'CREATE POLICY auditoria_tenant_insert ON public.auditoria FOR INSERT TO authenticated WITH CHECK (public.is_empresa_member(empresa_id))';
  END IF;

  IF to_regclass('public.gm_admin_audit') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.gm_admin_audit ENABLE ROW LEVEL SECURITY';
    EXECUTE 'GRANT SELECT ON TABLE public.gm_admin_audit TO authenticated';
    EXECUTE 'DROP POLICY IF EXISTS gm_admin_audit_platform_admin_all ON public.gm_admin_audit';
    EXECUTE 'DROP POLICY IF EXISTS gm_admin_audit_platform_admin_select ON public.gm_admin_audit';
    EXECUTE 'CREATE POLICY gm_admin_audit_platform_admin_select ON public.gm_admin_audit FOR SELECT TO authenticated USING (public.is_platform_admin())';
  END IF;

  -- Local schema has tenant-linked signature envelopes and signer/event
  -- tables; the deployed schema currently has owner_id-only envelopes. This
  -- branch is only for the local tenant-linked shape and never assumes remote
  -- columns that may not exist.
  IF to_regclass('public.signature_envelopes') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='signature_envelopes' AND column_name='empresa_id') THEN
    EXECUTE 'GRANT ALL ON TABLE public.signature_envelopes TO authenticated';
    EXECUTE 'DROP POLICY IF EXISTS signature_envelopes_tenant_all ON public.signature_envelopes';
    EXECUTE 'CREATE POLICY signature_envelopes_tenant_all ON public.signature_envelopes FOR ALL TO authenticated USING (public.is_empresa_member(empresa_id)) WITH CHECK (public.is_empresa_member(empresa_id))';
  END IF;

  IF to_regclass('public.signature_signers') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='signature_envelopes' AND column_name='empresa_id') THEN
    EXECUTE 'GRANT ALL ON TABLE public.signature_signers TO authenticated';
    EXECUTE 'ALTER TABLE public.signature_signers ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS signature_signers_tenant_all ON public.signature_signers';
    EXECUTE 'CREATE POLICY signature_signers_tenant_all ON public.signature_signers FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.signature_envelopes e WHERE e.id = envelope_id AND public.is_empresa_member(e.empresa_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.signature_envelopes e WHERE e.id = envelope_id AND public.is_empresa_member(e.empresa_id)))';
  END IF;

  IF to_regclass('public.signature_events') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='signature_envelopes' AND column_name='empresa_id') THEN
    EXECUTE 'GRANT ALL ON TABLE public.signature_events TO authenticated';
    EXECUTE 'ALTER TABLE public.signature_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS signature_events_tenant_all ON public.signature_events';
    EXECUTE 'CREATE POLICY signature_events_tenant_all ON public.signature_events FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.signature_envelopes e WHERE e.id = envelope_id AND public.is_empresa_member(e.empresa_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.signature_envelopes e WHERE e.id = envelope_id AND public.is_empresa_member(e.empresa_id)))';
  END IF;

  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS gm_files_platform_admin_all ON storage.objects';
    EXECUTE 'CREATE POLICY gm_files_platform_admin_all ON storage.objects FOR ALL TO authenticated USING (bucket_id = ''growmoney-files'' AND public.is_platform_admin()) WITH CHECK (bucket_id = ''growmoney-files'' AND public.is_platform_admin())';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
