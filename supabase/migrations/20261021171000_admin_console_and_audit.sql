CREATE TABLE IF NOT EXISTS public.gm_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gm_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gm_admin_audit FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_dashboard_counts()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'platform admin required'; END IF;
  RETURN jsonb_build_object(
    'companies', (SELECT count(*) FROM public.empresas),
    'users', (SELECT count(*) FROM public.profiles),
    'contracts', (SELECT count(*) FROM public.gm_contracts)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_dashboard_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_counts() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_empresas()
RETURNS TABLE (id uuid, nome text, cnpj text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'platform admin required'; END IF;
  RETURN QUERY SELECT e.id, e.nome, e.cnpj, e.criado_em FROM public.empresas e ORDER BY e.criado_em DESC LIMIT 500;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_empresas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_empresas() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS TABLE (id uuid, email text, nome text, role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'platform admin required'; END IF;
  RETURN QUERY SELECT p.id, p.email, p.nome, p.role FROM public.profiles p ORDER BY p.nome LIMIT 500;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_log_event(p_action text, p_details jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE event_id uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'platform admin required'; END IF;
  INSERT INTO public.gm_admin_audit (admin_user_id, action, details)
  VALUES (auth.uid(), left(trim(p_action), 120), COALESCE(p_details, '{}'::jsonb))
  RETURNING id INTO event_id;
  RETURN event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_log_event(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_event(text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_audit(p_limit integer DEFAULT 100)
RETURNS TABLE (id uuid, admin_user_id uuid, email text, action text, details jsonb, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'platform admin required'; END IF;
  RETURN QUERY
    SELECT a.id, a.admin_user_id, u.email, a.action, a.details, a.created_at
    FROM public.gm_admin_audit a JOIN auth.users u ON u.id = a.admin_user_id
    ORDER BY a.created_at DESC LIMIT LEAST(GREATEST(p_limit, 1), 500);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_audit(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_audit(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_workspace_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  row_id uuid;
  company_id uuid;
  operation_name text;
BEGIN
  operation_name := lower(TG_OP);
  IF TG_OP = 'DELETE' THEN
    row_id := OLD.id;
    IF TG_TABLE_NAME = 'empresas' THEN
      company_id := OLD.id;
    ELSE
      company_id := OLD.empresa_id;
    END IF;
  ELSE
    row_id := NEW.id;
    IF TG_TABLE_NAME = 'empresas' THEN
      company_id := NEW.id;
    ELSE
      company_id := NEW.empresa_id;
    END IF;
  END IF;
  IF company_id IS NOT NULL AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.auditoria (empresa_id, usuario_id, acao, entidade, entidade_id, detalhes)
    VALUES (company_id, auth.uid(), TG_TABLE_NAME || '_' || operation_name, TG_TABLE_NAME, row_id,
            jsonb_build_object('operacao', operation_name));
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_clients_changes ON public.clients;
CREATE TRIGGER audit_clients_changes AFTER INSERT OR UPDATE OR DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_workspace_change();
DROP TRIGGER IF EXISTS audit_services_changes ON public.services;
CREATE TRIGGER audit_services_changes AFTER INSERT OR UPDATE OR DELETE ON public.services FOR EACH ROW EXECUTE FUNCTION public.log_workspace_change();
DROP TRIGGER IF EXISTS audit_vendedores_changes ON public.vendedores;
CREATE TRIGGER audit_vendedores_changes AFTER INSERT OR UPDATE OR DELETE ON public.vendedores FOR EACH ROW EXECUTE FUNCTION public.log_workspace_change();
DROP TRIGGER IF EXISTS audit_agenda_changes ON public.agenda;
CREATE TRIGGER audit_agenda_changes AFTER INSERT OR UPDATE OR DELETE ON public.agenda FOR EACH ROW EXECUTE FUNCTION public.log_workspace_change();
DROP TRIGGER IF EXISTS audit_financial_entries_changes ON public.gm_financial_entries;
CREATE TRIGGER audit_financial_entries_changes AFTER INSERT OR UPDATE OR DELETE ON public.gm_financial_entries FOR EACH ROW EXECUTE FUNCTION public.log_workspace_change();
DROP TRIGGER IF EXISTS audit_empresas_changes ON public.empresas;
CREATE TRIGGER audit_empresas_changes AFTER INSERT OR UPDATE OR DELETE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.log_workspace_change();

GRANT SELECT ON public.auditoria TO authenticated;
