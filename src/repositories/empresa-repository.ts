import { supabase } from '@/lib/supabase/client';
import type { CreateEmpresaData, Empresa, EmpresaMember, Convite, CreateConviteData } from '@/lib/empresa-types';

export class EmpresaRepository {
  static async create(data: CreateEmpresaData, userId: string): Promise<Empresa> {
    const { data: empresa, error } = await supabase
      .from('empresas')
      .insert({
        ...data,
        responsavel_id: userId,
        configuracoes: {},
        criado_em: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Falha ao criar empresa: ${error.message}`);
    
    const { error: memberError } = await supabase
      .from('empresa_members')
      .insert({
        empresa_id: empresa.id,
        usuario_id: userId,
        role: 'admin',
        status: 'aceito',
        aceito_em: new Date().toISOString(),
      });

    if (memberError) {
      throw new Error(`Empresa criada, mas falha ao vincular o responsável: ${memberError.message}`);
    }

    return empresa as unknown as Empresa;
  }

  static async findById(id: string): Promise<Empresa | null> {
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(`Falha ao buscar empresa: ${error.message}`);
    return (data as unknown as Empresa) || null;
  }

  static async findByUsuario(userId: string): Promise<Empresa[]> {
    const { data, error } = await supabase
      .from('empresa_members')
      .select('empresas(*)')
      .eq('usuario_id', userId)
      .eq('status', 'aceito');

    if (error) throw new Error(`Falha ao buscar empresas: ${error.message}`);
    return (data?.map((d: any) => d.empresas) as Empresa[]) || [];
  }

  static async getMembers(empresaId: string): Promise<EmpresaMember[]> {
    const { data, error } = await supabase
      .from('empresa_members')
      .select('*')
      .eq('empresa_id', empresaId);

    if (error) throw new Error(`Falha ao buscar membros: ${error.message}`);
    return (data as unknown as EmpresaMember[]) || [];
  }

  static async addMember(empresaId: string, userId: string, role: string): Promise<EmpresaMember> {
    const { data, error } = await supabase
      .from('empresa_members')
      .insert({
        empresa_id: empresaId,
        usuario_id: userId,
        role,
        status: 'aceito',
        aceito_em: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Falha ao adicionar membro: ${error.message}`);
    return data as unknown as EmpresaMember;
  }

  static async updateMemberRole(memberId: string, role: string): Promise<EmpresaMember> {
    const { data, error } = await supabase
      .from('empresa_members')
      .update({ role })
      .eq('id', memberId)
      .select()
      .single();

    if (error) throw new Error(`Falha ao atualizar role: ${error.message}`);
    return data as unknown as EmpresaMember;
  }

  static async removeMember(memberId: string): Promise<void> {
    const { error } = await supabase
      .from('empresa_members')
      .delete()
      .eq('id', memberId);

    if (error) throw new Error(`Falha ao remover membro: ${error.message}`);
  }

  static async createConvite(data: CreateConviteData): Promise<Convite> {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expireEm = new Date();
    expireEm.setDate(expireEm.getDate() + (data.expire_dias || 7));

    const { data: convite, error } = await supabase
      .from('convites')
      .insert({
        ...data,
        token,
        expire_em: expireEm.toISOString(),
        status: 'pendente',
        criado_em: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Falha ao criar convite: ${error.message}`);
    return convite as unknown as Convite;
  }

  static async getConvites(empresaId: string): Promise<Convite[]> {
    const { data, error } = await supabase
      .from('convites')
      .select('*')
      .eq('empresa_id', empresaId);

    if (error) throw new Error(`Falha ao buscar convites: ${error.message}`);
    return (data as unknown as Convite[]) || [];
  }

  static async acceptConvite(token: string, userId: string): Promise<EmpresaMember> {
    const { data: convite, error: conviteError } = await supabase
      .from('convites')
      .select('*')
      .eq('token', token)
      .eq('status', 'pendente')
      .single();

    if (conviteError || !convite) throw new Error('Convite inválido ou expirado');

    const { data: member, error: memberError } = await supabase
      .from('empresa_members')
      .insert({
        empresa_id: convite.empresa_id,
        usuario_id: userId,
        role: convite.role,
        status: 'aceito',
        aceito_em: new Date().toISOString(),
      })
      .select()
      .single();

    if (memberError) throw new Error(`Falha ao aceitar convite: ${memberError.message}`);

    await supabase
      .from('convites')
      .update({ status: 'aceito' })
      .eq('id', convite.id);

    return member as unknown as EmpresaMember;
  }

  static async cancelConvite(id: string): Promise<void> {
    const { error } = await supabase
      .from('convites')
      .update({ status: 'expirado' })
      .eq('id', id);

    if (error) throw new Error(`Falha ao cancelar convite: ${error.message}`);
  }

  static async getPermissoes(empresaId: string, userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('empresa_members')
      .select('role')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', userId)
      .eq('status', 'aceito')
      .single();

    if (error || !data) throw new Error('Membro não encontrado');
    return data;
  }
}

