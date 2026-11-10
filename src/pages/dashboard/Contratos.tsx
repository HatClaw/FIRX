import { useMemo, useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Download, FileText, Trash2, Send, Eye, EyeOff, Pencil, MessageCircle, Check } from 'lucide-react';
import { Button, Input, Card, EmptyState, PageHeader, Modal } from '@/components/ui';
import { AdminAccordionList } from '@/components/admin/AdminAccordionList';
import { useAdminHiddenRecords } from '@/hooks/useAdminHiddenRecords';
import { exportCsv, exportPdf } from '@/lib/export';
import {
  listContratosRemotos,
  updateContratoStatus,
  updateContrato,
  deleteContrato,
  formatBRL,
  getContratoResumoFinanceiro,
  type ContratoLocal,
} from '@/lib/contratos-store';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { gerarContratoHtml } from '@/lib/contrato-template';

export default function Contratos() {
  const { isAdmin: isPlatformAdmin } = useAdminAuth();
  const { empresaAtiva } = useAuth();
  const canManage = isPlatformAdmin || empresaAtiva?.role === 'admin';
  const [rows, setRows] = useState<ContratoLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [editing, setEditing] = useState<ContratoLocal | null>(null);
  const [editError, setEditError] = useState('');
  const [viewing, setViewing] = useState<ContratoLocal | null>(null);
  const { hiddenIds, hiddenCount, showHidden, setShowHidden, toggleHidden } = useAdminHiddenRecords('contratos-operacional');
  const canEdit = canManage;
  const [params] = useSearchParams();
  const criado = params.get('criado');
  const assinaturaEnviada = params.get('assinatura') === 'enviada';

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listContratosRemotos());
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os contratos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload, criado]);

  const filtered = useMemo(
    () =>
      rows.filter((row) => showHidden ? hiddenIds.has(row.id) : !hiddenIds.has(row.id)).filter(
        (r) =>
          r.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
          String(r.numero).includes(busca) ||
          r.status.includes(busca.toLowerCase())
      ),
    [rows, busca, showHidden, hiddenIds]
  );

  const runAction = async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a alteração.');
    }
  };

  const saveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const total = Math.max(0, Number(String(form.get('valor')).replace(',', '.')) || 0);
    const entrada = Math.max(0, Number(String(form.get('entrada')).replace(',', '.')) || 0);
    const quantidade = Math.max(1, Number(form.get('parcelas')) || 1);
    const centavos = Math.round(Math.max(0, total - entrada) * 100);
    const parcela = Math.floor(centavos / quantidade) / 100;
    const ultima = (centavos - parcela * 100 * (quantidade - 1)) / 100;
    const valorSemBeneficios = editing.valor_sem_beneficios ?? (editing.valor_bruto + editing.bonus_total);
    const economiaTotal = Math.max(0, valorSemBeneficios - total);
    const descontoValor = Math.max(0, editing.valor_bruto - total);
    try {
      await updateContrato(editing.id, {
      cliente_nome: String(form.get('cliente_nome') || '').trim(),
      cliente_documento: String(form.get('cliente_documento') || '').trim(),
      valor: total,
      entrada_valor: entrada,
      parcelas: quantidade,
      valor_parcela: parcela,
      valor_ultima_parcela: ultima,
      desconto_valor: descontoValor,
      desconto_percentual: editing.valor_bruto > 0 ? descontoValor / editing.valor_bruto * 100 : 0,
      valor_sem_beneficios: valorSemBeneficios,
      economia_total: economiaTotal,
      data_inicio: String(form.get('data_inicio') || ''),
      pagamento_observacao: String(form.get('pagamento_observacao') || '').trim(),
      observacoes: String(form.get('observacoes') || '').trim(),
      });
      setEditing(null);
      setEditError('');
      await reload();
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o contrato.');
    }
  };

  const compartilharWhatsApp = (contrato: ContratoLocal) => {
    const financeiro = getContratoResumoFinanceiro(contrato);
    const numero = (contrato.cliente_whatsapp || contrato.cliente_telefone || '').replace(/\D/g, '');
    const mensagem = [
      `Olá, ${contrato.cliente_nome}! Segue o resumo do contrato CT-${String(contrato.numero).padStart(4, '0')}.`,
      `Valor de tabela: ${formatBRL(financeiro.valorSemBeneficios)}.`,
      `Valor final: ${formatBRL(financeiro.valorFinal)}.`,
      financeiro.economia > 0 ? `Sua economia: ${formatBRL(financeiro.economia)} (${financeiro.economiaPercentual.toFixed(1)}%).` : '',
      `Pagamento: ${contrato.pagamento_status === 'pago' ? 'realizado' : 'pendente'}.`,
      `${contrato.parcelas} parcela(s) de ${formatBRL(contrato.valor_parcela)}.`,
    ].filter(Boolean).join('\n');
    const query = new URLSearchParams({ text: mensagem });
    window.open(`https://wa.me/${numero}?${query.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const imprimirContrato = (contrato: ContratoLocal) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Permita a abertura de janelas para imprimir ou salvar o contrato em PDF.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contrato CT-${String(contrato.numero).padStart(4, '0')}</title></head><body>${gerarContratoHtml(contrato)}</body></html>`);
    printWindow.document.close();
    printWindow.opener = null;
    printWindow.setTimeout(() => printWindow.print(), 700);
  };

  return (
    <div className="max-w-7xl space-y-4">
      <PageHeader
        title="Contratos"
        description="Crie, edite, cobre e envie o contrato para assinatura eletrônica."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={() =>
          exportCsv(
                  'contratos',
                  filtered.map((r) => ({
                    Número: `CT-${String(r.numero).padStart(4, '0')}`,
                    Cliente: r.cliente_nome,
                    Valor: r.valor,
                    Parcelas: `${r.parcelas}x ${formatBRL(r.valor_parcela)}`,
                    Status: r.status,
                    Início: r.data_inicio,
                  }))
                )
              }
            >
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileText className="w-4 h-4" />}
              onClick={() =>
                exportPdf(
                  'Contratos',
                  `<table><thead><tr><th>Nº</th><th>Cliente</th><th>Valor</th><th>Parcelas</th><th>Status</th></tr></thead><tbody>${filtered
                    .map(
                      (r) =>
                        `<tr><td>CT-${String(r.numero).padStart(4, '0')}</td><td>${r.cliente_nome}</td><td>${formatBRL(
                          r.valor
                        )}</td><td>${r.parcelas}x ${formatBRL(r.valor_parcela)}${r.valor_ultima_parcela && r.valor_ultima_parcela !== r.valor_parcela ? ` (última ${formatBRL(r.valor_ultima_parcela)})` : ''}</td><td>${r.status}</td></tr>`
                    )
                    .join('')}</tbody></table>`
                )
              }
            >
              PDF
            </Button>
            <Link to="/contratos/novo">
              <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                Novo contrato
              </Button>
            </Link>
          </>
        }
      />

      {criado && (
        <div className="rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm text-brand">
          {assinaturaEnviada
            ? 'Contrato criado e convites de assinatura enviados para o cliente e para a empresa.'
            : 'Contrato criado com sucesso.'}
        </div>
      )}

      {error && <p className="rounded-lg border border-erro/30 bg-erro/10 px-4 py-3 text-sm text-erro" role="alert">{error}</p>}

      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border-color">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <Input
              className="pl-9"
              placeholder="Buscar por cliente, número ou status..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowHidden((value) => !value)}>{showHidden ? 'Exibir ativos' : `Exibir ocultos (${hiddenCount})`}</Button>
        </div>

        {loading ? <p className="p-8 text-center text-sm text-text-secondary">Carregando contratos…</p> : filtered.length === 0 ? (
          <EmptyState
            title="Nenhum contrato"
            description="Crie o primeiro contrato em poucos passos: cliente, serviços, condições e revisão."
            action={(
              <Link to="/contratos/novo">
                <Button leftIcon={<Plus className="w-4 h-4" />}>Novo contrato</Button>
              </Link>
            )}
          />
        ) : (
          <AdminAccordionList items={filtered.map((r) => ({
            id: r.id,
            title: `${r.cliente_nome} · CT-${String(r.numero).padStart(4, '0')}`,
            subtitle: `${formatBRL(r.valor)} · ${r.status} · pagamento ${r.pagamento_status || 'pendente'}`,
            details: [
              { label: 'Valor de tabela (sem bônus/descontos)', value: formatBRL(getContratoResumoFinanceiro(r).valorSemBeneficios) },
              { label: 'Valor final', value: formatBRL(r.valor) },
              { label: 'Economia', value: `${formatBRL(getContratoResumoFinanceiro(r).economia)} (${getContratoResumoFinanceiro(r).economiaPercentual.toFixed(1)}%)` },
              { label: 'Pagamento', value: r.pagamento_status === 'pago' ? 'Realizado' : 'Pendente' },
              { label: 'CPF/CNPJ', value: r.cliente_documento },
              { label: 'Parcelas', value: `${r.parcelas}x ${formatBRL(r.valor_parcela)}${r.valor_ultima_parcela && r.valor_ultima_parcela !== r.valor_parcela ? ` · última ${formatBRL(r.valor_ultima_parcela)}` : ''}` },
              { label: 'Vigência', value: `${r.data_inicio || '—'}${r.data_termino ? ` → ${r.data_termino}` : ''}` },
              { label: 'Condições de pagamento', value: r.pagamento_observacao },
              { label: 'Observações', value: r.observacoes },
            ],
            actions: <>
              <Button variant="outline" size="sm" leftIcon={<Eye className="h-4 w-4" />} onClick={() => setViewing(r)}>Visualizar</Button>
              <Button variant="outline" size="sm" leftIcon={<MessageCircle className="h-4 w-4" />} onClick={() => compartilharWhatsApp(r)}>WhatsApp</Button>
              <Button variant="ghost" size="sm" leftIcon={<EyeOff className="h-4 w-4" />} onClick={() => toggleHidden(r.id)}>{showHidden ? 'Reexibir' : 'Ocultar'}</Button>
              {canManage && <>{canEdit && <Button variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => { setEditing(r); setEditError(''); }}>Editar</Button>}<Button variant="outline" size="sm" leftIcon={<Check className="h-4 w-4" />} onClick={() => void runAction(() => updateContrato(r.id, { pagamento_status: r.pagamento_status === 'pago' ? 'pendente' : 'pago' }))}>{r.pagamento_status === 'pago' ? 'Marcar pendente' : 'Marcar pago'}</Button><Button variant="outline" size="sm" leftIcon={<Send className="h-4 w-4" />} onClick={() => void runAction(() => updateContratoStatus(r.id, 'enviado'))}>Enviar</Button><Button variant="outline" size="sm" onClick={() => void runAction(() => updateContratoStatus(r.id, 'assinado'))}>Marcar assinado</Button><Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-4 w-4 text-erro" />} onClick={() => void runAction(() => deleteContrato(r.id))}>Excluir</Button></>}
            </>,
          }))} />
        )}
      </Card>

      {canManage && <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar contrato" size="lg">
        {editing && <form onSubmit={saveEdit} className="space-y-4">
          {editError && <p className="text-sm text-erro" role="alert">{editError}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="cliente_nome" label="Cliente" defaultValue={editing.cliente_nome} required />
            <Input name="cliente_documento" label="CPF/CNPJ" defaultValue={editing.cliente_documento || ''} />
            <Input name="valor" label="Valor total (R$)" type="number" min="0" step="0.01" defaultValue={editing.valor} required />
            <Input name="entrada" label="Entrada (R$)" type="number" min="0" step="0.01" defaultValue={editing.entrada_valor} />
            <Input name="parcelas" label="Quantidade de parcelas" type="number" min="1" max="99" defaultValue={editing.parcelas} required />
            <Input name="data_inicio" label="Data de início" type="date" defaultValue={editing.data_inicio} />
            <Input name="pagamento_observacao" label="Condições de pagamento" defaultValue={editing.pagamento_observacao || ''} />
            <label className="text-sm font-medium sm:col-span-2">Observações internas<textarea name="observacoes" rows={3} defaultValue={editing.observacoes || ''} className="mt-1 w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm" /></label>
          </div>
          <p className="text-xs text-text-secondary">O valor unitário será recalculado e exibido na lista e na exportação do contrato.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button type="submit">Salvar alterações</Button>
          </div>
        </form>}
      </Modal>}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Visualizar contrato" footer={<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={!viewing} onClick={() => viewing && imprimirContrato(viewing)}>Imprimir / salvar PDF</Button><Button variant="outline" onClick={() => setViewing(null)}>Fechar</Button></div>}>
        {viewing && <><dl className="grid gap-3 sm:grid-cols-2">{[['Número', `CT-${String(viewing.numero).padStart(4, '0')}`], ['Cliente', viewing.cliente_nome], ['CPF/CNPJ', viewing.cliente_documento], ['Valor de tabela', formatBRL(getContratoResumoFinanceiro(viewing).valorSemBeneficios)], ['Valor final', formatBRL(viewing.valor)], ['Economia', `${formatBRL(getContratoResumoFinanceiro(viewing).economia)} (${getContratoResumoFinanceiro(viewing).economiaPercentual.toFixed(1)}%)`], ['Pagamento', viewing.pagamento_status === 'pago' ? 'Realizado' : 'Pendente'], ['Entrada', formatBRL(viewing.entrada_valor)], ['Parcelas', `${viewing.parcelas}x ${formatBRL(viewing.valor_parcela)}`], ['Status', viewing.status], ['Início', viewing.data_inicio], ['Término', viewing.data_termino], ['Condições', viewing.pagamento_observacao], ['Observações', viewing.observacoes]].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-bg-secondary p-3"><dt className="text-xs font-medium uppercase text-text-secondary">{label}</dt><dd className="mt-1 break-words text-sm text-text-primary">{value || '—'}</dd></div>)}</dl><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" leftIcon={<MessageCircle className="h-4 w-4" />} onClick={() => compartilharWhatsApp(viewing)}>Compartilhar no WhatsApp</Button><a className="inline-flex min-h-9 items-center rounded-xl border border-border-color px-3 text-sm font-medium hover:bg-bg-secondary" href="https://assinador.iti.br/" target="_blank" rel="noopener noreferrer">Assinatura Gov.br (opcional)</a></div><p className="mt-3 rounded-lg bg-bg-secondary p-3 text-xs text-text-secondary">Para usar Gov.br, salve o contrato em PDF e as duas partes assinam o mesmo arquivo no portal oficial. Depois, mantenham o PDF assinado. A confirmação dessas assinaturas externas não é sincronizada automaticamente no GrowMoney.</p></>}
      </Modal>
    </div>
  );
}
