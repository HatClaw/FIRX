import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RequestBody =
  | { action: 'create'; empresaId: string; email: string; nome: string; metaMensal?: number; cpf?: string; dataNascimento?: string; cep?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; uf?: string; fotoPath?: string }
  | { action: 'update'; empresaId: string; vendedorId: string; nome: string; email: string; metaMensal?: number; cpf?: string; dataNascimento?: string; cep?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; uf?: string; fotoPath?: string | null }
  | { action: 'resend_activation'; empresaId: string; vendedorId: string }
  | { action: 'delete'; empresaId: string; userId: string };

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function cpfValido(value: string) {
  if (!/^\d{11}$/.test(value) || /^([0-9])\1{10}$/.test(value)) return false;
  const digit = (base: string, initialWeight: number) => {
    const sum = [...base].reduce((total, char, index) => total + Number(char) * (initialWeight - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(value.slice(0, 9), 10) === Number(value[9]) && digit(value.slice(0, 10), 11) === Number(value[10]);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Método não permitido.' });

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json(401, { error: 'Autenticação necessária.' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey) {
    return json(500, { error: 'Configuração segura do serviço indisponível.' });
  }

  const token = authorization.slice('Bearer '.length);
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const serviceClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user: actor }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !actor) return json(401, { error: 'Sessão inválida ou expirada.' });

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Corpo JSON inválido.' });
  }

  if (!body || typeof body !== 'object' || !body.empresaId || !['create', 'update', 'resend_activation', 'delete'].includes(body.action)) {
    return json(400, { error: 'Ação ou empresa inválida.' });
  }

  const { data: platformAdminRecord, error: platformAdminError } = await serviceClient
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', actor.id)
    .maybeSingle();
  if (platformAdminError) return json(500, { error: 'Falha ao verificar permissões administrativas.' });

  if (body.action === 'create') {
    let empresaAdmin = false;
    if (!platformAdminRecord) {
      const { data: membership, error: membershipCheckError } = await serviceClient
        .from('empresa_members')
        .select('role')
        .eq('empresa_id', body.empresaId)
        .eq('usuario_id', actor.id)
        .eq('status', 'aceito')
        .maybeSingle();
      if (membershipCheckError) return json(500, { error: 'Falha ao verificar permissões da empresa.' });
      empresaAdmin = membership?.role === 'admin';
    }
    if (!platformAdminRecord && !empresaAdmin) {
      return json(403, { error: 'Apenas administradores da plataforma ou da empresa podem cadastrar vendedores.' });
    }
    if (typeof body.email !== 'string' || typeof body.nome !== 'string') {
      return json(400, { error: 'Nome e e-mail são obrigatórios.' });
    }
    const email = body.email.trim().toLowerCase();
    const nome = body.nome.trim();
    if (!/^\S+@\S+\.\S+$/.test(email) || !nome || nome.length > 120) {
      return json(400, { error: 'Informe nome e e-mail válido.' });
    }

    const metaMensal = Number(body.metaMensal ?? 0);
    if (!Number.isFinite(metaMensal) || metaMensal < 0 || metaMensal > 1_000_000_000) {
      return json(400, { error: 'Informe uma meta mensal válida.' });
    }

    const cpf = typeof body.cpf === 'string' ? body.cpf.replace(/\D/g, '') : '';
    if (cpf && !cpfValido(cpf)) return json(400, { error: 'CPF inválido. Confira os dígitos verificadores.' });
    const dataNascimento = typeof body.dataNascimento === 'string' && body.dataNascimento ? body.dataNascimento : null;
    if (dataNascimento && (!/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento) || Number.isNaN(Date.parse(`${dataNascimento}T00:00:00Z`)))) {
      return json(400, { error: 'Data de nascimento inválida.' });
    }
    const fotoPath = typeof body.fotoPath === 'string' ? body.fotoPath : null;
    if (fotoPath) {
      const { data: photo, error: photoError } = await serviceClient.from('gm_files')
        .select('object_path, content_type, size_bytes').eq('object_path', fotoPath).eq('user_id', actor.id).eq('categoria', 'fotos').maybeSingle();
      if (photoError || !photo || !photo.content_type.startsWith('image/') || Number(photo.size_bytes) > 5 * 1024 * 1024) {
        return json(400, { error: 'Foto inválida ou não enviada pela sua conta.' });
      }
    }

    const baseUrl = (Deno.env.get('APP_BASE_URL') || 'https://canal360.run.place/grow').replace(/\/$/, '');
    const activationRedirect = `${baseUrl}/auth/callback?flow=vendor-activation`;
    const readiness = await fetch(`${url}/functions/v1/smtp-mailer`, {
      method: 'POST',
      headers: { Authorization: authorization, apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_vendor_mail', empresaId: body.empresaId }),
    });
    if (!readiness.ok) {
      const readinessBody = await readiness.json().catch(() => ({}));
      return json(readiness.status, { error: typeof readinessBody.error === 'string' ? readinessBody.error : 'Configure e valide o SMTP antes de cadastrar vendedores.' });
    }

    const { data: generated, error: createError } = await serviceClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: activationRedirect,
        data: { nome, full_name: nome },
      },
    });
    const createdUser = generated?.user;
    const activationLink = generated?.properties?.action_link;
    if (createError || !createdUser || !activationLink) {
      return json(400, { error: createError?.message || 'Não foi possível criar o convite de ativação.' });
    }

    const { error: profileError } = await serviceClient.from('profiles').upsert({
      id: createdUser.id,
      email,
      nome,
      role: 'vendedor',
    });
    const { error: memberError } = profileError
      ? { error: profileError }
      : await serviceClient.from('empresa_members').insert({
          empresa_id: body.empresaId,
          usuario_id: createdUser.id,
          role: 'vendedor',
          status: 'aceito',
          aceito_em: new Date().toISOString(),
        });

    if (profileError || memberError) {
      await serviceClient.auth.admin.deleteUser(createdUser.id);
      return json(500, { error: 'Não foi possível concluir a vinculação; a conta criada foi revertida.' });
    }

    const { data: vendor, error: vendorError } = await serviceClient.from('vendedores').insert({
      empresa_id: body.empresaId,
      nome,
      email,
      identificador_interno: crypto.randomUUID().slice(0, 12),
      role: 'vendedor',
      status: 'inativo',
      meta_mensal: metaMensal,
      cpf: cpf || null,
      data_nascimento: dataNascimento,
      cep: typeof body.cep === 'string' ? body.cep.replace(/\D/g, '').slice(0, 8) || null : null,
      logradouro: typeof body.logradouro === 'string' ? body.logradouro.trim().slice(0, 180) || null : null,
      numero: typeof body.numero === 'string' ? body.numero.trim().slice(0, 30) || null : null,
      complemento: typeof body.complemento === 'string' ? body.complemento.trim().slice(0, 120) || null : null,
      bairro: typeof body.bairro === 'string' ? body.bairro.trim().slice(0, 120) || null : null,
      cidade: typeof body.cidade === 'string' ? body.cidade.trim().slice(0, 120) || null : null,
      uf: typeof body.uf === 'string' ? body.uf.trim().toUpperCase().slice(0, 2) || null : null,
      foto_path: fotoPath,
      usuario_id: createdUser.id,
      atualizado_por: actor.id,
    }).select('id').single();
    if (vendorError || !vendor) {
      await serviceClient.from('empresa_members').delete().eq('empresa_id', body.empresaId).eq('usuario_id', createdUser.id);
      await serviceClient.auth.admin.deleteUser(createdUser.id);
      return json(500, { error: 'Não foi possível concluir o cadastro do vendedor; a conta criada foi revertida.' });
    }

    const { error: activationEventError } = await serviceClient.from('gm_vendor_activation_events').insert({
      vendedor_id: vendor.id,
      empresa_id: body.empresaId,
      admin_user_id: actor.id,
      status: 'pending',
    });
    if (activationEventError) {
      await serviceClient.from('vendedores').delete().eq('id', vendor.id);
      await serviceClient.from('empresa_members').delete().eq('empresa_id', body.empresaId).eq('usuario_id', createdUser.id);
      await serviceClient.auth.admin.deleteUser(createdUser.id);
      return json(500, { error: 'Não foi possível registrar o fluxo de ativação; a conta criada foi revertida.' });
    }

    const { error: auditError } = await serviceClient.from('gm_admin_audit').insert({
      admin_user_id: actor.id,
      action: 'usuario.criado',
      details: { email, role: 'vendedor', empresa_id: body.empresaId },
    });
    if (auditError) {
      await serviceClient.from('gm_vendor_activation_events').delete().eq('vendedor_id', vendor.id);
      await serviceClient.from('vendedores').delete().eq('id', vendor.id);
      await serviceClient.from('empresa_members').delete().eq('empresa_id', body.empresaId).eq('usuario_id', createdUser.id);
      await serviceClient.auth.admin.deleteUser(createdUser.id);
      return json(500, { error: 'Não foi possível registrar auditoria; a conta criada foi revertida.' });
    }

    const mailResponse = await fetch(`${url}/functions/v1/smtp-mailer`, {
      method: 'POST',
      headers: { Authorization: authorization, apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_vendor_activation', empresaId: body.empresaId, email, nome, activationLink }),
    });
    const mailBody = await mailResponse.json().catch(() => ({}));
    return json(201, {
      userId: createdUser.id,
      vendedorId: vendor.id,
      email,
      nome,
      role: 'vendedor',
      emailSent: mailResponse.ok,
      message: mailResponse.ok
        ? 'Cadastro criado. O link de ativação foi enviado ao vendedor.'
        : (typeof mailBody.error === 'string' ? mailBody.error : 'Cadastro criado, mas não foi possível enviar o link de ativação.'),
    });
  }

  if (body.action === 'update' || body.action === 'resend_activation') {
    let empresaAdmin = false;
    if (!platformAdminRecord) {
      const { data: membership, error: membershipCheckError } = await serviceClient
        .from('empresa_members').select('role').eq('empresa_id', body.empresaId)
        .eq('usuario_id', actor.id).eq('status', 'aceito').maybeSingle();
      if (membershipCheckError) return json(500, { error: 'Falha ao verificar permissões da empresa.' });
      empresaAdmin = membership?.role === 'admin';
    }
    if (!platformAdminRecord && !empresaAdmin) return json(403, { error: 'Apenas administradores podem gerenciar vendedores.' });
    if (typeof body.vendedorId !== 'string' || !body.vendedorId) return json(400, { error: 'Vendedor inválido.' });

    const { data: vendor, error: vendorError } = await serviceClient.from('vendedores')
      .select('id, empresa_id, usuario_id, nome, email, status, foto_path')
      .eq('id', body.vendedorId).eq('empresa_id', body.empresaId).maybeSingle();
    if (vendorError || !vendor) return json(404, { error: 'Vendedor não encontrado nesta empresa.' });
    if (!vendor.usuario_id) return json(409, { error: 'Este vendedor ainda não possui conta de acesso vinculada.' });

    if (body.action === 'resend_activation') {
      if (vendor.status !== 'inativo') return json(409, { error: 'O link de ativação só pode ser reenviado enquanto o cadastro aguarda ativação.' });
      const { data: authRecord, error: authRecordError } = await serviceClient.auth.admin.getUserById(vendor.usuario_id);
      if (authRecordError || !authRecord.user) return json(404, { error: 'Conta de acesso do vendedor não encontrada.' });
      const email = (authRecord.user.email || vendor.email).toLowerCase();
      const baseUrl = (Deno.env.get('APP_BASE_URL') || 'https://canal360.run.place/grow').replace(/\/$/, '');
      const activationRedirect = `${baseUrl}/auth/callback?flow=vendor-activation`;
      const linkType = authRecord.user.email_confirmed_at ? 'recovery' : 'invite';
      const { data: generated, error: linkError } = await serviceClient.auth.admin.generateLink({
        type: linkType,
        email,
        options: { redirectTo: activationRedirect },
      });
      const activationLink = generated?.properties?.action_link;
      if (linkError || !activationLink) return json(400, { error: linkError?.message || 'Não foi possível gerar um novo link de ativação.' });

      const { error: eventError } = await serviceClient.from('gm_vendor_activation_events').upsert({
        vendedor_id: vendor.id, empresa_id: body.empresaId, admin_user_id: actor.id,
        status: 'pending', claimed_at: null, notified_at: null, last_error_code: null, updated_at: new Date().toISOString(),
      }, { onConflict: 'vendedor_id' });
      if (eventError) return json(500, { error: 'Não foi possível registrar o novo envio do convite.' });
      const mailResponse = await fetch(`${url}/functions/v1/smtp-mailer`, {
        method: 'POST',
        headers: { Authorization: authorization, apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_vendor_activation', empresaId: body.empresaId, email, nome: vendor.nome, activationLink }),
      });
      const mailBody = await mailResponse.json().catch(() => ({}));
      await serviceClient.from('gm_admin_audit').insert({
        admin_user_id: actor.id, action: mailResponse.ok ? 'vendedor.convite_reenviado' : 'vendedor.convite_reenvio_falhou',
        details: { vendedor_id: vendor.id, empresa_id: body.empresaId, email },
      });
      if (!mailResponse.ok) return json(mailResponse.status, { error: typeof mailBody.error === 'string' ? mailBody.error : 'Não foi possível enviar o link de ativação.' });
      return json(200, { emailSent: true, email, message: 'Novo link de ativação enviado.' });
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
    if (!email || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || !nome || nome.length > 120) {
      return json(400, { error: 'Informe nome e e-mail válidos.' });
    }
    const metaMensal = Number(body.metaMensal ?? 0);
    if (!Number.isFinite(metaMensal) || metaMensal < 0 || metaMensal > 1_000_000_000) return json(400, { error: 'Informe uma meta mensal válida.' });
    const cpf = typeof body.cpf === 'string' ? body.cpf.replace(/\D/g, '') : '';
    if (cpf && !cpfValido(cpf)) return json(400, { error: 'CPF inválido. Confira os dígitos verificadores.' });
    const dataNascimento = typeof body.dataNascimento === 'string' && body.dataNascimento ? body.dataNascimento : null;
    if (dataNascimento && (!/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento) || Number.isNaN(Date.parse(`${dataNascimento}T00:00:00Z`)))) return json(400, { error: 'Data de nascimento inválida.' });
    const fotoPath = typeof body.fotoPath === 'string' ? body.fotoPath : null;
    if (fotoPath && fotoPath !== vendor.foto_path) {
      const { data: photo, error: photoError } = await serviceClient.from('gm_files').select('object_path, content_type, size_bytes')
        .eq('object_path', fotoPath).eq('user_id', actor.id).eq('categoria', 'fotos').maybeSingle();
      if (photoError || !photo || !photo.content_type.startsWith('image/') || Number(photo.size_bytes) > 5 * 1024 * 1024) return json(400, { error: 'Foto inválida ou não enviada pela sua conta.' });
    }

    const { data: existingAuth, error: existingAuthError } = await serviceClient.auth.admin.getUserById(vendor.usuario_id);
    if (existingAuthError || !existingAuth.user) return json(404, { error: 'Conta de acesso do vendedor não encontrada.' });
    if (email !== String(existingAuth.user.email || '').toLowerCase()) {
      const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(vendor.usuario_id, { email });
      if (authUpdateError) {
        const conflict = /already|exists|duplicate/i.test(authUpdateError.message);
        return json(conflict ? 409 : 400, { error: conflict ? 'Este e-mail já está vinculado a outra conta.' : `Não foi possível atualizar o e-mail de acesso: ${authUpdateError.message}` });
      }
    }

    const { error: profileError } = await serviceClient.from('profiles').update({ email, nome }).eq('id', vendor.usuario_id);
    if (profileError) {
      if (email !== String(existingAuth.user.email || '').toLowerCase()) await serviceClient.auth.admin.updateUserById(vendor.usuario_id, { email: existingAuth.user.email! });
      return json(500, { error: 'Não foi possível atualizar o perfil; a alteração de e-mail foi revertida.' });
    }
    const { error: updateError } = await serviceClient.from('vendedores').update({
      nome, email, meta_mensal: metaMensal, cpf: cpf || null, data_nascimento: dataNascimento,
      cep: typeof body.cep === 'string' ? body.cep.replace(/\D/g, '').slice(0, 8) || null : null,
      logradouro: typeof body.logradouro === 'string' ? body.logradouro.trim().slice(0, 180) || null : null,
      numero: typeof body.numero === 'string' ? body.numero.trim().slice(0, 30) || null : null,
      complemento: typeof body.complemento === 'string' ? body.complemento.trim().slice(0, 120) || null : null,
      bairro: typeof body.bairro === 'string' ? body.bairro.trim().slice(0, 120) || null : null,
      cidade: typeof body.cidade === 'string' ? body.cidade.trim().slice(0, 120) || null : null,
      uf: typeof body.uf === 'string' ? body.uf.trim().toUpperCase().slice(0, 2) || null : null,
      foto_path: fotoPath, atualizado_por: actor.id,
    }).eq('id', vendor.id).eq('empresa_id', body.empresaId);
    if (updateError) {
      await serviceClient.from('profiles').update({ email: vendor.email, nome: vendor.nome }).eq('id', vendor.usuario_id);
      if (email !== String(existingAuth.user.email || '').toLowerCase()) await serviceClient.auth.admin.updateUserById(vendor.usuario_id, { email: existingAuth.user.email! });
      return json(500, { error: 'Não foi possível salvar os dados; perfil e e-mail foram revertidos.' });
    }
    const { error: auditError } = await serviceClient.from('gm_admin_audit').insert({
      admin_user_id: actor.id, action: 'vendedor.atualizado',
      details: { vendedor_id: vendor.id, empresa_id: body.empresaId, email_anterior: vendor.email, email_novo: email },
    });
    if (auditError) return json(500, { error: 'Dados salvos, mas não foi possível registrar a auditoria.' });
    return json(200, { vendedorId: vendor.id, email });
  }

  if (!platformAdminRecord) return json(403, { error: 'Apenas administradores da plataforma podem excluir contas.' });

  if (typeof body.userId !== 'string' || !body.userId || body.userId === actor.id) return json(400, { error: 'Usuário de destino inválido.' });
  const { data: target, error: targetError } = await serviceClient.auth.admin.getUserById(body.userId);
  if (targetError || !target.user) return json(404, { error: 'Usuário não encontrado.' });
  const { data: targetPlatformAdmin, error: targetPlatformAdminError } = await serviceClient
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', body.userId)
    .maybeSingle();
  if (targetPlatformAdminError) return json(500, { error: 'Falha ao verificar conta de destino.' });
  if (targetPlatformAdmin) {
    return json(403, { error: 'Contas de administração da plataforma não podem ser removidas por esta operação.' });
  }

  const { data: targetMembership, error: targetMembershipError } = await serviceClient
    .from('empresa_members')
    .select('role')
    .eq('empresa_id', body.empresaId)
    .eq('usuario_id', body.userId)
    .eq('status', 'aceito')
    .maybeSingle();
  if (targetMembershipError) return json(500, { error: 'Falha ao verificar usuário.' });
  if (targetMembership?.role !== 'vendedor') return json(403, { error: 'Somente contas de vendedor vinculadas podem ser removidas.' });

  const { data: otherMemberships, error: otherMembershipsError } = await serviceClient
    .from('empresa_members')
    .select('id')
    .eq('usuario_id', body.userId)
    .neq('empresa_id', body.empresaId);
  if (otherMembershipsError) return json(500, { error: 'Falha ao verificar os vínculos do usuário.' });
  if (otherMemberships?.length) {
    return json(409, { error: 'Esta conta também pertence a outra empresa. Remova os outros vínculos antes de excluir a conta.' });
  }

  const { data: ownedCompanies, error: ownedCompaniesError } = await serviceClient
    .from('empresas')
    .select('id')
    .eq('responsavel_id', body.userId)
    .limit(1);
  if (ownedCompaniesError) return json(500, { error: 'Falha ao verificar titularidade.' });
  if (ownedCompanies?.length) return json(409, { error: 'Esta conta é responsável por uma empresa e não pode ser excluída.' });

  const { error: auditError } = await serviceClient.from('gm_admin_audit').insert({
    admin_user_id: actor.id,
    action: 'usuario.exclusao_solicitada',
    details: { email: target.user.email, role: 'vendedor', empresa_id: body.empresaId },
  });
  if (auditError) return json(500, { error: 'Não foi possível registrar a auditoria da exclusão.' });

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(body.userId);
  if (deleteError) {
    await serviceClient.from('gm_admin_audit').insert({
      admin_user_id: actor.id,
      action: 'usuario.exclusao_falhou',
      details: { email: target.user.email, role: 'vendedor', empresa_id: body.empresaId },
    });
    return json(500, { error: 'Não foi possível excluir a conta. Verifique dependências de armazenamento ou vínculos.' });
  }

  await serviceClient.from('gm_admin_audit').insert({
    admin_user_id: actor.id,
    action: 'usuario.excluido',
    details: { email: target.user.email, role: 'vendedor', empresa_id: body.empresaId },
  });
  return json(200, { userId: body.userId, deleted: true });
});
