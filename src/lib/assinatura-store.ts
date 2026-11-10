import { supabase } from '@/lib/supabase/client';
import type { Envelope, EnvelopeEvent, SavedSignature, Signer } from './assinatura-types';

const SIGNATURES_KEY = 'grow_saved_signatures_v1';
const ALERTS_KEY = 'grow_signature_alerts_v1';

export type SignatureAlert = {
  id: string;
  envelopeId: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  email?: string;
};

function uid() {
  return crypto.randomUUID();
}

function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function pushEvent(type: string, message: string, actor?: string): EnvelopeEvent {
  return { id: uid(), at: new Date().toISOString(), type, message, actor };
}

function throwIfError(error: { message: string } | null, action: string): asserts error is null {
  if (error) throw new Error(`${action}: ${error.message}`);
}

export async function listEnvelopes(): Promise<Envelope[]> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  throwIfError(userError, 'Não foi possível validar sua sessão');
  if (!user) throw new Error('Entre na sua conta para acessar os envelopes.');
  const { data, error } = await supabase
    .from('signature_envelopes')
    .select('payload')
    .order('updated_at', { ascending: false });
  throwIfError(error, 'Não foi possível carregar os envelopes');
  const remote = (data || []).map((row) => row.payload as Envelope);
  const remoteIds = new Set(remote.map((envelope) => envelope.id));
  const local = read<Envelope[]>('grow_envelopes_v1', []).filter(
    (envelope) => envelope.createdBy.trim().toLowerCase() === (user.email || '').toLowerCase()
      && !remoteIds.has(envelope.id)
  );
  if (local.length) {
    const { error: importError } = await supabase.from('signature_envelopes').upsert(
      local.map((envelope) => ({
        id: envelope.id,
        empresa_id: envelope.empresa_id || localStorage.getItem('empresaAtiva'),
        owner_id: user.id,
        payload: envelope,
        updated_at: envelope.updatedAt,
      }))
    );
    throwIfError(importError, 'Não foi possível migrar os envelopes deste dispositivo');
    const imported = new Set(local.map((envelope) => envelope.id));
    write('grow_envelopes_v1', read<Envelope[]>('grow_envelopes_v1', []).filter((envelope) => !imported.has(envelope.id)));
    return [...remote, ...local].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }
  return remote;
}

export async function getEnvelope(id: string): Promise<Envelope | null> {
  const { data, error } = await supabase
    .from('signature_envelopes')
    .select('payload')
    .eq('id', id)
    .maybeSingle();
  throwIfError(error, 'Não foi possível carregar o envelope');
  return (data?.payload as Envelope | undefined) ?? null;
}

export async function getEnvelopeBySignerToken(t: string): Promise<{ envelope: Envelope; signer: Signer } | null> {
  const { data, error } = await supabase.rpc('get_signature_envelope_by_token', { p_token: t });
  throwIfError(error, 'Não foi possível localizar o documento');
  const envelope = data as Envelope | null;
  const signer = envelope?.signers.find((item) => item.token === t);
  return envelope && signer ? { envelope, signer } : null;
}

export async function saveEnvelope(envelope: Envelope): Promise<Envelope> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  throwIfError(userError, 'Não foi possível validar sua sessão');
  if (!user) throw new Error('Entre na sua conta para salvar o envelope.');
  const { error } = await supabase.from('signature_envelopes').upsert({
    id: envelope.id,
    empresa_id: envelope.empresa_id || localStorage.getItem('empresaAtiva'),
    owner_id: user.id,
    payload: envelope,
    updated_at: envelope.updatedAt,
  });
  throwIfError(error, 'Não foi possível salvar o envelope no servidor');
  return envelope;
}

export async function createEnvelope(input: {
  titulo: string;
  descricao?: string;
  documentoTexto: string;
  empresa_id?: string;
  createdBy: string;
  messageToSigners?: string;
  arquivoNome?: string;
  arquivoStoragePath?: string;
  signers: Array<{ nome: string; email: string; role?: 'sign' | 'cc' }>;
}): Promise<Envelope> {
  const signers = input.signers
    .map((signer) => ({ ...signer, nome: signer.nome.trim(), email: signer.email.trim().toLowerCase() }))
    .filter((signer) => signer.nome && signer.email);
  if (!input.titulo.trim() || !input.documentoTexto.trim()) {
    throw new Error('Informe o título e o conteúdo do documento.');
  }
  if (!signers.some((signer) => (signer.role || 'sign') === 'sign')) {
    throw new Error('Adicione ao menos um signatário com permissão para assinar.');
  }
  const emails = signers.map((signer) => signer.email);
  if (emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error('Confira o e-mail de cada participante.');
  }
  if (new Set(emails).size !== emails.length) {
    throw new Error('Cada participante precisa ter um e-mail diferente.');
  }
  const now = new Date().toISOString();
  const envelope: Envelope = {
    id: uid(),
    empresa_id: input.empresa_id || localStorage.getItem('empresaAtiva') || undefined,
    titulo: input.titulo,
    descricao: input.descricao || '',
    documentoTexto: input.documentoTexto,
    arquivoNome: input.arquivoNome,
    arquivoStoragePath: input.arquivoStoragePath,
    status: 'rascunho',
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    messageToSigners: input.messageToSigners,
    signers: signers.map((signer, index) => ({
      id: uid(),
      nome: signer.nome,
      email: signer.email,
      role: signer.role || 'sign',
      status: 'pending',
      token: token(),
      order: index + 1,
    })),
    events: [pushEvent('created', 'Envelope criado', input.createdBy)],
  };
  return saveEnvelope(envelope);
}

export async function sendEnvelope(id: string, actor: string): Promise<Envelope | null> {
  const { data, error } = await supabase.functions.invoke('smtp-mailer', {
    body: { action: 'send_signature', envelopeId: id },
  });
  if (error) throw new Error(`Falha no envio do convite por e-mail: ${error.message}`);
  if (data?.error) throw new Error(String(data.error));
  const envelope = data?.envelope as Envelope | undefined;
  if (!envelope) throw new Error('O servidor não retornou o envelope atualizado.');
  addAlert({
    envelopeId: envelope.id,
    title: `Convites enviados: ${envelope.titulo}`,
    body: `O servidor SMTP enviou convites para ${envelope.signers.filter((signer) => signer.role === 'sign' && signer.emailSentAt).length} signatário(s).`,
    email: actor,
  });
  return envelope;
}
export async function markViewed(tokenStr: string): Promise<Envelope | null> {
  const { data, error } = await supabase.rpc('mark_signature_envelope_viewed', { p_token: tokenStr });
  throwIfError(error, 'Não foi possível registrar a visualização');
  const envelope = data as Envelope | null;
  if (!envelope) return null;
  const signer = envelope.signers.find((item) => item.token === tokenStr);
  if (signer?.viewedAt) {
    addAlert({
      envelopeId: envelope.id,
      title: `Visualizado: ${envelope.titulo}`,
      body: `${signer.nome} abriu o documento para assinatura.`,
      email: envelope.createdBy,
    });
  }
  return envelope;
}

export async function applySignature(
  tokenStr: string,
  signatureDataUrl: string,
  mode: 'canvas' | 'typed' | 'saved'
): Promise<Envelope | null> {
  const { data, error } = await supabase.rpc('apply_signature_to_envelope', {
    p_token: tokenStr,
    p_signature_data_url: signatureDataUrl,
    p_mode: mode,
  });
  throwIfError(error, 'Não foi possível registrar a assinatura');
  const envelope = data as Envelope | null;
  if (envelope) {
    const signer = envelope.signers.find((item) => item.token === tokenStr);
    if (signer) {
      addAlert({
        envelopeId: envelope.id,
        title: envelope.status === 'concluido' ? `Concluído: ${envelope.titulo}` : `Assinatura recebida: ${envelope.titulo}`,
        body: envelope.status === 'concluido' ? 'Envelope finalizado com sucesso.' : `${signer.nome} assinou. Aguardando demais partes.`,
        email: envelope.createdBy,
      });
    }
  }
  return envelope;
}

export async function cancelEnvelope(id: string, actor: string): Promise<Envelope | null> {
  const envelope = await getEnvelope(id);
  if (!envelope) return null;
  envelope.status = 'cancelado';
  envelope.updatedAt = new Date().toISOString();
  envelope.events.push(pushEvent('cancelled', 'Envelope cancelado', actor));
  return saveEnvelope(envelope);
}

export async function deleteEnvelope(id: string): Promise<void> {
  const { error } = await supabase.from('signature_envelopes').delete().eq('id', id);
  throwIfError(error, 'Não foi possível excluir o envelope');
}

export function listSavedSignatures(): SavedSignature[] {
  return read<SavedSignature[]>(SIGNATURES_KEY, []);
}

export function saveSignature(label: string, dataUrl: string, mode: SavedSignature['mode']) {
  const signatures = listSavedSignatures();
  const item: SavedSignature = { id: uid(), label, dataUrl, mode, createdAt: new Date().toISOString() };
  signatures.unshift(item);
  if (!write(SIGNATURES_KEY, signatures.slice(0, 20))) {
    throw new Error('Não foi possível salvar a assinatura neste dispositivo.');
  }
  return item;
}

export function deleteSavedSignature(id: string) {
  write(SIGNATURES_KEY, listSavedSignatures().filter((signature) => signature.id !== id));
}

export function listAlerts(): SignatureAlert[] {
  return read<SignatureAlert[]>(ALERTS_KEY, []).sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

export function addAlert(input: Omit<SignatureAlert, 'id' | 'at' | 'read'>) {
  const alerts = listAlerts();
  alerts.unshift({ id: uid(), at: new Date().toISOString(), read: false, ...input });
  write(ALERTS_KEY, alerts.slice(0, 100));
}

export function markAlertRead(id: string) {
  write(ALERTS_KEY, listAlerts().map((alert) => (alert.id === id ? { ...alert, read: true } : alert)));
}

export function markAllAlertsRead() {
  write(ALERTS_KEY, listAlerts().map((alert) => ({ ...alert, read: true })));
}

export function signingUrl(tokenStr: string) {
  if (typeof window === 'undefined') return `/assinar/${tokenStr}`;
  const base = import.meta.env.BASE_URL || '/';
  return `${window.location.origin}${base.replace(/\/$/, '')}/assinar/${tokenStr}`;
}

export function signingEmailHref(envelope: Envelope, signer: Signer) {
  const subject = `Assinatura: ${envelope.titulo}`;
  const body = [
    `Olá ${signer.nome},`,
    '',
    'Você recebeu um documento para revisar e assinar eletronicamente.',
    envelope.messageToSigners || '',
    '',
    `Acesse seu link pessoal: ${signingUrl(signer.token)}`,
    '',
    'Esta mensagem só será enviada quando você confirmar o envio no seu aplicativo de e-mail.',
  ].filter(Boolean).join('\n');
  return `mailto:${encodeURIComponent(signer.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function copySigningLink(tokenStr: string) {
  const value = signingUrl(tokenStr);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // Try the browser fallback below for embedded or restricted contexts.
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Não foi possível copiar o link neste navegador.');
}
