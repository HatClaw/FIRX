export type ClientStatus = 'ativo' | 'inativo' | 'arquivado' | 'suspenso' | 'prospecto';
export type ClientType = 'pessoa_fisica' | 'pessoa_juridica' | 'pf' | 'pj';

export interface Endereco {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  pais?: string;
}

export interface Cliente {
  id: string;
  empresa_id: string;
  nome: string;
  razao_social?: string;
  tipo: ClientType;
  documento: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  cep?: string;
  endereco?: Endereco;
  responsavel?: string;
  status: ClientStatus;
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
  atualizado_por?: string;
}

export interface ClienteHistorico {
  id: string;
  cliente_id: string;
  empresa_id: string;
  acao: string;
  detalhes: string;
  usuario_id: string;
  criado_em: string;
}

export interface CreateClienteData {
  empresa_id: string;
  nome: string;
  razao_social?: string;
  tipo: ClientType;
  documento: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  cep?: string;
  endereco?: Endereco;
  responsavel?: string;
  status?: ClientStatus;
  observacoes?: string;
}

export interface UpdateClienteData extends Partial<Omit<CreateClienteData, 'empresa_id'>> {
  status?: ClientStatus;
}

export interface FiltrosCliente {
  empresa_id?: string;
  busca?: string;
  status?: ClientStatus;
  tipo?: ClientType;
  responsavel?: string;
  page?: number;
  limit?: number;
  order_by?: 'nome' | 'criado_em' | 'atualizado_em';
  order_dir?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
