import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ChatRequest = {
  action?: 'sync' | 'send';
  empresaId?: string;
  vendedorId?: string;
  body?: string;
  attachmentPath?: string;
};

const allowedAttachmentTypes = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function respond(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'Método não permitido.' });

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'Autenticação necessária.' });
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey) return respond(500, { error: 'Configuração segura do chat indisponível.' });

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const serviceClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice('Bearer '.length);
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return respond(401, { error: 'Sessão inválida ou expirada.' });

  let input: ChatRequest;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return respond(400, { error: 'Corpo JSON inválido.' });
    input = parsed as ChatRequest;
  } catch {
    return respond(400, { error: 'Corpo JSON inválido.' });
  }
  if (!input.empresaId || (input.action !== 'sync' && input.action !== 'send')) {
    return respond(400, { error: 'Empresa ou ação inválida.' });
  }

  const { data: membership, error: membershipError } = await serviceClient
    .from('empresa_members').select('role').eq('empresa_id', input.empresaId)
    .eq('usuario_id', user.id).eq('status', 'aceito').maybeSingle();
  if (membershipError) return respond(500, { error: 'Falha ao verificar acesso à empresa.' });
  const role = membership?.role;
  if (!role || !['admin', 'gestor', 'vendedor'].includes(role)) {
    return respond(403, { error: 'O chat está disponível para vendedores e equipe administrativa da empresa.' });
  }

  let vendorQuery = serviceClient.from('vendedores').select('id, nome, email, usuario_id')
    .eq('empresa_id', input.empresaId).order('nome', { ascending: true });
  if (role === 'vendedor') vendorQuery = vendorQuery.eq('usuario_id', user.id);
  const { data: vendors, error: vendorsError } = await vendorQuery;
  if (vendorsError) return respond(500, { error: 'Não foi possível carregar os vendedores do chat.' });
  if (role === 'vendedor' && (vendors || []).length !== 1) return respond(403, { error: 'Sua conta não está vinculada a um vendedor nesta empresa.' });

  const availableVendors = (vendors || []).map((vendor) => ({ id: vendor.id, name: vendor.nome, email: role === 'vendedor' ? '' : vendor.email }));
  if (input.action === 'send') {
    const vendor = availableVendors.find((item) => item.id === input.vendedorId);
    const messageText = typeof input.body === 'string' ? input.body.trim() : '';
    const attachmentPath = typeof input.attachmentPath === 'string' ? input.attachmentPath : '';
    if (!vendor || (!messageText && !attachmentPath) || messageText.length > 5000) {
      return respond(400, { error: 'Informe uma conversa válida e uma mensagem ou anexo (até 5.000 caracteres).' });
    }

    let attachment: { object_path: string; original_name: string; content_type: string; size_bytes: number; categoria: string } | null = null;
    if (attachmentPath) {
      const { data, error } = await serviceClient.from('gm_files')
        .select('object_path, original_name, content_type, size_bytes, categoria')
        .eq('object_path', attachmentPath).eq('user_id', user.id).maybeSingle();
      if (error || !data || Number(data.size_bytes) > 10 * 1024 * 1024
        || !allowedAttachmentTypes.has(data.content_type) || !['fotos', 'arquivos'].includes(data.categoria)) {
        return respond(400, { error: 'O anexo não foi enviado por esta conta ou excede o limite de 10 MB.' });
      }
      attachment = data;
    }

    const { error } = await serviceClient.from('gm_chat_messages').insert({
      empresa_id: input.empresaId,
      vendedor_id: vendor.id,
      sender_id: user.id,
      body: messageText,
      attachment_path: attachment?.object_path || null,
      attachment_name: attachment?.original_name || null,
      attachment_type: attachment?.content_type || null,
    });
    if (error) return respond(500, { error: 'Não foi possível enviar a mensagem.' });
  } else if (input.vendedorId && !availableVendors.some((item) => item.id === input.vendedorId)) {
    return respond(403, { error: 'Você não tem acesso a esta conversa.' });
  }

  let messages: Array<Record<string, unknown>> = [];
  if (input.vendedorId) {
    const { error: markError } = await serviceClient.from('gm_chat_messages').update({ read_at: new Date().toISOString() })
      .eq('empresa_id', input.empresaId).eq('vendedor_id', input.vendedorId).neq('sender_id', user.id).is('read_at', null);
    if (markError) return respond(500, { error: 'Não foi possível marcar as mensagens como lidas.' });
    const { data, error } = await serviceClient.from('gm_chat_messages')
      .select('id, vendedor_id, sender_id, body, attachment_path, attachment_name, attachment_type, created_at, read_at')
      .eq('empresa_id', input.empresaId).eq('vendedor_id', input.vendedorId)
      .order('created_at', { ascending: true }).limit(200);
    if (error) return respond(500, { error: 'Não foi possível carregar as mensagens.' });
    messages = await Promise.all((data || []).map(async (message) => {
      let attachmentUrl: string | null = null;
      if (message.attachment_path) {
        const { data: signed } = await serviceClient.storage.from('growmoney-files')
          .createSignedUrl(message.attachment_path, 60 * 60);
        attachmentUrl = signed?.signedUrl || null;
      }
      return {
        id: message.id,
        vendedorId: message.vendedor_id,
        senderId: message.sender_id,
        senderName: message.sender_id === user.id ? 'Você' : role === 'vendedor' ? 'Empresa' : availableVendors.find((item) => item.id === message.vendedor_id)?.name || 'Vendedor',
        body: message.body,
        attachmentName: message.attachment_name,
        attachmentType: message.attachment_type,
        attachmentUrl,
        createdAt: message.created_at,
        readAt: message.read_at,
      };
    }));
  }

  const unreadQuery = serviceClient.from('gm_chat_messages').select('id, vendedor_id')
    .eq('empresa_id', input.empresaId).neq('sender_id', user.id).is('read_at', null)
    .order('created_at', { ascending: false }).limit(500);
  if (role === 'vendedor') unreadQuery.eq('vendedor_id', availableVendors[0].id);
  const { data: unreadRows, error: unreadError } = await unreadQuery;
  if (unreadError) return respond(500, { error: 'Não foi possível consultar mensagens não lidas.' });

  const unreadByVendor: Record<string, number> = {};
  for (const row of unreadRows || []) unreadByVendor[row.vendedor_id] = (unreadByVendor[row.vendedor_id] || 0) + 1;
  return respond(200, {
    vendors: availableVendors,
    unreadCount: (unreadRows || []).length,
    unreadMessageIds: (unreadRows || []).map((row) => row.id),
    unreadByVendor,
    messages,
    sent: input.action === 'send',
  });
});
