import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Pencil, Trash2, Search, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { Button, Card, EmptyState, Input, Modal, PageHeader } from '@/components/ui';
import { AdminResourceService, type AdminResourceRecord, type AdminResourceTable } from '@/services/admin-resource-service';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { criarLinkArquivo, uploadArquivo } from '@/services/file-storage';
import { AdminAccordionList } from '@/components/admin/AdminAccordionList';
import { useAdminHiddenRecords } from '@/hooks/useAdminHiddenRecords';
import { gerarContratoHtml } from '@/lib/contrato-template';
import type { ContratoLocal } from '@/lib/contratos-store';

type Field = {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'date' | 'number' | 'select' | 'textarea' | 'json';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  hint?: string;
};

type ResourceDefinition = {
  table: AdminResourceTable;
  title: string;
  description: string;
  columns: string;
  orderBy: string;
  visible: string[];
  fields: Field[];
  deleteWarning?: string;
  readOnly?: boolean;
};

const definitions: Record<string, ResourceDefinition> = {
  empresas: {
    table: 'empresas', title: 'Empresas', description: 'Gestão global das empresas cadastradas',
    columns: 'id,nome,cnpj,responsavel_id,criado_em', orderBy: 'criado_em', visible: ['nome', 'cnpj', 'responsavel_id', 'criado_em'],
    fields: [
      { name: 'nome', label: 'Nome', required: true },
      { name: 'cnpj', label: 'CNPJ' },
      { name: 'responsavel_id', label: 'ID do responsável', hint: 'UUID de uma conta existente; pode ficar em branco.' },
    ],
    deleteWarning: 'Excluir uma empresa remove em cascata os dados vinculados a ela. Esta ação não pode ser desfeita.',
  },
  clientes: {
    table: 'clients', title: 'Clientes', description: 'Clientes de todas as empresas',
    columns: 'id,empresa_id,nome,razao_social,tipo,documento,email,telefone,whatsapp,cep,responsavel,status,observacoes,endereco,criado_em,atualizado_em', orderBy: 'criado_em',
    visible: ['nome', 'documento', 'email', 'empresa_id', 'status', 'criado_em'],
    fields: [
      { name: 'empresa_id', label: 'ID da empresa', required: true },
      { name: 'nome', label: 'Nome', required: true }, { name: 'razao_social', label: 'Razão social' },
      { name: 'tipo', label: 'Tipo', type: 'select', required: true, options: [{ value: 'pessoa_fisica', label: 'Pessoa física' }, { value: 'pessoa_juridica', label: 'Pessoa jurídica' }] },
      { name: 'documento', label: 'CPF/CNPJ', required: true }, { name: 'email', label: 'E-mail', type: 'email' },
      { name: 'telefone', label: 'Telefone' }, { name: 'whatsapp', label: 'WhatsApp' }, { name: 'cep', label: 'CEP' },
      { name: 'responsavel', label: 'Responsável' },
      { name: 'status', label: 'Status', type: 'select', required: true, options: ['ativo', 'inativo', 'arquivado', 'suspenso', 'prospecto'].map((value) => ({ value, label: value })) },
      { name: 'observacoes', label: 'Observações', type: 'textarea' },
    ],
  },
  contratos: {
    table: 'gm_contracts', title: 'Contratos', description: 'Contratos persistidos na plataforma',
    columns: 'id,user_id,numero,status,payload,created_at,updated_at', orderBy: 'created_at',
    visible: ['numero', 'user_id', 'status', 'created_at'],
    fields: [
      { name: 'user_id', label: 'ID do usuário proprietário', required: true }, { name: 'numero', label: 'Número', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', required: true, options: ['rascunho', 'enviado', 'assinado', 'cancelado'].map((value) => ({ value, label: value })) },
      { name: 'cliente_nome', label: 'Nome do cliente', required: true }, { name: 'cliente_documento', label: 'CPF/CNPJ do cliente' },
      { name: 'cliente_email', label: 'E-mail do cliente', type: 'email' }, { name: 'cliente_telefone', label: 'Telefone do cliente' },
      { name: 'valor', label: 'Valor total (R$)', type: 'number', required: true }, { name: 'entrada_valor', label: 'Entrada (R$)', type: 'number' },
      { name: 'parcelas', label: 'Quantidade de parcelas', type: 'number' }, { name: 'valor_parcela', label: 'Valor da parcela (R$)', type: 'number' },
      { name: 'forma_pagamento', label: 'Forma de pagamento', required: true }, { name: 'data_inicio', label: 'Início da vigência', type: 'date', required: true },
      { name: 'data_termino', label: 'Término da vigência', type: 'date' }, { name: 'pdf_path', label: 'Caminho PDF' },
      { name: 'observacoes', label: 'Observações do contrato', type: 'textarea' },
    ],
  },
  assinaturas: {
    table: 'signature_envelopes', title: 'Assinaturas', description: 'Envelopes de assinatura digital',
    columns: 'id,owner_id,payload,created_at,updated_at', orderBy: 'created_at',
    visible: ['owner_id', 'payload', 'created_at'],
    fields: [
      { name: 'owner_id', label: 'ID do usuário proprietário', required: true },
      { name: 'payload', label: 'Dados da assinatura (JSON)', type: 'json', required: true },
    ],
  },
  financeiro: {
    table: 'gm_financial_entries', title: 'Financeiro', description: 'Lançamentos financeiros persistidos',
    columns: 'id,empresa_id,cliente,valor,vencimento,status,comprovante_path,criado_por', orderBy: 'vencimento',
    visible: ['cliente', 'empresa_id', 'valor', 'vencimento', 'status'],
    fields: [
      { name: 'empresa_id', label: 'ID da empresa', required: true }, { name: 'cliente', label: 'Cliente', required: true },
      { name: 'valor', label: 'Valor', type: 'number', required: true }, { name: 'vencimento', label: 'Vencimento', type: 'date', required: true },
      { name: 'status', label: 'Status', type: 'text', required: true },
    ],
  },
};

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return 'Detalhes disponíveis';
  return String(value);
};

const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const formatDateTime = (value: unknown) => {
  if (typeof value !== 'string' || !value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
};

const signatureStatusLabels: Record<string, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', parcial: 'Assinatura parcial',
  concluido: 'Concluído', cancelado: 'Cancelado', expirado: 'Expirado',
};

function mapAdminContract(row: AdminResourceRecord): ContratoLocal {
  const payload = objectValue(row.payload);
  const items = Array.isArray(payload.itens) ? payload.itens : [];
  const amount = Number(payload.valor ?? 0);
  const installments = Math.max(1, Number(payload.parcelas ?? 1));
  const upfront = Number(payload.entrada_valor ?? 0);
  const createdAt = String(payload.created_at ?? row.created_at ?? '');
  const createdDate = new Date(createdAt);
  return {
    id: row.id,
    numero: Number(row.numero ?? payload.numero ?? 0),
    client_id: String(payload.client_id ?? ''),
    cliente_nome: String(payload.cliente_nome ?? 'Cliente'),
    cliente_documento: String(payload.cliente_documento ?? ''),
    cliente_email: String(payload.cliente_email ?? ''),
    cliente_telefone: String(payload.cliente_telefone ?? ''),
    cliente_endereco: String(payload.cliente_endereco ?? ''),
    cliente_numero_endereco: String(payload.cliente_numero_endereco ?? ''),
    cliente_bairro: String(payload.cliente_bairro ?? ''),
    cliente_complemento: String(payload.cliente_complemento ?? ''),
    cliente_cep: String(payload.cliente_cep ?? ''),
    cliente_cidade: String(payload.cliente_cidade ?? ''),
    cliente_estado: String(payload.cliente_estado ?? ''),
    vendedor: String(payload.vendedor ?? ''),
    itens: items.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object').map((item) => ({
      servico_id: String(item.servico_id ?? ''),
      nome: String(item.nome ?? 'Serviço'),
      valor: Number(item.valor ?? 0),
      tipo: item.tipo === 'mensal' ? 'mensal' as const : 'unico' as const,
      isBonus: item.isBonus === true,
      quantidade: Number(item.quantidade ?? 1),
      valor_total: Number(item.valor_total ?? (Number(item.valor ?? 0) * Number(item.quantidade ?? 1))),
      valor_comercial_total: Number(item.valor_comercial_total ?? 0),
      prazo_meses: Number(item.prazo_meses ?? payload.prazo_meses ?? 0),
    })),
    unidades: Number(payload.unidades ?? 1),
    valor_bruto: Number(payload.valor_bruto ?? amount),
    valor: amount,
    desconto_valor: Number(payload.desconto_valor ?? 0),
    desconto_percentual: Number(payload.desconto_percentual ?? 0),
    bonus_total: Number(payload.bonus_total ?? 0),
    economia_total: Number(payload.economia_total ?? 0),
    prazo_meses: Number(payload.prazo_meses ?? 12),
    modalidade: String(payload.modalidade ?? ''),
    data_primeira_parcela: String(payload.data_primeira_parcela ?? ''),
    forma_pagamento: String(payload.forma_pagamento ?? 'A combinar'),
    parcelas: installments,
    valor_parcela: Number(payload.valor_parcela ?? Math.round(((amount - upfront) / installments) * 100) / 100),
    valor_ultima_parcela: Number(payload.valor_ultima_parcela ?? 0),
    entrada_valor: upfront,
    periodicidade: payload.periodicidade === 'mensal' || payload.periodicidade === 'trimestral' || payload.periodicidade === 'semestral' || payload.periodicidade === 'anual' ? payload.periodicidade : null,
    plano_recorrente: payload.plano_recorrente === true,
    data_inicio: String(payload.data_inicio ?? (Number.isNaN(createdDate.getTime()) ? new Date().toISOString().slice(0, 10) : createdDate.toISOString().slice(0, 10))),
    data_termino: String(payload.data_termino ?? ''),
    pagamento_observacao: String(payload.pagamento_observacao ?? ''),
    observacoes: String(payload.observacoes ?? ''),
    status: (row.status === 'enviado' || row.status === 'assinado' || row.status === 'cancelado' ? row.status : 'rascunho'),
    created_at: String(payload.created_at ?? row.created_at ?? new Date().toISOString()),
  };
}

export default function AdminRecursos({ resource }: { resource: keyof typeof definitions }) {
  const { isAdmin } = useAdminAuth();
  const definition = definitions[resource];
  const [rows, setRows] = useState<AdminResourceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminResourceRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [contractPdfUrl, setContractPdfUrl] = useState('');
  const [viewing, setViewing] = useState<AdminResourceRecord | null>(null);
  const [contractPreview, setContractPreview] = useState<{ kind: 'pdf' | 'html'; content: string } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const { hiddenIds, hiddenCount, showHidden, setShowHidden, toggleHidden } = useAdminHiddenRecords(resource);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await AdminResourceService.list(definition.table, definition.columns, definition.orderBy));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar os registros.');
    } finally {
      setLoading(false);
    }
  }, [definition]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (showHidden ? !hiddenIds.has(row.id) : hiddenIds.has(row.id)) return false;
      if (!term) return true;
      return (() => {
        const payload = objectValue(row.payload);
        const related = resource === 'assinaturas'
          ? [payload.titulo, payload.createdBy, ...(Array.isArray(payload.signers) ? payload.signers.flatMap((signer) => {
            const person = objectValue(signer);
            return [person.nome, person.email];
          }) : [])]
          : resource === 'contratos'
            ? [payload.cliente_nome, payload.cliente_documento, payload.cliente_email]
            : [];
        return [...definition.visible.map((key) => displayValue(row[key])), ...related.map(displayValue)].some((value) => value.toLowerCase().includes(term));
      })();
    });
  }, [definition, rows, search, showHidden, hiddenIds, resource]);

  const openCreate = () => {
    setEditing(null);
    const initial = Object.fromEntries(definition.fields.map((field) => [field.name, '']));
    if (resource === 'contratos') {
      initial.status = 'rascunho';
      initial.parcelas = '1';
      initial.entrada_valor = '0';
      initial.data_inicio = new Date().toISOString().slice(0, 10);
    }
    setForm(initial);
    setError(''); setOpen(true);
    setContractPdfUrl('');
  };

  const openEdit = (row: AdminResourceRecord) => {
    setEditing(row);
    const valueFor = (field: Field) => {
      const value = resource === 'contratos' && ['cliente_nome', 'cliente_documento', 'cliente_email', 'cliente_telefone', 'valor', 'entrada_valor', 'parcelas', 'valor_parcela', 'forma_pagamento', 'data_inicio', 'data_termino', 'pdf_path', 'observacoes'].includes(field.name)
        ? (row.payload as Record<string, unknown> | null)?.[field.name]
        : row[field.name];
      return displayValue(value) === '—' ? '' : displayValue(value);
    };
    setForm(Object.fromEntries(definition.fields.map((field) => [field.name, valueFor(field)])));
    setContractPdfUrl('');
    setError(''); setOpen(true);
    if (resource === 'contratos' && typeof (row.payload as Record<string, unknown> | null)?.pdf_path === 'string') {
      void criarLinkArquivo(String((row.payload as Record<string, unknown>).pdf_path), 60 * 60)
        .then(setContractPdfUrl)
        .catch((cause) => setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o PDF vinculado.'));
    }
  };

  const uploadContractPdf = async (file?: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Selecione um arquivo PDF.');
      return;
    }
    const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
    if (header !== '%PDF-') {
      setError('O arquivo não contém um cabeçalho PDF válido.');
      return;
    }
    setPdfBusy(true); setError('');
    try {
      const uploaded = await uploadArquivo(file, 'contratos');
      setForm((current) => ({ ...current, pdf_path: uploaded.caminho }));
      setContractPdfUrl(uploaded.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o PDF.');
    } finally { setPdfBusy(false); }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    const payload: Record<string, unknown> = {};
    for (const field of definition.fields) {
      const value = form[field.name]?.trim() || '';
      if (!value) {
        if (editing && !field.required) payload[field.name] = null;
        continue;
      }
      try {
        payload[field.name] = field.type === 'number' ? Number(value) : field.type === 'json' ? JSON.parse(value) : value;
      } catch {
        setError(`${field.label} precisa conter um JSON válido.`);
        setSaving(false);
        return;
      }
    }
    if (resource === 'contratos') {
      const previousPayload = (editing?.payload as Record<string, unknown> | undefined) || {};
      const contractFields = ['cliente_nome', 'cliente_documento', 'cliente_email', 'cliente_telefone', 'valor', 'entrada_valor', 'parcelas', 'valor_parcela', 'forma_pagamento', 'data_inicio', 'data_termino', 'pdf_path', 'observacoes'];
      const contractPayload: Record<string, unknown> = editing ? { ...previousPayload } : {
        client_id: '', itens: [], unidades: 1, desconto_valor: 0, desconto_percentual: 0,
        bonus_total: 0, economia_total: 0, prazo_meses: 12, periodicidade: null,
        plano_recorrente: false, created_at: new Date().toISOString(),
      };
      contractFields.forEach((field) => {
        const value = form[field]?.trim() || '';
        if (['valor', 'entrada_valor', 'parcelas', 'valor_parcela'].includes(field)) contractPayload[field] = value ? Number(value) : 0;
        else if (value) contractPayload[field] = value;
        else if (editing && Object.prototype.hasOwnProperty.call(contractPayload, field)) delete contractPayload[field];
      });
      if (!editing) {
        const total = Number(form.valor || 0);
        const entrada = Number(form.entrada_valor || 0);
        const parcelas = Math.max(1, Number(form.parcelas || 1));
        contractPayload.valor_bruto = total;
        contractPayload.valor = total;
        contractPayload.valor_parcela = form.valor_parcela ? Number(form.valor_parcela) : Math.round(((total - entrada) / parcelas) * 100) / 100;
        contractPayload.entrada_valor = entrada;
        contractPayload.parcelas = parcelas;
        contractPayload.status = form.status;
        contractPayload.numero = form.numero ? Number(form.numero) : 0;
      }
      payload.payload = contractPayload;
      delete payload.cliente_nome; delete payload.cliente_documento; delete payload.cliente_email;
      delete payload.cliente_telefone; delete payload.valor; delete payload.entrada_valor;
      delete payload.parcelas; delete payload.valor_parcela; delete payload.forma_pagamento;
      delete payload.data_inicio; delete payload.data_termino; delete payload.pdf_path; delete payload.observacoes;
    }
    try {
      if (editing) await AdminResourceService.update(definition.table, editing.id, payload);
      else await AdminResourceService.create(definition.table, payload);
      setOpen(false); await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao salvar o registro.');
    } finally { setSaving(false); }
  };

  const remove = async (row: AdminResourceRecord) => {
    const name = displayValue(row[definition.visible[0]]);
    const prompt = definition.deleteWarning ? `${definition.deleteWarning}\n\n${name}` : `Excluir o registro “${name}”? Esta ação não pode ser desfeita.`;
    if (!window.confirm(prompt)) return;
    setError('');
    try { await AdminResourceService.delete(definition.table, row.id); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao excluir o registro.'); }
  };

  const viewRecord = async (row: AdminResourceRecord) => {
    setViewing(row);
    setContractPreview(null);
    if (resource !== 'contratos') return;

    setViewLoading(true);
    try {
      const payload = objectValue(row.payload);
      if (typeof payload.pdf_path === 'string' && payload.pdf_path.trim()) {
        const url = await criarLinkArquivo(payload.pdf_path, 60 * 60);
        setContractPreview({ kind: 'pdf', content: url });
      } else {
        setContractPreview({ kind: 'html', content: gerarContratoHtml(mapAdminContract(row)) });
      }
    } catch (cause) {
      setContractPreview({
        kind: 'html',
        content: gerarContratoHtml(mapAdminContract(row)),
      });
      setError(cause instanceof Error ? `PDF indisponível; exibindo o contrato gerado. ${cause.message}` : 'PDF indisponível; exibindo o contrato gerado.');
    } finally {
      setViewLoading(false);
    }
  };

  const renderSignatureDetails = (row: AdminResourceRecord) => {
    const envelope = objectValue(row.payload);
    const signers = Array.isArray(envelope.signers) ? envelope.signers.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : [];
    const events = Array.isArray(envelope.events) ? envelope.events.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : [];
    return (
      <div className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-bg-secondary p-3"><p className="text-xs font-medium uppercase text-text-secondary">Situação</p><p className="mt-1 text-sm font-semibold">{signatureStatusLabels[String(envelope.status)] || displayValue(envelope.status)}</p></div>
          <div className="rounded-xl bg-bg-secondary p-3"><p className="text-xs font-medium uppercase text-text-secondary">Responsável</p><p className="mt-1 break-all text-sm">{displayValue(envelope.createdBy)}</p></div>
          <div className="rounded-xl bg-bg-secondary p-3"><p className="text-xs font-medium uppercase text-text-secondary">Criado em</p><p className="mt-1 text-sm">{formatDateTime(envelope.createdAt ?? row.created_at)}</p></div>
          <div className="rounded-xl bg-bg-secondary p-3"><p className="text-xs font-medium uppercase text-text-secondary">Atualizado em</p><p className="mt-1 text-sm">{formatDateTime(envelope.updatedAt ?? row.updated_at)}</p></div>
        </section>
        {typeof envelope.descricao === 'string' && envelope.descricao && <p className="rounded-xl border border-border-color p-3 text-sm leading-relaxed">{envelope.descricao}</p>}
        <section>
          <h3 className="mb-2 text-sm font-semibold">Participantes ({signers.length})</h3>
          {signers.length ? <ul className="space-y-2">{signers.map((signer, index) => <li key={String(signer.id ?? index)} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-color p-3">
            <div className="min-w-0"><p className="break-words text-sm font-medium">{displayValue(signer.nome)}</p><p className="break-all text-xs text-text-secondary">{displayValue(signer.email)}</p></div>
            <div className="text-right text-xs"><p className="font-medium">{signer.role === 'cc' ? 'Cópia' : 'Assinante'} · {signer.status === 'signed' ? 'Assinado' : signer.status === 'viewed' ? 'Visualizado' : signer.status === 'declined' ? 'Recusado' : 'Pendente'}</p><p className="mt-1 text-text-secondary">{signer.signedAt ? `Assinado em ${formatDateTime(signer.signedAt)}` : signer.viewedAt ? `Visualizado em ${formatDateTime(signer.viewedAt)}` : 'Aguardando ação'}</p></div>
            {typeof signer.signatureDataUrl === 'string' && signer.signatureDataUrl.startsWith('data:image/') && <img src={signer.signatureDataUrl} alt={`Assinatura de ${String(signer.nome ?? 'participante')}`} className="h-12 max-w-40 rounded-lg border border-border-color bg-white object-contain p-1" />}
          </li>)}</ul> : <p className="rounded-xl bg-bg-secondary p-3 text-sm text-text-secondary">Nenhum participante cadastrado.</p>}
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Documento</h3>
          {typeof envelope.arquivoNome === 'string' && envelope.arquivoNome && <p className="mb-2 rounded-lg bg-bg-secondary p-3 text-sm">Arquivo: {envelope.arquivoNome}</p>}
          <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border-color bg-white p-4 text-sm leading-relaxed text-slate-800">{String(envelope.documentoTexto ?? 'O documento não possui texto.')}</pre>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Histórico ({events.length})</h3>
          {events.length ? <ol className="space-y-2">{events.map((event, index) => <li key={String(event.id ?? index)} className="rounded-xl bg-bg-secondary p-3"><p className="text-sm">{displayValue(event.message)}</p><p className="mt-1 text-xs text-text-secondary">{formatDateTime(event.at)}{event.actor ? ` · ${String(event.actor)}` : ''}</p></li>)}</ol> : <p className="rounded-xl bg-bg-secondary p-3 text-sm text-text-secondary">Sem eventos registrados.</p>}
        </section>
      </div>
    );
  };

  return (
    <div className="max-w-7xl space-y-4">
      <PageHeader title={definition.title} description={definition.description} actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()}>Atualizar</Button>
          {isAdmin && !definition.readOnly && <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Novo</Button>}
        </div>
      } />
      {error && !open && <div className="rounded-xl border border-erro/30 bg-erro/10 p-4 text-sm text-erro" role="alert"><div className="flex items-start gap-2"><ShieldAlert className="h-4 w-4 mt-0.5" />{error}</div></div>}
      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-color p-4"><div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" /><Input aria-label={`Buscar ${definition.title.toLowerCase()}`} placeholder="Buscar..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" /></div><Button type="button" variant="outline" size="sm" onClick={() => setShowHidden((value) => !value)}>{showHidden ? 'Exibir itens ativos' : `Exibir ocultos (${hiddenCount})`}</Button><p className="w-full text-xs text-text-secondary">Ocultar afeta somente esta lista neste navegador; o registro continua salvo.</p></div>
        {loading ? <p className="p-8 text-center text-sm text-text-secondary">Carregando…</p> : filtered.length === 0 ? <div className="p-8"><EmptyState title="Nenhum registro" description="Os registros disponíveis aparecerão aqui." /></div> : (
          <>
            <AdminAccordionList items={filtered.map((row) => {
              const payload = objectValue(row.payload);
              const signers = Array.isArray(payload.signers) ? payload.signers : [];
              const events = Array.isArray(payload.events) ? payload.events : [];
              return {
                id: row.id,
                title: resource === 'assinaturas'
                  ? displayValue(payload.titulo) === '—' ? `Documento ${row.id.slice(0, 8)}` : displayValue(payload.titulo)
                  : resource === 'contratos'
                    ? displayValue(payload.cliente_nome) === '—' ? `Contrato #${displayValue(row.numero)}` : `Contrato · ${displayValue(payload.cliente_nome)}`
                    : displayValue(row[definition.visible[0]]),
                subtitle: resource === 'assinaturas'
                  ? `${signatureStatusLabels[String(payload.status)] || 'Status indisponível'} · ${signers.length} participante(s)`
                  : resource === 'contratos'
                    ? `Nº ${displayValue(row.numero)} · ${displayValue(row.status)}`
                    : definition.visible[1] ? displayValue(row[definition.visible[1]]) : undefined,
                details: resource === 'assinaturas' ? [
                  { label: 'Signatários', value: signers.map((signer) => displayValue(objectValue(signer).nome)).join(', ') || 'Nenhum participante' },
                  { label: 'Criado em', value: formatDateTime(payload.createdAt ?? row.created_at) },
                  { label: 'Atualizado em', value: formatDateTime(payload.updatedAt ?? row.updated_at) },
                  { label: 'Atividade', value: `${events.length} evento(s) registrado(s)` },
                ] : resource === 'contratos' ? [
                  { label: 'Cliente', value: displayValue(payload.cliente_nome) },
                  { label: 'Valor', value: Number(payload.valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
                  { label: 'Pagamento', value: displayValue(payload.forma_pagamento) },
                  { label: 'Parcelamento', value: `${displayValue(payload.parcelas)}x${Number(payload.valor_parcela) > 0 ? ` de ${Number(payload.valor_parcela).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}` },
                  { label: 'Criado em', value: formatDateTime(row.created_at) },
                ] : definition.visible.slice(2).map((key) => ({
                  label: definition.fields.find((field) => field.name === key)?.label || key.replace(/_/g, ' '),
                  value: displayValue(row[key]),
                })),
                actions: <>
                {(resource !== 'empresas' || isAdmin) && <Button variant="outline" size="sm" leftIcon={<Eye className="h-4 w-4" />} aria-label={resource === 'empresas' ? 'Visualizar cadastro da empresa' : 'Visualizar registro'} onClick={() => void viewRecord(row)}>{resource === 'contratos' ? 'Visualizar contrato' : resource === 'assinaturas' ? 'Visualizar envelope' : resource === 'empresas' ? 'Visualizar cadastro' : 'Visualizar'}</Button>}
                <Button variant="ghost" size="sm" leftIcon={<EyeOff className="h-4 w-4" />} aria-label={showHidden ? 'Reexibir registro' : 'Ocultar registro'} onClick={() => toggleHidden(row.id)}>{showHidden ? 'Reexibir' : 'Ocultar'}</Button>
                {isAdmin && !definition.readOnly && <><Button variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />} aria-label={resource === 'empresas' ? 'Editar cadastro da empresa' : 'Editar registro'} onClick={() => openEdit(row)}>{resource === 'empresas' ? 'Editar cadastro' : 'Editar'}</Button><Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-4 w-4 text-erro" />} aria-label="Excluir registro" onClick={() => void remove(row)}>Excluir</Button></>}
                </>,
              };
            })} />
          </>
        )}
      </Card>
      {isAdmin && <Modal open={open} onClose={() => !saving && setOpen(false)} title={editing ? `Editar ${definition.title.toLowerCase()}` : `Novo registro · ${definition.title.toLowerCase()}`} size="xl" footer={<><Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancelar</Button><Button form="admin-resource-form" type="submit" loading={saving}>{editing ? 'Salvar alterações' : 'Criar registro'}</Button></>}>
        <form id="admin-resource-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">{error && <div className="sm:col-span-2 rounded-lg border border-erro/30 bg-erro/10 p-3 text-sm text-erro" role="alert">{error}</div>}
          {definition.fields.filter((field) => !(resource === 'contratos' && field.name === 'pdf_path')).map((field) => <div key={field.name} className={field.type === 'textarea' || field.type === 'json' ? 'sm:col-span-2' : ''}>{field.type === 'select' ? <div><label htmlFor={`admin-${field.name}`} className="mb-1.5 block text-sm font-medium">{field.label}</label><select id={`admin-${field.name}`} required={field.required} className="w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5 text-sm" value={form[field.name] || ''} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}><option value="">Selecione…</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div> : field.type === 'textarea' || field.type === 'json' ? <div><label htmlFor={`admin-${field.name}`} className="mb-1.5 block text-sm font-medium">{field.label}</label><textarea id={`admin-${field.name}`} rows={field.type === 'json' ? 10 : 3} required={field.required} spellCheck={field.type !== 'json'} className="w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5 font-mono text-sm" value={form[field.name] || ''} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} /></div> : <Input id={`admin-${field.name}`} label={field.label} type={field.type || 'text'} required={field.required} hint={field.hint} value={form[field.name] || ''} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} />}</div>)}
          {resource === 'contratos' && <div className="space-y-2 sm:col-span-2"><label htmlFor="contract-pdf-upload" className="block text-sm font-medium">PDF do contrato</label><input id="contract-pdf-upload" type="file" accept="application/pdf,.pdf" disabled={pdfBusy} onChange={(event) => { void uploadContractPdf(event.target.files?.[0]); event.target.value = ''; }} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:font-medium file:text-brand" />{pdfBusy && <p className="text-xs text-text-secondary">Enviando PDF ao armazenamento privado…</p>}{form.pdf_path && <p className="break-all text-xs text-text-secondary">Arquivo vinculado: {form.pdf_path}</p>}{contractPdfUrl && <a href={contractPdfUrl} target="_blank" rel="noreferrer" className="text-sm text-brand underline">Visualizar PDF enviado</a>}<p className="text-xs text-text-secondary">O PDF é enviado ao armazenamento privado e seu caminho fica no registro do contrato.</p></div>}
        </form>
      </Modal>}
      <Modal open={!!viewing} onClose={() => { setViewing(null); setContractPreview(null); }} title={resource === 'contratos' ? `Contrato · ${displayValue(objectValue(viewing?.payload).cliente_nome)}` : resource === 'assinaturas' ? `Envelope · ${displayValue(objectValue(viewing?.payload).titulo)}` : `Visualizar · ${definition.title.toLowerCase()}`} size="xl" footer={<Button variant="outline" onClick={() => { setViewing(null); setContractPreview(null); }}>Fechar</Button>}>
        {viewing && resource === 'contratos' && <div className="space-y-3">
          {viewLoading && <p className="py-12 text-center text-sm text-text-secondary">Preparando a visualização do contrato…</p>}
          {!viewLoading && contractPreview?.kind === 'pdf' && <iframe title="Prévia do contrato em PDF" src={contractPreview.content} className="h-[calc(100dvh-180px)] min-h-[420px] w-full rounded-xl border border-border-color bg-white" />}
          {!viewLoading && contractPreview?.kind === 'html' && <iframe title="Prévia ao vivo do contrato" srcDoc={`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:24px;background:#fff}@media(max-width:640px){body{padding:14px}}</style></head><body>${contractPreview.content}</body></html>`} sandbox="allow-same-origin" className="h-[calc(100dvh-180px)] min-h-[420px] w-full rounded-xl border border-border-color bg-white" />}
          {!viewLoading && !contractPreview && <p className="py-12 text-center text-sm text-text-secondary">Não foi possível preparar o documento.</p>}
        </div>}
        {viewing && resource === 'assinaturas' && renderSignatureDetails(viewing)}
        {viewing && resource !== 'contratos' && resource !== 'assinaturas' && <dl className="grid gap-3 sm:grid-cols-2">{[...new Set(['id', ...definition.visible, ...Object.keys(viewing).filter((key) => key !== 'id' && key !== 'payload')])].map((key) => <div key={key} className="min-w-0 rounded-lg bg-bg-secondary p-3"><dt className="text-xs font-medium uppercase text-text-secondary">{definition.fields.find((field) => field.name === key)?.label || key.replace(/_/g, ' ')}</dt><dd className="mt-1 break-all text-sm text-text-primary">{displayValue(viewing[key])}</dd></div>)}</dl>}
      </Modal>
    </div>
  );
}
