import { supabase } from '@/lib/supabase/client';
import type { ClienteLocal } from '@/lib/contratos-store';
import { loadServicosEmpresa } from '@/services/servico-catalogo-persistente';

type ClientRow = { id: string; nome: string; razao_social: string | null; documento: string; email: string | null; telefone: string | null; whatsapp: string | null; endereco: Record<string, string> | null; cep: string | null; tipo: string };

function fromClient(row: ClientRow): ClienteLocal {
  const address = row.endereco || {};
  return {
    id: row.id, razao_social: row.razao_social || row.nome, documento: row.documento,
    email: row.email || '', telefone: row.telefone || '', whatsapp: row.whatsapp || '',
    cidade: address.cidade || '', endereco: address.logradouro || '', numero_endereco: address.numero || '',
    bairro: address.bairro || '', complemento: address.complemento || '', cep: row.cep || address.cep || '',
    estado: address.estado || '', tipo: row.tipo === 'pf' || row.tipo === 'pessoa_fisica' ? 'PF' : 'PJ',
  };
}

function toClient(companyId: string, userId: string, client: Omit<ClienteLocal, 'id'>) {
  return {
    empresa_id: companyId, nome: client.razao_social.trim(), razao_social: client.razao_social.trim(),
    documento: client.documento.trim(), tipo: client.tipo === 'PF' ? 'pf' : 'pj',
    email: client.email.trim() || null, telefone: client.telefone.trim() || null,
    whatsapp: client.whatsapp?.trim() || null, cep: client.cep?.trim() || null,
    endereco: { logradouro: client.endereco || '', numero: client.numero_endereco || '', bairro: client.bairro || '', complemento: client.complemento || '', cidade: client.cidade || '', estado: client.estado || '', cep: client.cep || '' },
    status: 'ativo', atualizado_por: userId, atualizado_em: new Date().toISOString(),
  };
}

export async function loadClientesEmpresa(companyId: string, role?: string, allowLegacyImport = false): Promise<ClienteLocal[]> {
  let { data, error } = await supabase.from('clients').select('id,nome,razao_social,documento,email,telefone,whatsapp,endereco,cep,tipo').eq('empresa_id', companyId).order('criado_em', { ascending: false });
  if (error) throw new Error(`Falha ao carregar clientes: ${error.message}`);
  if (role === 'admin' && allowLegacyImport) {
    try {
      const legacy = JSON.parse(localStorage.getItem('gm_clientes_v1') || '[]') as ClienteLocal[];
      if (legacy.length) {
        const documents = new Set((data || []).map((client) => normalizeClientKey(client.documento)).filter(Boolean));
        const names = new Set((data || []).map((client) => normalizeClientKey(client.razao_social || client.nome)).filter(Boolean));
        const missing = legacy.filter((client) => {
          const document = normalizeClientKey(client.documento);
          const name = normalizeClientKey(client.razao_social);
          const isMissing = document ? !documents.has(document) : !names.has(name);
          if (isMissing) {
            if (document) documents.add(document);
            else if (name) names.add(name);
          }
          return isMissing;
        });
        if (missing.length) {
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (userError || !user) throw new Error('Entre na sua conta para migrar os clientes salvos neste navegador.');
          const { error: importError } = await supabase.from('clients').insert(missing.map((client) => ({ ...toClient(companyId, user.id, client), criado_por: user.id })));
          if (importError) throw new Error(`Falha ao migrar clientes locais para o servidor: ${importError.message}`);
        }
        localStorage.removeItem('gm_clientes_v1');
        ({ data, error } = await supabase.from('clients').select('id,nome,razao_social,documento,email,telefone,whatsapp,endereco,cep,tipo').eq('empresa_id', companyId).order('criado_em', { ascending: false }));
        if (error) throw new Error(`Falha ao recarregar clientes migrados: ${error.message}`);
      }
    } catch (cause) {
      if (cause instanceof Error && (cause.message.startsWith('Falha ao') || cause.message.startsWith('Entre na'))) throw cause;
    }
  }
  return (data || []).map((row) => fromClient(row as ClientRow));
}

function normalizeClientKey(value: string | null | undefined) {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\D/g, '')
    || (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

export async function saveClienteEmpresa(companyId: string, userId: string, client: Omit<ClienteLocal, 'id'>, id?: string): Promise<ClienteLocal> {
  const payload = toClient(companyId, userId, client);
  const result = id
    ? await supabase.from('clients').update(payload).eq('id', id).eq('empresa_id', companyId).select('id,nome,razao_social,documento,email,telefone,whatsapp,endereco,cep,tipo').maybeSingle()
    : await supabase.from('clients').insert({ ...payload, criado_por: userId }).select('id,nome,razao_social,documento,email,telefone,whatsapp,endereco,cep,tipo').maybeSingle();
  if (result.error) throw new Error(`Falha ao salvar cliente: ${result.error.message}`);
  if (!result.data) throw new Error('Nenhum cliente foi salvo; verifique seu acesso à empresa.');
  return fromClient(result.data as ClientRow);
}

export { loadServicosEmpresa };
