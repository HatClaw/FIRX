-- Helpers used by row policies remain callable to signed-in users, while
-- trigger-only routines are removed from the public RPC surface.
REVOKE ALL ON FUNCTION public.is_empresa_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_empresa_member(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.empresa_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empresa_role(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_workspace_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
