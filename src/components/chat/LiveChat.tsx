import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Paperclip, Send, Users, X } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { excluirArquivo, uploadArquivo } from '@/services/file-storage';
import { enviarMensagemChat, sincronizarChat, type ChatMessage, type ChatVendor } from '@/services/vendor-chat-service';

interface LiveChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnreadCount: (count: number) => void;
  onIncomingMessage: () => void;
}

const supportedChatFile = (file: File) => (
  ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  || ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.type)
);

const formatTime = (value: string) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
}).format(new Date(value));

export function LiveChat({ open, onOpenChange, onUnreadCount, onIncomingMessage }: LiveChatProps) {
  const { user, empresaAtiva } = useAuth();
  const canChat = Boolean(empresaAtiva?.id && user?.id && ['admin', 'gestor', 'vendedor'].includes(user.role));
  const sellerAccount = user?.role === 'vendedor';
  const [vendors, setVendors] = useState<ChatVendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [unreadByVendor, setUnreadByVendor] = useState<Record<string, number>>({});
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const seenUnreadIds = useRef(new Set<string>());
  const trackedThread = useRef({ vendorId: '', messageIds: new Set<string>() });
  const initialized = useRef(false);
  const syncInFlight = useRef(false);
  const endOfMessages = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const selectedVendor = useMemo(() => vendors.find((item) => item.id === selectedVendorId) || null, [vendors, selectedVendorId]);

  const sync = useCallback(async (notify = true) => {
    if (!canChat || !empresaAtiva?.id || !user?.id || syncInFlight.current) return;
    syncInFlight.current = true;
    try {
      const result = await sincronizarChat(empresaAtiva.id, open ? selectedVendorId || undefined : undefined);
      setVendors(result.vendors);
      if (sellerAccount && result.vendors[0] && selectedVendorId !== result.vendors[0].id) setSelectedVendorId(result.vendors[0].id);
      setUnreadByVendor(result.unreadByVendor || {});
      onUnreadCount(result.unreadCount || 0);

      const unreadIds = result.unreadMessageIds || [];
      if (!initialized.current) {
        unreadIds.forEach((id) => seenUnreadIds.current.add(id));
        initialized.current = true;
      } else {
        const incoming = unreadIds.filter((id) => !seenUnreadIds.current.has(id));
        unreadIds.forEach((id) => seenUnreadIds.current.add(id));
        if (incoming.length && notify) onIncomingMessage();
      }

      if (open && selectedVendorId) {
        if (trackedThread.current.vendorId !== selectedVendorId) {
          trackedThread.current = { vendorId: selectedVendorId, messageIds: new Set(result.messages.map((message) => message.id)) };
        } else {
          let incoming = false;
          result.messages.forEach((message) => {
            if (trackedThread.current.messageIds.has(message.id)) return;
            trackedThread.current.messageIds.add(message.id);
            if (message.senderId !== user.id && !seenUnreadIds.current.has(message.id)) incoming = true;
            seenUnreadIds.current.add(message.id);
          });
          result.messages.forEach((message) => trackedThread.current.messageIds.add(message.id));
          if (incoming && notify) onIncomingMessage();
        }
        setMessages(result.messages);
        setLoadingThread(false);
      }
      setError('');
    } catch (cause) {
      setLoadingThread(false);
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o chat.');
    } finally {
      syncInFlight.current = false;
    }
  }, [canChat, empresaAtiva?.id, onIncomingMessage, onUnreadCount, open, selectedVendorId, sellerAccount, user?.id]);

  useEffect(() => {
    initialized.current = false;
    seenUnreadIds.current.clear();
    trackedThread.current = { vendorId: '', messageIds: new Set() };
    setMessages([]); setVendors([]); setSelectedVendorId(''); onUnreadCount(0);
  }, [empresaAtiva?.id, user?.id, onUnreadCount]);

  useEffect(() => {
    if (!canChat) return;
    void sync(false);
    const timer = window.setInterval(() => { void sync(true); }, 5000);
    return () => window.clearInterval(timer);
  }, [canChat, sync]);

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    if (open && sellerAccount && vendors[0]) setSelectedVendorId(vendors[0].id);
  }, [open, sellerAccount, vendors]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!empresaAtiva?.id || !selectedVendorId || (!draft.trim() && !attachment)) return;
    if (attachment && (attachment.size > 10 * 1024 * 1024 || !supportedChatFile(attachment))) {
      setError('Anexe uma foto, PDF ou documento aceito de até 10 MB.'); return;
    }
    setSending(true); setError('');
    let attachmentPath: string | undefined;
    try {
      if (attachment) attachmentPath = (await uploadArquivo(attachment, attachment.type.startsWith('image/') ? 'fotos' : 'arquivos')).caminho;
      await enviarMensagemChat({ empresaId: empresaAtiva.id, vendedorId: selectedVendorId, body: draft.trim(), attachmentPath });
      setDraft(''); setAttachment(null);
      if (fileInput.current) fileInput.current.value = '';
      await sync(false);
    } catch (cause) {
      if (attachmentPath) await excluirArquivo(attachmentPath).catch(() => undefined);
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar a mensagem.');
    } finally { setSending(false); }
  };

  if (!canChat) return null;

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} title="Chat ao vivo · Vendedor e empresa" size="xl">
      <div className="flex h-[calc(100dvh-9rem)] min-h-[320px] flex-col gap-3 md:flex-row">
        {!sellerAccount && <aside className="max-h-32 shrink-0 overflow-y-auto rounded-xl border border-border-color bg-bg-secondary/40 p-2 md:max-h-none md:w-64 md:p-3" aria-label="Conversas por vendedor">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Vendedores da empresa</p>
          {vendors.length === 0 ? <p className="p-2 text-sm text-text-secondary">Nenhum vendedor cadastrado.</p> : vendors.map((vendor) => (
            <button key={vendor.id} type="button" onClick={() => { setSelectedVendorId(vendor.id); setMessages([]); setLoadingThread(true); }} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-bg-tertiary ${selectedVendorId === vendor.id ? 'bg-brand/10 text-brand' : 'text-text-primary'}`}>
              <span className="min-w-0"><span className="block truncate font-medium">{vendor.name}</span><span className="block truncate text-xs text-text-secondary">{vendor.email}</span></span>
              {(unreadByVendor[vendor.id] || 0) > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{unreadByVendor[vendor.id]}</span>}
            </button>
          ))}
        </aside>}

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border-color" aria-label="Mensagens da conversa">
          {!selectedVendor ? <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-text-secondary"><Users className="h-8 w-8" /><p>Selecione um vendedor para abrir a conversa.</p></div> : <>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-color bg-bg-secondary/40 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-text-primary">{selectedVendor.name}</p><p className="text-xs text-text-secondary">{sellerAccount ? 'Atendimento da empresa' : selectedVendor.email}</p></div><button type="button" aria-label="Fechar chat" onClick={() => onOpenChange(false)} className="rounded-lg p-2 text-text-secondary hover:bg-bg-tertiary md:hidden"><X className="h-4 w-4" /></button></div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4" aria-live="polite">
              {loadingThread && messages.length === 0 && <p className="py-8 text-center text-sm text-text-secondary">Carregando conversa…</p>}
              {!loadingThread && messages.length === 0 && <p className="py-8 text-center text-sm text-text-secondary">Envie a primeira mensagem para iniciar a conversa.</p>}
              {messages.map((message) => {
                const mine = message.senderId === user?.id;
                return <article key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[min(85%,36rem)] rounded-2xl px-3 py-2 ${mine ? 'rounded-br-md bg-brand/15 text-text-primary' : 'rounded-bl-md bg-bg-secondary text-text-primary'}`}>
                    <p className="mb-1 text-[11px] font-semibold text-text-secondary">{message.senderName}</p>
                    {message.body && <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>}
                    {message.attachmentUrl && message.attachmentType?.startsWith('image/') ? <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 block"><img src={message.attachmentUrl} alt={message.attachmentName || 'Imagem anexada'} className="max-h-64 max-w-full rounded-lg object-contain" /></a> : message.attachmentUrl && <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm text-brand underline">📎 {message.attachmentName || 'Abrir anexo'}</a>}
                    <time className="mt-1 block text-right text-[10px] text-text-secondary">{formatTime(message.createdAt)}</time>
                  </div>
                </article>;
              })}
              <div ref={endOfMessages} />
            </div>
            {error && <p className="shrink-0 border-t border-erro/20 bg-erro/5 px-3 py-2 text-sm text-erro" role="alert">{error}</p>}
            <form onSubmit={(event) => void send(event)} className="shrink-0 border-t border-border-color p-3 sm:p-4">
              {attachment && <div className="mb-2 flex items-center gap-2 rounded-lg bg-bg-secondary px-3 py-2 text-xs"><Paperclip className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{attachment.name}</span><button type="button" aria-label="Remover anexo" onClick={() => { setAttachment(null); if (fileInput.current) fileInput.current.value = ''; }} className="rounded p-1 text-text-secondary hover:bg-bg-tertiary"><X className="h-4 w-4" /></button></div>}
              <div className="flex items-end gap-2"><textarea aria-label="Mensagem" rows={2} maxLength={5000} placeholder="Digite sua mensagem…" value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-11 min-w-0 flex-1 resize-y rounded-xl border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => { setAttachment(event.target.files?.[0] || null); setError(''); }} />
                <Button type="button" variant="outline" aria-label="Anexar arquivo ou foto" title="Anexar arquivo ou foto" disabled={sending} onClick={() => fileInput.current?.click()}><Paperclip className="h-4 w-4" /></Button>
                <Button type="submit" aria-label="Enviar mensagem" title="Enviar mensagem" disabled={sending || (!draft.trim() && !attachment)} loading={sending}><Send className="h-4 w-4" /></Button>
              </div>
            </form>
          </>}
        </section>
      </div>
    </Modal>
  );
}

export function LiveChatTrigger({ unreadCount, onClick }: { unreadCount: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="relative rounded-xl p-2.5 text-text-primary hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label={`Abrir chat ao vivo${unreadCount ? `, ${unreadCount} mensagens não lidas` : ''}`} title="Chat ao vivo">
    <MessageCircle className="h-5 w-5" />
    {unreadCount > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-erro px-1 text-[9px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
  </button>;
}
