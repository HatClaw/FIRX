import { supabase } from '@/lib/supabase/client';

export interface ChatVendor {
  id: string;
  name: string;
  email: string;
}

export interface ChatMessage {
  id: string;
  vendedorId: string;
  senderId: string;
  senderName: string;
  body: string;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface ChatSyncResult {
  vendors: ChatVendor[];
  unreadCount: number;
  unreadMessageIds: string[];
  unreadByVendor: Record<string, number>;
  messages: ChatMessage[];
}

async function invokeChat<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('vendor-chat', { body });
  if (error) {
    const context = (error as Error & { context?: unknown }).context;
    const payload = context instanceof Response
      ? await context.clone().json().catch(() => null) as { error?: unknown } | null
      : null;
    throw new Error(typeof payload?.error === 'string' ? payload.error : error.message || 'Falha ao acessar o chat.');
  }
  return data as T;
}

export function sincronizarChat(empresaId: string, vendedorId?: string) {
  return invokeChat<ChatSyncResult>({ action: 'sync', empresaId, vendedorId });
}

export function enviarMensagemChat(input: { empresaId: string; vendedorId: string; body: string; attachmentPath?: string }) {
  return invokeChat<ChatSyncResult & { sent: boolean }>({ action: 'send', ...input });
}
