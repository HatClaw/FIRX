export interface Empresa {
  id: string;
  nome: string;
  cnpj?: string | null;
  role?: string;
  responsavel_id?: string;
  configuracoes?: Record<string, unknown>;
  criado_em?: string;
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

export interface UserSession {
  id: string;
  email: string;
  nome: string;
  avatar_url?: string | null;
  avatar?: string;
  role: 'admin' | 'gestor' | 'vendedor' | 'financeiro' | 'operador';
  empresa_id: string | null;
  empresas: Array<{ id: string; nome: string; role: string }>;
  token: string;
  expira_em: string;
}

