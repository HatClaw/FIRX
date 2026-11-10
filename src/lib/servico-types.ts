export type ServicoStatus = 'ativo' | 'inativo' | 'pausado' | 'arquivado';

export interface Servico {
  id: string;
  empresa_id: string;
  codigo: string;
  nome: string;
  categoria: string;
  subcategoria?: string;
  valor_base: number;
  custo?: number;
  margem?: number;
  duracao_minutos?: number;
  unidade: 'hora' | 'dia' | 'semana' | 'mes' | 'ano' | 'unidade';
  condicoes_comerciais?: string;
  status: ServicoStatus;
  criado_em: string;
  atualizado_em: string;
}

export interface CreateServicoData {
  empresa_id: string;
  codigo: string;
  nome: string;
  categoria: string;
  subcategoria?: string;
  valor_base: number;
  custo?: number;
  duracao_minutos?: number;
  unidade?: 'hora' | 'dia' | 'semana' | 'mes' | 'ano' | 'unidade';
  condicoes_comerciais?: string;
}

export interface UpdateServicoData extends Partial<CreateServicoData> {
  status?: ServicoStatus;
}

export interface FiltrosServico {
  empresaId: string;
  busca?: string;
  categoria?: string;
  status?: ServicoStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ComissaoRule {
  id: string;
  empresa_id: string;
  vendedor_id: string;
  tipo: 'percentual' | 'fixa' | 'escalonada';
  valor: number;
  condicoes?: string;
  ativo: boolean;
  criado_em: string;
}

export interface Vendedor {
  id: string;
  empresa_id: string;
  nome: string;
  email: string;
  telefone?: string;
  whatsapp?: string;
  identificador_interno: string;
  role: 'admin' | 'gestor' | 'vendedor' | 'financeiro' | 'operador';
  status: 'ativo' | 'inativo' | 'suspenso';
  meta_mensal?: number;
  comissao_padrao?: number;
  comissao_rule_id?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface CreateVendedorData {
  empresa_id: string;
  nome: string;
  email: string;
  telefone?: string;
  whatsapp?: string;
  identificador_interno: string;
  role: 'admin' | 'gestor' | 'vendedor' | 'financeiro' | 'operador';
  meta_mensal?: number;
  comissao_padrao?: number;
}

export interface UpdateVendedorData extends Partial<CreateVendedorData> {
  status?: 'ativo' | 'inativo' | 'suspenso';
}

export interface DesempenhoVendedor {
  vendedor_id: string;
  periodo: string;
  contratos_criados: number;
  contratos_assinados: number;
  valor_total_contratos: number;
  valor_recebido: number;
  comissao_calculada: number;
  meta_alcancada: number;
  percentual_meta: number;
}
