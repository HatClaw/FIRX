-- Dados pessoais e endereço do vendedor. Mantém o acesso sob as políticas
-- existentes de vendedores (administrador/gestor para leitura).
ALTER TABLE public.vendedores
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS foto_path text;

CREATE UNIQUE INDEX IF NOT EXISTS vendedores_empresa_cpf_unique
  ON public.vendedores (empresa_id, cpf)
  WHERE cpf IS NOT NULL AND cpf <> '';

ALTER TABLE public.vendedores
  ADD CONSTRAINT vendedores_cpf_digits_check
  CHECK (cpf IS NULL OR cpf = '' OR cpf ~ '^[0-9]{11}$');

ALTER TABLE public.vendedores
  ADD CONSTRAINT vendedores_uf_check
  CHECK (uf IS NULL OR uf = '' OR uf ~ '^[A-Z]{2}$');

-- Fotos permanecem em bucket privado; membros administrativos da mesma empresa
-- podem abrir a foto vinculada a um cadastro de vendedor.
DROP POLICY IF EXISTS gm_vendor_photos_storage_select ON storage.objects;
CREATE POLICY gm_vendor_photos_storage_select ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'growmoney-files'
    AND EXISTS (
      SELECT 1
      FROM public.vendedores vendedor
      WHERE vendedor.foto_path = name
        AND (public.is_platform_admin() OR public.empresa_role(vendedor.empresa_id) IN ('admin', 'gestor'))
    )
  );
