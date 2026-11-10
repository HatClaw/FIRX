import { supabase } from '@/lib/supabase/client';

export type ArquivoCategoria = 'fotos' | 'arquivos' | 'contratos' | 'auto';

export interface ArquivoEnviado {
  id: string;
  nome: string;
  caminho: string;
  url: string;
  tamanho: number;
  tipo: string;
}

interface ArquivoRegistro {
  id: string;
  original_name: string;
  object_path: string;
  content_type: string;
  size_bytes: number;
}

const BUCKET = 'growmoney-files';

export async function criarLinkArquivo(caminho: string, expiresIn = 60 * 60) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, expiresIn);
  if (error || !data?.signedUrl) throw new Error(`Não foi possível abrir o arquivo: ${error?.message || 'erro desconhecido'}`);
  return data.signedUrl;
}

function nomeSeguro(nome: string) {
  return nome
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-120) || 'arquivo';
}

export async function uploadArquivo(file: File, categoria: ArquivoCategoria): Promise<ArquivoEnviado> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Entre na sua conta para salvar arquivos.');

  const pasta = categoria === 'auto' ? (file.type.startsWith('image/') ? 'fotos' : 'arquivos') : categoria;
  const caminho = `${user.id}/${pasta}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${nomeSeguro(file.name)}`;
  const tipo = file.type || 'application/octet-stream';
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(caminho, file, {
    contentType: tipo,
    upsert: false,
  });

  if (uploadError) throw new Error(`Não foi possível enviar ${file.name}: ${uploadError.message}`);

  const { data: registro, error: registroError } = await supabase
    .from('gm_files')
    .insert({
      user_id: user.id,
      categoria: pasta,
      bucket_id: BUCKET,
      object_path: caminho,
      original_name: file.name,
      content_type: tipo,
      size_bytes: file.size,
    })
    .select('id')
    .single();

  if (registroError) {
    await supabase.storage.from(BUCKET).remove([caminho]);
    throw new Error(`O arquivo foi enviado, mas não foi possível registrar seus dados: ${registroError.message}`);
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(caminho, 60 * 60);

  if (signedError || !signed?.signedUrl) {
    throw new Error(`Arquivo salvo, mas não foi possível gerar o link de acesso: ${signedError?.message || 'erro desconhecido'}`);
  }

  return { id: registro.id, nome: file.name, caminho, url: signed.signedUrl, tamanho: file.size, tipo };
}

export async function excluirArquivo(caminho: string): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Entre na sua conta para remover arquivos.');
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([caminho]);
  if (storageError) throw new Error(`Não foi possível remover o arquivo: ${storageError.message}`);
  const { error: recordError } = await supabase.from('gm_files').delete().eq('object_path', caminho).eq('user_id', user.id);
  if (recordError) throw new Error(`Arquivo removido, mas não foi possível remover o registro: ${recordError.message}`);
}

export async function listarArquivos(categoria: ArquivoCategoria): Promise<ArquivoEnviado[]> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Entre na sua conta para acessar os arquivos.');
  const query = supabase
    .from('gm_files')
    .select('id, original_name, object_path, content_type, size_bytes')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (categoria !== 'auto') query.eq('categoria', categoria);
  else query.in('categoria', ['fotos', 'arquivos', 'contratos']);
  const { data, error } = await query;
  if (error) throw new Error(`Não foi possível carregar os arquivos: ${error.message}`);
  return Promise.all((data as ArquivoRegistro[]).map(async (file) => {
    const { data: signed, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(file.object_path, 60 * 60);
    if (signedError || !signed?.signedUrl) {
      throw new Error(`Não foi possível abrir ${file.original_name}: ${signedError?.message || 'erro desconhecido'}`);
    }
    return {
      id: file.id,
      nome: file.original_name,
      caminho: file.object_path,
      url: signed.signedUrl,
      tamanho: Number(file.size_bytes),
      tipo: file.content_type,
    };
  }));
}
