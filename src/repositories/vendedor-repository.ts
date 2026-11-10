import { supabase } from '@/lib/supabase/client';
import type { CreateVendedorData, UpdateVendedorData, Vendedor, DesempenhoVendedor } from '@/lib/servico-types';
import type { PaginatedResult } from '@/lib/client-types';

interface FiltrosVendedor {
  empresaId: string;
  busca?: string;
  status?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export class VendedorRepository {
  static async create(data: CreateVendedorData, userId: string): Promise<Vendedor> {
    const { data: vendedor, error } = await supabase
      .from('vendedores')
      .insert({
        ...data,
        criado_por: userId,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Falha ao criar vendedor: ${error.message}`);
    return vendedor as unknown as Vendedor;
  }

  static async findById(id: string, empresaId: string): Promise<Vendedor | null> {
    const { data, error } = await supabase
      .from('vendedores')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(`Falha ao buscar vendedor: ${error.message}`);
    return (data as unknown as Vendedor) || null;
  }

  static async findByDocumento(documento: string, empresaId: string): Promise<Vendedor | null> {
    const { data, error } = await supabase
      .from('vendedores')
      .select('*')
      .eq('identificador_interno', documento)
      .eq('empresa_id', empresaId)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(`Falha ao buscar vendedor: ${error.message}`);
    return (data as unknown as Vendedor) || null;
  }

  static async findMany(filtros: FiltrosVendedor): Promise<PaginatedResult<Vendedor>> {
    const page = filtros.page || 1;
    const limit = filtros.limit || 20;
    const offset = (page - 1) * limit;

    let query = supabase.from('vendedores').select('*', { count: 'exact' }).eq('empresa_id', filtros.empresaId);

    if (filtros.status) query = query.eq('status', filtros.status);
    if (filtros.role) query = query.eq('role', filtros.role);

    if (filtros.busca) {
      query = query.or(`nome.ilike.%${filtros.busca}%,email.ilike.%${filtros.busca}%,identificador_interno.ilike.%${filtros.busca}%`);
    }

    query = query.order('nome', { ascending: true });
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw new Error(`Falha ao buscar vendedores: ${error.message}`);

    return {
      data: (data as unknown as Vendedor[]) || [],
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    };
  }

  static async update(id: string, empresaId: string, data: UpdateVendedorData, userId: string): Promise<Vendedor> {
    const { data: vendedor, error } = await supabase
      .from('vendedores')
      .update({
        ...data,
        atualizado_por: userId,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    if (error) throw new Error(`Falha ao atualizar vendedor: ${error.message}`);
    return vendedor as unknown as Vendedor;
  }

  static async delete(id: string, empresaId: string): Promise<void> {
    const { error } = await supabase
      .from('vendedores')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId);

    if (error) throw new Error(`Falha ao excluir vendedor: ${error.message}`);
  }

  static async getDesempenho(vendedorId: string, empresaId: string, periodo: string): Promise<DesempenhoVendedor> {
    const { data, error } = await supabase
      .from('vendedor_desempenho')
      .select('*')
      .eq('vendedor_id', vendedorId)
      .eq('empresa_id', empresaId)
      .eq('periodo', periodo)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(`Falha ao buscar desempenho: ${error.message}`);

    const row = (data as any) || {};
    return {
      vendedor_id: vendedorId,
      periodo,
      contratos_criados: row.contratos_criados || 0,
      contratos_assinados: row.contratos_assinados || 0,
      valor_total_contratos: row.valor_total_contratos || 0,
      valor_recebido: row.valor_recebido || 0,
      comissao_calculada: row.comissao_calculada || 0,
      meta_alcancada: row.meta_alcancada || 0,
      percentual_meta: row.percentual_meta || 0,
    };
  }

  static async getComissoes(vendedorId: string, empresaId: string, periodo: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('comissoes')
      .select('*')
      .eq('vendedor_id', vendedorId)
      .eq('empresa_id', empresaId)
      .eq('periodo', periodo);

    if (error) throw new Error(`Falha ao buscar comissoes: ${error.message}`);
    return (data as unknown as any[]) || [];
  }
}
