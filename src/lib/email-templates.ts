export type EmailTemplate = {
  subject: string;
  html: string;
};

export const EMAIL_TEMPLATE_KEYS = [
  'vendor_activation',
  'vendor_activation_admin_notice',
  'signature',
  'test_email',
] as const;

export type EmailTemplateKey = typeof EMAIL_TEMPLATE_KEYS[number];

export const EMAIL_BRAND_LOGO_ASSET = 'assets/agencia-africa-email.png';
export const EMAIL_BRAND_LOGO_WIDTH = 260;

export const EMAIL_TEMPLATE_INFO: Record<EmailTemplateKey, { name: string; description: string; variables: string[] }> = {
  vendor_activation: {
    name: 'Ativação de vendedor',
    description: 'Convite enviado ao vendedor para confirmar o cadastro.',
    variables: ['nome', 'empresa', 'link', 'logoUrl', 'appUrl'],
  },
  vendor_activation_admin_notice: {
    name: 'Cadastro ativado',
    description: 'Aviso enviado aos administradores quando o vendedor confirma o e-mail.',
    variables: ['nome', 'email', 'empresa', 'logoUrl', 'appUrl'],
  },
  signature: {
    name: 'Assinatura de documento',
    description: 'Convite enviado aos signatários de um contrato ou documento.',
    variables: ['nome', 'titulo', 'mensagem', 'documento', 'link', 'logoUrl', 'appUrl'],
  },
  test_email: {
    name: 'Teste de envio',
    description: 'Mensagem usada para testar o envio SMTP no painel.',
    variables: ['logoUrl', 'appUrl'],
  },
};

const shell = (content: string) => `<!doctype html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <title>GrowMoney</title>
  <style>
    html,body{width:100%!important;margin:0!important;padding:0!important}
    table{border-collapse:collapse!important;border-spacing:0!important}
    img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}
    a{color:#c65300}
    @media screen and (max-width:620px){
      .email-shell{width:100%!important;max-width:100%!important}
      .email-gutter{padding-left:20px!important;padding-right:20px!important}
      .email-content{padding:26px 20px!important}
      .email-logo{width:220px!important;max-width:100%!important}
      .email-footer{padding:20px!important}
    }
  </style>
</head>
<body bgcolor="#f5f6f8" style="width:100%;margin:0;padding:0;background-color:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#17202a;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  <div role="article" aria-roledescription="email" lang="pt-BR" style="width:100%;background-color:#f5f6f8">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f5f6f8" style="width:100%;background-color:#f5f6f8">
      <tr><td align="center" class="email-gutter" style="padding:32px 16px">
        <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" class="email-shell" width="100%" align="center" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #e6e8eb;border-radius:14px;overflow:hidden">
          <tr><td class="email-gutter" style="padding:24px 32px;border-bottom:3px solid #ff6a00;text-align:center">
            <a href="{{appUrl}}" style="text-decoration:none"><img class="email-logo" src="{{logoUrl}}" width="260" alt="Agência AFRICA" style="display:block;width:260px;max-width:100%;height:auto;margin:0"></a>
          </td></tr>
          <tr><td class="email-content" style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#17202a;font-size:15px;line-height:1.6">${content}</td></tr>
          <tr><td class="email-footer" bgcolor="#f8f9fb" style="padding:20px 32px;background-color:#f8f9fb;border-top:1px solid #e6e8eb;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.65;color:#68717d;overflow-wrap:anywhere;word-break:break-word">
            <strong style="color:#17202a">GROWMONEY DIGITAL LTDA</strong><br>
            GROWMONEY DIGITAL · Sociedade Empresária Limitada (206-2)<br>
            CNPJ: 10.949.897/0001-58 · Matriz<br>
            R Sete Barras, 257, Box 254 · Nossa Senhora do Ó<br>
            São Paulo/SP · CEP 02.927-080<br>
            <a href="mailto:RENATOARANTESDIGITAL@GMAIL.COM" style="color:#c65300;text-decoration:underline">RENATOARANTESDIGITAL@GMAIL.COM</a> · (62) 8594-3333<br>
            <span style="display:block;margin-top:8px">Mensagem enviada pelo sistema GrowMoney.</span>
          </td></tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td></tr>
    </table>
  </div>
</body>
</html>`;

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateKey, EmailTemplate> = {
  vendor_activation: {
    subject: 'Ative seu acesso ao GrowMoney',
    html: shell(`<h1 style="font-size:22px;margin:0 0 16px;color:#17202a">Ative seu cadastro</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px">Olá {{nome}}. Seu acesso de vendedor para {{empresa}} está quase pronto. Confirme seu e-mail e defina sua senha para ativar a conta.</p>
      <p style="margin:0 0 20px"><a href="{{link}}" style="display:inline-block;background:#ff6a00;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:8px">Ativar e definir senha</a></p>
      <p style="font-size:12px;line-height:1.5;color:#68717d;margin:0">Se o botão não abrir, copie este endereço para o navegador:<br><a href="{{link}}" style="color:#c65300;word-break:break-all">{{link}}</a></p>`),
  },
  vendor_activation_admin_notice: {
    subject: 'Cadastro de vendedor ativado: {{nome}}',
    html: shell(`<h1 style="font-size:22px;margin:0 0 16px">Cadastro ativado</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px">O cadastro de {{nome}} foi confirmado pelo próprio vendedor.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="font-size:15px;line-height:1.8"><tr><td><strong>E-mail:</strong>&nbsp;</td><td>{{email}}</td></tr><tr><td><strong>Empresa:</strong>&nbsp;</td><td>{{empresa}}</td></tr><tr><td><strong>Status:</strong>&nbsp;</td><td>Ativo</td></tr></table>`),
  },
  signature: {
    subject: 'Assinatura: {{titulo}}',
    html: shell(`<h1 style="font-size:22px;margin:0 0 16px">Documento para assinatura</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px">Olá {{nome}}, você recebeu um documento para revisar e assinar.</p>
      <h2 style="font-size:17px;margin:20px 0 8px">{{titulo}}</h2>
      <div style="font-size:15px;line-height:1.7;white-space:pre-line">{{mensagem}}</div>
      <p style="margin:24px 0 20px"><a href="{{link}}" style="display:inline-block;background:#ff6a00;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:8px">Revisar e assinar</a></p>
      <h2 style="font-size:17px;margin:24px 0 8px">Contrato completo</h2>
      <div style="font-size:12px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #e6e8eb;border-radius:8px;padding:16px;background:#f8f9fb">{{documento}}</div>
      <p style="font-size:12px;line-height:1.5;color:#68717d;margin:0">Se você não esperava este e-mail, entre em contato com quem enviou o documento.</p>`),
  },
  test_email: {
    subject: 'Teste de envio — GrowMoney',
    html: shell(`<h1 style="font-size:22px;margin:0 0 16px">Teste de envio realizado</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px">Este é um e-mail de validação do sistema.</p>
      <p style="font-size:15px;line-height:1.7;margin:0">O servidor SMTP está conectado e o envio de mensagens foi confirmado.</p>`),
  },
};

export const EMAIL_TEMPLATE_PREVIEW_VALUES: Record<EmailTemplateKey, Record<string, string>> = {
  vendor_activation: { nome: 'Maria Silva', empresa: 'Empresa Exemplo', link: 'https://growmoneydigital.com.br/grow/ativar/abc123', logoUrl: '/logo-grow-dark.svg', appUrl: 'https://growmoneydigital.com.br/grow' },
  vendor_activation_admin_notice: { nome: 'Maria Silva', email: 'maria@exemplo.com.br', empresa: 'Empresa Exemplo', logoUrl: '/logo-grow-dark.svg', appUrl: 'https://growmoneydigital.com.br/grow' },
  signature: { nome: 'Maria Silva', titulo: 'Contrato de prestação de serviços', mensagem: 'Revise os dados e assine o documento para concluir o processo.', documento: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nCláusulas e condições comerciais do contrato.', link: 'https://growmoneydigital.com.br/grow/assinar/abc123', logoUrl: '/logo-grow-dark.svg', appUrl: 'https://growmoneydigital.com.br/grow' },
  test_email: { logoUrl: '/logo-grow-dark.svg', appUrl: 'https://growmoneydigital.com.br/grow' },
};

export function renderEmailTemplate(value: string, variables: Record<string, string>, escapeHtml: (text: string) => string): string {
  return value.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g, (_match, key: string) => escapeHtml(variables[key] ?? ''));
}

/** Render HTML email content and enforce the AFRICA brand mark in its header. */
export function renderEmailHtmlTemplate(value: string, variables: Record<string, string>, escapeHtml: (text: string) => string): string {
  const rendered = renderEmailTemplate(value, variables, escapeHtml);
  const logoUrl = escapeHtml(variables.logoUrl || `https://canal360.run.place/grow/${EMAIL_BRAND_LOGO_ASSET}`);
  const appUrl = escapeHtml(variables.appUrl || 'https://canal360.run.place/grow');
  const logo = `<img class="email-logo" src="${logoUrl}" width="${EMAIL_BRAND_LOGO_WIDTH}" alt="Agência AFRICA" style="display:block;width:${EMAIL_BRAND_LOGO_WIDTH}px;max-width:100%;height:auto;margin:0 auto">`;
  const existingBrandLogo = /<img\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bemail-logo\b)[^>]*>/i;

  if (existingBrandLogo.test(rendered)) return rendered.replace(existingBrandLogo, logo);

  const header = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e6e8eb;border-bottom:3px solid #ff6a00;border-radius:14px 14px 0 0"><tr><td align="center" style="padding:24px 28px"><a href="${appUrl}" style="display:inline-block;text-decoration:none">${logo}</a></td></tr></table>`;
  const bodyTag = /<body\b[^>]*>/i;
  if (bodyTag.test(rendered)) return rendered.replace(bodyTag, (match) => `${match}${header}`);
  return `${header}${rendered}`;
}

export function validateEmailTemplate(template: unknown): string | null {
  if (!template || typeof template !== 'object' || Array.isArray(template)) return 'Modelo inválido.';
  const candidate = template as Partial<EmailTemplate>;
  if (typeof candidate.subject !== 'string' || !candidate.subject.trim() || candidate.subject.length > 180) return 'O assunto deve ter entre 1 e 180 caracteres.';
  if (typeof candidate.html !== 'string' || !candidate.html.trim() || candidate.html.length > 50000) return 'O HTML deve ter entre 1 e 50.000 caracteres.';
  if (/<\s*(script|iframe|object|embed|form)\b|\bon[a-z]+\s*=|javascript\s*:|vbscript\s*:|srcdoc\s*=/i.test(candidate.html)) {
    return 'O HTML não pode conter scripts, formulários ou atributos executáveis.';
  }
  return null;
}

export function mergeEmailTemplates(value: unknown): Record<EmailTemplateKey, EmailTemplate> {
  const stored = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(EMAIL_TEMPLATE_KEYS.map((key) => {
    const candidate = stored[key];
    return [key, validateEmailTemplate(candidate) ? DEFAULT_EMAIL_TEMPLATES[key] : candidate as EmailTemplate];
  })) as Record<EmailTemplateKey, EmailTemplate>;
}

export function ensureEmailLink(html: string, url: string, escapeHtml: (text: string) => string, label = 'Abrir link'): string {
  const safeUrl = escapeHtml(url);
  if (html.includes(safeUrl) || html.includes(url)) return html;

  const fallback = `<p style="margin:24px 0 8px"><a href="${safeUrl}" style="color:#c65300;text-decoration:underline">${escapeHtml(label)}</a></p>
    <p style="font-size:12px;line-height:1.5;color:#68717d;margin:0">Se o botão não abrir, copie este endereço para o navegador:<br><a href="${safeUrl}" style="color:#c65300;word-break:break-all">${safeUrl}</a></p>`;
  const bodyEnd = html.search(/<\/body\s*>/i);
  return bodyEnd >= 0 ? `${html.slice(0, bodyEnd)}${fallback}${html.slice(bodyEnd)}` : `${html}${fallback}`;
}
