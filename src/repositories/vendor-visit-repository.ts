import { supabase } from '@/lib/supabase/client';
import type { CreateVendorVisit, VendorVisit, VendorVisitStatus } from '@/lib/vendor-visit-types';

export class VendorVisitRepository {
  static async listForCompany(empresaId: string) {
    const { data, error } = await supabase.from('vendedor_visitas').select('*, vendedores(nome)')
      .eq('empresa_id', empresaId).order('data_hora', { ascending: true });
    if (error) throw new Error(`Falha ao buscar visitas: ${error.message}`);
    return ((data || []) as any[]).map(({ vendedores, ...visit }) => ({ ...visit, vendedor_nome: vendedores?.nome })) as VendorVisit[];
  }

  static async listForSeller(vendedorId: string) {
    const { data, error } = await supabase.from('vendedor_visitas').select('*')
      .eq('vendedor_id', vendedorId).order('data_hora', { ascending: true });
    if (error) throw new Error(`Falha ao buscar suas visitas: ${error.message}`);
    return (data || []) as VendorVisit[];
  }

  static async create(visit: CreateVendorVisit) {
    const { data, error } = await supabase.from('vendedor_visitas').insert(visit).select('*').single();
    if (error) throw new Error(`Falha ao enviar a visita: ${error.message}`);
    return data as VendorVisit;
  }

  static async updateStatus(id: string, status: VendorVisitStatus) {
    const { error } = await supabase.from('vendedor_visitas').update({ status })
      .eq('id', id).select('id').single();
    if (error) throw new Error(`Falha ao atualizar a visita: ${error.message}`);
  }

  static async updateLocation(id: string, latitude: number, longitude: number) {
    const { error } = await supabase.from('vendedor_visitas').update({
      latitude_atual: latitude, longitude_atual: longitude, localizacao_atualizada_em: new Date().toISOString(),
    }).eq('id', id).select('id').single();
    if (error) throw new Error(`Falha ao enviar a localização: ${error.message}`);
  }

  static subscribe(empresaId: string, onChange: () => void) {
    return supabase.channel(`visitas:${empresaId}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'vendedor_visitas', filter: `empresa_id=eq.${empresaId}`,
    }, onChange).subscribe();
  }
}
