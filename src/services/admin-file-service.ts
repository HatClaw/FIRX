import { supabase } from '@/lib/supabase/client';
import { requirePlatformAdmin } from '@/services/admin-resource-service';

export const ADMIN_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const ADMIN_FILE_BUCKET = 'growmoney-files';
export const ADMIN_FILE_CATEGORIES = ['fotos', 'arquivos', 'contratos'] as const;
type AdminFileCategory = (typeof ADMIN_FILE_CATEGORIES)[number];

export type AdminFile = {
  id: string;
  user_id: string;
  categoria: string;
  bucket_id: string;
  object_path: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

export class AdminFileService {
  static async list(): Promise<AdminFile[]> {
    await requirePlatformAdmin();
    const { data, error } = await supabase.from('gm_files')
      .select('id,user_id,categoria,bucket_id,object_path,original_name,content_type,size_bytes,created_at')
      .order('created_at', { ascending: false }).limit(500);
    if (error) throw new Error(`Falha ao listar arquivos: ${error.message}`);
    return (data || []) as AdminFile[];
  }

  static async upload(file: File, categoria: string): Promise<void> {
    const user = await requirePlatformAdmin();
    if (file.size > ADMIN_FILE_MAX_BYTES) throw new Error('O arquivo excede o limite de 10 MB.');
    const safeCategory = this.validateCategory(categoria);
    const safeName = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(-120) || 'arquivo';
    const objectPath = `${user.id}/${safeCategory}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(ADMIN_FILE_BUCKET).upload(objectPath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (uploadError) throw new Error(`Falha ao enviar arquivo: ${uploadError.message}`);
    const { error: metadataError } = await supabase.from('gm_files').insert({
      user_id: user.id,
      categoria: safeCategory,
      bucket_id: ADMIN_FILE_BUCKET,
      object_path: objectPath,
      original_name: file.name,
      content_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
    });
    if (metadataError) {
      await supabase.storage.from(ADMIN_FILE_BUCKET).remove([objectPath]);
      throw new Error(`Falha ao registrar arquivo: ${metadataError.message}`);
    }
    await this.audit(user.id, 'arquivo.criado', { object_path: objectPath });
  }

  static async update(fileId: string, values: Pick<AdminFile, 'categoria' | 'original_name'>): Promise<void> {
    const user = await requirePlatformAdmin();
    const categoria = this.validateCategory(values.categoria);
    const originalName = values.original_name.trim();
    if (!originalName) throw new Error('Informe o nome do arquivo.');

    const { data: current, error: readError } = await supabase.from('gm_files')
      .select('id,user_id,categoria,bucket_id,object_path,original_name,content_type,size_bytes,created_at')
      .eq('id', fileId).maybeSingle();
    if (readError) throw new Error(`Falha ao carregar arquivo: ${readError.message}`);
    if (!current) throw new Error('Arquivo não encontrado ou sem permissão para alterá-lo.');
    const file = current as AdminFile;
    this.assertManagedFile(file);

    let nextPath = file.object_path;
    let moved = false;
    if (categoria !== file.categoria) {
      const parts = file.object_path.split('/');
      if (parts.length < 3 || parts[0] !== file.user_id || parts[1] !== file.categoria) {
        throw new Error('O caminho atual não permite alterar a categoria com segurança.');
      }
      parts[1] = categoria;
      nextPath = parts.join('/');
      const { error: moveError } = await supabase.storage.from(file.bucket_id).move(file.object_path, nextPath);
      if (moveError) throw new Error(`Falha ao mover arquivo: ${moveError.message}`);
      moved = true;
    }

    const { data, error } = await supabase.from('gm_files').update({
      categoria, original_name: originalName, object_path: nextPath,
    }).eq('id', fileId).select('id').maybeSingle();
    if (error || !data) {
      if (moved) {
        const { error: rollbackError } = await supabase.storage.from(file.bucket_id).move(nextPath, file.object_path);
        if (rollbackError) throw new Error(`Falha ao atualizar cadastro (${error?.message || 'registro indisponível'}) e ao restaurar o arquivo (${rollbackError.message}).`);
      }
      if (error) throw new Error(`Falha ao atualizar arquivo: ${error.message}`);
      throw new Error('Arquivo não encontrado ou sem permissão para alterá-lo.');
    }
    await this.audit(user.id, 'arquivo.atualizado', { arquivo_id: fileId });
  }

  static async delete(file: AdminFile): Promise<void> {
    const user = await requirePlatformAdmin();
    this.assertManagedFile(file);
    const { error: storageError } = await supabase.storage.from(file.bucket_id).remove([file.object_path]);
    if (storageError) throw new Error(`Não foi possível remover o objeto do armazenamento: ${storageError.message}`);
    const { data, error } = await supabase.from('gm_files').delete().eq('id', file.id).select('id').maybeSingle();
    if (error) throw new Error(`Arquivo removido do armazenamento, mas falhou ao excluir o cadastro: ${error.message}`);
    if (!data) throw new Error('Objeto removido, mas o cadastro não foi encontrado. Atualize a lista.');
    await this.audit(user.id, 'arquivo.excluido', { arquivo_id: file.id, object_path: file.object_path });
  }

  static async getDownloadUrl(file: AdminFile): Promise<string> {
    await requirePlatformAdmin();
    this.assertManagedFile(file);
    const { data, error } = await supabase.storage.from(file.bucket_id).createSignedUrl(file.object_path, 60);
    if (error || !data?.signedUrl) throw new Error(`Falha ao abrir arquivo: ${error?.message || 'URL indisponível'}`);
    return data.signedUrl;
  }

  private static async audit(adminUserId: string, action: string, details: Record<string, unknown>) {
    const { error } = await supabase.rpc('admin_log_event', {
      p_action: action,
      p_details: { ...details, admin_user_id: adminUserId },
    });
    if (error) throw new Error(`Operação concluída, mas a auditoria não foi registrada: ${error.message}`);
  }

  private static validateCategory(value: string): AdminFileCategory {
    const normalized = value.trim();
    if (!ADMIN_FILE_CATEGORIES.includes(normalized as AdminFileCategory)) {
      throw new Error(`Categoria inválida. Use: ${ADMIN_FILE_CATEGORIES.join(', ')}.`);
    }
    return normalized as AdminFileCategory;
  }

  private static assertManagedFile(file: AdminFile) {
    const parts = file.object_path.split('/');
    if (file.bucket_id !== ADMIN_FILE_BUCKET || parts[0] !== file.user_id || parts[1] !== file.categoria) {
      throw new Error('Os metadados do arquivo não correspondem ao caminho esperado no armazenamento.');
    }
  }
}
