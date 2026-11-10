import { ClientRepository } from '@/repositories/client-repository';
import type { CreateClienteData, UpdateClienteData, FiltrosCliente, Cliente, ClienteHistorico, PaginatedResult } from '@/lib/client-types';
import { hasPermission } from '@/lib/permissions';

export class ClientService {
  static async create(data: CreateClienteData, userId: string, userRole: string): Promise<Cliente> {
    if (!hasPermission(userRole as any, 'clients:write')) {
      throw new Error('Permissao insuficiente para criar cliente');
    }

    if (!data.empresa_id) throw new Error('Empresa e obrigatoria');

    const cliente = await ClientRepository.create(data, userId);
    await this.registrarHistorico(cliente.id, data.empresa_id, 'criacao', 'Cliente criado', userId);
    return cliente;
  }

  static async update(id: string, empresaId: string, data: UpdateClienteData, userId: string, userRole: string): Promise<Cliente> {
    if (!hasPermission(userRole as any, 'clients:write')) {
      throw new Error('Permissao insuficiente para atualizar cliente');
    }

    const cliente = await ClientRepository.update(id, empresaId, data, userId);
    await this.registrarHistorico(id, empresaId, 'edicao', `Cliente atualizado: ${JSON.stringify(data)}`, userId);
    return cliente;
  }

  static async delete(id: string, empresaId: string, userRole: string): Promise<void> {
    if (!hasPermission(userRole as any, 'clients:delete')) {
      throw new Error('Permissao insuficiente para excluir cliente');
    }

    await ClientRepository.delete(id, empresaId);
  }

  static async archive(id: string, empresaId: string, userId: string, userRole: string): Promise<Cliente> {
    if (!hasPermission(userRole as any, 'clients:write')) {
      throw new Error('Permissao insuficiente para arquivar cliente');
    }

    const cliente = await ClientRepository.archive(id, empresaId, userId);
    await this.registrarHistorico(id, empresaId, 'arquivamento', 'Cliente arquivado', userId);
    return cliente;
  }

  static async findById(id: string, empresaId: string, userRole: string): Promise<Cliente | null> {
    if (!hasPermission(userRole as any, 'clients:read')) {
      throw new Error('Permissao insuficiente para buscar cliente');
    }

    return ClientRepository.findById(id, empresaId);
  }

  static async findMany(filtros: FiltrosCliente, userRole: string): Promise<PaginatedResult<Cliente>> {
    if (!hasPermission(userRole as any, 'clients:read')) {
      throw new Error('Permissao insuficiente para listar clientes');
    }

    if (!filtros.empresa_id) throw new Error('Empresa e obrigatoria');
    return ClientRepository.findMany({ ...filtros, empresa_id: filtros.empresa_id });
  }

  static async getHistorico(clienteId: string, empresaId: string, userRole: string): Promise<ClienteHistorico[]> {
    if (!hasPermission(userRole as any, 'clients:read')) {
      throw new Error('Permissao insuficiente para buscar historico');
    }

    return ClientRepository.getHistorico(clienteId, empresaId);
  }

  private static async registrarHistorico(clienteId: string, empresaId: string, acao: string, detalhes: string, userId: string) {
    try {
      await ClientRepository.addHistorico(clienteId, empresaId, acao, detalhes, userId);
    } catch (error) {
      // A gravação principal já foi concluída; não sinalizar falsamente que ela falhou.
      console.error('Falha ao registrar historico do cliente', error);
    }
  }
}
