import { supabase } from '@/lib/supabase/client';
import type { CreateServicoData, UpdateServicoData, Servico, ServicoStatus } from '@/lib/servico-types';
import type { PaginatedResult } from '@/lib/contrato-types';

interface FiltrosEmpresa {
  empresaId: string;
  busca?: string;
  categoria?: string;
  status?: ServicoStatus;
  page?: number;
  limit?: number;
}

export class ServicoRepository {
  static async create(data: CreateServicoData, userId: string): Promise<Servico> {
    const { data: servico, error } = await supabase
      .from('services')
      .insert({
        ...data,
        criado_por: userId,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Falha ao criar servico: ${error.message}`);
    return servico as unknown as Servico;
  }

  static async findById(id: string, empresaId: string): Promise<Servico | null> {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(`Falha ao buscar servico: ${error.message}`);
    return (data as unknown as Servico) || null;
  }

  static async findByCodigo(codigo: string, empresaId: string): Promise<Servico | null> {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('codigo', codigo)
      .eq('empresa_id', empresaId)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(`Falha ao buscar servico: ${error.message}`);
    return (data as unknown as Servico) || null;
  }

  static async findMany(filtros: FiltrosEmpresa): Promise<PaginatedResult<Servico>> {
    const page = filtros.page || 1;
    const limit = filtros.limit || 20;
    const offset = (page - 1) * limit;

    let query = supabase.from('services').select('*', { count: 'exact' }).eq('empresa_id', filtros.empresaId);

    if (filtros.status) query = query.eq('status', filtros.status);
    if (filtros.categoria) query = query.eq('categoria', filtros.categoria);

    if (filtros.busca) {
      query = query.or(`nome.ilike.%${filtros.busca}%,codigo.ilike.%${filtros.busca}%,categoria.ilike.%${filtros.busca}%`);
    }

    query = query.order('nome', { ascending: true });
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw new Error(`Falha ao buscar servicos: ${error.message}`);

    return {
      data: (data as unknown as Servico[]) || [],
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    };
  }

  static async update(id: string, empresaId: string, data: UpdateServicoData, _userId: string): Promise<Servico> {
    const { data: servico, error } = await supabase
      .from('services')
      .update({
        ...data,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    if (error) throw new Error(`Falha ao atualizar servico: ${error.message}`);
    return servico as unknown as Servico;
  }

  static async delete(id: string, empresaId: string): Promise<void> {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId);

    if (error) throw new Error(`Falha ao excluir servico: ${error.message}`);
  }

  static async getCategoriaStats(empresaId: string): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('services')
      .select('categoria')
      .eq('empresa_id', empresaId);

    if (error) throw new Error(`Falha ao buscar estatisticas: ${error.message}`);

    const stats: Record<string, number> = {};
    (data as unknown as { categoria: string }[]).forEach((s) => {
      stats[s.categoria] = (stats[s.categoria] || 0) + 1;
    });
    return stats;
  }
}
