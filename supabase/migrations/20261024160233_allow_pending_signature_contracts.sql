-- Mantém o fluxo antigo do painel, mas aceita contratos aguardando as duas assinaturas.
-- Atualiza instalações iniciadas pela migration legada de gm_contracts.
ALTER TABLE public.gm_contracts
  DROP CONSTRAINT IF EXISTS gm_contracts_status_check;

ALTER TABLE public.gm_contracts
  ADD CONSTRAINT gm_contracts_status_check
  CHECK (status IN ('rascunho', 'revisao', 'enviado', 'pendente_assinatura', 'assinado', 'cancelado', 'expirado'));
