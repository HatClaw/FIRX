-- System email templates are only read or changed by the authenticated SMTP Edge Function.
CREATE TABLE IF NOT EXISTS public.gm_email_templates (
  template_key text PRIMARY KEY CHECK (template_key IN (
    'vendor_activation',
    'vendor_activation_admin_notice',
    'signature',
    'test_email'
  )),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 180),
  html text NOT NULL CHECK (length(html) BETWEEN 1 AND 50000),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gm_email_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gm_email_templates FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gm_email_templates TO service_role;

COMMENT ON TABLE public.gm_email_templates IS
  'Editable branded system email templates. Access is restricted to the SMTP Edge Function service role.';
