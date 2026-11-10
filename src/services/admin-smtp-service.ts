import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { DEFAULT_EMAIL_TEMPLATES, type EmailTemplate, type EmailTemplateKey } from '@/lib/email-templates';

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string;
  enabled: boolean;
  passwordConfigured: boolean;
};

export type SmtpSettingsInput = Omit<SmtpSettings, 'passwordConfigured'> & {
  password: string;
  clearPassword: boolean;
};

export type MailchimpTemplate = { id: number; name: string; subject: string; html: string; published: boolean };

async function invoke<T>(action: string, fields: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('smtp-mailer', { body: { action, ...fields } });
  if (error instanceof FunctionsHttpError) {
    let message: unknown;
    try {
      message = (await error.context.clone().json() as { error?: unknown }).error;
    } catch { /* Keep the SDK message when the function didn't return JSON. */ }
    if (typeof message === 'string' && message.trim()) throw new Error(message);
    throw new Error(`Serviço SMTP (${error.context.status}): ${error.message}`);
  }
  if (error) throw new Error(error.message || 'Não foi possível acessar o serviço SMTP.');
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export const AdminSmtpService = {
  async getSettings(): Promise<SmtpSettings | null> {
    const result = await invoke<{ settings: Omit<SmtpSettings, 'passwordConfigured'> & { passwordConfigured: boolean } | null }>('get_settings');
    return result.settings;
  },
  async saveSettings(settings: SmtpSettingsInput): Promise<void> {
    await invoke<{ saved: boolean; passwordConfigured: boolean }>('save_settings', settings);
  },
  async testConnection(): Promise<string> {
    const result = await invoke<{ valid: boolean; message: string }>('test_connection');
    return result.message;
  },
  async sendTestEmail(to: string): Promise<string> {
    const result = await invoke<{ sent: boolean; message: string }>('test_email', { to });
    return result.message;
  },
  async syncMailchimpTemplates(): Promise<MailchimpTemplate[]> {
    const result = await invoke<{ templates?: MailchimpTemplate[] }>('sync_mailchimp_templates');
    return result.templates || [];
  },
  async testMailchimpConnection(): Promise<string> {
    const result = await invoke<{ valid: boolean; message: string }>('test_mailchimp_connection');
    return result.message;
  },
  async getEmailTemplates(): Promise<Record<EmailTemplateKey, EmailTemplate>> {
    const result = await invoke<{ templates?: Record<EmailTemplateKey, EmailTemplate> }>('get_templates');
    return result.templates || DEFAULT_EMAIL_TEMPLATES;
  },
  async saveEmailTemplate(key: EmailTemplateKey, template: EmailTemplate): Promise<void> {
    await invoke<{ saved: boolean }>('save_template', { key, template });
  },
};
