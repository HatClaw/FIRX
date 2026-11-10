-- File metadata edits (name/category/path) are available only through the
-- existing gm_files_platform_admin_all RLS policy. Tenant users still have no
-- UPDATE policy, so this table-level grant does not grant them row access.
GRANT UPDATE ON TABLE public.gm_files TO authenticated;

NOTIFY pgrst, 'reload schema';
