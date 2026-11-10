import { supabase } from '@/lib/supabase/client';
import type { CreateClienteData, UpdateClienteData, FiltrosCliente, Cliente, PaginatedResult, ClienteHistorico } from '@/lib/client-types';

export class ClientRepository {
  static async create(data: CreateClienteData, userId: string): Promise<Cliente> {
    const { empresa_id, nome, razao_social, tipo, documento, email, telefone, whatsapp, cep, endereco, responsavel, status, observacoes } = data;
    const { data: cliente, error } = await supabase
      .from('clients')
      .insert({
        empresa_id,
        nome,
        razao_social,
        tipo,
        documento,
        email,
        telefone,
        whatsapp,
        cep,
        endereco,
        responsavel,
        status: status || 'ativo',
        observacoes,
        criado_por: userId,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Falha ao criar cliente: ${error.message}`);
    if (!cliente) throw new Error('Falha ao criar cliente: resposta vazia do servidor');
    return cliente as unknown as Cliente;
  }

  static async findById(id: string, empresaId: string): Promise<Cliente | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw new Error(`Falha ao buscar cliente: ${error.message}`);
    return (data as unknown as Cliente) || null;
  }

  static async findByDocumento(documento: string, empresaId: string): Promise<Cliente | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('documento', documento)
      .eq('empresa_id', empresaId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw new Error(`Falha ao buscar cliente: ${error.message}`);
    return (data as unknown as Cliente) || null;
  }

  static async findMany(filtros: FiltrosCliente & { empresa_id: string }): Promise<PaginatedResult<Cliente>> {
    const page = Math.max(1, Math.floor(filtros.page || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(filtros.limit || 20)));
    const offset = (page - 1) * limit;

    let query = supabase.from('clients').select('*', { count: 'exact' }).eq('empresa_id', filtros.empresa_id);

    if (filtros.status) query = query.eq('status', filtros.status);
    if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
    if (filtros.responsavel) query = query.eq('responsavel', filtros.responsavel);

    if (filtros.busca?.trim()) {
      const busca = filtros.busca.trim().replace(/[%,()]/g, ' ').replace(/\s+/g, ' ');
      query = query.or(`nome.ilike.%${busca}%,documento.ilike.%${busca}%,email.ilike.%${busca}%`);
    }

    const orderColumn = filtros.order_by === 'nome' ? 'nome'
      : filtros.order_by === 'atualizado_em' ? 'atualizado_em'
      : 'criado_em';
    const orderDir = filtros.order_dir || 'desc';

    query = query.order(orderColumn, { ascending: orderDir === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw new Error(`Falha ao buscar clientes: ${error.message}`);

    return {
      data: (data as unknown as Cliente[]) || [],
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    };
  }

  static async update(id: string, empresaId: string, data: UpdateClienteData, userId: string): Promise<Cliente> {
    const { data: cliente, error } = await supabase
      .from('clients')
      .update({
        ...data,
        atualizado_por: userId,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .maybeSingle();

    if (error) throw new Error(`Falha ao atualizar cliente: ${error.message}`);
    if (!cliente) throw new Error('Cliente nao encontrado nesta empresa');
    return cliente as unknown as Cliente;
  }

  static async delete(id: string, empresaId: string): Promise<void> {
    const { data, error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select('id');

    if (error) throw new Error(`Falha ao excluir cliente: ${error.message}`);
    if (!data?.length) throw new Error('Cliente nao encontrado nesta empresa');
  }

  static async archive(id: string, empresaId: string, userId: string): Promise<Cliente> {
    return this.update(id, empresaId, { status: 'arquivado' }, userId);
  }

  static async getHistorico(clienteId: string, empresaId: string): Promise<ClienteHistorico[]> {
    const { data, error } = await supabase
      .from('client_historico')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('empresa_id', empresaId)
      .order('criado_em', { ascending: false });

    if (error) throw new Error(`Falha ao buscar historico: ${error.message}`);
    return (data as unknown as ClienteHistorico[]) || [];
  }

  static async addHistorico(clienteId: string, empresaId: string, acao: string, detalhes: string, userId: string): Promise<void> {
    const { error } = await supabase.from('client_historico').insert({
      cliente_id: clienteId,
      empresa_id: empresaId,
      acao,
      detalhes,
      usuario_id: userId,
      criado_em: new Date().toISOString(),
    });

    if (error) throw new Error(`Falha ao registrar historico: ${error.message}`);
  }
}
