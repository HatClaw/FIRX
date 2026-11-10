import { supabase, getCurrentUser } from '@/lib/supabase/client';

export type MarketingRole = 'admin' | 'gestor' | 'desenvolvedor' | 'designer' | 'copywriter' | 'trafego';
export type MarketingStatus = 'nao_iniciado' | 'briefing_pendente' | 'pronto' | 'em_andamento' | 'aguardando_informacoes' | 'em_revisao' | 'aguardando_aprovacao' | 'ajustes_solicitados' | 'aprovado' | 'concluido' | 'pausado' | 'cancelado';
export type MarketingPriority = 'baixa' | 'normal' | 'alta' | 'urgente';

export interface MarketingMember {
  user_id: string;
  nome: string;
  email: string;
  role: MarketingRole;
  status: 'active' | 'inactive';
  permission_overrides?: Record<string, boolean>;
}

export interface MarketingProject {
  id: string;
  name: string;
  code: string | null;
  client_label: string | null;
  empresa_id: string | null;
  client_id: string | null;
  objective: string;
  scope: string;
  description: string;
  owner_id: string | null;
  status: MarketingStatus;
  priority: MarketingPriority;
  starts_at: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingTask {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: MarketingStatus;
  priority: MarketingPriority;
  progress: number;
  assignee_id: string | null;
  due_at: string | null;
  created_at: string;
}

export interface MarketingMilestone {
  id: string;
  project_id: string;
  title: string;
  starts_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  assignee_id: string | null;
  created_at: string;
}

export interface MarketingNotification {
  id: string;
  project_id: string | null;
  title: string;
  body: string;
  url: string;
  kind: string;
  read_at: string | null;
  created_at: string;
}

export interface MarketingProjectMember {
  project_id: string;
  user_id: string;
  project_role: string;
}

export interface MarketingWorkspaceData {
  member: MarketingMember | null;
  members: MarketingMember[];
  projects: MarketingProject[];
  tasks: MarketingTask[];
  projectMembers: MarketingProjectMember[];
  notifications: MarketingNotification[];
  canManage: boolean;
  canManageTeam: boolean;
  canManageTasks: boolean;
  canUpdateTasks: boolean;
  canManageReviews: boolean;
  canRequestReviews: boolean;
  canManageFiles: boolean;
  canUploadFiles: boolean;
  canComment: boolean;
  canSendMessages: boolean;
  canViewReports: boolean;
}

type Row = Record<string, any>;
const marketingClient = supabase as any;

function fail(context: string, error: { message: string } | null) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export class MarketingService {
  static async isAuthorized(): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_marketing_member');
    if (error) throw new Error(`Não foi possível validar o acesso à Central de Marketing: ${error.message}`);
    return data === true;
  }

  static async loadWorkspace(): Promise<MarketingWorkspaceData> {
    const user = await getCurrentUser();
    if (!user) throw new Error('Entre no sistema para acessar a Central de Marketing.');
    const [memberResult, membersResult, projectsResult, tasksResult, projectMemberResult, notificationsResult, ...permissionResults] = await Promise.all([
      marketingClient.from('marketing_members').select('user_id,nome,email,role,status,permission_overrides').eq('user_id', user.id).maybeSingle(),
      marketingClient.from('marketing_members').select('user_id,nome,email,role,status,permission_overrides').order('nome').limit(500),
      marketingClient.from('marketing_projects').select('*').order('updated_at', { ascending: false }).limit(500),
      marketingClient.from('marketing_tasks').select('id,project_id,title,description,status,priority,progress,assignee_id,due_at,created_at').order('due_at', { ascending: true }).limit(1000),
      marketingClient.from('marketing_project_members').select('project_id,user_id,project_role').limit(2000),
      marketingClient.from('marketing_notifications').select('id,project_id,title,body,url,kind,read_at,created_at').order('created_at', { ascending: false }).limit(50),
      ...['projects.manage','team.manage','tasks.manage','tasks.update','reviews.manage','reviews.request','files.manage','files.upload','comments.create','chat.send','reports.view'].map((permission) => supabase.rpc('marketing_has_permission', { p_permission: permission })),
    ]);
    fail('Falha ao carregar perfil de Marketing', memberResult.error);
    fail('Falha ao carregar equipe', membersResult.error);
    fail('Falha ao carregar projetos', projectsResult.error);
    fail('Falha ao carregar tarefas', tasksResult.error);
    fail('Falha ao carregar participantes dos projetos', projectMemberResult.error);
    fail('Falha ao carregar notificações', notificationsResult.error);
    // RLS remains authoritative for every write; these flags only shape the interface.
    const [canManage, canManageTeam, canManageTasks, canUpdateTasks, canManageReviews, canRequestReviews, canManageFiles, canUploadFiles, canComment, canSendMessages, canViewReports] = permissionResults.map((result: { data: unknown; error: { message: string } | null }) => !result.error && result.data === true);
    return {
      member: memberResult.data as MarketingMember | null,
      members: (membersResult.data || []) as MarketingMember[],
      projects: (projectsResult.data || []) as MarketingProject[],
      tasks: (tasksResult.data || []) as MarketingTask[],
      projectMembers: (projectMemberResult.data || []) as MarketingProjectMember[],
      notifications: (notificationsResult.data || []) as MarketingNotification[],
      canManage,
      canManageTeam,
      canManageTasks,
      canUpdateTasks,
      canManageReviews,
      canRequestReviews,
      canManageFiles,
      canUploadFiles,
      canComment,
      canSendMessages,
      canViewReports,
    };
  }

  static async createProject(input: Pick<MarketingProject, 'name' | 'client_label' | 'objective' | 'scope' | 'description' | 'status' | 'priority' | 'starts_at' | 'due_at'>, memberIds: string[]) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await marketingClient.from('marketing_projects').insert({ ...input, created_by: user.id, owner_id: user.id }).select('*').single();
    fail('Falha ao criar projeto', error);
    const { data: selfMembership } = await marketingClient.from('marketing_members').select('status').eq('user_id', user.id).maybeSingle();
    const assigned = Array.from(new Set([...memberIds, ...(selfMembership?.status === 'active' ? [user.id] : [])]));
    const { error: memberError } = assigned.length ? await marketingClient.from('marketing_project_members').insert(assigned.map((userId) => ({ project_id: data.id, user_id: userId, project_role: userId === user.id ? 'owner' : 'contributor' }))) : { error: null };
    if (memberError) {
      await marketingClient.from('marketing_projects').delete().eq('id', data.id);
      throw new Error(`Projeto criado sem conseguir atribuir toda a equipe: ${memberError.message}`);
    }
    return data as MarketingProject;
  }

  static async updateProject(projectId: string, patch: Partial<Pick<MarketingProject, 'name' | 'client_label' | 'objective' | 'scope' | 'description' | 'status' | 'priority' | 'starts_at' | 'due_at' | 'owner_id'>>) {
    const { data, error } = await marketingClient.from('marketing_projects').update(patch).eq('id', projectId).select('*').maybeSingle();
    fail('Falha ao atualizar projeto', error);
    if (!data) throw new Error('Projeto não encontrado ou sem permissão para editar.');
    return data as MarketingProject;
  }

  static async assignProjectMember(projectId: string, userId: string, assigned: boolean) {
    const query = assigned
      ? marketingClient.from('marketing_project_members').upsert({ project_id: projectId, user_id: userId, project_role: 'contributor' }, { onConflict: 'project_id,user_id' })
      : marketingClient.from('marketing_project_members').delete().eq('project_id', projectId).eq('user_id', userId);
    const { error } = await query;
    fail('Falha ao atualizar equipe do projeto', error);
  }

  static async createTask(input: Pick<MarketingTask, 'project_id' | 'title' | 'description' | 'status' | 'priority' | 'assignee_id' | 'due_at'>) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Sessão expirada. Entre novamente.');
    const { data, error } = await marketingClient.from('marketing_tasks').insert({ ...input, created_by: user.id }).select('*').single();
    fail('Falha ao criar tarefa', error);
    return data as MarketingTask;
  }

  static async milestones(projectId: string) {
    const { data, error } = await marketingClient.from('marketing_milestones')
      .select('id,project_id,title,starts_at,due_at,completed_at,assignee_id,created_at')
      .eq('project_id', projectId).order('due_at', { ascending: true, nullsFirst: false });
    fail('Falha ao carregar marcos do projeto', error);
    return (data || []) as MarketingMilestone[];
  }

  static async createMilestone(projectId: string, title: string, dueAt: string | null, assigneeId: string | null) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Sessão expirada. Entre novamente.');
    const { error } = await marketingClient.from('marketing_milestones').insert({
      project_id: projectId, title: title.trim(), due_at: dueAt || null, assignee_id: assigneeId || null, created_by: user.id,
    });
    fail('Falha ao criar marco do projeto', error);
  }

  static async updateMilestone(id: string, patch: { completed_at: string | null }) {
    const { data, error } = await marketingClient.from('marketing_milestones').update(patch).eq('id', id).select('id').maybeSingle();
    fail('Falha ao atualizar marco do projeto', error);
    if (!data) throw new Error('Marco não encontrado ou sem permissão para alterar.');
  }

  static async updateTask(taskId: string, patch: Partial<Pick<MarketingTask, 'title' | 'description' | 'status' | 'priority' | 'progress' | 'assignee_id' | 'due_at'>>) {
    const progress = patch.status === 'concluido' ? 100 : patch.progress;
    const completedAt = patch.status === 'concluido' ? new Date().toISOString() : patch.status ? null : undefined;
    const { data, error } = await marketingClient.from('marketing_tasks').update({ ...patch, ...(progress === undefined ? {} : { progress }), ...(completedAt === undefined ? {} : { completed_at: completedAt }) }).eq('id', taskId).select('*').maybeSingle();
    fail('Falha ao atualizar tarefa', error);
    if (!data) throw new Error('Tarefa não encontrada ou sem permissão para alterar.');
    return data as MarketingTask;
  }

  static async addComment(taskId: string, body: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Sessão expirada. Entre novamente.');
    const { error } = await marketingClient.from('marketing_task_comments').insert({ task_id: taskId, author_id: user.id, body: body.trim() });
    fail('Falha ao comentar tarefa', error);
  }

  static async comments(taskId: string) {
    const { data, error } = await marketingClient.from('marketing_task_comments').select('id,author_id,body,created_at').eq('task_id', taskId).order('created_at');
    fail('Falha ao carregar comentários', error);
    return (data || []) as Array<{ id: string; author_id: string; body: string; created_at: string }>;
  }

  static async requestApproval(projectId: string, taskId: string | null, reviewerId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Sessão expirada. Entre novamente.');
    const { error } = await marketingClient.from('marketing_approvals').insert({ project_id: projectId, task_id: taskId, requested_by: user.id, reviewer_id: reviewerId, status: 'pending' });
    fail('Falha ao solicitar revisão', error);
  }

  static async approvals(projectId: string) {
    const { data, error } = await marketingClient.from('marketing_approvals').select('id,task_id,file_id,requested_by,reviewer_id,status,feedback,requested_at,resolved_at').eq('project_id', projectId).order('requested_at', { ascending: false });
    fail('Falha ao carregar revisões', error);
    return (data || []) as Array<Record<string, any>>;
  }

  static async resolveApproval(id: string, status: 'approved' | 'changes_requested', feedback: string) {
    const { error } = await marketingClient.from('marketing_approvals').update({ status, feedback: feedback.trim(), resolved_at: new Date().toISOString() }).eq('id', id);
    fail('Falha ao atualizar revisão', error);
  }

  static async projectEvents(projectId: string) {
    const { data, error } = await marketingClient.from('marketing_events').select('id,actor_id,action,entity_type,entity_id,summary,details,created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(100);
    fail('Falha ao carregar histórico', error);
    return (data || []) as Array<Record<string, any>>;
  }

  static async projectFiles(projectId: string) {
    const { data, error } = await marketingClient.from('marketing_files').select('id,project_id,task_id,uploaded_by,storage_name,original_name,content_type,size_bytes,category,version,created_at').eq('project_id', projectId).order('created_at', { ascending: false });
    fail('Falha ao carregar arquivos', error);
    return (data || []) as Array<Record<string, any>>;
  }

  static async uploadFile(projectId: string, file: File, category: string, taskId?: string) {
    if (file.size > 100 * 1024 * 1024) throw new Error('O arquivo excede o limite de 100 MB.');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sessão expirada. Entre novamente.');
    const body = new FormData();
    body.set('action', 'upload');
    body.set('project_id', projectId);
    if (taskId) body.set('task_id', taskId);
    body.set('category', category);
    body.set('file', file);
    const response = await fetch(`${import.meta.env.BASE_URL}api/marketing-files.php`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Não foi possível enviar o arquivo para o servidor da hospedagem.');
    return typeof result.id === 'string' ? result.id : null;
  }

  static async downloadFile(id: string, disposition: 'inline' | 'attachment' = 'attachment') {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sessão expirada. Entre novamente.');
    const response = await fetch(`${import.meta.env.BASE_URL}api/marketing-files.php?action=download&id=${encodeURIComponent(id)}&disposition=${disposition}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Não foi possível acessar o arquivo.');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/i)?.[1] || 'arquivo';
    link.target = disposition === 'inline' ? '_blank' : '_self';
    if (disposition === 'inline') link.rel = 'noopener';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  static async deleteFile(id: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sessão expirada. Entre novamente.');
    const response = await fetch(`${import.meta.env.BASE_URL}api/marketing-files.php?action=delete&id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Não foi possível excluir o arquivo.');
  }

  static async saveBrief(projectId: string, content: Record<string, unknown>, changeSummary: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Sessão expirada. Entre novamente.');
    const { data: latest, error: latestError } = await marketingClient.from('marketing_briefs').select('version').eq('project_id', projectId).order('version', { ascending: false }).limit(1).maybeSingle();
    fail('Falha ao consultar versão do briefing', latestError);
    const { error } = await marketingClient.from('marketing_briefs').insert({ project_id: projectId, version: (latest?.version || 0) + 1, content, change_summary: changeSummary, created_by: user.id });
    fail('Falha ao salvar briefing', error);
  }

  static async loadBrief(projectId: string) {
    const { data, error } = await marketingClient.from('marketing_briefs').select('*').eq('project_id', projectId).order('version', { ascending: false }).limit(1).maybeSingle();
    fail('Falha ao carregar briefing', error);
    return data as Row | null;
  }

  static async openProjectChat(projectId: string) {
    const { data, error } = await supabase.rpc('marketing_open_project_conversation', { p_project_id: projectId });
    fail('Falha ao abrir chat do projeto', error);
    return data as string;
  }

  static async sendMessage(conversationId: string, body: string, attachmentId?: string | null) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Sessão expirada. Entre novamente.');
    const { error } = await marketingClient.from('marketing_messages').insert({ conversation_id: conversationId, sender_id: user.id, body: body.trim(), attachment_id: attachmentId || null });
    fail('Falha ao enviar mensagem', error);
  }

  static async loadMessages(conversationId: string) {
    const { data, error } = await marketingClient.from('marketing_messages').select('id,sender_id,body,attachment_id,created_at').eq('conversation_id', conversationId).order('created_at').limit(300);
    fail('Falha ao carregar conversa', error);
    return (data || []) as Array<{ id: string; sender_id: string; body: string; attachment_id: string | null; created_at: string }>;
  }

  static async markNotificationRead(id: string) {
    const { error } = await marketingClient.from('marketing_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    fail('Falha ao atualizar notificação', error);
  }

  static async upsertMember(userId: string, nome: string, email: string, role: MarketingRole, active: boolean, overrides: Record<string, boolean> = {}) {
    const actor = await getCurrentUser();
    if (!actor) throw new Error('Sessão expirada. Entre novamente.');
    const { data: current, error: readError } = await marketingClient.from('marketing_members').select('user_id').eq('user_id', userId).maybeSingle();
    fail('Falha ao verificar integrante', readError);
    const values = { nome: nome.trim(), email: email.trim().toLowerCase(), role, status: active ? 'active' : 'inactive', permission_overrides: overrides, updated_at: new Date().toISOString() };
    const { error } = current
      ? await marketingClient.from('marketing_members').update(values).eq('user_id', userId)
      : await marketingClient.from('marketing_members').insert({ ...values, user_id: userId, invited_by: actor.id });
    fail('Falha ao atualizar integrante', error);
  }

  static async directory() {
    const { data, error } = await supabase.rpc('marketing_available_users');
    fail('Falha ao pesquisar usuários existentes', error);
    return (data || []) as Array<{ id: string; nome: string; email: string }>;
  }

  static async inviteMember(input: { nome: string; email: string; role: MarketingRole }) {
    const { data, error } = await supabase.functions.invoke('marketing-invite', { body: input });
    if (error) {
      const context = (error as Error & { context?: unknown }).context;
      const payload = context instanceof Response
        ? await context.clone().json().catch(() => null) as { error?: unknown } | null
        : null;
      throw new Error(typeof payload?.error === 'string' ? payload.error : error.message || 'Falha ao enviar o convite.');
    }
    return data as { ok: boolean; userId: string; message: string };
  }

  static subscribe(onChange: () => void) {
    const channel = supabase.channel('marketing-workspace')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_projects' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_project_members' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_members' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_briefs' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_tasks' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_task_dependencies' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_task_comments' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_files' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_milestones' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_messages' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_approvals' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_events' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_notifications' }, onChange)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }
}

