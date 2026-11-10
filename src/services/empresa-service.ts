import { EmpresaRepository } from '@/repositories/empresa-repository';
import type { CreateEmpresaData, Empresa, EmpresaMember, Convite } from '@/lib/empresa-types';
import { hasPermission } from '@/lib/permissions';

export class EmpresaService {
  static async createEmpresa(data: CreateEmpresaData, userId: string): Promise<Empresa> {
    return EmpresaRepository.create(data, userId);
  }

  static async getEmpresas(userId: string): Promise<Empresa[]> {
    return EmpresaRepository.findByUsuario(userId);
  }

  static async getEmpresa(id: string, userId: string): Promise<Empresa | null> {
    const member = await EmpresaRepository.getPermissoes(id, userId);
    if (!hasPermission(member.role, 'empresas:read')) {
      throw new Error('Permissão insuficiente');
    }
    return EmpresaRepository.findById(id);
  }

  static async updateEmpresa(id: string, data: Partial<CreateEmpresaData>, userId: string): Promise<Empresa> {
    const member = await EmpresaRepository.getPermissoes(id, userId);
    if (!hasPermission(member.role, 'empresas:write')) {
      throw new Error('Permissão insuficiente');
    }
    const { supabase } = await import('@/lib/supabase/client');
    const { data: empresa, error } = await supabase
      .from('empresas')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Falha ao atualizar empresa: ${error.message}`);
    return empresa as unknown as Empresa;
  }

  static async getMembers(empresaId: string, userId: string): Promise<EmpresaMember[]> {
    const member = await EmpresaRepository.getPermissoes(empresaId, userId);
    if (!hasPermission(member.role, 'empresas:read')) {
      throw new Error('Permissão insuficiente');
    }
    return EmpresaRepository.getMembers(empresaId);
  }

  static async addMember(empresaId: string, email: string, role: string, userId: string): Promise<Convite> {
    const member = await EmpresaRepository.getPermissoes(empresaId, userId);
    if (!hasPermission(member.role, 'convites:write')) {
      throw new Error('Permissão insuficiente');
    }
    const conviteData = { empresa_id: empresaId, email, role: role as any };
    return EmpresaRepository.createConvite(conviteData);
  }

  static async removeMember(memberId: string, empresaId: string, userId: string): Promise<void> {
    const member = await EmpresaRepository.getPermissoes(empresaId, userId);
    if (!hasPermission(member.role, 'empresas:delete')) {
      throw new Error('Permissão insuficiente');
    }
    return EmpresaRepository.removeMember(memberId);
  }

  static async changeRole(memberId: string, role: string, empresaId: string, userId: string): Promise<EmpresaMember> {
    const member = await EmpresaRepository.getPermissoes(empresaId, userId);
    if (!hasPermission(member.role, 'empresas:write')) {
      throw new Error('Permissão insuficiente');
    }
    return EmpresaRepository.updateMemberRole(memberId, role);
  }

  static async getConvites(empresaId: string, userId: string): Promise<Convite[]> {
    const member = await EmpresaRepository.getPermissoes(empresaId, userId);
    if (!hasPermission(member.role, 'convites:read')) {
      throw new Error('Permissão insuficiente');
    }
    return EmpresaRepository.getConvites(empresaId);
  }

  static async cancelConvite(id: string, empresaId: string, userId: string): Promise<void> {
    const member = await EmpresaRepository.getPermissoes(empresaId, userId);
    if (!hasPermission(member.role, 'convites:delete')) {
      throw new Error('Permissão insuficiente');
    }
    return EmpresaRepository.cancelConvite(id);
  }

  static async acceptConvite(token: string, userId: string): Promise<EmpresaMember> {
    return EmpresaRepository.acceptConvite(token, userId);
  }

  static async switchEmpresa(empresaId: string, userId: string): Promise<void> {
    const member = await EmpresaRepository.getPermissoes(empresaId, userId);
    if (!member) {
      throw new Error('Não pertence a esta empresa');
    }
  }
}

