-- Mensagens privadas por empresa e vendedor. O acesso do navegador ocorre via
-- Edge Function autenticada; a tabela não fica disponível diretamente no Data API.
CREATE TABLE public.gm_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  vendedor_id uuid NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 5000),
  attachment_path text,
  attachment_name text,
  attachment_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CHECK (char_length(body) > 0 OR attachment_path IS NOT NULL),
  CHECK (
    (attachment_path IS NULL AND attachment_name IS NULL AND attachment_type IS NULL)
    OR (attachment_path IS NOT NULL AND attachment_name IS NOT NULL AND attachment_type IS NOT NULL)
  )
);

CREATE INDEX gm_chat_messages_thread_idx
  ON public.gm_chat_messages (empresa_id, vendedor_id, created_at DESC);
CREATE INDEX gm_chat_messages_unread_idx
  ON public.gm_chat_messages (empresa_id, vendedor_id, read_at)
  WHERE read_at IS NULL;

ALTER TABLE public.gm_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gm_chat_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.gm_chat_messages TO service_role;
