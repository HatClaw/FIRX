export type ContratoStatus = 'rascunho' | 'revisao' | 'enviado' | 'pendente_assinatura' | 'assinado' | 'cancelado' | 'expirado';
export type AssinaturaStatus = 'pendente' | 'enviado' | 'assinado' | 'recusado' | 'expirado';
export type PagamentoStatus = 'pendente' | 'parcial' | 'pago' | 'atrasado' | 'cancelado';

export interface Parcela {
  id: string;
  contrato_id: string;
  numero: number;
  valor: number;
  desconto: number;
  acrescimo: number;
  valor_liquido: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: PagamentoStatus;
  forma_pagamento?: string;
  observacoes?: string;
}

export interface Contrato {
  id: string;
  empresa_id: string;
  numero: string;
  cliente_id: string;
  servico_id: string;
  vendedor_id: string;
  template_id?: string;
  valor_base: number;
  desconto: number;
  acrescimo: number;
  valor_total: number;
  entrada: number;
  parcelas: number;
  data_emissao: string;
  data_vigencia?: string;
  data_vencimento?: string;
  condicoes_pagamento?: string;
  observacoes?: string;
  status: ContratoStatus;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
  atualizado_por?: string;
}

export interface Assinatura {
  id: string;
  contrato_id: string;
  assinante: string;
  email: string;
  status: AssinaturaStatus;
  provedor?: string;
  token_provedor?: string;
  data_envio?: string;
  data_assinatura?: string;
  ip_assinatura?: string;
  user_agent?: string;
  observacoes?: string;
}

export interface ContratoHistorico {
  id: string;
  contrato_id: string;
  empresa_id: string;
  acao: string;
  status_anterior?: string;
  status_novo?: string;
  detalhes?: string;
  usuario_id: string;
  criado_em: string;
}

export interface CreateContratoData {
  empresa_id: string;
  cliente_id: string;
  servico_id: string;
  vendedor_id: string;
  template_id?: string;
  valor_base: number;
  desconto?: number;
  acrescimo?: number;
  entrada?: number;
  parcelas?: number;
  data_vigencia?: string;
  data_vencimento?: string;
  condicoes_pagamento?: string;
  observacoes?: string;
}

export interface UpdateContratoData extends Partial<CreateContratoData> {
  status?: ContratoStatus;
}

export interface FiltrosContrato {
  empresaId: string;
  cliente_id?: string;
  vendedor_id?: string;
  status?: ContratoStatus;
  busca?: string;
  page?: number;
  limit?: number;
  order_by?: 'numero' | 'data_emissao' | 'valor_total' | 'criado_em';
  order_dir?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ContratoCompleto extends Omit<Contrato, 'parcelas'> {
  cliente?: { nome: string; documento: string; email?: string };
  servico?: { nome: string; valor_base: number };
  vendedor?: { nome: string };
  assinaturas?: Assinatura[];
  parcelas?: Parcela[];
}

export interface PDFContratoData {
  contract: ContratoCompleto;
  template: string;
  logoUrl?: string;
}
