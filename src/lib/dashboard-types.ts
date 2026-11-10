export interface DashboardKPI {
  label: string;
  value: number;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  format?: 'currency' | 'number' | 'percent';
}

export interface DashboardData {
  kpis: DashboardKPI[];
  evolucaoRecebimentos: Array<{ periodo: string; recebido: number; previsto: number }>;
  contratosPorStatus: Array<{ status: string; valor: number; count: number }>;
  desempenhoVendedores: Array<{ vendedor: string; recebido: number; meta: number; contratos: number }>;
  inadimplencia: Array<{ periodo: string; vencido: number; total: number }>;
  clientesDistribuicao: Array<{ tipo: string; count: number }>;
  agendamentos: Array<{ periodo: string; agendados: number; realizados: number }>;
}

export interface FiltrosDashboard {
  periodo?: '7d' | '30d' | '90d' | '6m' | '12m' | 'custom';
  data_init?: string;
  data_fim?: string;
  vendedor_id?: string;
  status?: string;
}
