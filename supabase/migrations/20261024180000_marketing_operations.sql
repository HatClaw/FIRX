-- Central interna de Marketing: associacao independente dos tenants comerciais.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.marketing_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','gestor','desenvolvedor','designer','copywriter','trafego')),
  permission_overrides jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(permission_overrides) = 'object'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_members_active_role_idx ON public.marketing_members(role) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.marketing_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 180),
  code text UNIQUE,
  client_label text,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  objective text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'briefing_pendente' CHECK (status IN ('nao_iniciado','briefing_pendente','pronto','em_andamento','aguardando_informacoes','em_revisao','aguardando_aprovacao','ajustes_solicitados','aprovado','concluido','pausado','cancelado')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa','normal','alta','urgente')),
  starts_at date,
  due_at date,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((empresa_id IS NULL) = (client_id IS NULL))
);
CREATE INDEX IF NOT EXISTS marketing_projects_status_due_idx ON public.marketing_projects(status, due_at);
CREATE INDEX IF NOT EXISTS marketing_projects_crm_client_idx ON public.marketing_projects(empresa_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.marketing_project_members (
  project_id uuid NOT NULL REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.marketing_members(user_id) ON DELETE CASCADE,
  project_role text NOT NULL DEFAULT 'contributor' CHECK (project_role IN ('owner','contributor','reviewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS marketing_project_members_user_idx ON public.marketing_project_members(user_id, project_id);

CREATE TABLE IF NOT EXISTS public.marketing_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object'),
  change_summary text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, version)
);

CREATE TABLE IF NOT EXISTS public.marketing_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 180),
  description text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  acceptance_criteria text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'nao_iniciado' CHECK (status IN ('nao_iniciado','briefing_pendente','pronto','em_andamento','aguardando_informacoes','em_revisao','aguardando_aprovacao','ajustes_solicitados','aprovado','concluido','pausado','cancelado')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa','normal','alta','urgente')),
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  assignee_id uuid REFERENCES public.marketing_members(user_id) ON DELETE SET NULL,
  start_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  estimate_minutes integer CHECK (estimate_minutes IS NULL OR estimate_minutes >= 0),
  actual_minutes integer CHECK (actual_minutes IS NULL OR actual_minutes >= 0),
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(checklist) = 'array'),
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_tasks_project_status_due_idx ON public.marketing_tasks(project_id, status, due_at);
CREATE INDEX IF NOT EXISTS marketing_tasks_assignee_due_idx ON public.marketing_tasks(assignee_id, due_at) WHERE assignee_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.marketing_task_dependencies (
  task_id uuid NOT NULL REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(task_id, depends_on_task_id),
  CHECK(task_id <> depends_on_task_id)
);

CREATE TABLE IF NOT EXISTS public.marketing_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 10000),
  mentions uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_task_comments_task_idx ON public.marketing_task_comments(task_id, created_at);

CREATE TABLE IF NOT EXISTS public.marketing_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  starts_at date,
  due_at date,
  completed_at timestamptz,
  assignee_id uuid REFERENCES public.marketing_members(user_id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('direct','team','project')),
  project_id uuid REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  direct_key text UNIQUE,
  title text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'direct' AND project_id IS NULL AND direct_key IS NOT NULL) OR (kind <> 'direct' AND direct_key IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_project_conversation_unique ON public.marketing_conversations(project_id) WHERE kind = 'project';
CREATE TABLE IF NOT EXISTS public.marketing_conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.marketing_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS marketing_conversation_members_user_idx ON public.marketing_conversation_members(user_id, conversation_id);
CREATE TABLE IF NOT EXISTS public.marketing_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.marketing_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 10000),
  attachment_id uuid,
  reply_to uuid REFERENCES public.marketing_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(trim(body)) > 0 OR attachment_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS marketing_messages_conversation_idx ON public.marketing_messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketing_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.marketing_tasks(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  storage_name text NOT NULL UNIQUE CHECK (storage_name !~ '(^/|\.\.|\\)'),
  original_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 104857600),
  category text NOT NULL DEFAULT 'entrega' CHECK (category IN ('briefing','referencia','entrega','documento','outro')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_files_project_idx ON public.marketing_files(project_id, created_at DESC);
ALTER TABLE public.marketing_messages DROP CONSTRAINT IF EXISTS marketing_messages_attachment_id_fkey;
ALTER TABLE public.marketing_messages ADD CONSTRAINT marketing_messages_attachment_id_fkey FOREIGN KEY (attachment_id) REFERENCES public.marketing_files(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.marketing_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  file_id uuid REFERENCES public.marketing_files(id) ON DELETE SET NULL,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','changes_requested')),
  feedback text NOT NULL DEFAULT '',
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (task_id IS NOT NULL OR file_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS marketing_approvals_reviewer_status_idx ON public.marketing_approvals(reviewer_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS public.marketing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_events_project_idx ON public.marketing_events(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketing_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.marketing_members(user_id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '/marketing',
  kind text NOT NULL DEFAULT 'activity',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_notifications_user_unread_idx ON public.marketing_notifications(user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS public.marketing_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.marketing_members(user_id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_push_subscriptions_user_idx ON public.marketing_push_subscriptions(user_id);

CREATE OR REPLACE FUNCTION private.marketing_active_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (SELECT 1 FROM public.marketing_members m WHERE m.user_id = (SELECT auth.uid()) AND m.status = 'active') $$;
CREATE OR REPLACE FUNCTION private.marketing_has_permission(p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM public.marketing_members m
    WHERE m.user_id=(SELECT auth.uid()) AND m.status='active'
      AND CASE
        WHEN m.permission_overrides ? p_permission THEN COALESCE(m.permission_overrides->>p_permission,'false')='true'
        WHEN m.role IN ('admin','gestor') THEN true
        WHEN p_permission IN ('tasks.update','files.upload','comments.create','reviews.request','chat.send','reports.view') THEN true
        ELSE false
      END
  )
$$;
CREATE OR REPLACE FUNCTION private.marketing_can_manage()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT private.marketing_has_permission('projects.manage') $$;
CREATE OR REPLACE FUNCTION private.marketing_can_access_project(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT public.is_platform_admin() OR (private.marketing_active_member() AND (private.marketing_can_manage() OR private.marketing_has_permission('team.manage') OR EXISTS (SELECT 1 FROM public.marketing_project_members pm WHERE pm.project_id = p_project_id AND pm.user_id = (SELECT auth.uid())))) $$;
CREATE OR REPLACE FUNCTION private.marketing_can_edit_project(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT public.is_platform_admin() OR (private.marketing_active_member() AND (private.marketing_has_permission('projects.manage') OR EXISTS (SELECT 1 FROM public.marketing_projects p WHERE p.id = p_project_id AND p.owner_id = (SELECT auth.uid())))) $$;
CREATE OR REPLACE FUNCTION private.marketing_is_conversation_member(p_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT (private.marketing_active_member() OR public.is_platform_admin()) AND EXISTS (SELECT 1 FROM public.marketing_conversation_members cm WHERE cm.conversation_id = p_conversation_id AND cm.user_id = (SELECT auth.uid())) $$;

REVOKE ALL ON FUNCTION private.marketing_active_member() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.marketing_has_permission(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.marketing_can_manage() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.marketing_can_access_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.marketing_can_edit_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.marketing_is_conversation_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.marketing_active_member(), private.marketing_has_permission(text), private.marketing_can_manage(), private.marketing_can_access_project(uuid), private.marketing_can_edit_project(uuid), private.marketing_is_conversation_member(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_marketing_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private, pg_temp
AS $$ SELECT private.marketing_active_member() OR public.is_platform_admin() $$;
REVOKE ALL ON FUNCTION public.is_marketing_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_marketing_member() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.marketing_can_manage()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private, pg_temp
AS $$ SELECT private.marketing_can_manage() $$;
REVOKE ALL ON FUNCTION public.marketing_can_manage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketing_can_manage() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.marketing_has_permission(p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private, pg_temp
AS $$ SELECT private.marketing_has_permission(p_permission) $$;
REVOKE ALL ON FUNCTION public.marketing_has_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketing_has_permission(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.marketing_available_users()
RETURNS TABLE(id uuid, nome text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, private, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.marketing_has_permission('team.manage') THEN
    RAISE EXCEPTION 'marketing team permission required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.nome, p.email FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM public.marketing_members m WHERE m.user_id=p.id)
    ORDER BY p.nome LIMIT 500;
END
$$;
REVOKE ALL ON FUNCTION public.marketing_available_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketing_available_users() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.marketing_open_direct_conversation(p_target_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private, pg_temp
AS $$
DECLARE actor uuid := auth.uid(); target_status text; conversation_id uuid; direct_key_value text;
BEGIN
  IF actor IS NULL OR NOT (private.marketing_active_member() OR public.is_platform_admin()) THEN RAISE EXCEPTION 'marketing membership required' USING ERRCODE = '42501'; END IF;
  SELECT status INTO target_status FROM public.marketing_members WHERE user_id = p_target_user;
  IF target_status IS DISTINCT FROM 'active' OR p_target_user = actor THEN RAISE EXCEPTION 'invalid recipient' USING ERRCODE = '42501'; END IF;
  direct_key_value := least(actor::text, p_target_user::text) || ':' || greatest(actor::text, p_target_user::text);
  INSERT INTO public.marketing_conversations(kind, direct_key, title, created_by)
  VALUES ('direct', direct_key_value, '', actor)
  ON CONFLICT (direct_key) DO UPDATE SET direct_key = EXCLUDED.direct_key
  RETURNING id INTO conversation_id;
  INSERT INTO public.marketing_conversation_members(conversation_id, user_id)
  VALUES (conversation_id, actor), (conversation_id, p_target_user)
  ON CONFLICT DO NOTHING;
  RETURN conversation_id;
END $$;

REVOKE ALL ON FUNCTION private.marketing_open_direct_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.marketing_open_direct_conversation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketing_open_project_conversation(p_project_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private, pg_temp
AS $$
DECLARE actor uuid := auth.uid(); conversation_id uuid;
BEGIN
  IF actor IS NULL OR NOT (private.marketing_can_access_project(p_project_id)) THEN RAISE EXCEPTION 'project access required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.marketing_conversations(kind, project_id, title, created_by)
  VALUES ('project', p_project_id, 'Equipe do projeto', actor)
  ON CONFLICT (project_id) WHERE kind = 'project' DO UPDATE SET project_id=EXCLUDED.project_id
  RETURNING id INTO conversation_id;
  INSERT INTO public.marketing_conversation_members(conversation_id,user_id)
    SELECT conversation_id, pm.user_id FROM public.marketing_project_members pm WHERE pm.project_id=p_project_id
    ON CONFLICT DO NOTHING;
  INSERT INTO public.marketing_conversation_members(conversation_id,user_id)
    SELECT conversation_id, p.owner_id FROM public.marketing_projects p JOIN public.marketing_members mm ON mm.user_id=p.owner_id AND mm.status='active'
    WHERE p.id=p_project_id AND p.owner_id IS NOT NULL ON CONFLICT DO NOTHING;
  INSERT INTO public.marketing_conversation_members(conversation_id,user_id) VALUES(conversation_id,actor) ON CONFLICT DO NOTHING;
  RETURN conversation_id;
END $$;

REVOKE ALL ON FUNCTION public.marketing_open_project_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketing_open_project_conversation(uuid) TO authenticated;

DO $$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['marketing_members','marketing_projects','marketing_project_members','marketing_briefs','marketing_tasks','marketing_task_dependencies','marketing_task_comments','marketing_milestones','marketing_conversations','marketing_conversation_members','marketing_messages','marketing_files','marketing_approvals','marketing_events','marketing_notifications','marketing_push_subscriptions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
  END LOOP;
END $$;

REVOKE UPDATE ON public.marketing_members FROM authenticated;
GRANT UPDATE (nome,email,role,permission_overrides,status,updated_at) ON public.marketing_members TO authenticated;
REVOKE UPDATE ON public.marketing_projects FROM authenticated;
GRANT UPDATE (name,code,client_label,empresa_id,client_id,objective,scope,description,owner_id,status,priority,starts_at,due_at,updated_at) ON public.marketing_projects TO authenticated;
REVOKE UPDATE ON public.marketing_project_members FROM authenticated;
GRANT UPDATE (project_role) ON public.marketing_project_members TO authenticated;
REVOKE UPDATE ON public.marketing_tasks FROM authenticated;
GRANT UPDATE (title,description,instructions,acceptance_criteria,status,priority,progress,assignee_id,start_at,due_at,completed_at,estimate_minutes,actual_minutes,checklist,sort_order,updated_at) ON public.marketing_tasks TO authenticated;
REVOKE UPDATE ON public.marketing_task_comments FROM authenticated;
GRANT UPDATE (body,mentions,updated_at) ON public.marketing_task_comments TO authenticated;
REVOKE UPDATE ON public.marketing_approvals FROM authenticated;
GRANT UPDATE (status,feedback,resolved_at) ON public.marketing_approvals TO authenticated;
REVOKE UPDATE ON public.marketing_notifications FROM authenticated;
GRANT UPDATE (read_at) ON public.marketing_notifications TO authenticated;

DROP POLICY IF EXISTS marketing_members_read ON public.marketing_members;
CREATE POLICY marketing_members_read ON public.marketing_members FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR (status='active' AND private.marketing_active_member()) OR private.marketing_has_permission('team.manage') OR public.is_platform_admin());
DROP POLICY IF EXISTS marketing_members_platform_manage ON public.marketing_members;
CREATE POLICY marketing_members_platform_manage ON public.marketing_members FOR ALL TO authenticated USING (private.marketing_has_permission('team.manage') AND (user_id <> (SELECT auth.uid()) OR public.is_platform_admin())) WITH CHECK (public.is_platform_admin() OR (private.marketing_has_permission('team.manage') AND user_id <> (SELECT auth.uid()) AND role <> 'admin'));

DROP POLICY IF EXISTS marketing_projects_read ON public.marketing_projects;
CREATE POLICY marketing_projects_read ON public.marketing_projects FOR SELECT TO authenticated USING (private.marketing_can_access_project(id));
DROP POLICY IF EXISTS marketing_projects_insert ON public.marketing_projects;
CREATE POLICY marketing_projects_insert ON public.marketing_projects FOR INSERT TO authenticated WITH CHECK (private.marketing_can_manage() AND created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS marketing_projects_update ON public.marketing_projects;
CREATE POLICY marketing_projects_update ON public.marketing_projects FOR UPDATE TO authenticated USING (private.marketing_can_edit_project(id)) WITH CHECK (private.marketing_can_edit_project(id));
DROP POLICY IF EXISTS marketing_projects_delete ON public.marketing_projects;
CREATE POLICY marketing_projects_delete ON public.marketing_projects FOR DELETE TO authenticated USING (private.marketing_can_manage());

DROP POLICY IF EXISTS marketing_project_members_read ON public.marketing_project_members;
CREATE POLICY marketing_project_members_read ON public.marketing_project_members FOR SELECT TO authenticated USING (private.marketing_can_access_project(project_id));
DROP POLICY IF EXISTS marketing_project_members_manage ON public.marketing_project_members;
CREATE POLICY marketing_project_members_manage ON public.marketing_project_members FOR ALL TO authenticated USING (private.marketing_can_edit_project(project_id) OR (private.marketing_has_permission('team.manage') AND private.marketing_can_access_project(project_id))) WITH CHECK ((private.marketing_can_edit_project(project_id) OR (private.marketing_has_permission('team.manage') AND private.marketing_can_access_project(project_id))) AND EXISTS (SELECT 1 FROM public.marketing_members m WHERE m.user_id = marketing_project_members.user_id AND m.status='active'));

DO $$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['marketing_briefs','marketing_tasks','marketing_task_dependencies','marketing_milestones','marketing_files','marketing_approvals','marketing_events'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_project_read', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (private.marketing_can_access_project(project_id))', tbl || '_project_read', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_project_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_project_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_project_delete', tbl);
  END LOOP;
END $$;

DROP POLICY IF EXISTS marketing_task_comments_project_read ON public.marketing_task_comments;
CREATE POLICY marketing_task_comments_project_read ON public.marketing_task_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.marketing_tasks t WHERE t.id=task_id AND private.marketing_can_access_project(t.project_id)));

DROP POLICY IF EXISTS marketing_briefs_insert_author ON public.marketing_briefs;
CREATE POLICY marketing_briefs_insert_author ON public.marketing_briefs FOR INSERT TO authenticated WITH CHECK (created_by=(SELECT auth.uid()) AND private.marketing_can_edit_project(project_id));
DROP POLICY IF EXISTS marketing_tasks_insert_author ON public.marketing_tasks;
CREATE POLICY marketing_tasks_insert_author ON public.marketing_tasks FOR INSERT TO authenticated WITH CHECK (created_by=(SELECT auth.uid()) AND private.marketing_can_access_project(project_id) AND (private.marketing_has_permission('tasks.manage') OR EXISTS (SELECT 1 FROM public.marketing_projects p WHERE p.id=project_id AND p.owner_id=(SELECT auth.uid()))) AND (assignee_id IS NULL OR EXISTS (SELECT 1 FROM public.marketing_members m WHERE m.user_id=assignee_id AND m.status='active')));
DROP POLICY IF EXISTS marketing_tasks_update_assignee ON public.marketing_tasks;
CREATE POLICY marketing_tasks_update_assignee ON public.marketing_tasks FOR UPDATE TO authenticated USING (private.marketing_can_access_project(project_id) AND private.marketing_has_permission('tasks.update') AND (private.marketing_has_permission('tasks.manage') OR assignee_id=(SELECT auth.uid()))) WITH CHECK (private.marketing_can_access_project(project_id) AND private.marketing_has_permission('tasks.update') AND (private.marketing_has_permission('tasks.manage') OR assignee_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS marketing_tasks_delete_manage ON public.marketing_tasks;
CREATE POLICY marketing_tasks_delete_manage ON public.marketing_tasks FOR DELETE TO authenticated USING (private.marketing_has_permission('tasks.manage'));
DROP POLICY IF EXISTS marketing_task_dependencies_insert_manage ON public.marketing_task_dependencies;
CREATE POLICY marketing_task_dependencies_insert_manage ON public.marketing_task_dependencies FOR INSERT TO authenticated WITH CHECK (private.marketing_has_permission('tasks.manage') AND EXISTS (SELECT 1 FROM public.marketing_tasks t WHERE t.id=task_id AND t.project_id=marketing_task_dependencies.project_id) AND EXISTS (SELECT 1 FROM public.marketing_tasks t WHERE t.id=depends_on_task_id AND t.project_id=marketing_task_dependencies.project_id));
DROP POLICY IF EXISTS marketing_task_dependencies_delete_manage ON public.marketing_task_dependencies;
CREATE POLICY marketing_task_dependencies_delete_manage ON public.marketing_task_dependencies FOR DELETE TO authenticated USING (private.marketing_has_permission('tasks.manage'));
DROP POLICY IF EXISTS marketing_task_comments_insert_author ON public.marketing_task_comments;
CREATE POLICY marketing_task_comments_insert_author ON public.marketing_task_comments FOR INSERT TO authenticated WITH CHECK (author_id=(SELECT auth.uid()) AND private.marketing_has_permission('comments.create') AND EXISTS (SELECT 1 FROM public.marketing_tasks t WHERE t.id=task_id AND private.marketing_can_access_project(t.project_id)));
DROP POLICY IF EXISTS marketing_task_comments_update_author ON public.marketing_task_comments;
CREATE POLICY marketing_task_comments_update_author ON public.marketing_task_comments FOR UPDATE TO authenticated USING ((author_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.marketing_tasks t WHERE t.id=task_id AND private.marketing_can_access_project(t.project_id))) OR EXISTS (SELECT 1 FROM public.marketing_tasks t WHERE t.id=task_id AND private.marketing_can_edit_project(t.project_id))) WITH CHECK ((author_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.marketing_tasks t WHERE t.id=task_id AND private.marketing_can_access_project(t.project_id))) OR EXISTS (SELECT 1 FROM public.marketing_tasks t WHERE t.id=task_id AND private.marketing_can_edit_project(t.project_id)));
DROP POLICY IF EXISTS marketing_task_comments_delete_author ON public.marketing_task_comments;
CREATE POLICY marketing_task_comments_delete_author ON public.marketing_task_comments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.marketing_tasks t WHERE t.id=task_id AND private.marketing_can_access_project(t.project_id)) AND (author_id=(SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.marketing_tasks t WHERE t.id=task_id AND private.marketing_can_edit_project(t.project_id))));
DROP POLICY IF EXISTS marketing_files_insert_author ON public.marketing_files;
CREATE POLICY marketing_files_insert_author ON public.marketing_files FOR INSERT TO authenticated WITH CHECK (uploaded_by=(SELECT auth.uid()) AND private.marketing_has_permission('files.upload') AND private.marketing_can_access_project(project_id));
DROP POLICY IF EXISTS marketing_files_delete_manage ON public.marketing_files;
CREATE POLICY marketing_files_delete_manage ON public.marketing_files FOR DELETE TO authenticated USING (private.marketing_can_access_project(project_id) AND (uploaded_by=(SELECT auth.uid()) OR private.marketing_has_permission('files.manage')));
DROP POLICY IF EXISTS marketing_events_insert_actor ON public.marketing_events;
DROP POLICY IF EXISTS marketing_approvals_insert_requester ON public.marketing_approvals;
CREATE POLICY marketing_approvals_insert_requester ON public.marketing_approvals FOR INSERT TO authenticated WITH CHECK (requested_by=(SELECT auth.uid()) AND private.marketing_has_permission('reviews.request') AND status='pending' AND private.marketing_can_access_project(project_id) AND (public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.marketing_members reviewer WHERE reviewer.user_id=reviewer_id AND reviewer.status='active' AND (reviewer.role IN ('admin','gestor') OR COALESCE(reviewer.permission_overrides->>'reviews.manage','false')='true'))));
DROP POLICY IF EXISTS marketing_approvals_update_reviewer ON public.marketing_approvals;
CREATE POLICY marketing_approvals_update_reviewer ON public.marketing_approvals FOR UPDATE TO authenticated USING ((reviewer_id=(SELECT auth.uid()) AND status='pending') OR private.marketing_has_permission('reviews.manage')) WITH CHECK (((reviewer_id=(SELECT auth.uid()) AND status IN ('approved','changes_requested') AND resolved_at IS NOT NULL) OR private.marketing_has_permission('reviews.manage')) AND status IN ('pending','approved','changes_requested'));
DROP POLICY IF EXISTS marketing_approvals_delete_manage ON public.marketing_approvals;
CREATE POLICY marketing_approvals_delete_manage ON public.marketing_approvals FOR DELETE TO authenticated USING (private.marketing_can_edit_project(project_id));
DROP POLICY IF EXISTS marketing_milestones_insert_manage ON public.marketing_milestones;
CREATE POLICY marketing_milestones_insert_manage ON public.marketing_milestones FOR INSERT TO authenticated WITH CHECK (created_by=(SELECT auth.uid()) AND private.marketing_can_access_project(project_id) AND private.marketing_has_permission('tasks.manage'));
DROP POLICY IF EXISTS marketing_milestones_update_manage ON public.marketing_milestones;
CREATE POLICY marketing_milestones_update_manage ON public.marketing_milestones FOR UPDATE TO authenticated USING (private.marketing_has_permission('tasks.manage')) WITH CHECK (private.marketing_has_permission('tasks.manage'));
DROP POLICY IF EXISTS marketing_milestones_delete_manage ON public.marketing_milestones;
CREATE POLICY marketing_milestones_delete_manage ON public.marketing_milestones FOR DELETE TO authenticated USING (private.marketing_has_permission('tasks.manage'));
DROP POLICY IF EXISTS marketing_conversations_read ON public.marketing_conversations;
CREATE POLICY marketing_conversations_read ON public.marketing_conversations FOR SELECT TO authenticated USING (private.marketing_is_conversation_member(id));
DROP POLICY IF EXISTS marketing_conversations_create ON public.marketing_conversations;
CREATE POLICY marketing_conversations_create ON public.marketing_conversations FOR INSERT TO authenticated WITH CHECK (created_by=(SELECT auth.uid()) AND private.marketing_active_member() AND (project_id IS NULL OR private.marketing_can_access_project(project_id)));
DROP POLICY IF EXISTS marketing_conversation_members_read ON public.marketing_conversation_members;
CREATE POLICY marketing_conversation_members_read ON public.marketing_conversation_members FOR SELECT TO authenticated USING (private.marketing_is_conversation_member(conversation_id));
DROP POLICY IF EXISTS marketing_conversation_members_manage ON public.marketing_conversation_members;
DROP POLICY IF EXISTS marketing_messages_read ON public.marketing_messages;
CREATE POLICY marketing_messages_read ON public.marketing_messages FOR SELECT TO authenticated USING (private.marketing_is_conversation_member(conversation_id));
DROP POLICY IF EXISTS marketing_messages_insert ON public.marketing_messages;
CREATE POLICY marketing_messages_insert ON public.marketing_messages FOR INSERT TO authenticated WITH CHECK (sender_id=(SELECT auth.uid()) AND private.marketing_has_permission('chat.send') AND private.marketing_is_conversation_member(conversation_id));

DROP POLICY IF EXISTS marketing_notifications_read ON public.marketing_notifications;
CREATE POLICY marketing_notifications_read ON public.marketing_notifications FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()) AND private.marketing_active_member());
DROP POLICY IF EXISTS marketing_notifications_update ON public.marketing_notifications;
CREATE POLICY marketing_notifications_update ON public.marketing_notifications FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid()) AND private.marketing_active_member()) WITH CHECK (user_id=(SELECT auth.uid()) AND private.marketing_active_member());
DROP POLICY IF EXISTS marketing_push_subscriptions_self ON public.marketing_push_subscriptions;
CREATE POLICY marketing_push_subscriptions_self ON public.marketing_push_subscriptions FOR ALL TO authenticated USING (user_id=(SELECT auth.uid()) AND private.marketing_active_member()) WITH CHECK (user_id=(SELECT auth.uid()) AND private.marketing_active_member());

CREATE OR REPLACE FUNCTION private.marketing_log_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private, pg_temp
AS $$
DECLARE
  row_new jsonb := to_jsonb(NEW);
  row_old jsonb := CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  project_key uuid;
  record_id uuid;
  actor uuid := auth.uid();
  entity_label text;
  action_label text;
BEGIN
  IF TG_TABLE_NAME='marketing_projects' THEN project_key := (row_new->>'id')::uuid;
  ELSIF TG_TABLE_NAME='marketing_task_comments' THEN SELECT t.project_id INTO project_key FROM public.marketing_tasks t WHERE t.id=(row_new->>'task_id')::uuid;
  ELSE project_key := (row_new->>'project_id')::uuid; END IF;
  record_id := (row_new->>'id')::uuid;
  action_label := lower(TG_OP);
  entity_label := CASE WHEN TG_TABLE_NAME='marketing_projects' THEN COALESCE(row_new->>'name','projeto') WHEN TG_TABLE_NAME='marketing_task_comments' THEN 'comentário de tarefa' ELSE COALESCE(row_new->>'title','registro') END;
  INSERT INTO public.marketing_events(project_id, actor_id, action, entity_type, entity_id, summary, details)
    VALUES(project_key, actor, action_label, TG_TABLE_NAME, record_id, CASE WHEN TG_OP='INSERT' THEN 'Criou ' ELSE 'Atualizou ' END || entity_label, jsonb_build_object('status_anterior',row_old->>'status','status_atual',row_new->>'status'));
  IF TG_TABLE_NAME='marketing_tasks' AND (TG_OP='INSERT' OR row_old->>'assignee_id' IS DISTINCT FROM row_new->>'assignee_id')
     AND row_new->>'assignee_id' IS NOT NULL AND (row_new->>'assignee_id')::uuid IS DISTINCT FROM actor THEN
    INSERT INTO public.marketing_notifications(user_id, project_id, title, body, url, kind)
      VALUES((row_new->>'assignee_id')::uuid, project_key, CASE WHEN TG_OP='INSERT' THEN 'Nova tarefa atribuída' ELSE 'Tarefa reatribuída' END,
        entity_label, '/marketing', 'assignment');
  END IF;
  IF TG_TABLE_NAME='marketing_tasks' AND TG_OP='UPDATE' AND row_old->>'status' IS DISTINCT FROM row_new->>'status' THEN
    INSERT INTO public.marketing_notifications(user_id, project_id, title, body, url, kind)
      SELECT DISTINCT targets.user_id, project_key, 'Tarefa atualizada', entity_label || ': ' || COALESCE(row_new->>'status',''), '/marketing', 'task_status'
      FROM (
        SELECT pm.user_id FROM public.marketing_project_members pm WHERE pm.project_id=project_key
        UNION ALL SELECT (row_new->>'assignee_id')::uuid WHERE row_new->>'assignee_id' IS NOT NULL
      ) targets
      JOIN public.marketing_members active_member ON active_member.user_id=targets.user_id AND active_member.status='active'
      WHERE targets.user_id IS DISTINCT FROM actor;
  END IF;
  IF TG_OP='UPDATE' AND row_old->>'status' IS DISTINCT FROM row_new->>'status' THEN
    INSERT INTO public.marketing_notifications(user_id, project_id, title, body, url, kind)
      SELECT pm.user_id, project_key, 'Status do projeto atualizado', entity_label || ': ' || COALESCE(row_new->>'status',''), '/marketing', 'status'
      FROM public.marketing_project_members pm WHERE pm.project_id=project_key AND pm.user_id IS DISTINCT FROM actor;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.marketing_log_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS marketing_projects_activity ON public.marketing_projects;
CREATE TRIGGER marketing_projects_activity AFTER INSERT OR UPDATE ON public.marketing_projects FOR EACH ROW EXECUTE FUNCTION private.marketing_log_change();
DROP TRIGGER IF EXISTS marketing_tasks_activity ON public.marketing_tasks;
CREATE TRIGGER marketing_tasks_activity AFTER INSERT OR UPDATE ON public.marketing_tasks FOR EACH ROW EXECUTE FUNCTION private.marketing_log_change();
DROP TRIGGER IF EXISTS marketing_task_comments_activity ON public.marketing_task_comments;
CREATE TRIGGER marketing_task_comments_activity AFTER INSERT ON public.marketing_task_comments FOR EACH ROW EXECUTE FUNCTION private.marketing_log_change();

CREATE OR REPLACE FUNCTION private.marketing_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp
AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION private.marketing_set_updated_at() FROM PUBLIC, anon, authenticated;
DO $$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['marketing_members','marketing_projects','marketing_tasks','marketing_task_comments','marketing_push_subscriptions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', tbl || '_set_updated_at', tbl);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.marketing_set_updated_at()', tbl || '_set_updated_at', tbl);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.marketing_prevent_blocked_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private, pg_temp
AS $$
BEGIN
  IF NEW.status='concluido' AND OLD.status IS DISTINCT FROM NEW.status AND EXISTS (
    SELECT 1 FROM public.marketing_task_dependencies d
    JOIN public.marketing_tasks blocker ON blocker.id=d.depends_on_task_id
    WHERE d.task_id=NEW.id AND blocker.status IS DISTINCT FROM 'concluido'
  ) THEN
    RAISE EXCEPTION 'Esta tarefa depende da conclusão de outra tarefa.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.marketing_prevent_blocked_completion() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS marketing_tasks_dependency_guard ON public.marketing_tasks;
CREATE TRIGGER marketing_tasks_dependency_guard BEFORE UPDATE OF status ON public.marketing_tasks FOR EACH ROW EXECUTE FUNCTION private.marketing_prevent_blocked_completion();

CREATE OR REPLACE FUNCTION private.marketing_notify_collaborators()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private, pg_temp
AS $$
DECLARE project_key uuid; actor uuid; target_user uuid; item_title text; item_body text; item_kind text;
BEGIN
  actor := auth.uid();
  IF TG_TABLE_NAME='marketing_messages' THEN
    SELECT c.project_id, COALESCE(NULLIF(c.title,''),'Nova mensagem no chat') INTO project_key,item_title FROM public.marketing_conversations c WHERE c.id=(to_jsonb(NEW)->>'conversation_id')::uuid;
    item_body := left(COALESCE(to_jsonb(NEW)->>'body','Arquivo enviado'),240);
    item_kind := 'message';
    INSERT INTO public.marketing_notifications(user_id,project_id,title,body,url,kind)
      SELECT cm.user_id, project_key, item_title, item_body, '/marketing', item_kind
      FROM public.marketing_conversation_members cm JOIN public.marketing_members mm ON mm.user_id=cm.user_id AND mm.status='active'
      WHERE cm.conversation_id=(to_jsonb(NEW)->>'conversation_id')::uuid AND cm.user_id IS DISTINCT FROM actor;
    RETURN NEW;
  END IF;
  project_key := (to_jsonb(NEW)->>'project_id')::uuid;
  IF TG_TABLE_NAME='marketing_approvals' THEN
    IF TG_OP='INSERT' THEN
      target_user := (to_jsonb(NEW)->>'reviewer_id')::uuid;
      item_title := 'Nova revisão solicitada'; item_body := 'Uma entrega aguarda sua análise.'; item_kind := 'approval';
    ELSIF to_jsonb(OLD)->>'status' IS DISTINCT FROM to_jsonb(NEW)->>'status' THEN
      target_user := (to_jsonb(OLD)->>'requested_by')::uuid;
      item_title := 'Revisão respondida'; item_body := COALESCE(to_jsonb(NEW)->>'feedback','A decisão foi registrada.'); item_kind := 'approval';
    ELSE RETURN NEW;
    END IF;
    IF EXISTS (SELECT 1 FROM public.marketing_members m WHERE m.user_id=target_user AND m.status='active') THEN
      INSERT INTO public.marketing_notifications(user_id,project_id,title,body,url,kind) VALUES(target_user,project_key,item_title,item_body,'/marketing',item_kind);
    END IF;
    RETURN NEW;
  END IF;
  item_title := CASE WHEN TG_TABLE_NAME='marketing_briefs' THEN 'Briefing atualizado' ELSE 'Novo arquivo no projeto' END;
  item_body := CASE WHEN TG_TABLE_NAME='marketing_briefs' THEN COALESCE(to_jsonb(NEW)->>'change_summary','Uma nova versão do briefing foi publicada.') ELSE COALESCE(to_jsonb(NEW)->>'original_name','Um arquivo foi enviado.') END;
  item_kind := CASE WHEN TG_TABLE_NAME='marketing_briefs' THEN 'briefing' ELSE 'file' END;
  INSERT INTO public.marketing_notifications(user_id,project_id,title,body,url,kind)
    SELECT pm.user_id, project_key, item_title, item_body, '/marketing', item_kind
    FROM public.marketing_project_members pm WHERE pm.project_id=project_key AND pm.user_id IS DISTINCT FROM actor;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.marketing_notify_collaborators() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS marketing_messages_notify ON public.marketing_messages;
CREATE TRIGGER marketing_messages_notify AFTER INSERT ON public.marketing_messages FOR EACH ROW EXECUTE FUNCTION private.marketing_notify_collaborators();
DROP TRIGGER IF EXISTS marketing_approvals_notify ON public.marketing_approvals;
CREATE TRIGGER marketing_approvals_notify AFTER INSERT OR UPDATE ON public.marketing_approvals FOR EACH ROW EXECUTE FUNCTION private.marketing_notify_collaborators();
DROP TRIGGER IF EXISTS marketing_briefs_notify ON public.marketing_briefs;
CREATE TRIGGER marketing_briefs_notify AFTER INSERT ON public.marketing_briefs FOR EACH ROW EXECUTE FUNCTION private.marketing_notify_collaborators();
DROP TRIGGER IF EXISTS marketing_files_notify ON public.marketing_files;
CREATE TRIGGER marketing_files_notify AFTER INSERT ON public.marketing_files FOR EACH ROW EXECUTE FUNCTION private.marketing_notify_collaborators();

DO $$ DECLARE tbl text; BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY['marketing_members','marketing_projects','marketing_project_members','marketing_briefs','marketing_tasks','marketing_task_dependencies','marketing_task_comments','marketing_milestones','marketing_conversations','marketing_conversation_members','marketing_messages','marketing_files','marketing_approvals','marketing_events','marketing_notifications'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=tbl) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      END IF;
    END LOOP;
  END IF;
END $$;

