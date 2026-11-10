-- Security hardening for public signup, tenant membership and platform admin access.

-- Platform administrators are provisioned by a trusted operator in the Supabase SQL editor.
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM anon, authenticated;
GRANT SELECT ON public.platform_admins TO authenticated;
DROP POLICY IF EXISTS platform_admins_select_own ON public.platform_admins;
CREATE POLICY platform_admins_select_own ON public.platform_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins a WHERE a.user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- A profile's global role is informational. Per-company access comes from empresa_members.
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'operador';
UPDATE public.profiles SET role = 'operador' WHERE role IS DISTINCT FROM 'operador';
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM public.empresa_members me
    JOIN public.empresa_members other
      ON other.empresa_id = me.empresa_id AND other.status = 'aceito'
    WHERE me.usuario_id = auth.uid() AND me.status = 'aceito'
      AND other.usuario_id = profiles.id
  ));
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (email, nome, telefone, avatar_url) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'profile role cannot be changed by a user';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_role_guard ON public.profiles;
CREATE TRIGGER profiles_role_guard BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_change();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(COALESCE(NEW.email, 'usuario'), '@', 1)),
    'operador'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
INSERT INTO public.profiles (id, email, nome, role)
SELECT u.id, COALESCE(u.email, ''),
       COALESCE(u.raw_user_meta_data->>'nome', split_part(COALESCE(u.email, 'usuario'), '@', 1)),
       'operador'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- A company and its first admin membership must be created atomically by the database.
CREATE OR REPLACE FUNCTION public.create_empresa_with_admin(
  p_nome text,
  p_cnpj text DEFAULT NULL,
  p_configuracoes jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NULLIF(trim(p_nome), '') IS NULL THEN RAISE EXCEPTION 'company name is required'; END IF;

  INSERT INTO public.empresas (nome, cnpj, responsavel_id, configuracoes)
  VALUES (trim(p_nome), NULLIF(trim(COALESCE(p_cnpj, '')), ''), v_user_id,
          COALESCE(p_configuracoes, '{}'::jsonb))
  RETURNING id INTO v_empresa_id;

  INSERT INTO public.empresa_members (empresa_id, usuario_id, role, status, aceito_em)
  VALUES (v_empresa_id, v_user_id, 'admin', 'aceito', now());
  RETURN v_empresa_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_empresa_with_admin(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_empresa_with_admin(text, text, jsonb) TO authenticated;

-- Used during signup/OAuth hydration. The advisory lock prevents duplicate starter companies.
CREATE OR REPLACE FUNCTION public.ensure_default_empresa(p_nome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  SELECT empresa_id INTO v_empresa_id
  FROM public.empresa_members
  WHERE usuario_id = v_user_id AND status = 'aceito'
  ORDER BY aceito_em NULLS LAST, convidado_em
  LIMIT 1;
  IF v_empresa_id IS NOT NULL THEN RETURN v_empresa_id; END IF;

  RETURN public.create_empresa_with_admin(p_nome, NULL, '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_default_empresa(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_default_empresa(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_empresa_invite(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := lower(COALESCE(auth.jwt()->>'email', ''));
  v_invite public.convites%ROWTYPE;
  v_member_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_email = '' THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT * INTO v_invite FROM public.convites
  WHERE token = p_token AND status = 'pendente' AND expire_em > now()
    AND lower(email) = v_email
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite is invalid, expired, or belongs to another email'; END IF;

  INSERT INTO public.empresa_members (empresa_id, usuario_id, role, status, aceito_em)
  VALUES (v_invite.empresa_id, v_user_id, v_invite.role, 'aceito', now())
  ON CONFLICT (empresa_id, usuario_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'aceito', aceito_em = now()
  RETURNING id INTO v_member_id;

  UPDATE public.convites SET status = 'aceito' WHERE id = v_invite.id;
  RETURN v_member_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_empresa_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_empresa_invite(text) TO authenticated;

-- Direct self-membership allowed users to assign themselves admin on any known tenant.
DROP POLICY IF EXISTS members_select ON public.empresa_members;
CREATE POLICY members_select ON public.empresa_members FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.is_platform_admin() OR public.is_empresa_member(empresa_id));
DROP POLICY IF EXISTS members_insert ON public.empresa_members;
CREATE POLICY members_insert ON public.empresa_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin() OR (
      usuario_id <> auth.uid()
      AND public.empresa_role(empresa_id) IN ('admin', 'gestor')
      AND (public.empresa_role(empresa_id) = 'admin' OR role <> 'admin')
    )
  );
DROP POLICY IF EXISTS members_update ON public.empresa_members;
CREATE POLICY members_update ON public.empresa_members FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin() OR (
      usuario_id <> auth.uid() AND public.empresa_role(empresa_id) IN ('admin', 'gestor')
    )
  )
  WITH CHECK (
    public.is_platform_admin() OR (
      usuario_id <> auth.uid()
      AND public.empresa_role(empresa_id) IN ('admin', 'gestor')
      AND (public.empresa_role(empresa_id) = 'admin' OR role <> 'admin')
    )
  );
DROP POLICY IF EXISTS members_delete ON public.empresa_members;
CREATE POLICY members_delete ON public.empresa_members FOR DELETE TO authenticated
  USING (public.is_platform_admin() OR (
    usuario_id <> auth.uid() AND public.empresa_role(empresa_id) IN ('admin', 'gestor')
  ));

CREATE OR REPLACE FUNCTION public.prevent_membership_identity_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
     OR NEW.usuario_id IS DISTINCT FROM OLD.usuario_id THEN
    RAISE EXCEPTION 'membership identity cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS empresa_members_identity_guard ON public.empresa_members;
CREATE TRIGGER empresa_members_identity_guard BEFORE UPDATE ON public.empresa_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_membership_identity_change();

-- Invitations require a manager. Invited users accept via the email-verified RPC above.
DROP POLICY IF EXISTS convites_all ON public.convites;
DROP POLICY IF EXISTS convites_select ON public.convites;
DROP POLICY IF EXISTS convites_insert ON public.convites;
DROP POLICY IF EXISTS convites_update ON public.convites;
DROP POLICY IF EXISTS convites_delete ON public.convites;
CREATE POLICY convites_select ON public.convites FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.empresa_role(empresa_id) IN ('admin', 'gestor'));
CREATE POLICY convites_insert ON public.convites FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin() OR (
    public.empresa_role(empresa_id) IN ('admin', 'gestor')
    AND (public.empresa_role(empresa_id) = 'admin' OR role <> 'admin')
  ));
CREATE POLICY convites_update ON public.convites FOR UPDATE TO authenticated
  USING (public.is_platform_admin() OR public.empresa_role(empresa_id) IN ('admin', 'gestor'))
  WITH CHECK (public.is_platform_admin() OR (
    public.empresa_role(empresa_id) IN ('admin', 'gestor')
    AND (public.empresa_role(empresa_id) = 'admin' OR role <> 'admin')
  ));
CREATE POLICY convites_delete ON public.convites FOR DELETE TO authenticated
  USING (public.is_platform_admin() OR public.empresa_role(empresa_id) IN ('admin', 'gestor'));

-- Company creation is only available through the atomic SECURITY DEFINER functions.
DROP POLICY IF EXISTS empresas_insert ON public.empresas;
REVOKE INSERT ON public.empresas FROM anon, authenticated;
DROP POLICY IF EXISTS empresas_select ON public.empresas;
CREATE POLICY empresas_select ON public.empresas FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.is_empresa_member(id) OR responsavel_id = auth.uid());
DROP POLICY IF EXISTS empresas_update ON public.empresas;
CREATE POLICY empresas_update ON public.empresas FOR UPDATE TO authenticated
  USING (public.is_platform_admin() OR public.empresa_role(id) IN ('admin', 'gestor'))
  WITH CHECK (public.is_platform_admin() OR public.empresa_role(id) IN ('admin', 'gestor'));
DROP POLICY IF EXISTS empresas_delete ON public.empresas;
CREATE POLICY empresas_delete ON public.empresas FOR DELETE TO authenticated
  USING (public.is_platform_admin() OR public.empresa_role(id) = 'admin');

-- Platform admins can inspect all profiles; regular users still see only permitted profiles.
-- Tenant data reads are membership-scoped, writes are role-scoped, and audit histories are append-only.
DO $$
DECLARE
  cfg record;
  predicate text;
BEGIN
  FOR cfg IN
    SELECT * FROM (VALUES
      ('clients', ARRAY['admin','gestor','vendedor']::text[], ARRAY['admin','gestor']::text[], ARRAY['admin','gestor','vendedor','financeiro','operador']::text[]),
      ('client_historico', ARRAY['admin','gestor','vendedor']::text[], ARRAY[]::text[], ARRAY['admin','gestor','vendedor','financeiro','operador']::text[]),
      ('services', ARRAY['admin','gestor']::text[], ARRAY['admin']::text[], ARRAY['admin','gestor','vendedor','financeiro','operador']::text[]),
      ('vendedores', ARRAY['admin','gestor']::text[], ARRAY['admin']::text[], ARRAY['admin','gestor','vendedor','financeiro','operador']::text[]),
      ('comissoes', ARRAY['admin','gestor','financeiro']::text[], ARRAY['admin','gestor']::text[], ARRAY['admin','gestor','financeiro']::text[]),
      ('vendedor_desempenho', ARRAY['admin','gestor','financeiro']::text[], ARRAY['admin','gestor']::text[], ARRAY['admin','gestor','financeiro','vendedor']::text[]),
      ('contratos', ARRAY['admin','gestor','vendedor']::text[], ARRAY['admin','gestor']::text[], ARRAY['admin','gestor','vendedor','financeiro','operador']::text[]),
      ('assinaturas', ARRAY['admin','gestor','vendedor']::text[], ARRAY['admin']::text[], ARRAY['admin','gestor','vendedor','financeiro','operador']::text[]),
      ('contrato_historico', ARRAY['admin','gestor','vendedor']::text[], ARRAY[]::text[], ARRAY['admin','gestor','vendedor','financeiro','operador']::text[]),
      ('parcelas', ARRAY['admin','gestor','financeiro']::text[], ARRAY['admin','gestor']::text[], ARRAY['admin','gestor','financeiro','vendedor']::text[]),
      ('lancamentos', ARRAY['admin','gestor','financeiro']::text[], ARRAY['admin','gestor']::text[], ARRAY['admin','gestor','financeiro']::text[]),
      ('estornos', ARRAY['admin','gestor','financeiro']::text[], ARRAY['admin','gestor']::text[], ARRAY['admin','gestor','financeiro']::text[]),
      ('agenda', ARRAY['admin','gestor','vendedor','operador']::text[], ARRAY['admin','gestor']::text[], ARRAY['admin','gestor','vendedor','financeiro','operador']::text[]),
      ('agenda_historico', ARRAY['admin','gestor','vendedor','operador']::text[], ARRAY[]::text[], ARRAY['admin','gestor','vendedor','financeiro','operador']::text[]),
      ('auditoria', ARRAY['admin','gestor']::text[], ARRAY[]::text[], ARRAY['admin','gestor']::text[])
    ) AS policies(table_name, write_roles, delete_roles, read_roles)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_all ON public.%I', cfg.table_name, cfg.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_select ON public.%I', cfg.table_name, cfg.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_insert ON public.%I', cfg.table_name, cfg.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_update ON public.%I', cfg.table_name, cfg.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_delete ON public.%I', cfg.table_name, cfg.table_name);

    predicate := format(
      'public.is_platform_admin() OR (public.is_empresa_member(empresa_id) AND public.empresa_role(empresa_id) = ANY (%L::text[]))',
      cfg.read_roles
    );
    EXECUTE format('CREATE POLICY %I_tenant_select ON public.%I FOR SELECT TO authenticated USING (%s)',
      cfg.table_name, cfg.table_name, predicate);

    IF cardinality(cfg.write_roles) > 0 THEN
      predicate := format(
        'public.is_platform_admin() OR (public.is_empresa_member(empresa_id) AND public.empresa_role(empresa_id) = ANY (%L::text[]))',
        cfg.write_roles
      );
      EXECUTE format('CREATE POLICY %I_tenant_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
        cfg.table_name, cfg.table_name, predicate);
      EXECUTE format('CREATE POLICY %I_tenant_update ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
        cfg.table_name, cfg.table_name, predicate, predicate);
    END IF;

    IF cardinality(cfg.delete_roles) > 0 THEN
      predicate := format(
        'public.is_platform_admin() OR (public.is_empresa_member(empresa_id) AND public.empresa_role(empresa_id) = ANY (%L::text[]))',
        cfg.delete_roles
      );
      EXECUTE format('CREATE POLICY %I_tenant_delete ON public.%I FOR DELETE TO authenticated USING (%s)',
        cfg.table_name, cfg.table_name, predicate);
    END IF;
  END LOOP;
END $$;
