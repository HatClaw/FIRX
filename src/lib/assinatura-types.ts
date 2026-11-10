export type SignerRole = 'sign' | 'cc';
export type SignerStatus = 'pending' | 'viewed' | 'signed' | 'declined';
export type EnvelopeStatus =
  | 'rascunho'
  | 'enviado'
  | 'parcial'
  | 'concluido'
  | 'cancelado'
  | 'expirado';

export type SignatureMode = 'canvas' | 'typed' | 'saved';

export interface Signer {
  id: string;
  nome: string;
  email: string;
  role: SignerRole;
  status: SignerStatus;
  token: string;
  signedAt?: string;
  viewedAt?: string;
  emailSentAt?: string;
  emailSendStatus?: 'sending' | 'sent' | 'failed';
  emailSendStartedAt?: string;
  signatureDataUrl?: string;
  signatureMode?: SignatureMode;
  order: number;
}

export interface EnvelopeEvent {
  id: string;
  at: string;
  type: string;
  message: string;
  actor?: string;
}

export interface Envelope {
  id: string;
  empresa_id?: string;
  titulo: string;
  descricao: string;
  documentoTexto: string;
  arquivoNome?: string;
  arquivoStoragePath?: string;
  status: EnvelopeStatus;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  completedAt?: string;
  createdBy: string;
  signers: Signer[];
  events: EnvelopeEvent[];
  messageToSigners?: string;
}

export interface SavedSignature {
  id: string;
  label: string;
  dataUrl: string;
  mode: SignatureMode;
  createdAt: string;
}

