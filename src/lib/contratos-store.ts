/** Catálogo local e persistência remota de contratos do GrowMoney. */
import { supabase } from '@/lib/supabase/client';

export type ClienteLocal = {
  id: string;
  razao_social: string;
  documento: string;
  email: string;
  telefone: string;
  whatsapp?: string;
  cidade?: string;
  endereco?: string;
  numero_endereco?: string;
  bairro?: string;
  complemento?: string;
  cep?: string;
  estado?: string;
  tipo: 'PF' | 'PJ';
};

export type ServicoCatalogo = {
  id: string;
  codigo?: string;
  nome: string;
  categoria: string;
  descricao?: string;
  texto_contrato?: string;
  valor: number;
  tipo: 'unico' | 'mensal';
  tipo_cobranca?: 'unico' | 'mensal';
  ordem: number;
  ativo: boolean;
  bonus_automatico?: boolean;
  bonus_gatilhos?: string[];
  contratacao_permitida?: boolean;
  bonus_permitido?: boolean;
  exclusaoGrupo?: string;
};

export type ContratoItem = {
  servico_id: string;
  nome: string;
  valor: number;
  tipo: 'unico' | 'mensal';
  isBonus: boolean;
  quantidade: number;
  valor_total?: number;
  valor_comercial_total?: number;
  prazo_meses?: number;
};

export type ContratoLocal = {
  id: string;
  empresa_id?: string;
  numero: number;
  client_id: string;
  cliente_nome: string;
  cliente_documento?: string;
  cliente_email?: string;
  cliente_telefone?: string;
  cliente_whatsapp?: string;
  cliente_endereco?: string;
  cliente_numero_endereco?: string;
  cliente_bairro?: string;
  cliente_complemento?: string;
  cliente_cep?: string;
  cliente_cidade?: string;
  cliente_estado?: string;
  vendedor?: string;
  itens: ContratoItem[];
  unidades: number;
  valor_bruto: number;
  valor: number;
  desconto_valor: number;
  desconto_percentual: number;
  bonus_total: number;
  economia_total?: number;
  valor_sem_beneficios?: number;
  prazo_meses?: number;
  modalidade?: string;
  data_primeira_parcela?: string;
  forma_pagamento: string;
  parcelas: number;
  valor_parcela: number;
  valor_ultima_parcela?: number;
  entrada_valor: number;
  periodicidade: 'mensal' | 'trimestral' | 'semestral' | 'anual' | null;
  plano_recorrente: boolean;
  data_inicio: string;
  data_termino?: string;
  pagamento_observacao?: string;
  pagamento_status?: 'pendente' | 'pago';
  observacoes?: string;
  status: 'rascunho' | 'pendente_assinatura' | 'enviado' | 'assinado' | 'cancelado';
  created_at: string;
};

const K_CLIENTES = 'gm_clientes_v1';
const K_CONTRATOS = 'gm_contratos_v1';
const K_SERVICOS = 'gm_servicos_catalogo_v1';

const DEFAULT_SERVICOS: ServicoCatalogo[] = [
  { id: 'svc-trafego', nome: 'Gestor de tráfego pago', categoria: 'GESTÃO DE TRÁFEGO', valor: 597, tipo: 'mensal', tipo_cobranca: 'mensal', ordem: 1, ativo: true, bonus_permitido: false },
  { id: 'svc-google-perfil', nome: 'Criação/Otimização do perfil do Google Meu Negócio', categoria: 'GOOGLE', valor: 297, tipo: 'mensal', tipo_cobranca: 'mensal', ordem: 2, ativo: true, bonus_permitido: false },
  { id: 'svc-landing', nome: 'Landing Page', categoria: 'GOOGLE', valor: 997, tipo: 'unico', tipo_cobranca: 'unico', ordem: 3, ativo: true, bonus_permitido: false, exclusaoGrupo: 'web' },
  { id: 'svc-site-catalogo', nome: 'Site catálogo', categoria: 'GOOGLE', valor: 2497, tipo: 'unico', tipo_cobranca: 'unico', ordem: 4, ativo: true, bonus_permitido: false },
  { id: 'svc-meta-gestao', nome: 'Gestão de Tráfego Meta Ads', categoria: 'META ADS', valor: 597, tipo: 'mensal', tipo_cobranca: 'mensal', ordem: 5, ativo: true, bonus_permitido: false },
  { id: 'svc-google-ads-gestao', nome: 'Gestão de Tráfego Google Ads', categoria: 'GOOGLE ADS', valor: 697, tipo: 'mensal', tipo_cobranca: 'mensal', ordem: 6, ativo: true, bonus_permitido: false },
  { id: 'svc-loja-virtual', nome: 'Loja Virtual', categoria: 'DIGITAL', valor: 3997, tipo: 'unico', tipo_cobranca: 'unico', ordem: 7, ativo: true, bonus_permitido: false },
  { id: 'svc-site', nome: 'Site institucional', categoria: 'DIGITAL', valor: 1497, tipo: 'unico', tipo_cobranca: 'unico', ordem: 8, ativo: true, bonus_permitido: false, exclusaoGrupo: 'web' },
  { id: 'svc-instagram-reform', nome: 'Reformulação do Instagram', categoria: 'INSTAGRAM', valor: 597, tipo: 'unico', tipo_cobranca: 'unico', ordem: 9, ativo: true, bonus_permitido: false },
  { id: 'bonus-google-cartao', nome: 'Cartão digital Google', categoria: 'GOOGLE', valor: 97, tipo: 'unico', tipo_cobranca: 'unico', ordem: 20, ativo: true, contratacao_permitida: false },
  { id: 'bonus-google-ads-config', nome: 'Configuração de Conta Google Ads', categoria: 'GOOGLE', valor: 297, tipo: 'unico', tipo_cobranca: 'unico', ordem: 21, ativo: true, contratacao_permitida: false },
  { id: 'bonus-keywords', nome: 'Inserção/otimização de palavras-chave', categoria: 'GOOGLE', valor: 297, tipo: 'mensal', tipo_cobranca: 'mensal', ordem: 22, ativo: true, contratacao_permitida: false },
  { id: 'bonus-rastreamento', nome: 'Rastreamento e Tag do Google', categoria: 'GOOGLE', valor: 297, tipo: 'unico', tipo_cobranca: 'unico', ordem: 23, ativo: true, contratacao_permitida: false, bonus_gatilhos: ['svc-site', 'svc-landing', 'svc-site-catalogo', 'svc-loja-virtual'] },
  { id: 'bonus-seo', nome: 'SEO', categoria: 'SEO', valor: 597, tipo: 'mensal', tipo_cobranca: 'mensal', ordem: 24, ativo: true, contratacao_permitida: false },
  { id: 'bonus-meta-posts', nome: '3 posts no Instagram', categoria: 'META ADS', valor: 97, tipo: 'unico', tipo_cobranca: 'unico', ordem: 25, ativo: true, contratacao_permitida: false },
  { id: 'bonus-link-bio', nome: 'Árvore de links (link da bio)', categoria: 'META ADS', valor: 97, tipo: 'unico', tipo_cobranca: 'unico', ordem: 26, ativo: true, contratacao_permitida: false },
  { id: 'bonus-meta-config', nome: 'Configuração de Conta Meta Ads', categoria: 'META ADS', valor: 197, tipo: 'unico', tipo_cobranca: 'unico', ordem: 27, ativo: true, contratacao_permitida: false },
  { id: 'bonus-instagram-bio', nome: 'Configuração e Otimização de Bio do Instagram', categoria: 'INSTAGRAM', valor: 97, tipo: 'unico', tipo_cobranca: 'unico', ordem: 28, ativo: true, contratacao_permitida: false },
];

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function listClientes(): ClienteLocal[] {
  return read<ClienteLocal[]>(K_CLIENTES, []);
}

export function saveCliente(c: Omit<ClienteLocal, 'id'> & { id?: string }): ClienteLocal {
  const list = listClientes();
  const item: ClienteLocal = {
    id: c.id || crypto.randomUUID(),
    razao_social: c.razao_social,
    documento: c.documento,
    email: c.email,
    telefone: c.telefone,
    whatsapp: c.whatsapp,
    cidade: c.cidade,
    endereco: c.endereco,
    numero_endereco: c.numero_endereco,
    bairro: c.bairro,
    complemento: c.complemento,
    cep: c.cep,
    estado: c.estado,
    tipo: c.tipo,
  };
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  write(K_CLIENTES, list);
  return item;
}

function normalizeServico(s: Partial<ServicoCatalogo> & { id: string; nome: string }): ServicoCatalogo {
  const tipo = (s.tipo_cobranca || s.tipo || 'unico') as 'unico' | 'mensal';
  return {
    id: s.id,
    nome: s.nome,
    categoria: s.categoria || '',
    descricao: s.descricao || '',
    texto_contrato: s.texto_contrato || '',
    valor: Number(s.valor) || 0,
    tipo,
    tipo_cobranca: tipo,
    ordem: Number(s.ordem) || 0,
    ativo: s.ativo !== false,
    bonus_automatico: !!s.bonus_automatico,
    bonus_gatilhos: s.bonus_gatilhos || [],
    contratacao_permitida: s.contratacao_permitida !== false,
    bonus_permitido: s.bonus_permitido !== false,
    exclusaoGrupo: s.exclusaoGrupo,
  };
}

export function listServicosCatalogo(): ServicoCatalogo[] {
  const existing = read<ServicoCatalogo[] | null>(K_SERVICOS, null);
  if (existing && existing.length) {
    const obsoleteDefaults: Record<string, { nome: string; valor: number }> = {
      'svc-seo': { nome: 'SEO mensal', valor: 890 },
      'svc-social': { nome: 'Social media', valor: 1500 },
      'svc-crm': { nome: 'Implantação CRM', valor: 3500 },
      'svc-suporte': { nome: 'Suporte premium', valor: 499 },
      'svc-hospedagem': { nome: 'Hospedagem anual', valor: 600 },
      'svc-consultoria': { nome: 'Consultoria estratégica', valor: 2000 },
    };
    const retained = existing.map((s) => normalizeServico(s)).filter((s) => {
      const obsolete = obsoleteDefaults[s.id];
      return !obsolete || s.nome !== obsolete.nome || s.valor !== obsolete.valor;
    });
    const byId = new Map(retained.map((s) => [s.id, s]));
    DEFAULT_SERVICOS.forEach((seed) => {
      const current = byId.get(seed.id);
      if (!current) {
        byId.set(seed.id, seed);
        return;
      }
      const legacyDefaults: Record<string, number> = { 'svc-site': 2500, 'svc-landing': 1200, 'svc-trafego': 1200 };
      if (legacyDefaults[seed.id] === current.valor) byId.set(seed.id, { ...current, ...seed });
    });
    const merged = [...byId.values()].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
    if (merged.length !== existing.length || merged.some((s) => existing.find((item) => item.id === s.id)?.valor !== s.valor)) write(K_SERVICOS, merged);
    return merged;
  }
  write(K_SERVICOS, DEFAULT_SERVICOS);
  return [...DEFAULT_SERVICOS];
}

export function listServicosAtivos(): ServicoCatalogo[] {
  return listServicosCatalogo().filter((s) => s.ativo);
}

export function saveServico(data: Omit<ServicoCatalogo, 'id'> & { id?: string }): ServicoCatalogo {
  const list = listServicosCatalogo();
  const id = data.id || crypto.randomUUID();
  const item = normalizeServico({ ...data, id });
  const idx = list.findIndex((x) => x.id === id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  write(K_SERVICOS, list);
  return item;
}

export function deleteServico(id: string) {
  write(
    K_SERVICOS,
    listServicosCatalogo().filter((s) => s.id !== id)
  );
}

type ContratoRemoto = { id: string; numero: number; empresa_id?: string | null; status: ContratoLocal['status']; payload: ContratoLocal; created_at: string };

async function currentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Entre na sua conta para acessar os contratos.');
  return user.id;
}

function fromRemote(row: ContratoRemoto): ContratoLocal {
  return { ...row.payload, id: row.id, numero: row.numero, status: row.status, created_at: row.created_at };
}

export async function listContratosRemotos(): Promise<ContratoLocal[]> {
  const userId = await currentUserId();
  const empresaId = localStorage.getItem('empresaAtiva');
  const { data: isPlatformAdmin, error: platformCheckError } = await supabase.rpc('is_platform_admin');
  if (platformCheckError) throw new Error(`Não foi possível validar o acesso administrativo: ${platformCheckError.message}`);
  const role = empresaId ? await currentCompanyRole(empresaId) : null;
  const legacy = read<ContratoLocal[]>(K_CONTRATOS, []);
  if (legacy.length && await canImportLegacyContracts()) {
    const rows = legacy.map((contrato) => ({
      id: /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(contrato.id) ? contrato.id : crypto.randomUUID(),
      user_id: userId,
      empresa_id: isPlatformAdmin === true ? contrato.empresa_id || null : empresaId && (role === 'admin' || role === 'gestor') ? empresaId : null,
      status: contrato.status,
      payload: contrato,
      created_at: contrato.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('gm_contracts').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error(`Não foi possível migrar os contratos locais para o servidor: ${error.message}`);
    localStorage.removeItem(K_CONTRATOS);
  }

  let query = supabase
    .from('gm_contracts')
    .select('id, numero, empresa_id, status, payload, created_at');
  if (isPlatformAdmin !== true) {
    if (empresaId && (role === 'admin' || role === 'gestor')) query = query.eq('empresa_id', empresaId);
    else query = query.eq('user_id', userId);
  }
  const { data, error } = await query.order('numero', { ascending: false });
  if (error) throw new Error(`Não foi possível carregar os contratos: ${error.message}`);
  return ((data || []) as ContratoRemoto[]).map(fromRemote);
}

/**
 * Browser-local contracts predate per-user persistence and have no reliable
 * owner. Only company managers/admins may migrate that shared legacy bucket;
 * otherwise the first seller to sign in could claim every contract on device.
 */
async function canImportLegacyContracts(): Promise<boolean> {
  const { data: platformAdmin, error: platformAdminError } = await supabase.rpc('is_platform_admin');
  if (!platformAdminError && platformAdmin === true) return true;

  const empresaId = localStorage.getItem('empresaAtiva');
  if (!empresaId) return false;
  const role = await currentCompanyRole(empresaId);
  return role === 'admin' || role === 'gestor';
}

async function currentCompanyRole(empresaId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('empresa_role', { p_empresa_id: empresaId });
  return error || typeof data !== 'string' ? null : data;
}

export async function saveContrato(
  c: Omit<ContratoLocal, 'id' | 'numero' | 'created_at'> & { empresa_id?: string; id?: string; numero?: number }
): Promise<ContratoLocal> {
  const userId = await currentUserId();
  const empresaId = c.empresa_id || localStorage.getItem('empresaAtiva');
  if (!empresaId) throw new Error('Selecione uma empresa para criar o contrato.');
  const id = c.id || crypto.randomUUID();
  const item: ContratoLocal = {
    ...c,
    id,
    numero: c.numero || 0,
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('gm_contracts')
    .insert({ id, user_id: userId, empresa_id: empresaId, status: item.status, payload: { ...item, empresa_id: empresaId } })
    .select('id, numero, empresa_id, status, payload, created_at')
    .single();
  if (error) throw new Error(`Não foi possível salvar o contrato no servidor: ${error.message}`);
  return fromRemote(data as ContratoRemoto);
}

export async function updateContratoStatus(id: string, status: ContratoLocal['status']) {
  await currentUserId();
  const { error } = await supabase.from('gm_contracts').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`Não foi possível atualizar o contrato: ${error.message}`);
}

export async function updateContrato(
  id: string,
  changes: Partial<Omit<ContratoLocal, 'id' | 'numero' | 'created_at'>>
): Promise<ContratoLocal> {
  await currentUserId();
  const { data: existing, error: readError } = await supabase
    .from('gm_contracts')
    .select('payload,status,empresa_id')
    .eq('id', id)
    .maybeSingle();
  if (readError) throw new Error(`Não foi possível carregar o contrato: ${readError.message}`);
  if (!existing) throw new Error('Contrato não encontrado ou sem permissão para alterá-lo.');

  const payload = { ...(existing.payload as ContratoLocal), ...changes, empresa_id: existing.empresa_id || (existing.payload as ContratoLocal).empresa_id };
  const { data, error } = await supabase
    .from('gm_contracts')
    .update({ payload, status: payload.status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, numero, empresa_id, status, payload, created_at')
    .single();
  if (error) throw new Error(`Não foi possível atualizar o contrato: ${error.message}`);
  return fromRemote(data as ContratoRemoto);
}

export async function deleteContrato(id: string) {
  await currentUserId();
  const { error } = await supabase.from('gm_contracts').delete().eq('id', id);
  if (error) throw new Error(`Não foi possível excluir o contrato: ${error.message}`);
}

export function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function getContratoResumoFinanceiro(contrato: Pick<ContratoLocal, 'valor' | 'valor_bruto' | 'bonus_total' | 'valor_sem_beneficios' | 'economia_total'>) {
  const valorSemBeneficios = Math.max(0, Number(contrato.valor_sem_beneficios ?? (Number(contrato.valor_bruto || contrato.valor) + Number(contrato.bonus_total || 0))) || 0);
  const valorFinal = Math.max(0, Number(contrato.valor) || 0);
  const economia = Math.max(0, Number(contrato.economia_total ?? (valorSemBeneficios - valorFinal)) || 0);
  return { valorSemBeneficios, valorFinal, economia, economiaPercentual: valorSemBeneficios > 0 ? economia / valorSemBeneficios * 100 : 0 };
}

export function formatValorCobranca(n: number, tipo: 'unico' | 'mensal') {
  const base = formatBRL(n);
  return tipo === 'mensal' ? `${base}/mês` : base;
}

export function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate + 'T12:00:00');
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const finalDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, finalDay));
  return d.toISOString().slice(0, 10);
}

