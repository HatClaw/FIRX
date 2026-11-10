-- Make audit inserts available to authenticated dashboard subscriptions.
-- Table-level RLS policies remain responsible for deciding who can receive rows.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF to_regclass('public.auditoria') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'auditoria'
      ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.auditoria;
    END IF;

    IF to_regclass('public.gm_admin_audit') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'gm_admin_audit'
      ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.gm_admin_audit;
    END IF;
  END IF;
END;
$$;
