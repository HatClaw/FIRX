import { ServicoRepository } from '@/repositories/servico-repository';
import type { CreateServicoData, UpdateServicoData, Servico, FiltrosServico } from '@/lib/servico-types';
import { hasPermission } from '@/lib/permissions';

export class ServicoService {
  static async create(data: CreateServicoData, userId: string, userRole: string): Promise<Servico> {
    if (!hasPermission(userRole as any, 'servicos:write')) {
      throw new Error('Permissao insuficiente para criar servico');
    }

    return ServicoRepository.create(data, userId);
  }

  static async update(id: string, empresaId: string, data: UpdateServicoData, _userId: string, userRole: string): Promise<Servico> {
    if (!hasPermission(userRole as any, 'servicos:write')) {
      throw new Error('Permissao insuficiente para atualizar servico');
    }

    return ServicoRepository.update(id, empresaId, data, _userId);
  }

  static async delete(id: string, empresaId: string, _userId: string, userRole: string): Promise<void> {
    if (!hasPermission(userRole as any, 'servicos:delete')) {
      throw new Error('Permissao insuficiente para excluir servico');
    }

    await ServicoRepository.delete(id, empresaId);
  }

  static async findById(id: string, empresaId: string, userRole: string): Promise<Servico | null> {
    if (!hasPermission(userRole as any, 'servicos:read')) {
      throw new Error('Permissao insuficiente para buscar servico');
    }

    return ServicoRepository.findById(id, empresaId);
  }

  static async findMany(filtros: FiltrosServico & { empresaId: string }, userRole: string) {
    if (!hasPermission(userRole as any, 'servicos:read')) {
      throw new Error('Permissao insuficiente para listar servicos');
    }

    return ServicoRepository.findMany(filtros);
  }

  static async getCategoriaStats(empresaId: string, userRole: string): Promise<Record<string, number>> {
    if (!hasPermission(userRole as any, 'servicos:read')) {
      throw new Error('Permissao insuficiente para buscar estatisticas');
    }

    return ServicoRepository.getCategoriaStats(empresaId);
  }
}
