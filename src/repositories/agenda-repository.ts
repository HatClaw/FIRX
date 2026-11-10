import { supabase } from '@/lib/supabase/client';
import type { CreateCompromissoData, UpdateCompromissoData, AgendaCompromisso, AgendaHistorico, AgendaTipo, AgendaStatus, ConflitoVerificado } from '@/lib/agenda-types';
import type { PaginatedResult } from '@/lib/contrato-types';

interface Filtros {
  empresaId: string;
  responsavel_id?: string;
  cliente_id?: string;
  status?: AgendaStatus;
  tipo?: AgendaTipo;
  data_init?: string;
  data_fim?: string;
  page?: number;
  limit?: number;
}

export class AgendaRepository {
  static async create(data: CreateCompromissoData, userId: string): Promise<AgendaCompromisso> {
    const { data: comp, error } = await supabase
      .from('agenda')
      .insert({
        ...data,
        criado_por: userId,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Falha ao criar compromisso: ${error.message}`);
    return comp as unknown as AgendaCompromisso;
  }

  static async findById(id: string, empresaId: string): Promise<AgendaCompromisso | null> {
    const { data, error } = await supabase
      .from('agenda')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(`Falha ao buscar compromisso: ${error.message}`);
    return (data as unknown as AgendaCompromisso) || null;
  }

  static async findMany(filtros: Filtros): Promise<PaginatedResult<AgendaCompromisso>> {
    const page = filtros.page || 1;
    const limit = filtros.limit || 20;
    const offset = (page - 1) * limit;

    let query = supabase.from('agenda').select('*', { count: 'exact' }).eq('empresa_id', filtros.empresaId);

    if (filtros.responsavel_id) query = query.eq('responsavel_id', filtros.responsavel_id);
    if (filtros.cliente_id) query = query.eq('cliente_id', filtros.cliente_id);
    if (filtros.status) query = query.eq('status', filtros.status);
    if (filtros.tipo) query = query.eq('tipo', filtros.tipo);

    if (filtros.data_init) query = query.gte('data_hora', filtros.data_init);
    if (filtros.data_fim) query = query.lte('data_hora', filtros.data_fim);

    query = query.order('data_hora', { ascending: true });
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw new Error(`Falha ao buscar compromissos: ${error.message}`);

    return {
      data: (data as unknown as AgendaCompromisso[]) || [],
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    };
  }

  static async update(id: string, empresaId: string, data: UpdateCompromissoData, _userId: string): Promise<AgendaCompromisso> {
    const { data: comp, error } = await supabase
      .from('agenda')
      .update({ ...data, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    if (error) throw new Error(`Falha ao atualizar compromisso: ${error.message}`);
    return comp as unknown as AgendaCompromisso;
  }

  static async delete(id: string, empresaId: string): Promise<void> {
    const { error } = await supabase.from('agenda').delete().eq('id', id).eq('empresa_id', empresaId);
    if (error) throw new Error(`Falha ao excluir compromisso: ${error.message}`);
  }

  static async checkConflict(empresaId: string, responsavelId: string, dataHora: string, duracaoMinutos: number, excludeId?: string): Promise<ConflitoVerificado> {
    const dataFim = new Date(new Date(dataHora).getTime() + duracaoMinutos * 60000).toISOString();

    let query = supabase
      .from('agenda')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('responsavel_id', responsavelId)
      .lt('data_hora', dataFim)
      .gt('data_fim', dataHora);

    if (excludeId) query = query.neq('id', excludeId);

    const { data, error } = await query;
    if (error) throw new Error(`Falha ao verificar conflito: ${error.message}`);

    if (data && data.length > 0) {
      return { conflito: true, compromisso: data[0] as unknown as AgendaCompromisso };
    }
    return { conflito: false };
  }

  static async getHistorico(compromissoId: string, empresaId: string): Promise<AgendaHistorico[]> {
    const { data, error } = await supabase
      .from('agenda_historico')
      .select('*')
      .eq('compromisso_id', compromissoId)
      .eq('empresa_id', empresaId)
      .order('criado_em', { ascending: false });

    if (error) throw new Error(`Falha ao buscar historico: ${error.message}`);
    return (data as unknown as AgendaHistorico[]) || [];
  }

  static async addHistorico(compromissoId: string, empresaId: string, acao: string, detalhes: string, statusAnterior: string | undefined, statusNovo: string | undefined, userId: string): Promise<void> {
    const { error } = await supabase.from('agenda_historico').insert({
      compromisso_id: compromissoId,
      empresa_id: empresaId,
      acao,
      detalhes,
      status_anterior: statusAnterior,
      status_novo: statusNovo,
      usuario_id: userId,
      criado_em: new Date().toISOString(),
    });

    if (error) throw new Error(`Falha ao registrar historico: ${error.message}`);
  }
}
