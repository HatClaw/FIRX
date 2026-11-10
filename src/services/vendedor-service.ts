import { VendedorRepository } from '@/repositories/vendedor-repository';
import type { CreateVendedorData, UpdateVendedorData, Vendedor, DesempenhoVendedor } from '@/lib/servico-types';
import { hasPermission } from '@/lib/permissions';

export class VendedorService {
  static async create(data: CreateVendedorData, userId: string, userRole: string): Promise<Vendedor> {
    if (!hasPermission(userRole as any, 'vendedores:write')) {
      throw new Error('Permissao insuficiente para criar vendedor');
    }

    return VendedorRepository.create(data, userId);
  }

  static async update(id: string, empresaId: string, data: UpdateVendedorData, _userId: string, userRole: string): Promise<Vendedor> {
    if (!hasPermission(userRole as any, 'vendedores:write')) {
      throw new Error('Permissao insuficiente para atualizar vendedor');
    }

    return VendedorRepository.update(id, empresaId, data, _userId);
  }

  static async delete(id: string, empresaId: string, _userId: string, userRole: string): Promise<void> {
    if (!hasPermission(userRole as any, 'vendedores:delete')) {
      throw new Error('Permissao insuficiente para excluir vendedor');
    }

    await VendedorRepository.delete(id, empresaId);
  }

  static async findById(id: string, empresaId: string, userRole: string): Promise<Vendedor | null> {
    if (!hasPermission(userRole as any, 'vendedores:read')) {
      throw new Error('Permissao insuficiente para buscar vendedor');
    }

    return VendedorRepository.findById(id, empresaId);
  }

  static async findMany(filtros: { empresaId: string; busca?: string; status?: string; role?: string; page?: number; limit?: number }, userRole: string) {
    if (!hasPermission(userRole as any, 'vendedores:read')) {
      throw new Error('Permissao insuficiente para listar vendedores');
    }

    return VendedorRepository.findMany(filtros);
  }

  static async getDesempenho(vendedorId: string, empresaId: string, periodo: string, userRole: string): Promise<DesempenhoVendedor> {
    if (!hasPermission(userRole as any, 'vendedores:read')) {
      throw new Error('Permissao insuficiente para buscar desempenho');
    }

    return VendedorRepository.getDesempenho(vendedorId, empresaId, periodo);
  }

  static async getComissoes(vendedorId: string, empresaId: string, periodo: string, userRole: string): Promise<any[]> {
    if (!hasPermission(userRole as any, 'vendedores:read')) {
      throw new Error('Permissao insuficiente para buscar comissoes');
    }

    return VendedorRepository.getComissoes(vendedorId, empresaId, periodo);
  }
}

