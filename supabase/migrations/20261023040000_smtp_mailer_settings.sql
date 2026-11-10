-- SMTP credentials are stored encrypted and can only be read by the Edge Function.
CREATE TABLE IF NOT EXISTS public.gm_smtp_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  host text NOT NULL,
  port integer NOT NULL CHECK (port BETWEEN 1 AND 65535),
  secure boolean NOT NULL DEFAULT false,
  username text NOT NULL,
  password_ciphertext text NOT NULL,
  password_nonce text NOT NULL,
  from_email text NOT NULL,
  from_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gm_smtp_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gm_smtp_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gm_smtp_settings TO service_role;

CREATE TABLE IF NOT EXISTS public.gm_smtp_mail_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('connection_test', 'test_email', 'signature_email')),
  recipient text,
  status text NOT NULL CHECK (status IN ('success', 'failure')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gm_smtp_mail_log_created_idx
  ON public.gm_smtp_mail_log (created_at DESC);
ALTER TABLE public.gm_smtp_mail_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gm_smtp_mail_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gm_smtp_mail_log TO service_role;
GRANT SELECT ON TABLE public.gm_smtp_mail_log TO authenticated;
CREATE POLICY gm_smtp_mail_log_platform_admin_read
  ON public.gm_smtp_mail_log FOR SELECT TO authenticated
  USING (public.is_platform_admin());

COMMENT ON TABLE public.gm_smtp_settings IS
  'SMTP transport configuration. SMTP password ciphertext is decrypted only by the smtp-mailer Edge Function.';
COMMENT ON COLUMN public.gm_smtp_settings.password_ciphertext IS
  'AES-GCM ciphertext; key is the server-only SMTP_ENCRYPTION_KEY Edge Function secret.';
