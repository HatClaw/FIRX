export type AgendaStatus = 'agendado' | 'confirmado' | 'realizado' | 'cancelado' | 'reagendado';
export type AgendaTipo = 'reuniao' | 'ligacao' | 'videoconferencia' | 'visita' | 'outro';

export interface AgendaCompromisso {
  id: string;
  empresa_id: string;
  cliente_id?: string;
  contrato_id?: string;
  servico_id?: string;
  responsavel_id: string;
  tipo: AgendaTipo;
  status: AgendaStatus;
  title: string;
  description?: string;
  data_hora: string;
  data_fim: string;
  duracao_minutos: number;
  local?: string;
  link_reuniao?: string;
  lembrete_antes?: number;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
  atualizado_por?: string;
}

export interface CreateCompromissoData {
  empresa_id: string;
  cliente_id?: string;
  contrato_id?: string;
  servico_id?: string;
  responsavel_id: string;
  tipo: AgendaTipo;
  title: string;
  description?: string;
  data_hora: string;
  duracao_minutos?: number;
  local?: string;
  link_reuniao?: string;
  lembrete_antes?: number;
}

export interface UpdateCompromissoData extends Partial<CreateCompromissoData> {
  status?: AgendaStatus;
}

export interface FiltrosAgenda {
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

export interface ConflitoVerificado {
  conflito: boolean;
  compromisso?: AgendaCompromisso;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AgendaHistorico {
  id: string;
  compromisso_id: string;
  empresa_id: string;
  acao: string;
  status_anterior?: string;
  status_novo?: string;
  detalhes?: string;
  usuario_id: string;
  criado_em: string;
}
