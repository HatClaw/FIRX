CREATE TABLE IF NOT EXISTS public.gm_vendor_activation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL UNIQUE REFERENCES public.vendedores(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  claimed_at timestamptz,
  notified_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gm_vendor_activation_events IS
  'Server-only idempotency and delivery state for vendor activation and administrator notification emails.';

ALTER TABLE public.gm_vendor_activation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gm_vendor_activation_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gm_vendor_activation_events TO service_role;

ALTER TABLE public.gm_smtp_mail_log
  DROP CONSTRAINT IF EXISTS gm_smtp_mail_log_action_check;
ALTER TABLE public.gm_smtp_mail_log
  ADD CONSTRAINT gm_smtp_mail_log_action_check
  CHECK (action IN (
    'connection_test', 'test_email', 'signature_email',
    'vendor_activation_email', 'vendor_activation_admin_notice'
  ));
