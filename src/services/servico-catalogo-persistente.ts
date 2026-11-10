import { supabase } from '@/lib/supabase/client';
import { listServicosCatalogo, type ServicoCatalogo } from '@/lib/contratos-store';

type ServiceRow = {
  id: string; codigo: string; nome: string; categoria: string; condicoes_comerciais: string | null;
  texto_contrato: string | null; valor_base: number; unidade: string; ordem: number; status: string;
  bonus_automatico: boolean; bonus_gatilhos: string[]; contratacao_permitida: boolean;
  bonus_permitido: boolean; exclusao_grupo: string | null;
};

function fromRow(row: ServiceRow): ServicoCatalogo {
  return {
    id: row.id, codigo: row.codigo, nome: row.nome, categoria: row.categoria,
    descricao: row.condicoes_comerciais || '', texto_contrato: row.texto_contrato || '',
    valor: Number(row.valor_base) || 0, tipo: row.unidade === 'mes' ? 'mensal' : 'unico',
    tipo_cobranca: row.unidade === 'mes' ? 'mensal' : 'unico', ordem: row.ordem || 0,
    ativo: row.status === 'ativo', bonus_automatico: row.bonus_automatico,
    bonus_gatilhos: Array.isArray(row.bonus_gatilhos) ? row.bonus_gatilhos : [],
    contratacao_permitida: row.contratacao_permitida, bonus_permitido: row.bonus_permitido,
    exclusaoGrupo: row.exclusao_grupo || undefined,
  };
}

function toRow(companyId: string, service: Omit<ServicoCatalogo, 'id'> & { id?: string; codigo?: string }) {
  return {
    empresa_id: companyId,
    codigo: service.codigo || service.id || crypto.randomUUID(),
    nome: service.nome.trim(), categoria: service.categoria || 'geral',
    condicoes_comerciais: service.descricao || null,
    texto_contrato: service.texto_contrato || null,
    valor_base: Number(service.valor) || 0,
    unidade: (service.tipo_cobranca || service.tipo) === 'mensal' ? 'mes' : 'unidade',
    ordem: Number(service.ordem) || 0,
    status: service.ativo ? 'ativo' : 'inativo',
    bonus_automatico: !!service.bonus_automatico,
    bonus_gatilhos: service.bonus_gatilhos || [],
    contratacao_permitida: service.contratacao_permitida !== false,
    bonus_permitido: service.bonus_permitido !== false,
    exclusao_grupo: service.exclusaoGrupo || null,
  };
}

export async function loadServicosEmpresa(companyId: string): Promise<ServicoCatalogo[]> {
  const { data, error } = await supabase.from('services').select('*').eq('empresa_id', companyId).order('ordem').order('nome');
  if (error) throw new Error(`Falha ao carregar o catálogo: ${error.message}`);
  if ((data || []).length) return (data as ServiceRow[]).map(fromRow);

  const seeds = listServicosCatalogo();
  const { error: seedError } = await supabase.from('services').insert(seeds.map((service) => toRow(companyId, service)));
  if (seedError) throw new Error(`O catálogo inicial não pôde ser salvo no servidor: ${seedError.message}`);
  const { data: inserted, error: reloadError } = await supabase.from('services').select('*').eq('empresa_id', companyId).order('ordem').order('nome');
  if (reloadError) throw new Error(`Falha ao carregar o catálogo salvo: ${reloadError.message}`);

  // Convert legacy default codes used by bonus rules to the new persistent row IDs.
  const codeToId = new Map((inserted || []).map((row: any) => [row.codigo, row.id]));
  const rows = (inserted || []) as ServiceRow[];
  await Promise.all(rows.map(async (row) => {
    const triggers = (row.bonus_gatilhos || []).map((code) => codeToId.get(code) || code);
    if (triggers.some((value, index) => value !== row.bonus_gatilhos[index])) {
      await supabase.from('services').update({ bonus_gatilhos: triggers }).eq('id', row.id).eq('empresa_id', companyId);
      row.bonus_gatilhos = triggers;
    }
  }));
  return rows.map(fromRow);
}

export async function saveServicoEmpresa(companyId: string, service: Omit<ServicoCatalogo, 'id'> & { id?: string; codigo?: string }): Promise<void> {
  const payload = toRow(companyId, service);
  const result = service.id
    ? await supabase.from('services').update(payload).eq('id', service.id).eq('empresa_id', companyId).select('id').maybeSingle()
    : await supabase.from('services').insert(payload).select('id').maybeSingle();
  if (result.error) throw new Error(`Falha ao salvar o serviço: ${result.error.message}`);
  if (!result.data) throw new Error('Nenhum serviço foi salvo; confirme o acesso à empresa.');
}

export async function deleteServicoEmpresa(companyId: string, id: string): Promise<void> {
  const { error } = await supabase.from('services').delete().eq('id', id).eq('empresa_id', companyId);
  if (error) throw new Error(`Falha ao excluir o serviço: ${error.message}`);
}
