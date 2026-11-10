import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, Check, RefreshCw } from 'lucide-react';
import { Button, Input, Card, PageHeader, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';
import { calcularDescontoComercial, calcularItensContrato, gerarCronogramaParcelas, isValidCurrencyInput, mesesDaPeriodicidade, parseCurrencyInput } from '@/lib/contrato-calculo';
import {
  listServicosCatalogo,
  saveContrato,
  formatBRL,
  addMonths,
  type ClienteLocal,
  type ContratoLocal,
  type ServicoCatalogo,
} from '@/lib/contratos-store';
import { useAuth } from '@/contexts/AuthContext';
import { loadClientesEmpresa, saveClienteEmpresa } from '@/services/contrato-wizard-data';
import { createEnvelope, sendEnvelope } from '@/lib/assinatura-store';
import { EMPRESA_CONTRATO, gerarContratoHtml } from '@/lib/contrato-template';

const STEPS = ['Cliente', 'Serviços', 'Condições', 'Revisão'] as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ContratoNovo({ vendedorMode = false }: { vendedorMode?: boolean }) {
  const navigate = useNavigate();
  const { user, empresas, empresaAtiva } = useAuth();
  const [step, setStep] = useState(1);
  const [pendingSignature, setPendingSignature] = useState<{ envelopeId?: string; contract: ContratoLocal } | null>(null);
  const [clientes, setClientes] = useState<ClienteLocal[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const servicos = useMemo(() => listServicosCatalogo(), []);

  const [clientId, setClientId] = useState('');
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const [clienteForm, setClienteForm] = useState({
    razao_social: '',
    documento: '',
    email: '',
    telefone: '',
    cidade: '',
    tipo: 'PJ' as 'PF' | 'PJ',
  });

  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [bonusIds, setBonusIds] = useState<string[]>([]);
  const [unidades, setUnidades] = useState(1);

  const [valorNegociado, setValorNegociado] = useState('');
  const [descontoManual, setDescontoManual] = useState('');
  const [modoDesconto, setModoDesconto] = useState<'valor' | 'percentual'>('valor');
  const [entrada, setEntrada] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [formaPagamento, setFormaPagamento] = useState<'cartao_credito' | 'pix' | 'boleto' | 'transferencia' | 'outro'>('cartao_credito');
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(today());
  const [periodicidade, setPeriodicidade] = useState<'mensal' | 'trimestral' | 'semestral' | 'anual'>('mensal');
  const [dataInicio, setDataInicio] = useState(today());
  const [obsPagamento, setObsPagamento] = useState('');
  const [obsInternas, setObsInternas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const carregarClientes = useCallback(async () => {
    if (!empresaAtiva?.id) return;
    setLoadingClientes(true);
    setError('');
    try {
      // The old browser-only client list had no company identifier. Import it
      // automatically only when the account has one company, avoiding cross-tenant data mixing.
      setClientes(await loadClientesEmpresa(empresaAtiva.id, empresaAtiva.role, empresas.length === 1));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os clientes da empresa.');
    } finally {
      setLoadingClientes(false);
    }
  }, [empresaAtiva?.id, empresaAtiva?.role, empresas.length]);

  useEffect(() => { void carregarClientes(); }, [carregarClientes]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const cliente = clientes.find((c) => c.id === clientId);

  const calc = useMemo(() => {
    const u = Math.max(1, unidades || 1);
    const nParc = Math.min(99, Math.max(1, Number(parcelas) || 1));
    const mesesPeriodicidade = mesesDaPeriodicidade(periodicidade);
    // Cada cobrança cobre o intervalo selecionado; o prazo e o calendário
    // acompanham a quantidade de cobranças e a periodicidade.
    const prazoMeses = Math.max(1, nParc * mesesPeriodicidade);
    const { itens, cobradoBruto, bonusTotal } = calcularItensContrato(servicos, selecionados, bonusIds, u, prazoMeses);
    const valorMensalBase = itens.reduce((sum, item) => sum + (!item.isBonus && item.tipo === 'mensal' ? item.valor * item.quantidade : 0), 0);
    const valorComercial = cobradoBruto;
    const descontoInput = descontoManual.trim() ? calcularDescontoComercial(valorComercial, parseCurrencyInput(descontoManual), modoDesconto) : null;
    const negociado = descontoInput !== null
      ? Math.max(0, valorComercial - descontoInput)
      : valorNegociado.trim() ? parseCurrencyInput(valorNegociado) : valorComercial;
    const descontoValor = Math.max(0, valorComercial - negociado);
    const descontoPercentual = valorComercial > 0 ? (descontoValor / valorComercial) * 100 : 0;
    const valorSemBeneficios = Math.round((cobradoBruto + bonusTotal) * 100) / 100;
    const economiaTotal = Math.round(Math.max(0, valorSemBeneficios - negociado) * 100) / 100;
    const economiaPercentual = valorSemBeneficios > 0 ? (economiaTotal / valorSemBeneficios) * 100 : 0;
    const entradaVal = parseCurrencyInput(entrada);
    const resto = Math.max(0, negociado - entradaVal);
    const totalCentavos = Math.round(resto * 100);
    const valorParcela = Math.floor(totalCentavos / nParc) / 100;
    const valorUltimaParcela = (totalCentavos - valorParcela * 100 * (nParc - 1)) / 100;
    const cronogramaParcelas = gerarCronogramaParcelas(
      dataPrimeiraParcela,
      nParc,
      valorParcela,
      valorUltimaParcela,
      mesesPeriodicidade,
    );
    const termino = addMonths(dataInicio, prazoMeses);

    return {
      itens,
      cobradoBruto,
      valorComercial,
      negociado,
      descontoValor,
      descontoPercentual,
      valorSemBeneficios,
      economiaTotal,
      economiaPercentual,
      bonusTotal,
      valorMensalBase,
      valorAnual: valorMensalBase * 12,
      prazoMeses,
      entradaVal,
      valorParcela,
      valorUltimaParcela,
      cronogramaParcelas,
      nParc,
      mesesPeriodicidade,
      termino,
    };
  }, [servicos, selecionados, bonusIds, unidades, valorNegociado, descontoManual, modoDesconto, entrada, parcelas, dataInicio, dataPrimeiraParcela, periodicidade]);

  const toggleServico = (s: ServicoCatalogo) => {
    setSelecionados((prev) => {
      let next = prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id];
      if (s.exclusaoGrupo && !prev.includes(s.id)) {
        const rivals = servicos.filter((x) => x.exclusaoGrupo === s.exclusaoGrupo && x.id !== s.id).map((x) => x.id);
        next = next.filter((id) => !rivals.includes(id));
      }
      return next;
    });
    setBonusIds((b) => b.filter((id) => id !== s.id));
  };

  const toggleBonus = (s: ServicoCatalogo) => {
    if (selecionados.includes(s.id)) return;
    setBonusIds((prev) => (prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]));
  };

  const salvarCliente = async () => {
    if (!clienteForm.razao_social.trim() || !empresaAtiva?.id || !user?.id) return;
    setError('');
    try {
      const c = await saveClienteEmpresa(empresaAtiva.id, user.id, { ...clienteForm, razao_social: clienteForm.razao_social.trim() });
      setClientes((current) => [c, ...current.filter((item) => item.id !== c.id)]);
      setClientId(c.id);
      setNovoClienteOpen(false);
      setClienteForm({ razao_social: '', documento: '', email: '', telefone: '', cidade: '', tipo: 'PJ' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o cliente.');
    }
  };

  const criarEnvelopeContrato = async (contrato: ContratoLocal) => {
    const contractHtml = gerarContratoHtml(contrato);
    const contractText = contractHtml
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\/(?:p|div|h[1-6]|tr|li|article|section)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#39;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return createEnvelope({
      empresa_id: contrato.empresa_id || empresaAtiva?.id,
      titulo: `Contrato CT-${String(contrato.numero).padStart(4, '0')} · ${contrato.cliente_nome}`,
      descricao: 'Contrato comercial para assinatura do cliente e da empresa.',
      documentoTexto: contractText,
      createdBy: user?.email || user?.nome || 'sistema',
      messageToSigners: 'Este contrato foi encaminhado para assinatura eletrônica das duas partes. Revise o documento completo antes de assinar.',
      signers: [
        { nome: contrato.cliente_nome, email: contrato.cliente_email || '', role: 'sign' },
        { nome: EMPRESA_CONTRATO.razaoSocial, email: EMPRESA_CONTRATO.email, role: 'sign' },
      ],
    });
  };

  const canNext = () => {
    if (step === 1) return !!clientId;
    if (step === 2) return selecionados.length > 0;
    return true;
  };

  const salvar = async () => {
    setError('');
    if (!cliente?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email.trim())) {
      setError('Para enviar o contrato para assinatura, informe um e-mail válido para o cliente. Volte à etapa Cliente e atualize o cadastro.');
      setStep(1);
      return;
    }
    if (cliente.email.trim().toLowerCase() === EMPRESA_CONTRATO.email.toLowerCase()) {
      setError('O e-mail do cliente deve ser diferente do e-mail do representante da empresa para que cada parte receba seu link pessoal.');
      setStep(1);
      return;
    }
    if (!isValidCurrencyInput(valorNegociado)) {
      setError('Informe um valor negociado válido, usando no máximo duas casas decimais.');
      setStep(3);
      return;
    }
    if (!isValidCurrencyInput(descontoManual) || parseCurrencyInput(descontoManual) > calc.valorComercial) {
      setError('O desconto deve ser válido e não pode superar o valor comercial do contrato.');
      setStep(3);
      return;
    }
    if (!isValidCurrencyInput(entrada)) {
      setError('Informe uma entrada válida, usando no máximo duas casas decimais.');
      setStep(3);
      return;
    }
    if (calc.entradaVal > calc.negociado) {
      setError('A entrada não pode ser maior que o valor final do contrato.');
      setStep(3);
      return;
    }
    if (!dataPrimeiraParcela) {
      setError('Informe a data de vencimento da primeira parcela.');
      setStep(3);
      return;
    }
    if (!clientId || !cliente) {
      setError('Selecione um cliente.');
      setStep(1);
      return;
    }
    if (!selecionados.length) {
      setError('Selecione ao menos um serviço.');
      setStep(2);
      return;
    }
    setSaving(true);
    try {
      if (pendingSignature) {
        const envelope = pendingSignature.envelopeId
          ? null
          : await criarEnvelopeContrato(pendingSignature.contract);
        const envelopeId = pendingSignature.envelopeId || envelope?.id;
        if (!envelopeId) throw new Error('Não foi possível preparar os links de assinatura. Tente novamente.');
        if (envelope) setPendingSignature({ ...pendingSignature, envelopeId });
        await sendEnvelope(envelopeId, user?.email || 'sistema');
        navigate(vendedorMode ? '/vendedor?contrato=criado' : `/contratos?criado=${pendingSignature.contract.id}&assinatura=enviada`);
        return;
      }
      const contrato = await saveContrato({
        empresa_id: empresaAtiva?.id,
        client_id: clientId,
        cliente_nome: cliente.razao_social,
        cliente_documento: cliente.documento,
        cliente_email: cliente.email,
        cliente_telefone: cliente.telefone,
        cliente_whatsapp: cliente.whatsapp,
        itens: calc.itens,
        unidades: Math.max(1, unidades),
        valor_bruto: calc.cobradoBruto,
        valor: calc.negociado,
        desconto_valor: calc.descontoValor,
        desconto_percentual: calc.descontoPercentual,
        bonus_total: calc.bonusTotal,
        valor_sem_beneficios: calc.valorSemBeneficios,
        economia_total: calc.economiaTotal,
        prazo_meses: calc.prazoMeses,
        forma_pagamento: formaPagamento,
        data_primeira_parcela: dataPrimeiraParcela,
        parcelas: calc.nParc,
        valor_parcela: calc.valorParcela,
        valor_ultima_parcela: calc.valorUltimaParcela,
        entrada_valor: calc.entradaVal,
        periodicidade,
        plano_recorrente: true,
        data_inicio: dataInicio,
        data_termino: calc.termino,
        pagamento_observacao: obsPagamento || undefined,
        pagamento_status: 'pendente',
        observacoes: obsInternas || undefined,
        status: 'pendente_assinatura',
      });
      setPendingSignature({ contract: contrato });
      const envelope = await criarEnvelopeContrato(contrato);
      setPendingSignature({ contract: contrato, envelopeId: envelope.id });
      await sendEnvelope(envelope.id, user?.email || 'sistema');
      navigate(vendedorMode ? '/vendedor?contrato=criado' : `/contratos?criado=${contrato.id}&assinatura=enviada`);
    } catch (e) {
      setError(e instanceof Error ? `${e.message} Se o contrato já foi salvo, tente concluir novamente para retomar o envio sem duplicá-lo.` : 'Não foi possível criar e enviar o contrato para assinatura.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <PageHeader
        title="Novo contrato"
        description={`Passo ${step} de 4`}
        actions={
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate(vendedorMode ? '/vendedor' : '/contratos')}>
            Voltar
          </Button>
        }
      />

      <div className="scroll-mt-4 flex gap-2 mb-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <button
              key={label}
              type="button"
              onClick={() => n < step && setStep(n)}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2 text-xs font-semibold sm:text-sm transition-colors',
                active && 'border-brand bg-brand/10 text-brand',
                done && 'border-brand/40 text-brand',
                !active && !done && 'border-border-color text-text-secondary'
              )}
            >
              <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-current/10 text-[10px]">
                {done ? <Check className="w-3 h-3" /> : n}
              </span>
              {label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-erro/40 bg-erro/10 px-4 py-3 text-sm text-erro" role="alert">
          {error}
        </div>
      )}

      {step === 1 && (
        <Card className="space-y-4 p-6">
          <div>
            <label className="text-sm font-medium text-text-primary">Cliente contratante</label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <select
                className="flex-1 rounded-xl border border-border-color bg-bg-primary px-3 py-2.5 text-sm text-text-primary"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={loadingClientes}
              >
                <option value="">{loadingClientes ? 'Carregando clientes…' : 'Selecione um cliente'}</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razao_social}
                    {c.cidade ? ` · ${c.cidade}` : ''}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button type="button" variant="outline" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => void carregarClientes()} disabled={!empresaAtiva?.id || loadingClientes}>
                  Atualizar
                </Button>
                <Button type="button" variant="outline" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setNovoClienteOpen(true)} disabled={!empresaAtiva?.id}>
                  Novo cliente
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              {clientes.length === 0 && !loadingClientes
                ? 'Nenhum cliente cadastrado nesta empresa. Confira a empresa ativa ou cadastre um novo cliente.'
                : 'A lista mostra clientes vinculados à empresa ativa. Use Atualizar para buscar os cadastros mais recentes.'}
            </p>
          </div>

          {cliente && (
            <div className="rounded-lg border border-border-color bg-bg-secondary/50 p-4 text-sm space-y-1">
              <p className="font-medium">{cliente.razao_social}</p>
              <p className="text-text-secondary">{cliente.documento || 'Sem documento'}</p>
              <p className="text-text-secondary">
                {cliente.email || '—'} · {cliente.telefone || '—'}
              </p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button disabled={!canNext()} onClick={() => setStep(2)} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Continuar
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-5 p-6">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Serviços contratados</h3>
            <p className="text-sm text-text-secondary">Selecione apenas os serviços contratados. Somente eles aparecerão no contrato.</p>
          </div>

          <div className="space-y-2">
            {servicos.map((s) => {
              const checked = selecionados.includes(s.id);
              const asBonus = bonusIds.includes(s.id);
              return (
                <div
                  key={s.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                    checked || asBonus ? 'border-brand/50 bg-brand/5' : 'border-border-color hover:bg-bg-tertiary/50'
                  )}
                >
                  <input id={`servico-${s.id}`} type="checkbox" className="mt-1 accent-brand" checked={checked} onChange={() => toggleServico(s)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor={`servico-${s.id}`} className="cursor-pointer font-medium text-sm">{s.nome}</label>
                      <span className="text-sm tabular-nums text-text-secondary">
                        {formatBRL(s.valor)}{s.tipo === 'mensal' ? '/mês' : ' · cobrança única'}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">{s.categoria}</p>
                    {s.bonus_permitido !== false && (
                      <label htmlFor={`bonus-${s.id}`} className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
                        <input
                          id={`bonus-${s.id}`}
                          type="checkbox"
                          className="accent-brand"
                          checked={asBonus}
                          disabled={checked}
                          onChange={() => toggleBonus(s)}
                        />
                        Incluir como bônus (cobrado R$ 0,00)
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-amber-600 dark:text-amber-400">Escolha Site institucional ou Landing Page, não os dois.</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Unidades / empresas atendidas</label>
              <Input
                type="number"
                min={1}
                max={99}
                value={String(unidades)}
                onChange={(e) => setUnidades(Math.max(1, Number(e.target.value) || 1))}
              />
              <p className="mt-1 text-xs text-text-secondary">Todos os valores são multiplicados por esta quantidade.</p>
            </div>
            <div className="rounded-xl border border-border-color p-4">
              <p className="text-xs font-semibold uppercase text-text-secondary">Total dos serviços no contrato</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatBRL(calc.cobradoBruto)}</p>
              <p className="mt-1 text-xs text-text-secondary">Prazo de {calc.prazoMeses} meses. Serviços mensais são multiplicados pelo prazo; itens únicos entram uma vez.</p>
              {calc.valorMensalBase > 0 && <p className="mt-2 text-xs text-text-secondary">Base mensal: {formatBRL(calc.valorMensalBase)} · valor anual: {formatBRL(calc.valorAnual)}</p>}
              {calc.bonusTotal > 0 && (
                <p className="mt-2 text-xs text-brand">Bônus no prazo: {formatBRL(calc.bonusTotal)} · cobrado R$ 0,00</p>
              )}
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button disabled={!canNext()} onClick={() => setStep(3)} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Continuar
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-4 p-6">
          <h3 className="text-sm font-semibold">Condições comerciais</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Valor final negociado (R$)</label>
              <Input
                placeholder={formatBRL(calc.valorComercial)}
                value={valorNegociado}
                onChange={(e) => { setValorNegociado(e.target.value); setDescontoManual(''); }}
              />
              <p className="mt-1 text-xs text-text-secondary">
                Valor de tabela: {formatBRL(calc.valorComercial)}
                {valorNegociado && (
                  <button type="button" className="ml-2 text-brand hover:underline" onClick={() => setValorNegociado('')}>
                    Voltar ao valor comercial
                  </button>
                )}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="modo-desconto">Adicionar desconto</label>
              <div className="mt-1 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
                <select
                  id="modo-desconto"
                  className="min-w-0 rounded-xl border border-border-color bg-bg-primary px-3 py-2.5 text-sm"
                  value={modoDesconto}
                  onChange={(e) => {
                    setModoDesconto(e.target.value as typeof modoDesconto);
                    setDescontoManual('');
                    setValorNegociado('');
                  }}
                >
                  <option value="valor">Valor (R$)</option>
                  <option value="percentual">Percentual (%)</option>
                </select>
                <Input
                  value={descontoManual}
                  onChange={(e) => { setDescontoManual(e.target.value); setValorNegociado(''); }}
                  placeholder={modoDesconto === 'percentual' ? 'Ex.: 10' : '0,00'}
                  inputMode="decimal"
                  aria-label={modoDesconto === 'percentual' ? 'Desconto comercial em percentual' : 'Desconto comercial em reais'}
                />
              </div>
              <p className="mt-1 text-xs text-text-secondary">{descontoManual && modoDesconto === 'percentual' ? `Desconto aplicado: ${formatBRL(calc.descontoValor)}` : 'O valor final e a economia são recalculados automaticamente.'}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Entrada (R$)</label>
              <Input value={entrada} onChange={(e) => setEntrada(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className="text-sm font-medium">{calc.entradaVal > 0 ? 'Cobranças após a entrada' : 'Número de cobranças'}</label>
              <Input
                type="number"
                min={1}
                max={99}
                value={String(parcelas)}
                onChange={(e) => setParcelas(Math.max(1, Number(e.target.value) || 1))}
              />
              <p className="mt-1 text-xs text-text-secondary">
                {calc.nParc}x de {formatBRL(calc.valorParcela)}
                {calc.valorUltimaParcela !== calc.valorParcela && ` · última ${formatBRL(calc.valorUltimaParcela)}`}
                {calc.entradaVal > 0 ? ` + entrada ${formatBRL(calc.entradaVal)}` : ''}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Data de início</label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              <p className="mt-1 text-xs text-text-secondary">Término previsto: {calc.termino}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Forma de pagamento</label>
              <select
                className="mt-1 w-full rounded-xl border border-border-color bg-bg-primary px-3 py-2.5 text-sm"
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value as typeof formaPagamento)}
              >
                <option value="cartao_credito">Cartão de crédito</option>
                <option value="pix">Pix</option>
                <option value="boleto">Boleto</option>
                <option value="transferencia">Transferência</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Vencimento da primeira parcela</label>
              <Input type="date" value={dataPrimeiraParcela} onChange={(e) => setDataPrimeiraParcela(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Periodicidade da cobrança</label>
            <select
              className="mt-1 w-full rounded-xl border border-border-color bg-bg-primary px-3 py-2.5 text-sm"
              value={periodicidade}
              onChange={(e) => setPeriodicidade(e.target.value as typeof periodicidade)}
            >
              <option value="mensal">Mensal</option>
              <option value="trimestral">Trimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
            </select>
            <p className="mt-1 text-xs text-text-secondary">Cada cobrança cobre {calc.mesesPeriodicidade} {calc.mesesPeriodicidade === 1 ? 'mês' : 'meses'}. O prazo, o valor por cobrança e os vencimentos são calculados automaticamente.</p>
          </div>

          <div>
            <label className="text-sm font-medium">Observação de pagamento</label>
            <Input value={obsPagamento} onChange={(e) => setObsPagamento(e.target.value)} placeholder="Ex.: boleto dia 10" />
          </div>
          <div>
            <label className="text-sm font-medium">Observações internas</label>
            <textarea
              className="mt-1 w-full min-h-[80px] rounded-xl border border-border-color bg-bg-primary px-3 py-2 text-sm"
              value={obsInternas}
              onChange={(e) => setObsInternas(e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 text-sm space-y-1">
            <div className="flex justify-between"><span>Valor de tabela sem bônus ou descontos</span><strong className="tabular-nums">{formatBRL(calc.valorSemBeneficios)}</strong></div>
            {calc.bonusTotal > 0 && <div className="flex justify-between text-text-secondary"><span>Bônus incluídos</span><span>− {formatBRL(calc.bonusTotal)}</span></div>}
            {calc.descontoValor > 0 && <div className="flex justify-between text-text-secondary"><span>Desconto comercial</span><span>− {formatBRL(calc.descontoValor)}</span></div>}
            <div className="flex justify-between border-t border-brand/20 pt-2"><span>Valor final no fechamento</span><strong className="tabular-nums">{formatBRL(calc.negociado)}</strong></div>
            {calc.economiaTotal > 0 && <div className="flex justify-between font-semibold text-brand"><span>Economia do cliente</span><span>{formatBRL(calc.economiaTotal)} ({calc.economiaPercentual.toFixed(1)}%)</span></div>}
            {calc.valorMensalBase > 0 && <div className="flex justify-between text-text-secondary"><span>Valor anual dos serviços mensais</span><span>{formatBRL(calc.valorAnual)}</span></div>}
            <div className="flex justify-between text-text-secondary"><span>Prazo</span><span>{calc.prazoMeses} meses · término previsto {calc.termino}</span></div>
            <div className="flex justify-between text-text-secondary"><span>Pagamento</span><span>{formaPagamento === 'cartao_credito' ? 'Cartão de crédito' : formaPagamento === 'pix' ? 'Pix' : formaPagamento === 'boleto' ? 'Boleto' : formaPagamento === 'transferencia' ? 'Transferência' : 'Outro'} · {periodicidade} · {calc.nParc} cobranças de {formatBRL(calc.valorParcela)}</span></div>
            <div className="border-t border-brand/20 pt-2">
              <p className="font-semibold">Vencimento de cada parcela</p>
              <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                {calc.cronogramaParcelas.map((parcela) => (
                  <li key={parcela.numero} className="flex justify-between gap-2 text-text-secondary">
                    <span>{parcela.numero}ª parcela · {new Date(`${parcela.data}T12:00:00`).toLocaleDateString('pt-BR')}</span>
                    <span className="tabular-nums">{formatBRL(parcela.valor)}</span>
                  </li>
                ))}
              </ul>
            </div>
            {calc.descontoValor > 0 && (
              <div className="flex justify-between text-text-secondary">
                <span>Desconto</span>
                <span>
                  {formatBRL(calc.descontoValor)} ({calc.descontoPercentual.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              Voltar
            </Button>
            <Button onClick={() => setStep(4)} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Revisar contrato
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="space-y-5 p-6">
          <h3 className="text-sm font-semibold">Revisar contrato</h3>
          <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 text-sm text-text-primary">
            Ao concluir, o sistema enviará automaticamente o contrato completo para assinatura eletrônica ao cliente ({cliente?.email || 'e-mail pendente'}) e à empresa ({EMPRESA_CONTRATO.email}). A conclusão do cadastro depende da confirmação de envio dos dois convites.
          </div>

          <div className="rounded-xl border border-border-color p-4 space-y-3 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase text-text-secondary">Cliente</p>
              <p className="font-medium">{cliente?.razao_social}</p>
              <p className="text-text-secondary">{cliente?.documento}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-text-secondary">Serviços contratados</p>
              <ul className="mt-1 space-y-1">
                {calc.itens.map((it) => (
                  <li key={it.servico_id + String(it.isBonus)} className="flex justify-between gap-2">
                    <span>
                      {it.nome}
                      {it.isBonus ? ' · bônus' : ''}
                      {it.quantidade > 1 ? ` × ${it.quantidade}` : ''}
                    </span>
                    <span className="tabular-nums text-text-secondary">
                      {it.isBonus ? 'R$ 0,00' : formatBRL(it.valor_total ?? it.valor * it.quantidade)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-border-color pt-3 space-y-1">
              <div className="flex justify-between">
                <span>Valor de tabela sem bônus ou descontos</span>
                <strong className="tabular-nums">{formatBRL(calc.valorSemBeneficios)}</strong>
              </div>
              {calc.bonusTotal > 0 && <div className="flex justify-between text-text-secondary"><span>Bônus incluídos</span><span>− {formatBRL(calc.bonusTotal)}</span></div>}
              {calc.descontoValor > 0 && <div className="flex justify-between text-text-secondary"><span>Desconto comercial</span><span>− {formatBRL(calc.descontoValor)}</span></div>}
              <div className="flex justify-between"><span>Valor final do contrato</span><strong className="tabular-nums">{formatBRL(calc.negociado)}</strong></div>
              {calc.economiaTotal > 0 && <div className="flex justify-between font-semibold text-brand"><span>Economia do cliente</span><span>{formatBRL(calc.economiaTotal)} ({calc.economiaPercentual.toFixed(1)}%)</span></div>}
              {calc.valorMensalBase > 0 && <div className="flex justify-between text-text-secondary"><span>Serviços mensais (12 meses)</span><span>{formatBRL(calc.valorAnual)}</span></div>}
              {calc.bonusTotal > 0 && <div className="flex justify-between text-text-secondary"><span>Bônus incluídos (sem cobrança)</span><span>{formatBRL(calc.bonusTotal)}</span></div>}
              {calc.itens.some((item) => item.isBonus) && (
                <div className="rounded-lg bg-brand/5 p-3 text-text-secondary">
                  <p className="font-semibold text-text-primary">Bônus acrescentados</p>
                  <ul className="mt-1 list-inside list-disc">
                    {calc.itens.filter((item) => item.isBonus).map((item) => (
                      <li key={item.servico_id}>{item.nome} · {formatBRL(item.valor_comercial_total || 0)} sem cobrança</li>
                    ))}
                  </ul>
                  <button type="button" className="mt-1 text-brand hover:underline" onClick={() => setStep(2)}>Editar bônus</button>
                </div>
              )}
              <div className="flex justify-between text-text-secondary">
                <span>Forma e condição de pagamento</span>
                <span>
                  {formaPagamento === 'cartao_credito' ? 'Cartão de crédito' : formaPagamento === 'pix' ? 'Pix' : formaPagamento === 'boleto' ? 'Boleto' : formaPagamento === 'transferencia' ? 'Transferência' : 'Outro'} ·{' '}
                  {calc.entradaVal > 0 && `Entrada ${formatBRL(calc.entradaVal)} + `}
                  {calc.nParc} cobranças {periodicidade} de {formatBRL(calc.valorParcela)}
                  {calc.valorUltimaParcela !== calc.valorParcela && ` (última ${formatBRL(calc.valorUltimaParcela)})`}
                </span>
              </div>
              <div className="rounded-lg bg-bg-secondary p-3">
                <p className="font-semibold">Resumo de vencimentos</p>
                <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                  {calc.cronogramaParcelas.map((parcela) => (
                    <li key={parcela.numero} className="flex justify-between gap-2 text-text-secondary">
                      <span>{parcela.numero}ª parcela · {new Date(`${parcela.data}T12:00:00`).toLocaleDateString('pt-BR')}</span>
                      <span className="tabular-nums">{formatBRL(parcela.valor)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Vigência</span>
                <span>
                  {dataInicio} → {calc.termino}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={() => setStep(3)}>
              Voltar
            </Button>
            <Button loading={saving} disabled={saving} onClick={salvar}>
              {saving ? (pendingSignature ? 'Reenviando convite pendente...' : 'Salvando e enviando para assinatura...') : 'Concluir e enviar para assinatura'}
            </Button>
          </div>
        </Card>
      )}

      <Modal
        open={novoClienteOpen}
        onClose={() => setNovoClienteOpen(false)}
        title="Novo cliente"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setNovoClienteOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarCliente}>Salvar</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Razão social / Nome"
              value={clienteForm.razao_social}
              onChange={(e) => setClienteForm({ ...clienteForm, razao_social: e.target.value })}
              required
            />
          </div>
          <Input
            label="CNPJ / CPF"
            value={clienteForm.documento}
            onChange={(e) => setClienteForm({ ...clienteForm, documento: e.target.value })}
          />
          <div>
            <label className="text-sm font-medium">Tipo</label>
            <select
              className="mt-1 w-full rounded-xl border border-border-color bg-bg-primary px-3 py-2.5 text-sm"
              value={clienteForm.tipo}
              onChange={(e) => setClienteForm({ ...clienteForm, tipo: e.target.value as 'PF' | 'PJ' })}
            >
              <option value="PJ">PJ</option>
              <option value="PF">PF</option>
            </select>
          </div>
          <Input label="E-mail" type="email" value={clienteForm.email} onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })} />
          <Input label="Telefone" value={clienteForm.telefone} onChange={(e) => setClienteForm({ ...clienteForm, telefone: e.target.value })} />
          <Input label="Cidade" value={clienteForm.cidade} onChange={(e) => setClienteForm({ ...clienteForm, cidade: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
