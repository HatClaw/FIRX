-- Transactional platform-admin restore and explicit operational-data wipe.
-- Authentication profiles, platform admins, authorization, audit logs, SMTP
-- settings, and Storage binaries are deliberately outside the wipe/restore.

CREATE OR REPLACE FUNCTION public.admin_clear_operational_data(p_confirmation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id uuid := auth.uid();
  counts jsonb := '{}'::jsonb;
  affected bigint;
  table_name text;
BEGIN
  IF actor_id IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador da plataforma.' USING ERRCODE = '42501';
  END IF;
  IF p_confirmation IS DISTINCT FROM 'APAGAR TODOS OS DADOS' THEN
    RAISE EXCEPTION 'Confirmação inválida. Digite APAGAR TODOS OS DADOS.' USING ERRCODE = '22023';
  END IF;

  -- Child-first ordering. Related history/signature events use the existing
  -- cascading FKs. Authentication identities, platform roles, audit trail,
  -- SMTP and files stored in Storage are retained.
  FOREACH table_name IN ARRAY ARRAY[
    'estornos', 'lancamentos', 'parcelas', 'agenda', 'assinaturas',
    'contratos', 'vendedor_desempenho', 'vendedores', 'comissoes',
    'gm_financial_entries', 'gm_contracts', 'signature_envelopes',
    'gm_files', 'services', 'clients', 'empresas'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      IF table_name = 'vendedores' THEN
        UPDATE public.vendedores SET comissao_rule_id = NULL WHERE comissao_rule_id IS NOT NULL;
      END IF;
      EXECUTE format('DELETE FROM public.%I', table_name);
      GET DIAGNOSTICS affected = ROW_COUNT;
      counts := counts || jsonb_build_object(table_name, affected);
    END IF;
  END LOOP;

  INSERT INTO public.gm_admin_audit (admin_user_id, action, details)
    VALUES (actor_id, 'system.operational_data_cleared', jsonb_build_object('deleted', counts));
  RETURN jsonb_build_object('cleared', true, 'deleted', counts,
    'preserved', jsonb_build_array('authentication users and profiles', 'platform admin roles', 'audit logs', 'SMTP configuration', 'Storage binaries'));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_system_backup(p_datasets jsonb, p_confirmation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id uuid := auth.uid();
  table_name text;
  item jsonb;
  total_records bigint := 0;
  inserted bigint;
  counts jsonb := '{}'::jsonb;
  tables text[] := ARRAY[
    'empresas', 'clients', 'services', 'vendedores', 'comissoes',
    'vendedor_desempenho', 'contratos', 'assinaturas', 'parcelas',
    'lancamentos', 'estornos', 'agenda', 'gm_contracts', 'gm_files',
    'gm_financial_entries', 'signature_envelopes'
  ];
BEGIN
  IF actor_id IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador da plataforma.' USING ERRCODE = '42501';
  END IF;
  IF p_confirmation IS DISTINCT FROM 'RESTAURAR E SUBSTITUIR DADOS' THEN
    RAISE EXCEPTION 'Confirmação inválida. Digite RESTAURAR E SUBSTITUIR DADOS.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_datasets) IS DISTINCT FROM 'object'
    OR octet_length(p_datasets::text) > 50000000 THEN
    RAISE EXCEPTION 'Dados de backup inválidos ou maiores que 50 MB.' USING ERRCODE = '22023';
  END IF;

  FOR table_name IN SELECT jsonb_object_keys(p_datasets) LOOP
    IF NOT table_name = ANY(tables) THEN
      RAISE EXCEPTION 'Dataset não permitido: %.', table_name USING ERRCODE = '22023';
    END IF;
  END LOOP;
  FOREACH table_name IN ARRAY tables LOOP
    IF jsonb_typeof(p_datasets -> table_name) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Dataset % ausente ou inválido.', table_name USING ERRCODE = '22023';
    END IF;
    total_records := total_records + jsonb_array_length(p_datasets -> table_name);
  END LOOP;
  IF total_records > 100000 THEN
    RAISE EXCEPTION 'O backup excede 100.000 registros.' USING ERRCODE = '22023';
  END IF;

  -- Replacing data is deliberately atomic: any invalid row or FK rolls back
  -- both the deletion and every insert in this transaction.
  PERFORM public.admin_clear_operational_data('APAGAR TODOS OS DADOS');

  FOREACH table_name IN ARRAY ARRAY['empresas','clients','services','vendedores'] LOOP
    FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> table_name) LOOP
      IF table_name = 'vendedores' AND item ? 'comissao_rule_id' THEN
        EXECUTE format(
          'INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I, $1 - ''comissao_rule_id'')).*',
          table_name, table_name
        ) USING item;
      ELSE
        EXECUTE format('INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I, $1)).*', table_name, table_name) USING item;
      END IF;
    END LOOP;
    counts := counts || jsonb_build_object(table_name, jsonb_array_length(p_datasets -> table_name));
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY['comissoes','vendedor_desempenho','contratos','gm_contracts','gm_files','gm_financial_entries','signature_envelopes','assinaturas','parcelas','lancamentos','estornos','agenda'] LOOP
    FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> table_name) LOOP
      IF table_name = 'signature_envelopes' AND item #>> '{payload,signers}' IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(COALESCE(item #> '{payload,signers}', '[]'::jsonb)) signer
           WHERE signer ->> 'token' IS NULL
         ) THEN
        RAISE EXCEPTION 'Backups não incluem tokens privados de assinatura; remova esses envelopes antes de restaurar.' USING ERRCODE = '22023';
      END IF;
      EXECUTE format('INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I, $1)).*', table_name, table_name) USING item;
    END LOOP;
    counts := counts || jsonb_build_object(table_name, jsonb_array_length(p_datasets -> table_name));
  END LOOP;

  -- Restore the nullable circular link after both sides exist.
  FOR item IN SELECT value FROM jsonb_array_elements(p_datasets -> 'vendedores') LOOP
    IF nullif(item ->> 'comissao_rule_id', '') IS NOT NULL THEN
      UPDATE public.vendedores
        SET comissao_rule_id = (item ->> 'comissao_rule_id')::uuid
        WHERE id = (item ->> 'id')::uuid;
    END IF;
  END LOOP;

  INSERT INTO public.gm_admin_audit (admin_user_id, action, details)
    VALUES (actor_id, 'system.backup_restored', jsonb_build_object('inserted', counts));
  RETURN jsonb_build_object('restored', true, 'inserted', counts, 'recordCount', total_records,
    'preserved', jsonb_build_array('authentication users and profiles', 'platform admin roles', 'audit logs', 'SMTP configuration'));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clear_operational_data(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_restore_system_backup(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_clear_operational_data(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_system_backup(jsonb, text) TO authenticated;
