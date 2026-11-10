-- =============================================================================
-- GrowMoney — schema inicial (alinhado ao código React)
-- ORDEM: extensões → tabelas → funções → triggers → RLS → grants
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) TABELAS (antes das funções que as referenciam)

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  nome text NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'gestor', 'vendedor', 'financeiro', 'operador')),
  telefone text, avatar_url text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL, cnpj text,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  configuracoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_empresas_responsavel ON public.empresas(responsavel_id);

CREATE TABLE IF NOT EXISTS public.empresa_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'gestor', 'vendedor', 'financeiro', 'operador')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'recusado')),
  convidado_em timestamptz NOT NULL DEFAULT now(),
  aceito_em timestamptz,
  UNIQUE (empresa_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_empresa_members_usuario ON public.empresa_members(usuario_id);
CREATE INDEX IF NOT EXISTS idx_empresa_members_empresa ON public.empresa_members(empresa_id);

CREATE TABLE IF NOT EXISTS public.convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'gestor', 'vendedor', 'financeiro', 'operador')),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expire_em timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'expirado')),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL, razao_social text,
  tipo text NOT NULL DEFAULT 'pessoa_fisica' CHECK (tipo IN ('pessoa_fisica', 'pessoa_juridica', 'pf', 'pj')),
  documento text NOT NULL,
  email text, telefone text, whatsapp text, cep text, responsavel text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'arquivado', 'suspenso', 'prospecto')),
  observacoes text, endereco jsonb DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  atualizado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_clients_empresa ON public.clients(empresa_id);

CREATE TABLE IF NOT EXISTS public.client_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  acao text NOT NULL, detalhes text,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text NOT NULL, nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'geral', subcategoria text,
  valor_base numeric(15,2) NOT NULL DEFAULT 0, custo numeric(15,2), margem numeric(15,2),
  duracao_minutos integer,
  unidade text NOT NULL DEFAULT 'unidade' CHECK (unidade IN ('hora','dia','semana','mes','ano','unidade','ao')),
  condicoes_comerciais text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','pausado','arquivado')),
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

CREATE TABLE IF NOT EXISTS public.vendedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL, email text NOT NULL, telefone text, whatsapp text,
  identificador_interno text NOT NULL,
  role text NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin','gestor','vendedor','financeiro','operador')),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','suspenso')),
  meta_mensal numeric(15,2), comissao_padrao numeric(8,4), comissao_rule_id uuid,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (empresa_id, identificador_interno), UNIQUE (empresa_id, email)
);

CREATE TABLE IF NOT EXISTS public.comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  vendedor_id uuid NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'percentual' CHECK (tipo IN ('percentual','fixa','escalonada')),
  valor numeric(15,4) NOT NULL DEFAULT 0, condicoes text,
  ativo boolean NOT NULL DEFAULT true, criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendedores DROP CONSTRAINT IF EXISTS vendedores_comissao_rule_id_fkey;
ALTER TABLE public.vendedores ADD CONSTRAINT vendedores_comissao_rule_id_fkey
  FOREIGN KEY (comissao_rule_id) REFERENCES public.comissoes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.vendedor_desempenho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  vendedor_id uuid NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  periodo text NOT NULL,
  contratos_criados integer NOT NULL DEFAULT 0, contratos_assinados integer NOT NULL DEFAULT 0,
  valor_total_contratos numeric(15,2) NOT NULL DEFAULT 0, valor_recebido numeric(15,2) NOT NULL DEFAULT 0,
  comissao_calculada numeric(15,2) NOT NULL DEFAULT 0, meta_alcancada numeric(15,2) NOT NULL DEFAULT 0,
  percentual_meta numeric(8,2) NOT NULL DEFAULT 0, criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendedor_id, periodo)
);

CREATE TABLE IF NOT EXISTS public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero text NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  servico_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  vendedor_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  template_id text,
  valor_base numeric(15,2) NOT NULL DEFAULT 0, desconto numeric(15,2) NOT NULL DEFAULT 0,
  acrescimo numeric(15,2) NOT NULL DEFAULT 0, valor_total numeric(15,2) NOT NULL DEFAULT 0,
  entrada numeric(15,2) NOT NULL DEFAULT 0, qtd_parcelas integer NOT NULL DEFAULT 1,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE, data_vigencia date, data_vencimento date,
  condicoes_pagamento text, observacoes text,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','revisao','enviado','pendente_assinatura','assinado','cancelado','expirado')),
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  atualizado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (empresa_id, numero)
);

CREATE TABLE IF NOT EXISTS public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  assinante text NOT NULL, email text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','assinado','recusado','expirado')),
  provedor text, token_provedor text, data_envio timestamptz, data_assinatura timestamptz,
  ip_assinatura text, user_agent text, observacoes text, criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contrato_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  acao text NOT NULL, status_anterior text, status_novo text, detalhes text,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  numero integer NOT NULL,
  valor_contratado numeric(15,2) NOT NULL DEFAULT 0, valor_previsto numeric(15,2) NOT NULL DEFAULT 0,
  valor_recebido numeric(15,2) NOT NULL DEFAULT 0, valor_saldo numeric(15,2) NOT NULL DEFAULT 0,
  data_vencimento date NOT NULL, data_pagamento date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','parcial','atrasado','cancelado','estornado')),
  forma_pagamento text CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('dinheiro','cartao_credito','cartao_debito','transferencia','pix','boleto','outro')),
  observacoes text, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, numero)
);

CREATE TABLE IF NOT EXISTS public.lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  parcela_id uuid NOT NULL REFERENCES public.parcelas(id) ON DELETE CASCADE,
  valor numeric(15,2) NOT NULL, data_pagamento date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento text NOT NULL DEFAULT 'pix' CHECK (forma_pagamento IN ('dinheiro','cartao_credito','cartao_debito','transferencia','pix','boleto','outro')),
  observacoes text, comprovante_url text, criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.estornos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  lancamento_id uuid NOT NULL REFERENCES public.lancamentos(id) ON DELETE CASCADE,
  valor numeric(15,2) NOT NULL, motivo text NOT NULL,
  data_estorno date NOT NULL DEFAULT CURRENT_DATE,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL, criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  servico_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  responsavel_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  tipo text NOT NULL DEFAULT 'reuniao' CHECK (tipo IN ('reuniao','ligacao','videoconferencia','visita','outro')),
  status text NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado','confirmado','realizado','cancelado','reagendado')),
  title text NOT NULL, description text, data_hora timestamptz NOT NULL, data_fim timestamptz,
  duracao_minutos integer NOT NULL DEFAULT 60, local text, link_reuniao text, lembrete_antes integer,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  atualizado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.agenda_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compromisso_id uuid NOT NULL REFERENCES public.agenda(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  acao text NOT NULL, status_anterior text, status_novo text, detalhes text,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  acao text NOT NULL, entidade text, entidade_id uuid,
  detalhes jsonb DEFAULT '{}'::jsonb, ip text, criado_em timestamptz NOT NULL DEFAULT now()
);

-- 2) FUNÇÕES (depois das tabelas)

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.is_empresa_member(p_empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresa_members m
    WHERE m.empresa_id = p_empresa_id AND m.usuario_id = auth.uid() AND m.status = 'aceito'
  );
$$;

CREATE OR REPLACE FUNCTION public.empresa_role(p_empresa_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role FROM public.empresa_members m
  WHERE m.empresa_id = p_empresa_id AND m.usuario_id = auth.uid() AND m.status = 'aceito' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, role)
  VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.raw_user_meta_data->>'nome', split_part(COALESCE(NEW.email, 'usuario'), '@', 1)), 'admin')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3) TRIGGERS
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS empresas_set_updated_at ON public.empresas;
CREATE TRIGGER empresas_set_updated_at BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS clients_set_updated_at ON public.clients;
CREATE TRIGGER clients_set_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS services_set_updated_at ON public.services;
CREATE TRIGGER services_set_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS vendedores_set_updated_at ON public.vendedores;
CREATE TRIGGER vendedores_set_updated_at BEFORE UPDATE ON public.vendedores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS contratos_set_updated_at ON public.contratos;
CREATE TRIGGER contratos_set_updated_at BEFORE UPDATE ON public.contratos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS parcelas_set_updated_at ON public.parcelas;
CREATE TRIGGER parcelas_set_updated_at BEFORE UPDATE ON public.parcelas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS agenda_set_updated_at ON public.agenda;
CREATE TRIGGER agenda_set_updated_at BEFORE UPDATE ON public.agenda FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4) RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedor_desempenho ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estornos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.empresa_members me
    JOIN public.empresa_members other ON other.empresa_id = me.empresa_id AND other.status = 'aceito'
    WHERE me.usuario_id = auth.uid() AND me.status = 'aceito' AND other.usuario_id = profiles.id));
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS empresas_select ON public.empresas;
CREATE POLICY empresas_select ON public.empresas FOR SELECT TO authenticated
  USING (public.is_empresa_member(id) OR responsavel_id = auth.uid());
DROP POLICY IF EXISTS empresas_insert ON public.empresas;
CREATE POLICY empresas_insert ON public.empresas FOR INSERT TO authenticated WITH CHECK (responsavel_id = auth.uid());
DROP POLICY IF EXISTS empresas_update ON public.empresas;
CREATE POLICY empresas_update ON public.empresas FOR UPDATE TO authenticated USING (public.is_empresa_member(id));

DROP POLICY IF EXISTS members_select ON public.empresa_members;
CREATE POLICY members_select ON public.empresa_members FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.is_empresa_member(empresa_id));
DROP POLICY IF EXISTS members_insert ON public.empresa_members;
CREATE POLICY members_insert ON public.empresa_members FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() OR public.empresa_role(empresa_id) IN ('admin','gestor'));
DROP POLICY IF EXISTS members_update ON public.empresa_members;
CREATE POLICY members_update ON public.empresa_members FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() OR public.empresa_role(empresa_id) IN ('admin','gestor'));

DROP POLICY IF EXISTS convites_all ON public.convites;
CREATE POLICY convites_all ON public.convites FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id)) WITH CHECK (public.is_empresa_member(empresa_id));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','client_historico','services','vendedores','comissoes',
    'vendedor_desempenho','contratos','assinaturas','contrato_historico',
    'parcelas','lancamentos','estornos','agenda','agenda_historico','auditoria'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_all ON public.%I FOR ALL TO authenticated USING (public.is_empresa_member(empresa_id)) WITH CHECK (public.is_empresa_member(empresa_id))',
      t, t);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

NOTIFY pgrst, 'reload schema';

