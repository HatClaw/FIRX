CREATE TABLE IF NOT EXISTS public.vendedor_visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  cliente_nome text NOT NULL,
  cliente_endereco jsonb NOT NULL DEFAULT '{}'::jsonb,
  cliente_telefone text,
  vendedor_id uuid NOT NULL REFERENCES public.vendedores(id) ON DELETE RESTRICT,
  titulo text NOT NULL,
  descricao text,
  data_hora timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'solicitada' CHECK (status IN ('solicitada','aceita','recusada','em_deslocamento','realizada','cancelada')),
  latitude_atual double precision,
  longitude_atual double precision,
  localizacao_atualizada_em timestamptz,
  criado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude_atual IS NULL AND longitude_atual IS NULL) OR (latitude_atual BETWEEN -90 AND 90 AND longitude_atual BETWEEN -180 AND 180))
);

CREATE INDEX IF NOT EXISTS vendedor_visitas_empresa_data_idx ON public.vendedor_visitas (empresa_id, data_hora DESC);
CREATE INDEX IF NOT EXISTS vendedor_visitas_vendedor_status_data_idx ON public.vendedor_visitas (vendedor_id, status, data_hora);

ALTER TABLE public.vendedor_visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedor_visitas FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedor_visitas TO authenticated;
REVOKE ALL ON public.vendedor_visitas FROM anon;

DROP POLICY IF EXISTS vendedor_visitas_select ON public.vendedor_visitas;
CREATE POLICY vendedor_visitas_select ON public.vendedor_visitas FOR SELECT TO authenticated USING (
  public.is_platform_admin()
  OR public.empresa_role(empresa_id) = 'admin'
  OR EXISTS (SELECT 1 FROM public.vendedores v WHERE v.id = vendedor_visitas.vendedor_id AND v.empresa_id = vendedor_visitas.empresa_id AND v.usuario_id = auth.uid())
);
DROP POLICY IF EXISTS vendedor_visitas_insert ON public.vendedor_visitas;
CREATE POLICY vendedor_visitas_insert ON public.vendedor_visitas FOR INSERT TO authenticated WITH CHECK (
  public.is_platform_admin() OR (public.empresa_role(empresa_id) = 'admin' AND criado_por = auth.uid())
);
DROP POLICY IF EXISTS vendedor_visitas_update ON public.vendedor_visitas;
CREATE POLICY vendedor_visitas_update ON public.vendedor_visitas FOR UPDATE TO authenticated USING (
  public.is_platform_admin() OR public.empresa_role(empresa_id) = 'admin'
  OR EXISTS (SELECT 1 FROM public.vendedores v WHERE v.id = vendedor_visitas.vendedor_id AND v.empresa_id = vendedor_visitas.empresa_id AND v.usuario_id = auth.uid())
) WITH CHECK (
  public.is_platform_admin() OR public.empresa_role(empresa_id) = 'admin'
  OR EXISTS (SELECT 1 FROM public.vendedores v WHERE v.id = vendedor_visitas.vendedor_id AND v.empresa_id = vendedor_visitas.empresa_id AND v.usuario_id = auth.uid())
);
DROP POLICY IF EXISTS vendedor_visitas_delete ON public.vendedor_visitas;
CREATE POLICY vendedor_visitas_delete ON public.vendedor_visitas FOR DELETE TO authenticated USING (
  public.is_platform_admin() OR public.empresa_role(empresa_id) = 'admin'
);

CREATE OR REPLACE FUNCTION public.protect_vendedor_visita_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  is_manager boolean := public.is_platform_admin() OR public.empresa_role(OLD.empresa_id) = 'admin';
BEGIN
  IF is_manager THEN
    NEW.atualizado_em := now();
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vendedores v
    WHERE v.id = OLD.vendedor_id AND v.empresa_id = OLD.empresa_id AND v.usuario_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar esta visita';
  END IF;

  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
    OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
    OR NEW.cliente_nome IS DISTINCT FROM OLD.cliente_nome
    OR NEW.cliente_endereco IS DISTINCT FROM OLD.cliente_endereco
    OR NEW.cliente_telefone IS DISTINCT FROM OLD.cliente_telefone
    OR NEW.vendedor_id IS DISTINCT FROM OLD.vendedor_id
    OR NEW.titulo IS DISTINCT FROM OLD.titulo
    OR NEW.descricao IS DISTINCT FROM OLD.descricao
    OR NEW.data_hora IS DISTINCT FROM OLD.data_hora
    OR NEW.criado_por IS DISTINCT FROM OLD.criado_por
    OR NEW.criado_em IS DISTINCT FROM OLD.criado_em THEN
    RAISE EXCEPTION 'Vendedores só podem atualizar o andamento e a localização das próprias visitas';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'solicitada' AND NEW.status IN ('aceita','recusada'))
    OR (OLD.status = 'aceita' AND NEW.status IN ('em_deslocamento','recusada'))
    OR (OLD.status = 'em_deslocamento' AND NEW.status = 'realizada')
  ) THEN
    RAISE EXCEPTION 'Transição de status inválida';
  END IF;

  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_vendedor_visita_update() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS vendedor_visitas_protect_update ON public.vendedor_visitas;
CREATE TRIGGER vendedor_visitas_protect_update BEFORE UPDATE ON public.vendedor_visitas
FOR EACH ROW EXECUTE FUNCTION public.protect_vendedor_visita_update();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = 'vendedor_visitas'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vendedor_visitas;
  END IF;
END $$;
