import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_BRAND_LOGO_WIDTH,
  EMAIL_TEMPLATE_KEYS,
  ensureEmailLink,
  mergeEmailTemplates,
  renderEmailHtmlTemplate,
  renderEmailTemplate,
  validateEmailTemplate,
} from './email-templates';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);

describe('modelos de e-mail', () => {
  it('fornece modelos padrão com logo no cabeçalho e dados empresariais no rodapé', () => {
    expect(EMAIL_TEMPLATE_KEYS).toHaveLength(4);
    for (const template of Object.values(DEFAULT_EMAIL_TEMPLATES)) {
      expect(template.html).toContain('{{logoUrl}}');
      expect(template.html).toContain('GROWMONEY DIGITAL LTDA');
      expect(template.html).toContain('10.949.897/0001-58');
      expect(template.html).toContain('class="email-shell" width="100%"');
      expect(template.html).toContain('@media screen and (max-width:620px)');
      expect(template.html).toContain('display:block;width:260px');
      expect(template.html).toContain('alt="Agência AFRICA"');
    }
  });

  it('orienta o vendedor a ativar o cadastro e definir a própria senha', () => {
    const activation = DEFAULT_EMAIL_TEMPLATES.vendor_activation.html;
    expect(activation).toContain('Confirme seu e-mail e defina sua senha');
    expect(activation).toContain('href="{{link}}"');
    expect(activation).toContain('Ativar e definir senha');
  });

  it('inclui o contrato completo no convite de assinatura', () => {
    const signature = DEFAULT_EMAIL_TEMPLATES.signature;
    expect(signature.html).toContain('{{documento}}');
    expect(signature.html).toContain('Contrato completo');
    expect(EMAIL_TEMPLATE_KEYS).toContain('signature');
  });

  it('mantém o link de ativação visível mesmo se o modelo editável não tiver o botão', () => {
    const link = 'https://project.supabase.co/auth/v1/verify?token=abc&redirect_to=https%3A%2F%2Fcanal360.run.place';
    const html = ensureEmailLink('<html><body><p>Convite</p></body></html>', link, escapeHtml, 'Ativar cadastro');

    expect(html).toContain(`href="${link.replace(/&/g, '&amp;')}"`);
    expect(html).toContain('Ativar cadastro');
    expect(html).toContain('Se o botão não abrir, copie este endereço');
    expect(html.indexOf('href=')).toBeLessThan(html.indexOf('</body>'));
  });

  it('não duplica o link quando o modelo já o inclui', () => {
    const link = 'https://project.supabase.co/auth/v1/verify?token=abc';
    const html = ensureEmailLink(`<a href="${link}">${link}</a>`, link, escapeHtml);
    expect(html.match(/Abrir link/g)).toBeNull();
  });

  it('substitui variáveis escapando valores fornecidos pelo usuário', () => {
    expect(renderEmailTemplate('<p>{{nome}}</p>', { nome: '<script>alert(1)</script>' }, escapeHtml))
      .toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  });

  it('inclui a logo AFRICA em tamanho médio/grande no cabeçalho de modelos personalizados', () => {
    const html = renderEmailHtmlTemplate('<html><body><p>Conteúdo</p></body></html>', {
      logoUrl: 'https://canal360.run.place/grow/assets/agencia-africa-email.png',
      appUrl: 'https://canal360.run.place/grow',
    }, escapeHtml);

    expect(html.indexOf('alt="Agência AFRICA"')).toBeLessThan(html.indexOf('<p>Conteúdo</p>'));
    expect(html).toContain(`width="${EMAIL_BRAND_LOGO_WIDTH}"`);
    expect(html).toContain('https://canal360.run.place/grow/assets/agencia-africa-email.png');
  });

  it('substitui pela logo oficial a imagem de cabeçalho de modelos personalizados', () => {
    const html = renderEmailHtmlTemplate('<html><body><img class="email-logo" src="logo-antiga.png" width="80"><p>Conteúdo</p></body></html>', {
      logoUrl: 'https://canal360.run.place/grow/assets/agencia-africa-email.png',
      appUrl: 'https://canal360.run.place/grow',
    }, escapeHtml);

    expect(html).toContain('alt="Agência AFRICA"');
    expect(html).toContain('width="260"');
    expect(html).not.toContain('logo-antiga.png');
  });

  it('rejeita HTML executável e assuntos ou corpos fora do limite', () => {
    expect(validateEmailTemplate({ subject: 'Seguro', html: '<img src=x onerror=alert(1)>' })).toContain('executáveis');
    expect(validateEmailTemplate({ subject: '', html: '<p>Olá</p>' })).toContain('assunto');
    expect(validateEmailTemplate({ subject: 'Teste', html: 'x'.repeat(50001) })).toContain('50.000');
  });

  it('mescla valores armazenados aos padrões e ignora modelos inválidos', () => {
    const templates = mergeEmailTemplates({ vendor_activation: { subject: 'Boas-vindas', html: '<p>Olá {{nome}}</p>' }, signature: { subject: '', html: '' } });
    expect(templates.vendor_activation.subject).toBe('Boas-vindas');
    expect(templates.signature).toEqual(DEFAULT_EMAIL_TEMPLATES.signature);
    expect(templates.test_email).toEqual(DEFAULT_EMAIL_TEMPLATES.test_email);
  });
});
