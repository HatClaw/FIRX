-- Complementa o cadastro das empresas com os dados retornados pela consulta de CNPJ.
-- Migration aditiva: preserva registros existentes e as políticas RLS da tabela.
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS endereco jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.empresas.endereco IS
  'Endereço cadastral da empresa em formato JSON (logradouro, número, complemento, bairro, município, UF e CEP).';
