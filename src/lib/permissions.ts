export type Role = 'admin' | 'gestor' | 'vendedor' | 'financeiro' | 'operador';

export interface RolePermissions {
  name: Role;
  label: string;
  description: string;
  permissions: Permission[];
}

export type Permission =
  | 'contratos:read' | 'contratos:write' | 'contratos:delete'
  | 'contratos:enviar' | 'contratos:assinar'
  | 'clients:read' | 'clients:write' | 'clients:delete'
  | 'servicos:read' | 'servicos:write' | 'servicos:delete'
  | 'vendedores:read' | 'vendedores:write' | 'vendedores:delete'
  | 'agendamentos:read' | 'agendamentos:write' | 'agendamentos:delete'
  | 'financeiro:read' | 'financeiro:write' | 'financeiro:delete'
  | 'financeiro:export'
  | 'relatorios:read' | 'relatorios:export'
  | 'auditoria:read' | 'auditoria:export'
  | 'configuracoes:read' | 'configuracoes:write'
  | 'empresas:read' | 'empresas:write' | 'empresas:delete'
  | 'convites:read' | 'convites:write' | 'convites:delete'
  | 'todos:todos';

export const ROLES: Record<Role, RolePermissions> = {
  admin: {
    name: 'admin',
    label: 'Administrador',
    description: 'Acesso total ao sistema',
    permissions: [
      'contratos:read', 'contratos:write', 'contratos:delete',
      'contratos:enviar', 'contratos:assinar',
      'clients:read', 'clients:write', 'clients:delete',
      'servicos:read', 'servicos:write', 'servicos:delete',
      'vendedores:read', 'vendedores:write', 'vendedores:delete',
      'agendamentos:read', 'agendamentos:write', 'agendamentos:delete',
      'financeiro:read', 'financeiro:write', 'financeiro:delete',
      'financeiro:export',
      'relatorios:read', 'relatorios:export',
      'auditoria:read', 'auditoria:export',
      'configuracoes:read', 'configuracoes:write',
      'empresas:read', 'empresas:write', 'empresas:delete',
      'convites:read', 'convites:write', 'convites:delete',
      'todos:todos',
    ],
  },
  gestor: {
    name: 'gestor',
    label: 'Gestor',
    description: 'Gestao de operaçoes e relatorios',
    permissions: [
      'contratos:read', 'contratos:write', 'contratos:enviar',
      'clients:read', 'clients:write',
      'servicos:read', 'servicos:write',
      'vendedores:read',
      'agendamentos:read', 'agendamentos:write',
      'financeiro:read', 'financeiro:export',
      'relatorios:read', 'relatorios:export',
      'configuracoes:read', 'configuracoes:write',
      'empresas:read',
    ],
  },
  vendedor: {
    name: 'vendedor',
    label: 'Vendedor',
    description: 'Gestao de contratos e clientes',
    permissions: [
      'contratos:read', 'contratos:write', 'contratos:enviar',
      'clients:read', 'clients:write',
      'agendamentos:read', 'agendamentos:write',
      'relatorios:read',
    ],
  },
  financeiro: {
    name: 'financeiro',
    label: 'Financeiro',
    description: 'Gestao financeira e relatorios',
    permissions: [
      'contratos:read',
      'clients:read',
      'financeiro:read', 'financeiro:write',
      'financeiro:export',
      'relatorios:read', 'relatorios:export',
      'configuracoes:read',
    ],
  },
  operador: {
    name: 'operador',
    label: 'Operador',
    description: 'Operacao basica de dados',
    permissions: [
      'contratos:read',
      'clients:read',
      'servicos:read',
      'agendamentos:read', 'agendamentos:write',
    ],
  },
};

export function hasPermission(role: Role, permission: Permission): boolean {
  if (role === 'admin') return true;
  return ROLES[role].permissions.includes(permission);
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function canAccess(role: Role, resource: string, action: string): boolean {
  const permission = `${resource}:${action}` as Permission;
  return hasPermission(role, permission);
}

export function getRoleLabel(role: Role): string {
  return ROLES[role]?.label || role;
}

export function getRoleDescription(role: Role): string {
  return ROLES[role]?.description || '';
}
