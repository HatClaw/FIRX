import { supabase } from '@/lib/supabase/client';

export type AdminUser = {
  id: string;
  email: string;
  nome: string;
  role: string;
  telefone: string | null;
  ativo: boolean;
  criado_em: string;
  memberships: Array<{ empresa_id: string; empresa_nome: string; role: string }>;
};

export type AdminCompanyOption = { id: string; nome: string };

async function edgeFunctionError(error: Error, fallback: string) {
  const context = (error as Error & { context?: unknown }).context;
  if (context instanceof Response) {
    const payload = await context.clone().json().catch(() => null) as { error?: unknown } | null;
    if (typeof payload?.error === 'string') return payload.error;
  }
  return `${fallback}: ${error.message}`;
}

async function requirePlatformAdmin() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Entre com uma conta administrativa para continuar.');
  const { data: allowed, error: checkError } = await supabase.rpc('is_platform_admin');
  if (checkError) throw new Error(`Não foi possível validar a autorização administrativa: ${checkError.message}`);
  if (allowed !== true) throw new Error('Esta conta não tem permissão de administração da plataforma.');
  return data.user;
}
export class AdminUserService {
  static async list(): Promise<{ users: AdminUser[]; companies: AdminCompanyOption[] }> {
    await requirePlatformAdmin();
    const [profilesResult, membershipsResult, companiesResult] = await Promise.all([
      supabase.from('profiles').select('id,email,nome,role,telefone,ativo,criado_em').order('nome').limit(500),
      supabase.from('empresa_members').select('empresa_id,usuario_id,role,status').eq('status', 'aceito').limit(2000),
      supabase.from('empresas').select('id,nome').order('nome').limit(500),
    ]);
    if (profilesResult.error) throw new Error(`Falha ao listar usuários: ${profilesResult.error.message}`);
    if (membershipsResult.error) throw new Error(`Falha ao listar vínculos: ${membershipsResult.error.message}`);
    if (companiesResult.error) throw new Error(`Falha ao listar empresas: ${companiesResult.error.message}`);
    const companyNames = new Map((companiesResult.data || []).map((company) => [company.id, company.nome]));
    const memberships = new Map<string, AdminUser['memberships']>();
    for (const membership of membershipsResult.data || []) {
      const current = memberships.get(membership.usuario_id) || [];
      current.push({ empresa_id: membership.empresa_id, empresa_nome: companyNames.get(membership.empresa_id) || membership.empresa_id, role: membership.role });
      memberships.set(membership.usuario_id, current);
    }
    const users = (profilesResult.data || []).map((profile) => ({
      ...profile,
      memberships: memberships.get(profile.id) || [],
    })) as AdminUser[];
    return { users, companies: companiesResult.data || [] };
  }

  static async update(id: string, nome: string, telefone: string): Promise<void> {
    const admin = await requirePlatformAdmin();
    const { data, error } = await supabase.from('profiles').update({ nome: nome.trim(), telefone: telefone.trim() || null }).eq('id', id).select('id').maybeSingle();
    if (error) throw new Error(`Falha ao atualizar usuário: ${error.message}`);
    if (!data) throw new Error('Usuário não encontrado ou sem permissão para alterá-lo.');
    await this.audit(admin.id, 'usuario.atualizado', { user_id: id });
  }

  static async create(empresaId: string, email: string, nome: string, metaMensal = 0): Promise<{ emailSent: boolean; message: string }> {
    await requirePlatformAdmin();
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'create', empresaId, email: email.trim(), nome: nome.trim(), metaMensal },
    });
    if (error) throw new Error(await edgeFunctionError(error, 'Falha ao criar usuário'));
    return {
      emailSent: data?.emailSent === true,
      message: typeof data?.message === 'string' ? data.message : 'Cadastro criado. O link de ativação foi enviado ao vendedor.',
    };
  }

  static async delete(empresaId: string, userId: string): Promise<void> {
    await requirePlatformAdmin();
    const { error } = await supabase.functions.invoke('admin-users', { body: { action: 'delete', empresaId, userId } });
    if (error) throw new Error(`Falha ao excluir usuário: ${error.message}`);
  }

  private static async audit(adminUserId: string, action: string, details: Record<string, unknown>) {
    const { error } = await supabase.rpc('admin_log_event', {
      p_action: action,
      p_details: { ...details, admin_user_id: adminUserId },
    });
    if (error) throw new Error(`Operação concluída, mas a auditoria não foi registrada: ${error.message}`);
  }
}
