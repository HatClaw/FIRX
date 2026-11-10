import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const roles = new Set(['gestor', 'desenvolvedor', 'designer', 'copywriter', 'trafego']);

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
  if (!url || !anonKey || !serviceRoleKey) return respond(500, { error: 'Configuração segura de convites indisponível.' });

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const serviceClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice('Bearer '.length);
  const { data: { user: actor }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !actor) return respond(401, { error: 'Sessão inválida ou expirada.' });

  const { data: canManageTeam, error: permissionError } = await authClient.rpc('marketing_has_permission', { p_permission: 'team.manage' });
  if (permissionError) return respond(500, { error: 'Não foi possível validar a permissão para convidar integrantes.' });
  if (canManageTeam !== true) return respond(403, { error: 'A permissão para gerenciar a equipe de Marketing é necessária.' });

  let input: { nome?: unknown; email?: unknown; role?: unknown };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return respond(400, { error: 'Corpo JSON inválido.' });
    input = parsed as typeof input;
  } catch {
    return respond(400, { error: 'Corpo JSON inválido.' });
  }

  const nome = typeof input.nome === 'string' ? input.nome.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const role = typeof input.role === 'string' ? input.role : '';
  if (nome.length < 2 || nome.length > 120) return respond(400, { error: 'Informe um nome entre 2 e 120 caracteres.' });
  if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) return respond(400, { error: 'Informe um e-mail válido.' });
  if (!roles.has(role)) return respond(400, { error: 'Selecione uma função válida para a equipe.' });

  const appBaseUrl = (Deno.env.get('APP_BASE_URL') || 'https://canal360.run.place/grow').replace(/\/$/, '');
  let redirectTo: string;
  try {
    const base = new URL(appBaseUrl);
    if (base.protocol !== 'https:' || base.hostname !== 'canal360.run.place') throw new Error('base inválida');
    redirectTo = new URL('auth/callback?flow=marketing-activation', `${base.toString().replace(/\/$/, '')}/`).toString();
  } catch {
    return respond(500, { error: 'A URL segura de ativação da equipe não está configurada.' });
  }

  const { data: invitation, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    data: { nome, full_name: nome, marketing_invitation: true },
    redirectTo,
  });
  if (inviteError || !invitation.user) {
    const message = inviteError?.message || 'O convite não foi criado.';
    if (/already|registered|exists/i.test(message)) {
      return respond(409, { error: 'Este e-mail já possui uma conta. Use a opção de autorizar usuário existente.' });
    }
    return respond(400, { error: `Não foi possível enviar o convite: ${message}` });
  }

  const invitedUser = invitation.user;
  const { error: memberError } = await serviceClient.from('marketing_members').insert({
    user_id: invitedUser.id,
    nome,
    email,
    role,
    status: 'active',
    invited_by: actor.id,
  });
  if (memberError) {
    await serviceClient.auth.admin.deleteUser(invitedUser.id);
    return respond(500, { error: 'O convite de autenticação foi enviado, mas não foi possível vincular a pessoa à equipe. O acesso foi revertido; gere um novo convite após corrigir o cadastro.' });
  }

  return respond(201, { ok: true, userId: invitedUser.id, nome, email, role, message: 'Convite enviado. A pessoa receberá um link para confirmar o e-mail e definir a senha.' });
});

