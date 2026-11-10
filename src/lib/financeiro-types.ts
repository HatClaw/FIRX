export type FinanceiroStatus = 'pendente' | 'pago' | 'parcial' | 'atrasado' | 'cancelado' | 'estornado';
export type FormaPagamento = 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'transferencia' | 'pix' | 'boleto' | 'outro';

export interface ParcelaFinanceira {
  id: string;
  empresa_id: string;
  contrato_id: string;
  cliente_id: string;
  numero: number;
  valor_contratado: number;
  valor_previsto: number;
  valor_recebido: number;
  valor_saldo: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: FinanceiroStatus;
  forma_pagamento?: FormaPagamento;
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface LancamentoFinanceiro {
  id: string;
  empresa_id: string;
  parcela_id: string;
  valor: number;
  data_pagamento: string;
  forma_pagamento: FormaPagamento;
  observacoes?: string;
  comprovante_url?: string;
  criado_em: string;
  criado_por: string;
}

export interface EstornoFinanceiro {
  id: string;
  empresa_id: string;
  lancamento_id: string;
  valor: number;
  motivo: string;
  data_estorno: string;
  criado_por: string;
  criado_em: string;
}

export interface SaldoFinanceiro {
  valor_contratado: number;
  valor_previsto: number;
  valor_recebido: number;
  valor_saldo: number;
  valor_vencido: number;
  valor_nao_vencido: number;
}

export interface FiltrosFinanceiro {
  empresaId: string;
  cliente_id?: string;
  contrato_id?: string;
  vendedor_id?: string;
  status?: FinanceiroStatus;
  data_init?: string;
  data_fim?: string;
  page?: number;
  limit?: number;
}

export interface RelatorioFinanceiro {
  periodo: string;
  saldos: SaldoFinanceiro;
  'por cliente': Record<string, SaldoFinanceiro>;
  'por vendedor': Record<string, SaldoFinanceiro>;
  vencimentos: ParcelaFinanceira[];
  pagamentos: LancamentoFinanceiro[];
}

export interface CreateParcelaData {
  empresa_id: string;
  contrato_id: string;
  cliente_id: string;
  numero: number;
  valor_contratado: number;
  data_vencimento: string;
  observacoes?: string;
}

export interface UpdateParcelaData {
  status?: FinanceiroStatus;
  forma_pagamento?: FormaPagamento;
  observacoes?: string;
}

export interface CreateLancamentoData {
  empresa_id: string;
  parcela_id: string;
  valor: number;
  data_pagamento: string;
  forma_pagamento: FormaPagamento;
  observacoes?: string;
}

export interface CreateEstornoData {
  empresa_id: string;
  lancamento_id: string;
  valor: number;
  motivo: string;
}
