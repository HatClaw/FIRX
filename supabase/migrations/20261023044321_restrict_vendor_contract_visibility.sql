-- Company members can read contracts through the existing tenant policy. A
-- seller must additionally be linked to the contract's vendedor_id.
-- RESTRICTIVE is intentional: it narrows the legacy permissive policies while
-- preserving the existing manager/admin access and write rules.
DROP POLICY IF EXISTS contratos_vendedor_select_own ON public.contratos;
CREATE POLICY contratos_vendedor_select_own
  ON public.contratos
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin()
    OR public.empresa_role(empresa_id) IS DISTINCT FROM 'vendedor'
    OR EXISTS (
      SELECT 1
      FROM public.vendedores AS vendedor
      WHERE vendedor.id = contratos.vendedor_id
        AND vendedor.empresa_id = contratos.empresa_id
        AND vendedor.usuario_id = (SELECT auth.uid())
    )
  );
