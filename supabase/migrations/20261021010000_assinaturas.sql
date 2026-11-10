-- Envelope de assinatura digital (DocuSign-like)
create table if not exists public.signature_envelopes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  titulo text not null,
  descricao text,
  documento_texto text not null,
  arquivo_url text,
  status text not null default 'rascunho',
  message_to_signers text,
  created_by uuid references auth.users(id),
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signature_signers (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references public.signature_envelopes(id) on delete cascade,
  nome text not null,
  email text not null,
  role text not null default 'sign',
  status text not null default 'pending',
  token text not null unique,
  signature_data text,
  signature_mode text,
  order_index int not null default 1,
  viewed_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.signature_events (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references public.signature_envelopes(id) on delete cascade,
  event_type text not null,
  message text not null,
  actor text,
  created_at timestamptz not null default now()
);

create index if not exists idx_signers_token on public.signature_signers(token);
create index if not exists idx_envelopes_empresa on public.signature_envelopes(empresa_id);

