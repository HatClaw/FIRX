-- Adds optional tenant linkage for envelopes without changing ownership or existing rows.
ALTER TABLE public.signature_envelopes
  ADD COLUMN IF NOT EXISTS empresa_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'signature_envelopes_empresa_id_fkey'
      AND conrelid = 'public.signature_envelopes'::regclass
  ) THEN
    ALTER TABLE public.signature_envelopes
      ADD CONSTRAINT signature_envelopes_empresa_id_fkey
      FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS signature_envelopes_empresa_updated_idx
  ON public.signature_envelopes (empresa_id, updated_at DESC);
