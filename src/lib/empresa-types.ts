export interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  responsavel_id: string;
  configuracoes: Record<string, unknown>;
  criado_em: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: Record<string, string>;
}

export interface EmpresaMember {
  id: string;
  empresa_id: string;
  usuario_id: string;
  role: 'admin' | 'gestor' | 'vendedor' | 'financeiro' | 'operador';
  convidado_em: string;
  aceito_em: string | null;
  status: 'pendente' | 'aceito' | 'recusado';
}

export interface Convite {
  id: string;
  empresa_id: string;
  email: string;
  role: 'admin' | 'gestor' | 'vendedor' | 'financeiro' | 'operador';
  token: string;
  expire_em: string;
  criado_por: string;
  status: 'pendente' | 'aceito' | 'expirado';
}

export interface CreateEmpresaData {
  nome: string;
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  email?: string;
  telefone?: string;
  endereco?: Record<string, string>;
}

export interface CreateConviteData {
  empresa_id: string;
  email: string;
  role: 'admin' | 'gestor' | 'vendedor' | 'financeiro' | 'operador';
  expire_dias?: number;
}
