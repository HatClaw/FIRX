import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Eye, EyeOff, FileText, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { Button, Card, EmptyState, FileUpload, Input, Modal, PageHeader } from '@/components/ui';
import { AdminAccordionList } from '@/components/admin/AdminAccordionList';
import { useAdminHiddenRecords } from '@/hooks/useAdminHiddenRecords';
import { exportCsv, exportPdf, formatBRL } from '@/lib/export';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

type Lancamento = { id: string; cliente: string; valor: number; vencimento: string; status: 'pendente' | 'pago' | 'atrasado'; comprovante_path: string | null };
const emptyForm = { cliente: '', valor: '', vencimento: '' };

export default function Financeiro() {
  const { user, empresaAtiva, hasPermission } = useAuth();
  const { isAdmin: isPlatformAdmin } = useAdminAuth();
  const canManage = isPlatformAdmin || empresaAtiva?.role === 'admin';
  const [rows, setRows] = useState<Lancamento[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [viewing, setViewing] = useState<Lancamento | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [comprovantePath, setComprovantePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { hiddenIds, hiddenCount, showHidden, setShowHidden, toggleHidden } = useAdminHiddenRecords('financeiro-operacional');

  const load = useCallback(async () => {
    if (!empresaAtiva?.id) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error: loadError } = await supabase.from('gm_financial_entries')
      .select('id, cliente, valor, vencimento, status, comprovante_path')
      .eq('empresa_id', empresaAtiva.id).order('vencimento', { ascending: true });
    if (loadError) setError(`Não foi possível carregar o financeiro: ${loadError.message}`);
    else { setRows((data || []).map((row) => ({ ...row, valor: Number(row.valor) })) as Lancamento[]); setError(''); }
    setLoading(false);
  }, [empresaAtiva?.id]);
  useEffect(() => { void load(); }, [load]);

  const displayRows = useMemo(() => rows.map((row) => ({ ...row, status: row.status === 'pendente' && row.vencimento < new Date().toISOString().slice(0, 10) ? 'atrasado' as const : row.status })), [rows]);
  const totals = useMemo(() => {
    const previsto = displayRows.reduce((sum, row) => sum + row.valor, 0);
    const pago = displayRows.filter((row) => row.status === 'pago').reduce((sum, row) => sum + row.valor, 0);
    const atrasado = displayRows.filter((row) => row.status === 'atrasado').reduce((sum, row) => sum + row.valor, 0);
    return { previsto, pago, atrasado, saldo: previsto - pago };
  }, [displayRows]);

  const salvar = async () => {
    if (!empresaAtiva?.id || !user?.id) { setError('Selecione uma empresa para registrar lançamentos.'); return; }
    if (!form.cliente.trim() || !form.vencimento || Number(form.valor) <= 0) { setError('Informe cliente, valor acima de zero e vencimento.'); return; }
    setSaving(true); setError('');
    const entry = { cliente: form.cliente.trim(), valor: Number(form.valor), vencimento: form.vencimento, comprovante_path: comprovantePath };
    const { error: saveError } = editing
      ? await supabase.from('gm_financial_entries').update({ ...entry, atualizado_em: new Date().toISOString() }).eq('id', editing.id).eq('empresa_id', empresaAtiva.id)
      : await supabase.from('gm_financial_entries').insert({ ...entry, empresa_id: empresaAtiva.id, criado_por: user.id });
    setSaving(false);
    if (saveError) { setError(`Não foi possível salvar o lançamento: ${saveError.message}`); return; }
    setOpen(false); setEditing(null); setForm(emptyForm); setComprovantePath(null); await load();
  };

  const marcarPago = async (row: Lancamento) => {
    if (!empresaAtiva?.id) return;
    const { error: updateError } = await supabase.from('gm_financial_entries').update({ status: 'pago', atualizado_em: new Date().toISOString() }).eq('id', row.id).eq('empresa_id', empresaAtiva.id);
    if (updateError) setError(`Não foi possível registrar o pagamento: ${updateError.message}`);
    else await load();
  };

  const canWrite = hasPermission('financeiro:write');
  const visibleRows = displayRows.filter((row) => showHidden ? hiddenIds.has(row.id) : !hiddenIds.has(row.id));
  const abrirEdicao = (row: Lancamento) => { setEditing(row); setForm({ cliente: row.cliente, valor: String(row.valor), vencimento: row.vencimento }); setComprovantePath(row.comprovante_path); setError(''); setOpen(true); };
  const excluir = async (row: Lancamento) => {
    if (!empresaAtiva?.id || !window.confirm(`Excluir o lançamento de ${row.cliente}? Esta ação não pode ser desfeita.`)) return;
    const { error: deleteError } = await supabase.from('gm_financial_entries').delete().eq('id', row.id).eq('empresa_id', empresaAtiva.id);
    if (deleteError) setError(`Não foi possível excluir o lançamento: ${deleteError.message}`); else await load();
  };
  return <div className="max-w-7xl space-y-4">
    <PageHeader title="Financeiro" description="Lançamentos, recebimentos e comprovantes" actions={<>
      <Button variant="outline" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={() => exportCsv('financeiro', displayRows.map((r) => ({ Cliente: r.cliente, Valor: r.valor, Vencimento: r.vencimento, Status: r.status })))}>CSV</Button>
      <Button variant="outline" size="sm" leftIcon={<FileText className="h-4 w-4" />} onClick={() => exportPdf('Financeiro', `<table><thead><tr><th>Cliente</th><th>Valor</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>${displayRows.map((r) => `<tr><td>${r.cliente}</td><td>${formatBRL(r.valor)}</td><td>${r.vencimento}</td><td>${r.status}</td></tr>`).join('')}</tbody></table>`)}>PDF</Button>
      {canWrite && <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setError(''); setOpen(true); }}>Lançar</Button>}
    </>} />
    {error && !open && <p className="rounded-lg border border-erro/30 bg-erro/10 p-3 text-sm text-erro" role="alert">{error}</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[{ label: 'Previsto', value: totals.previsto }, { label: 'Recebido', value: totals.pago }, { label: 'Atrasado', value: totals.atrasado }, { label: 'Saldo', value: totals.saldo }].map((item) => <Card key={item.label} className="p-4"><p className="text-xs font-medium text-text-secondary">{item.label}</p><p className="mt-1 text-xl font-bold tabular-nums">{formatBRL(item.value)}</p></Card>)}</div>
    <Card padding="none" className="overflow-hidden">{!loading && displayRows.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-color p-4"><p className="text-xs text-text-secondary">Os itens ocultos permanecem no financeiro e podem ser reexibidos.</p><Button type="button" variant="outline" size="sm" onClick={() => setShowHidden((value) => !value)}>{showHidden ? 'Exibir ativos' : `Exibir ocultos (${hiddenCount})`}</Button></div>}{loading ? <p className="p-8 text-center text-sm text-text-secondary">Carregando lançamentos…</p> : visibleRows.length === 0 ? <div className="p-8"><EmptyState title="Sem lançamentos" description="Registre recebimentos e anexe comprovantes." icon={<Wallet className="h-6 w-6" />} /></div> : <AdminAccordionList items={visibleRows.map((row) => ({ id: row.id, title: row.cliente, subtitle: `${formatBRL(row.valor)} · ${row.status}`, details: [{ label: 'Vencimento', value: new Date(`${row.vencimento}T12:00:00`).toLocaleDateString('pt-BR') }, { label: 'Comprovante', value: row.comprovante_path ? 'Anexado' : 'Não anexado' }], actions: <><Button variant="outline" size="sm" leftIcon={<Eye className="h-4 w-4" />} onClick={() => setViewing(row)}>Visualizar</Button><Button variant="ghost" size="sm" leftIcon={<EyeOff className="h-4 w-4" />} onClick={() => toggleHidden(row.id)}>{showHidden ? 'Reexibir' : 'Ocultar'}</Button>{canManage && <><Button variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => abrirEdicao(row)}>Editar</Button>{row.status !== 'pago' && <Button variant="outline" size="sm" onClick={() => void marcarPago(row)}>Marcar pago</Button>}<Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-4 w-4 text-erro" />} onClick={() => void excluir(row)}>Excluir</Button></>}</> }))} />}</Card>
    {canWrite && <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? 'Editar lançamento' : 'Novo lançamento'} size="lg" footer={<><Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button><Button loading={saving} onClick={() => void salvar()}>{editing ? 'Salvar alterações' : 'Salvar lançamento'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2"><Input label="Cliente" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} required /><Input label="Valor (R$)" type="number" min="0.01" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required /><Input label="Vencimento" type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} required /><div className="sm:col-span-2"><p className="mb-2 text-sm font-medium">Comprovante</p><FileUpload accept="image/*,.pdf" categoria="arquivos" onUploaded={(files) => setComprovantePath(files[0]?.caminho || null)} /></div>{error && <p className="text-sm text-erro sm:col-span-2" role="alert">{error}</p>}</div>
    </Modal>}
    <Modal open={!!viewing} onClose={() => setViewing(null)} title="Visualizar lançamento" footer={<Button variant="outline" onClick={() => setViewing(null)}>Fechar</Button>}>{viewing && <dl className="grid gap-3 sm:grid-cols-2">{[['Cliente', viewing.cliente], ['Valor', formatBRL(viewing.valor)], ['Vencimento', new Date(`${viewing.vencimento}T12:00:00`).toLocaleDateString('pt-BR')], ['Status', viewing.status], ['Comprovante', viewing.comprovante_path || 'Não anexado']].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-bg-secondary p-3"><dt className="text-xs font-medium uppercase text-text-secondary">{label}</dt><dd className="mt-1 break-all text-sm text-text-primary">{value}</dd></div>)}</dl>}</Modal>
  </div>;
}
