import { supabase } from '@/lib/supabase/client';

export type AdminResourceTable = 'empresas' | 'clients' | 'gm_contracts' | 'gm_financial_entries' | 'signature_envelopes';

export type AdminResourceRecord = Record<string, unknown> & { id: string };

export async function requirePlatformAdmin() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Entre com uma conta administrativa para continuar.');
  const { data: isAdmin, error: authorizationError } = await supabase.rpc('is_platform_admin');
  if (authorizationError) throw new Error(`Não foi possível validar a autorização administrativa: ${authorizationError.message}`);
  if (isAdmin !== true) {
    throw new Error('Esta conta não tem permissão de administração da plataforma.');
  }
  return data.user;
}
export class AdminResourceService {
  static async list(table: AdminResourceTable, columns: string, orderColumn: string): Promise<AdminResourceRecord[]> {
    await requirePlatformAdmin();
    const { data, error } = await supabase.from(table).select(columns).order(orderColumn, { ascending: false }).limit(500);
    if (error) throw new Error(`Falha ao listar registros: ${error.message}`);
    return (data || []) as unknown as AdminResourceRecord[];
  }

  static async create(table: AdminResourceTable, values: Record<string, unknown>): Promise<void> {
    const user = await requirePlatformAdmin();
    const payload = { ...values };
    if (table === 'gm_financial_entries' && !payload.criado_por) payload.criado_por = user.id;

    if (table === 'empresas') {
      await this.createEmpresa(payload, user.id);
      return;
    }

    const { data, error } = await supabase.from(table).insert(payload).select('id').single();
    if (error) throw new Error(`Falha ao criar registro: ${error.message}`);
    await this.audit(user.id, 'registro.criado', { tabela: table, registro_id: data.id });
  }

  static async update(table: AdminResourceTable, id: string, values: Record<string, unknown>): Promise<void> {
    const user = await requirePlatformAdmin();
    const payload = { ...values };
    let previousOwnerId: string | null = null;
    let nextOwnerId: string | null = null;

    if (table === 'empresas' && Object.prototype.hasOwnProperty.call(values, 'responsavel_id')) {
      const { data: company, error: readError } = await supabase.from('empresas')
        .select('responsavel_id').eq('id', id).maybeSingle();
      if (readError) throw new Error(`Falha ao carregar empresa: ${readError.message}`);
      if (!company) throw new Error('Empresa não encontrada.');
      previousOwnerId = company.responsavel_id;
      nextOwnerId = typeof values.responsavel_id === 'string' && values.responsavel_id.trim()
        ? values.responsavel_id.trim()
        : user.id;
      payload.responsavel_id = nextOwnerId;
    }

    const { data, error } = await supabase.from(table).update(payload).eq('id', id).select('id').maybeSingle();
    if (error) throw new Error(`Falha ao atualizar registro: ${error.message}`);
    if (!data) throw new Error('Registro não encontrado ou sem permissão para alterá-lo.');

    if (table === 'empresas' && nextOwnerId) {
      try {
        await this.ensureCompanyOwnerMembership(id, nextOwnerId);
      } catch (cause) {
        const { error: rollbackError } = await supabase.from('empresas').update({ responsavel_id: previousOwnerId }).eq('id', id);
        const reason = cause instanceof Error ? cause.message : 'falha ao associar o responsável';
        if (rollbackError) throw new Error(`Empresa atualizada, mas não foi possível vincular o responsável (${reason}); restauração também falhou: ${rollbackError.message}`);
        throw new Error(`Falha ao vincular o responsável; alteração da empresa revertida: ${reason}`);
      }
    }

    await this.audit(user.id, 'registro.atualizado', { tabela: table, registro_id: id, campos: Object.keys(values) });
  }

  static async delete(table: AdminResourceTable, id: string): Promise<void> {
    const user = await requirePlatformAdmin();
    const { data, error } = await supabase.from(table).delete().eq('id', id).select('id').maybeSingle();
    if (error) throw new Error(`Falha ao excluir registro: ${error.message}`);
    if (!data) throw new Error('Registro não encontrado ou sem permissão para excluí-lo.');
    await this.audit(user.id, 'registro.excluido', { tabela: table, registro_id: id });
  }

  private static async audit(adminUserId: string, action: string, details: Record<string, unknown>) {
    const { error } = await supabase.rpc('admin_log_event', {
      p_action: action,
      p_details: { ...details, admin_user_id: adminUserId },
    });
    if (error) throw new Error(`Operação concluída, mas a auditoria não foi registrada: ${error.message}`);
  }

  private static async createEmpresa(values: Record<string, unknown>, adminUserId: string) {
    const responsavelId = typeof values.responsavel_id === 'string' && values.responsavel_id.trim()
      ? values.responsavel_id.trim()
      : adminUserId;
    const { data, error } = await supabase.from('empresas').insert({
      ...values,
      responsavel_id: responsavelId,
      configuracoes: values.configuracoes ?? {},
    }).select('id').single();
    if (error) throw new Error(`Falha ao criar empresa: ${error.message}`);

    try {
      await this.ensureCompanyOwnerMembership(data.id, responsavelId);
    } catch (cause) {
      const { error: rollbackError } = await supabase.from('empresas').delete().eq('id', data.id);
      const reason = cause instanceof Error ? cause.message : 'falha ao associar o responsável';
      if (rollbackError) throw new Error(`Empresa criada, mas falhou o vínculo do responsável (${reason}) e a limpeza do registro também falhou: ${rollbackError.message}`);
      throw new Error(`Falha ao vincular o responsável; empresa recém-criada removida: ${reason}`);
    }

    await this.audit(adminUserId, 'empresa.criada', { tabela: 'empresas', registro_id: data.id, responsavel_id: responsavelId });
  }

  private static async ensureCompanyOwnerMembership(empresaId: string, userId: string) {
    const { error } = await supabase.from('empresa_members').upsert({
      empresa_id: empresaId,
      usuario_id: userId,
      role: 'admin',
      status: 'aceito',
      aceito_em: new Date().toISOString(),
    }, { onConflict: 'empresa_id,usuario_id' });
    if (error) throw new Error(`Falha ao associar o responsável à empresa: ${error.message}`);
  }
}
