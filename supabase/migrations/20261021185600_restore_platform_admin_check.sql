-- Restore the admin predicate expected by the already-deployed admin RPCs.
-- The predicate only grants access when the current JWT belongs to a
-- provisioned platform administrator; it does not change table RLS policies.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.platform_admins AS admins
      WHERE admins.user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
