import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { EMAIL_TEMPLATE_KEYS, EMAIL_BRAND_LOGO_ASSET, ensureEmailLink, mergeEmailTemplates, renderEmailHtmlTemplate, renderEmailTemplate, validateEmailTemplate, type EmailTemplateKey } from "../../../src/lib/email-templates.ts";

type Settings = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password_ciphertext: string;
  password_nonce: string;
  from_email: string;
  from_name: string;
  enabled: boolean;
};

type Action = "get_settings" | "save_settings" | "get_templates" | "save_template" | "sync_mailchimp_templates" | "test_mailchimp_connection" | "test_connection" | "test_email" | "send_signature" | "check_vendor_mail" | "send_vendor_activation" | "notify_vendor_activated";

const corsHeaders = (origin: string | null) => {
  const configured = Deno.env.get("APP_ORIGIN") || "https://canal360.run.place";
  const allowed = origin === configured || (Deno.env.get("ENVIRONMENT") !== "production" && !!origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : configured,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
};

function respond(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

function getClients(request: Request): { userClient: SupabaseClient; serviceClient: SupabaseClient } {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!url || !anonKey || !serviceKey || !authorization) throw new Error("Serviço ou sessão indisponível.");
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { userClient, serviceClient };
}

async function isPlatformAdmin(client: SupabaseClient): Promise<boolean> {
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return false;
  const { data, error } = await client.rpc("is_platform_admin");
  return !error && data === true;
}

function emailIsValid(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function encodeBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function encryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SMTP_ENCRYPTION_KEY");
  if (!secret || secret.length < 32) throw new Error("SMTP_ENCRYPTION_KEY ausente ou menor que 32 caracteres.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptPassword(password: string) {
  const key = await encryptionKey();
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, new TextEncoder().encode(password));
  return { password_nonce: encodeBase64(nonce), password_ciphertext: encodeBase64(new Uint8Array(ciphertext)) };
}

async function decryptPassword(settings: Settings): Promise<string> {
  const key = await encryptionKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64(settings.password_nonce) },
    key,
    decodeBase64(settings.password_ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

async function loadSettings(client: SupabaseClient): Promise<Settings | null> {
  const { data, error } = await client.from("gm_smtp_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw new Error("Não foi possível carregar a configuração de e-mail.");
  return data as Settings | null;
}

function makeTransport(settings: Settings, password: string) {
  if (settings.port !== 587 || settings.secure !== false) {
    throw new Error("O SMTP da hospedagem requer porta 587 com STARTTLS.");
  }
  const endpoint = Deno.env.get("SMTP_HOSTING_API_URL");
  const bridgeKey = Deno.env.get("SMTP_HOSTING_API_KEY");
  if (!endpoint || !bridgeKey || !endpoint.startsWith("https://") || bridgeKey.length < 32) {
    throw new Error("SMTP_HOSTING_API_URL ou SMTP_HOSTING_API_KEY não configurado.");
  }
  const call = async (payload: Record<string, unknown>) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${bridgeKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ settings: {
        host: settings.host, port: settings.port, username: settings.username,
        fromEmail: settings.from_email, fromName: settings.from_name, password,
      }, ...payload }),
      signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json().catch(() => ({})) as { error?: string; code?: string };
    if (!response.ok) {
      const error = new Error(result.error || "O servidor de hospedagem recusou a operação SMTP.") as Error & { code?: string };
      error.code = result.code || `HOSTING_${response.status}`;
      throw error;
    }
    return result;
  };
  return {
    verify: () => call({ action: "verify" }),
    sendMail: (mail: Record<string, unknown>) => call({ action: "send", mail }),
  };
}

function escapeHtml(value: string) {
  const replacements: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (char) => replacements[char] || char);
}

async function loadEmailTemplates(client: SupabaseClient) {
  const { data, error } = await client.from("gm_email_templates").select("template_key, subject, html");
  if (error) throw new Error("Não foi possível carregar os modelos de e-mail.");
  const stored = Object.fromEntries((data || []).map((row) => [row.template_key, { subject: row.subject, html: row.html }]));
  return mergeEmailTemplates(stored);
}

function renderSubject(template: string, variables: Record<string, string>, fallback: string) {
  return safeHeader(renderEmailTemplate(template, variables, (value) => value), fallback);
}

function safeHeader(value: unknown, fallback: string) {
  return (typeof value === "string" ? value : fallback).replace(/[\r\n\u0000-\u001f]/g, " ").trim().slice(0, 160) || fallback;
}

function safeSmtpFailure(error: unknown) {
  const originalMessage = error instanceof Error ? error.message : "";
  if (originalMessage.includes("SMTP_ENCRYPTION_KEY")) {
    return { message: "Configure o segredo SMTP_ENCRYPTION_KEY nas Edge Function Secrets.", code: "ENCRYPTION_KEY_MISSING" };
  }
  if (originalMessage.includes("SMTP da hospedagem requer")) {
    return { message: originalMessage, code: "SMTP_PORT_UNSUPPORTED" };
  }
  if (originalMessage.includes("SMTP_HOSTING_API_URL") || originalMessage.includes("SMTP_HOSTING_API_KEY")) {
    return { message: "Configure o endereço e a chave segura da ponte SMTP da hospedagem.", code: "SMTP_HOSTING_NOT_CONFIGURED" };
  }
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code.replace(/[^A-Z0-9_]/gi, "").slice(0, 32)
    : "";
  if (code === "SMTP_550_RCPT_TO") {
    return {
      message: "O servidor SMTP recusou o endereço destinatário (550 em RCPT TO). Confirme se a caixa existe e se o servidor aceita mensagens para esse domínio.",
      code,
    };
  }
  return {
    message: code
      ? `Falha no envio SMTP (${code}). Verifique o servidor, porta 587 com STARTTLS e as credenciais.`
      : "Falha no envio SMTP. Verifique o servidor, porta 587 com STARTTLS e as credenciais.",
    code: code || "SMTP_ERROR",
  };
}

async function isCompanyAdmin(client: SupabaseClient, userId: string, empresaId: unknown): Promise<boolean> {
  if (typeof empresaId !== "string" || !/^[0-9a-f-]{36}$/i.test(empresaId)) return false;
  const { data, error } = await client.from("empresa_members")
    .select("id").eq("empresa_id", empresaId).eq("usuario_id", userId)
    .eq("role", "admin").eq("status", "aceito").maybeSingle();
  return !error && Boolean(data);
}

async function logMail(client: SupabaseClient, actorId: string, action: string, recipient: string | null, success: boolean, details: Record<string, unknown> = {}) {
  await client.from("gm_smtp_mail_log").insert({
    actor_id: actorId,
    action,
    recipient,
    status: success ? "success" : "failure",
    details,
  });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (request.method !== "POST") return respond({ error: "Método não permitido." }, 405, origin);

  let clients: ReturnType<typeof getClients>;
  let actorId: string;
  try {
    clients = getClients(request);
    const { data: { user }, error } = await clients.userClient.auth.getUser();
    if (error || !user) return respond({ error: "Sessão inválida ou expirada." }, 401, origin);
    actorId = user.id;
  } catch {
    return respond({ error: "Serviço ou sessão indisponível." }, 503, origin);
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return respond({ error: "Corpo da solicitação inválido." }, 400, origin);
  }
  const action = input.action as Action;
  if (!["get_settings", "save_settings", "get_templates", "save_template", "sync_mailchimp_templates", "test_mailchimp_connection", "test_connection", "test_email", "send_signature", "check_vendor_mail", "send_vendor_activation", "notify_vendor_activated"].includes(action)) {
    return respond({ error: "Ação inválida." }, 400, origin);
  }

  const platformAdmin = await isPlatformAdmin(clients.userClient);
  const platformAdminOnlyAction = ["get_settings", "save_settings", "get_templates", "save_template", "sync_mailchimp_templates", "test_mailchimp_connection", "test_connection", "test_email"].includes(action);
  if (platformAdminOnlyAction && !platformAdmin) {
    return respond({ error: "Acesso restrito ao administrador da plataforma." }, 403, origin);
  }
  if (["check_vendor_mail", "send_vendor_activation"].includes(action)
    && !platformAdmin && !(await isCompanyAdmin(clients.serviceClient, actorId, input.empresaId))) {
    return respond({ error: "Apenas o administrador da empresa pode enviar convites de vendedor." }, 403, origin);
  }

  if (action === "check_vendor_mail") {
    try {
      const settings = await loadSettings(clients.serviceClient);
      if (!settings?.enabled) return respond({ error: "Configure e ative o SMTP no painel administrativo antes de cadastrar vendedores." }, 409, origin);
      const transport = makeTransport(settings, await decryptPassword(settings));
      await transport.verify();
      return respond({ ready: true }, 200, origin);
    } catch (error) {
      return respond({ error: safeSmtpFailure(error).message }, 502, origin);
    }
  }

  if (action === "send_vendor_activation") {
    const email = input.email;
    const nome = typeof input.nome === "string" ? safeHeader(input.nome, "Vendedor") : "Vendedor";
    const activationLink = input.activationLink;
    const empresaId = input.empresaId;
    if (!emailIsValid(email) || typeof activationLink !== "string" || activationLink.length > 4096
      || !/^https:\/\//i.test(activationLink) || typeof empresaId !== "string") {
      return respond({ error: "Dados do convite de ativação inválidos." }, 400, origin);
    }
    try {
      const linkUrl = new URL(activationLink);
      const authUrl = new URL(Deno.env.get("SUPABASE_URL") || "");
      if (linkUrl.origin !== authUrl.origin || linkUrl.pathname !== "/auth/v1/verify") {
        return respond({ error: "O link informado não pertence ao serviço de autenticação do GrowMoney." }, 400, origin);
      }
    } catch {
      return respond({ error: "Link de ativação inválido." }, 400, origin);
    }
    const { data: seller, error: sellerError } = await clients.serviceClient.from("vendedores")
      .select("id").eq("empresa_id", empresaId).eq("email", email.toLowerCase()).eq("status", "inativo").maybeSingle();
    if (sellerError || !seller) return respond({ error: "Vendedor pendente não encontrado para este convite." }, 404, origin);
    try {
      const settings = await loadSettings(clients.serviceClient);
      if (!settings?.enabled) throw new Error("SMTP_NOT_CONFIGURED");
      const transport = makeTransport(settings, await decryptPassword(settings));
      await transport.verify();
      const { data: company } = await clients.serviceClient.from("empresas").select("nome").eq("id", empresaId).maybeSingle();
      const appUrl = Deno.env.get("APP_BASE_URL") || "https://canal360.run.place/grow";
      const template = (await loadEmailTemplates(clients.serviceClient)).vendor_activation;
      const templateVariables = {
        nome, empresa: company?.nome || "a empresa", link: activationLink,
        appUrl, logoUrl: `${appUrl.replace(/\/$/, "")}/${EMAIL_BRAND_LOGO_ASSET}`,
      };
      const activationHtml = ensureEmailLink(
        renderEmailHtmlTemplate(template.html, templateVariables, escapeHtml),
        activationLink,
        escapeHtml,
        "Ativar e definir senha",
      );
      await transport.sendMail({
        from: { name: settings.from_name, address: settings.from_email },
        to: email,
        subject: renderSubject(template.subject, templateVariables, "Ative seu acesso ao GrowMoney"),
        text: `Olá ${nome},\n\nSeu cadastro de vendedor para ${company?.nome || "a empresa"} foi criado. Confirme seu e-mail e defina sua senha para ativar o acesso pelo link abaixo:\n\n${activationLink}\n\nSe você não esperava este convite, ignore esta mensagem.`,
        html: activationHtml,
      });
      await logMail(clients.serviceClient, actorId, "vendor_activation_email", email, true, { empresaId, vendedorId: seller.id });
      return respond({ sent: true }, 200, origin);
    } catch (error) {
      const failure = safeSmtpFailure(error);
      await logMail(clients.serviceClient, actorId, "vendor_activation_email", email, false, { empresaId, vendedorId: seller.id, errorCode: failure.code });
      return respond({ error: failure.message }, 502, origin);
    }
  }

  if (action === "notify_vendor_activated") {
    const { data: { user: confirmedUser }, error: confirmedUserError } = await clients.userClient.auth.getUser();
    if (confirmedUserError || !confirmedUser || !confirmedUser.email_confirmed_at) {
      return respond({ notApplicable: true }, 200, origin);
    }
    const { data: sellerRows, error: sellerError } = await clients.serviceClient.from("vendedores")
      .select("id, empresa_id, nome, email").eq("usuario_id", confirmedUser.id);
    if (sellerError || !sellerRows?.length) return respond({ notApplicable: true }, 200, origin);
    await clients.serviceClient.from("vendedores").update({ status: "ativo" }).eq("usuario_id", confirmedUser.id);
    const results: Array<{ notified: boolean; alreadySent?: boolean }> = [];
    for (const seller of sellerRows) {
      const { data: event } = await clients.serviceClient.from("gm_vendor_activation_events")
        .select("id, empresa_id, admin_user_id, status, claimed_at").eq("vendedor_id", seller.id).maybeSingle();
      if (!event) continue;
      if (event.status === "sent") { results.push({ notified: true, alreadySent: true }); continue; }
      const now = new Date();
      const staleBefore = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
      let { data: claimed } = await clients.serviceClient.from("gm_vendor_activation_events")
        .update({ status: "sending", claimed_at: now.toISOString(), updated_at: now.toISOString(), last_error_code: null })
        .eq("id", event.id).in("status", ["pending", "failed"]).select("id").maybeSingle();
      if (!claimed && event.status === "sending") {
        ({ data: claimed } = await clients.serviceClient.from("gm_vendor_activation_events")
          .update({ status: "sending", claimed_at: now.toISOString(), updated_at: now.toISOString(), last_error_code: null })
          .eq("id", event.id).eq("status", "sending").lt("claimed_at", staleBefore).select("id").maybeSingle());
      }
      if (!claimed) { results.push({ notified: false }); continue; }

      try {
        const { data: memberships } = await clients.serviceClient.from("empresa_members")
          .select("usuario_id").eq("empresa_id", seller.empresa_id).eq("role", "admin").eq("status", "aceito");
        const adminIds = new Set<string>((memberships || []).map((membership) => membership.usuario_id));
        adminIds.add(event.admin_user_id);
        adminIds.delete(confirmedUser.id);
        const { data: profiles } = await clients.serviceClient.from("profiles")
          .select("id, email, nome").in("id", [...adminIds]);
        const recipientMap = new Map<string, { email: string; nome: string }>();
        for (const profile of profiles || []) {
          if (emailIsValid(profile.email) && profile.email.toLowerCase() !== String(seller.email).toLowerCase()) {
            recipientMap.set(profile.email.toLowerCase(), { email: profile.email, nome: profile.nome || "Administrador" });
          }
        }
        if (!recipientMap.size) throw new Error("ADMIN_RECIPIENT_MISSING");
        const settings = await loadSettings(clients.serviceClient);
        if (!settings?.enabled) throw new Error("SMTP_NOT_CONFIGURED");
        const transport = makeTransport(settings, await decryptPassword(settings));
        await transport.verify();
        const appUrl = Deno.env.get("APP_BASE_URL") || "https://canal360.run.place/grow";
        const companyName = await clients.serviceClient.from("empresas").select("nome").eq("id", seller.empresa_id).maybeSingle();
        const recipients = [...recipientMap.values()];
        const template = (await loadEmailTemplates(clients.serviceClient)).vendor_activation_admin_notice;
        const templateVariables = {
          nome: seller.nome, email: seller.email, empresa: companyName.data?.nome || "—",
          appUrl, logoUrl: `${appUrl.replace(/\/$/, "")}/${EMAIL_BRAND_LOGO_ASSET}`,
        };
        await transport.sendMail({
          from: { name: settings.from_name, address: settings.from_email },
          to: recipients.map((recipient) => recipient.email),
          subject: renderSubject(template.subject, templateVariables, `Cadastro de vendedor ativado: ${safeHeader(seller.nome, "Vendedor")}`),
          text: `O vendedor ${seller.nome} (${seller.email}) confirmou o e-mail e ativou o cadastro em ${companyName.data?.nome || "sua empresa"}.`,
          html: renderEmailHtmlTemplate(template.html, templateVariables, escapeHtml),
        });
        await clients.serviceClient.from("gm_vendor_activation_events").update({ status: "sent", notified_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error_code: null }).eq("id", event.id);
        await logMail(clients.serviceClient, confirmedUser.id, "vendor_activation_admin_notice", recipients.map((recipient) => recipient.email).join(", "), true, { empresaId: seller.empresa_id, vendedorId: seller.id });
        results.push({ notified: true });
      } catch (error) {
        const failure = safeSmtpFailure(error);
        await clients.serviceClient.from("gm_vendor_activation_events").update({ status: "failed", updated_at: new Date().toISOString(), last_error_code: failure.code }).eq("id", event.id);
        await logMail(clients.serviceClient, confirmedUser.id, "vendor_activation_admin_notice", null, false, { empresaId: seller.empresa_id, vendedorId: seller.id, errorCode: failure.code });
        results.push({ notified: false });
      }
    }
    return respond({ activated: true, notifications: results }, 200, origin);
  }

  if (action === "get_templates") {
    try {
      return respond({ templates: await loadEmailTemplates(clients.serviceClient) }, 200, origin);
    } catch (error) {
      return respond({ error: error instanceof Error ? error.message : "Falha ao consultar modelos de e-mail." }, 500, origin);
    }
  }

  if (action === "save_template") {
    const key = input.key;
    const template = input.template;
    if (typeof key !== "string" || !EMAIL_TEMPLATE_KEYS.includes(key as EmailTemplateKey)) {
      return respond({ error: "Selecione um modelo de e-mail válido." }, 400, origin);
    }
    const validationError = validateEmailTemplate(template);
    if (validationError) return respond({ error: validationError }, 400, origin);
    const candidate = template as { subject: string; html: string };
    try {
      const { error } = await clients.serviceClient.from("gm_email_templates").upsert({
        template_key: key, subject: candidate.subject.trim(), html: candidate.html,
        updated_by: actorId, updated_at: new Date().toISOString(),
      });
      if (error) throw new Error("Não foi possível salvar o modelo de e-mail.");
      const { error: auditError } = await clients.userClient.rpc("admin_log_event", {
        p_action: "email_template_updated",
        p_details: { templateKey: key, subjectLength: candidate.subject.length, htmlLength: candidate.html.length },
      });
      if (auditError) throw new Error("Modelo salvo, mas o evento de auditoria não foi registrado.");
      return respond({ saved: true }, 200, origin);
    } catch (error) {
      return respond({ error: error instanceof Error ? error.message : "Falha ao salvar modelo de e-mail." }, 500, origin);
    }
  }

  if (action === "sync_mailchimp_templates") {
    try {
      const settings = await loadSettings(clients.serviceClient);
      if (!settings || settings.host !== "smtp.mandrillapp.com") {
        return respond({ error: "Selecione Mailchimp Transactional no provedor SMTP e salve a chave de API antes de sincronizar os modelos." }, 409, origin);
      }
      const key = await decryptPassword(settings);
      const response = await fetch("https://mandrillapp.com/api/1.0/mctemplates/list.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
        signal: AbortSignal.timeout(20_000),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload)) {
        const detail = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
          ? payload.message.slice(0, 240)
          : "Confira se a chave é do Mailchimp Transactional e se o recurso está habilitado na conta.";
        await logMail(clients.serviceClient, actorId, "connection_test", null, false, { provider: "mailchimp_transactional", status: response.status });
        return respond({ error: `Não foi possível conectar ao Mailchimp Transactional. ${detail}` }, 502, origin);
      }
      const templates = payload.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const html = typeof row.publish_code === "string" && row.publish_code.trim() ? row.publish_code : row.code;
        if (typeof row.mc_template_id !== "number" || typeof row.mc_template_name !== "string" || typeof html !== "string") return [];
        return [{
          id: row.mc_template_id,
          name: row.mc_template_name.slice(0, 120),
          subject: typeof row.subject === "string" ? row.subject.slice(0, 180) : "",
          html: html.slice(0, 50_000),
          published: typeof row.publish_code === "string" && !!row.publish_code.trim(),
        }];
      });
      await logMail(clients.serviceClient, actorId, "connection_test", null, true, { provider: "mailchimp_transactional", templateCount: templates.length });
      return respond({ templates }, 200, origin);
    } catch (error) {
      const message = error instanceof Error && error.name === "TimeoutError"
        ? "A conexão com o Mailchimp excedeu o tempo limite. Tente novamente."
        : "Não foi possível consultar os modelos do Mailchimp Transactional.";
      await logMail(clients.serviceClient, actorId, "connection_test", null, false, { provider: "mailchimp_transactional" });
      return respond({ error: message }, 502, origin);
    }
  }

  if (action === "test_mailchimp_connection") {
    try {
      const settings = await loadSettings(clients.serviceClient);
      if (!settings || settings.host !== "smtp.mandrillapp.com") {
        return respond({ error: "Selecione Mailchimp Transactional, informe a API key e salve a configuração antes do teste." }, 409, origin);
      }
      const key = await decryptPassword(settings);
      const response = await fetch("https://mandrillapp.com/api/1.0/users/ping.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
        signal: AbortSignal.timeout(15_000),
      });
      const pong: unknown = await response.json().catch(() => null);
      if (!response.ok || pong !== "PONG!") {
        await logMail(clients.serviceClient, actorId, "connection_test", null, false, { provider: "mailchimp_transactional", status: response.status });
        return respond({ error: "A API key não foi validada pelo Mailchimp Transactional. Confirme a chave e se o recurso Transactional está habilitado na conta." }, 502, origin);
      }
      await logMail(clients.serviceClient, actorId, "connection_test", null, true, { provider: "mailchimp_transactional" });
      return respond({ valid: true, message: "Conexão Mailchimp Transactional validada ao vivo pela API key." }, 200, origin);
    } catch (error) {
      const message = error instanceof Error && error.name === "TimeoutError"
        ? "O teste de conexão com o Mailchimp excedeu o tempo limite. Tente novamente."
        : "Não foi possível validar a conexão Mailchimp Transactional.";
      await logMail(clients.serviceClient, actorId, "connection_test", null, false, { provider: "mailchimp_transactional" });
      return respond({ error: message }, 502, origin);
    }
  }

  if (action === "get_settings") {
    try {
      const settings = await loadSettings(clients.serviceClient);
      return respond({ settings: settings ? {
        host: settings.host, port: settings.port, secure: settings.secure,
        username: settings.username, fromEmail: settings.from_email,
        fromName: settings.from_name, enabled: settings.enabled,
        passwordConfigured: Boolean(settings.password_ciphertext),
      } : null }, 200, origin);
    } catch (error) {
      return respond({ error: error instanceof Error ? error.message : "Falha ao consultar SMTP." }, 500, origin);
    }
  }

  if (action === "save_settings") {
    const host = typeof input.host === "string" ? input.host.trim().toLowerCase() : "";
    const port = Number(input.port);
    const username = typeof input.username === "string" ? input.username.trim() : "";
    const fromEmail = typeof input.fromEmail === "string" ? input.fromEmail.trim().toLowerCase() : "";
    const fromName = typeof input.fromName === "string" ? input.fromName.trim() : "";
    const password = typeof input.password === "string" ? input.password : "";
    const secure = input.secure === true;
    const enabled = input.enabled !== false;
    if (port !== 587 || secure !== false) {
      return respond({ error: "Use a porta 587 com TLS direto desativado para conectar por STARTTLS na hospedagem." }, 400, origin);
    }
    if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)
      || !username || username.length > 254 || !emailIsValid(fromEmail) || !fromName || fromName.length > 120
      || password.length > 1024) {
      return respond({ error: "Revise host, porta, usuário, remetente e nome do remetente." }, 400, origin);
    }
    try {
      const previous = await loadSettings(clients.serviceClient);
      let encrypted = previous ? {
        password_nonce: previous.password_nonce,
        password_ciphertext: previous.password_ciphertext,
      } : null;
      if (password) encrypted = await encryptPassword(password);
      if (!encrypted) return respond({ error: "Informe uma senha SMTP para configurar o envio." }, 400, origin);
      const { error } = await clients.serviceClient.from("gm_smtp_settings").upsert({
        id: true, host, port, secure, username,
        ...encrypted,
        from_email: fromEmail, from_name: fromName, enabled,
        updated_by: actorId, updated_at: new Date().toISOString(),
      });
      if (error) throw new Error("Não foi possível salvar a configuração SMTP.");
      const { error: auditError } = await clients.userClient.rpc("admin_log_event", {
        p_action: "smtp_settings_updated",
        p_details: { changedFields: ["host", "port", "secure", "username", "from_email", "from_name", "enabled", ...(password ? ["password"] : [])], host, port, fromEmail, fromName, enabled },
      });
      if (auditError) throw new Error("Configuração salva, mas o evento de auditoria não foi registrado.");
      return respond({ saved: true, passwordConfigured: true }, 200, origin);
    } catch (error) {
      const message = error instanceof Error && error.message.includes("SMTP_ENCRYPTION_KEY")
        ? error.message
        : error instanceof Error ? error.message : "Falha ao salvar configuração SMTP.";
      return respond({ error: message }, 500, origin);
    }
  }

  if (action === "send_signature") {
    const envelopeId = typeof input.envelopeId === "string" ? input.envelopeId : "";
    if (!/^[0-9a-f-]{36}$/i.test(envelopeId)) return respond({ error: "Envelope inválido." }, 400, origin);
    const { data: row, error: envelopeError } = await clients.userClient
      .from("signature_envelopes").select("id, owner_id, payload").eq("id", envelopeId).maybeSingle();
    if (envelopeError || !row || (row.owner_id !== actorId && !(await isPlatformAdmin(clients.userClient)))) {
      return respond({ error: "Envelope não encontrado ou sem permissão para envio." }, 404, origin);
    }
    const envelope = row.payload as Record<string, unknown>;
    if (["cancelado", "expirado", "concluido"].includes(String(envelope.status))) {
      return respond({ error: "Este envelope não pode mais ser enviado." }, 409, origin);
    }
    const signers = Array.isArray(envelope.signers) ? envelope.signers as Array<Record<string, unknown>> : [];
    const recipients = signers.filter((signer) => signer.role === "sign" && signer.status !== "signed" && signer.emailSentAt == null);
    if (recipients.length > 20) return respond({ error: "O envelope excede o limite de 20 signatários por envio." }, 400, origin);
    if (recipients.some((signer) => !emailIsValid(signer.email) || typeof signer.token !== "string" || !/^[a-f0-9]{48}$/i.test(signer.token))) {
      return respond({ error: "Há signatário pendente com e-mail ou link inválido. Revise o envelope antes do envio." }, 400, origin);
    }
    if (!recipients.length && envelope.status === "rascunho") return respond({ error: "Não há signatários pendentes para envio." }, 400, origin);
    const accepted: string[] = [];
    let totalRecipients = recipients.length;
    try {
      const settings = await loadSettings(clients.serviceClient);
      if (!settings?.enabled) throw new Error("O serviço SMTP não está configurado ou está desativado.");
      const password = await decryptPassword(settings);
      const transport = makeTransport(settings, password);
      await transport.verify();
      const appUrl = Deno.env.get("APP_BASE_URL") || "https://canal360.run.place/grow";
      for (const signer of recipients) {
        if (!emailIsValid(signer.email)) continue;
        const signingUrl = `${appUrl.replace(/\/$/, "")}/assinar/${encodeURIComponent(String(signer.token || ""))}`;
        const message = typeof envelope.messageToSigners === "string" ? envelope.messageToSigners : "";
        const contractDocument = typeof envelope.documentoTexto === "string" ? envelope.documentoTexto : "";
        const signerName = safeHeader(signer.nome, "");
        const title = safeHeader(envelope.titulo, "Documento");
        const text = `Olá ${signerName},\n\nVocê recebeu o documento “${title}” para revisar e assinar.\n\n${message}\n\nCONTRATO COMPLETO\n\n${contractDocument}\n\nAcesse seu link pessoal para revisar e registrar sua assinatura: ${signingUrl}\n\nSe você não esperava este e-mail, entre em contato com quem enviou o documento.`;
        const template = (await loadEmailTemplates(clients.serviceClient)).signature;
        const templateVariables = {
          nome: signerName, titulo: title, mensagem: message, documento: contractDocument, link: signingUrl,
          appUrl, logoUrl: `${appUrl.replace(/\/$/, "")}/${EMAIL_BRAND_LOGO_ASSET}`,
        };
        await transport.sendMail({
          from: { name: settings.from_name, address: settings.from_email },
          to: String(signer.email),
          subject: renderSubject(template.subject, templateVariables, `Assinatura: ${title}`),
          text,
          html: renderEmailHtmlTemplate(template.html, templateVariables, escapeHtml),
        });
        signer.emailSentAt = new Date().toISOString();
        accepted.push(String(signer.email));
        envelope.signers = signers;
        envelope.updatedAt = new Date().toISOString();
        // Ownership was checked with the caller's JWT above; service-role persistence
        // is needed because tenant RLS intentionally restricts client-side updates.
        const { error: persistError } = await clients.serviceClient.from("signature_envelopes")
          .update({ payload: envelope, updated_at: envelope.updatedAt }).eq("id", envelopeId);
        if (persistError) throw new Error("E-mail enviado, mas não foi possível registrar o envio no envelope. Confira a auditoria antes de reenviar.");
      }
      envelope.status = "enviado";
      envelope.sentAt = envelope.sentAt || new Date().toISOString();
      envelope.updatedAt = new Date().toISOString();
      const events = Array.isArray(envelope.events) ? envelope.events as Array<Record<string, unknown>> : [];
      events.push({ id: crypto.randomUUID(), at: envelope.updatedAt, type: "sent", message: `Convites enviados por SMTP para ${accepted.length} signatário(s)`, actor: actorId });
      envelope.events = events;
      const { error: finalPersistError } = await clients.serviceClient.from("signature_envelopes")
        .update({ payload: envelope, updated_at: envelope.updatedAt }).eq("id", envelopeId);
      if (finalPersistError) throw new Error("Convites enviados, mas não foi possível finalizar o registro do envelope.");
      await logMail(clients.serviceClient, actorId, "signature_email", accepted.join(", "), true, { envelopeId, sentCount: accepted.length });
      return respond({ sent: true, sentCount: accepted.length, envelope }, 200, origin);
    } catch (error) {
      const failure = safeSmtpFailure(error);
      const errorMessage = accepted.length
        ? `${accepted.length} de ${totalRecipients} convite(s) foram enviados. Os envios confirmados foram registrados; verifique o envelope antes de tentar novamente.`
        : failure.message;
      const persistenceFailure = error instanceof Error && error.message.includes("E-mail enviado, mas não foi possível registrar");
      await logMail(clients.serviceClient, actorId, "signature_email", null, false, {
        envelopeId, errorCode: persistenceFailure ? "DELIVERY_STATE_PERSISTENCE_FAILED" : failure.code,
        sentCount: accepted.length, totalCount: totalRecipients,
      });
      return respond({ error: persistenceFailure
        ? "O servidor SMTP aceitou um convite, mas o sistema não confirmou o registro. Não repita o envio sem conferir primeiro a caixa do destinatário."
        : errorMessage, sentCount: accepted.length, totalCount: totalRecipients }, 502, origin);
    }
  }

  try {
    const settings = await loadSettings(clients.serviceClient);
    if (!settings?.enabled) return respond({ error: "Configure e ative o SMTP antes de testar o envio." }, 409, origin);
    const password = await decryptPassword(settings);
    const transport = makeTransport(settings, password);
    if (action === "test_connection") {
      await transport.verify();
      await logMail(clients.serviceClient, actorId, "connection_test", null, true, { host: settings.host, port: settings.port });
      return respond({ valid: true, message: "Conexão e autenticação SMTP validadas." }, 200, origin);
    }
    if (action === "test_email") {
      const to = input.to;
      if (!emailIsValid(to)) return respond({ error: "Informe um endereço de e-mail válido para o teste." }, 400, origin);
      await transport.verify();
      const appUrl = Deno.env.get("APP_BASE_URL") || "https://canal360.run.place/grow";
      const template = (await loadEmailTemplates(clients.serviceClient)).test_email;
      const templateVariables = { appUrl, logoUrl: `${appUrl.replace(/\/$/, "")}/${EMAIL_BRAND_LOGO_ASSET}` };
      await transport.sendMail({
        from: { name: settings.from_name, address: settings.from_email }, to,
        subject: renderSubject(template.subject, templateVariables, "Teste de envio — GrowMoney"),
        text: "O envio de e-mails do GrowMoney está configurado e funcionando.",
        html: renderEmailHtmlTemplate(template.html, templateVariables, escapeHtml),
      });
      await logMail(clients.serviceClient, actorId, "test_email", to, true, {});
      return respond({ sent: true, message: `E-mail de teste enviado para ${to}.` }, 200, origin);
    }
    return respond({ error: "Ação não suportada." }, 400, origin);
  } catch (error) {
    const failure = safeSmtpFailure(error);
    await logMail(clients.serviceClient, actorId, action === "test_email" ? "test_email" : "connection_test", null, false, { errorCode: failure.code });
    return respond({ error: failure.message }, 502, origin);
  }
});
