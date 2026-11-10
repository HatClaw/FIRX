import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Download, FileText, Pencil, Trash2, Users, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Button, Input, Card, EmptyState, Modal, PageHeader } from '@/components/ui';
import { AdminAccordionList } from '@/components/admin/AdminAccordionList';
import { useAdminHiddenRecords } from '@/hooks/useAdminHiddenRecords';
import { exportCsv, exportPdf } from '@/lib/export';
import { ClientService } from '@/services/client-service';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import type { Cliente, ClientStatus, ClientType, CreateClienteData } from '@/lib/client-types';

type FormState = {
  nome: string;
  razao_social: string;
  documento: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  tipo: ClientType | '';
  status: ClientStatus;
};

type ClienteLookupFields = Pick<FormState,
  'nome' | 'razao_social' | 'email' | 'telefone' | 'cep' |
  'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'estado'
>;

const emptyForm: FormState = {
  nome: '', razao_social: '', documento: '', email: '', telefone: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  tipo: '', status: 'ativo',
};

const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 8);
const cnpjDigitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 14);
const formatCep = (value: string) => {
  const digits = digitsOnly(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char] || char));

type BrasilApiCliente = {
  razao_social?: string;
  nome_fantasia?: string;
  email?: string;
  ddd_telefone_1?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
};

export default function Clientes() {
  const { user, empresaAtiva } = useAuth();
  const { isAdmin: isPlatformAdmin } = useAdminAuth();
  const canManage = isPlatformAdmin || empresaAtiva?.role === 'admin';
  const [rows, setRows] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [cepStatus, setCepStatus] = useState('');
  const [cnpjStatus, setCnpjStatus] = useState('');
  const cnpjLookupValues = useRef<Partial<FormState>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [viewing, setViewing] = useState<Cliente | null>(null);
  const { hiddenIds, hiddenCount, showHidden, setShowHidden, toggleHidden } = useAdminHiddenRecords('clientes-operacional');

  useEffect(() => {
    const cep = digitsOnly(form.cep);
    if (cep.length !== 8) { setCepStatus(''); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCepStatus('Buscando endereço…');
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error('Não foi possível consultar o CEP.');
        const address = await response.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
        if (address.erro) throw new Error('CEP não encontrado. Confira os números digitados.');
        if (controller.signal.aborted) return;
        setForm((current) => ({
          ...current,
          logradouro: address.logradouro || current.logradouro,
          bairro: address.bairro || current.bairro,
          cidade: address.localidade || current.cidade,
          estado: address.uf || current.estado,
        }));
        setCepStatus('Endereço localizado. Confira e complete o número.');
      } catch (cause) {
        if (!controller.signal.aborted) setCepStatus(cause instanceof Error ? cause.message : 'Falha ao consultar o CEP.');
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [form.cep]);

  useEffect(() => {
    const cnpj = cnpjDigitsOnly(form.documento);
    if (!['pessoa_juridica', 'pj'].includes(form.tipo) || cnpj.length !== 14) {
      setCnpjStatus('');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCnpjStatus('Consultando CNPJ na BrasilAPI…');
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'CNPJ não encontrado. Confira os números digitados.' : 'Não foi possível consultar este CNPJ.');
        }
        const data = await response.json() as BrasilApiCliente;
        if (controller.signal.aborted) return;

        const cep = cnpjDigitsOnly(data.cep || '').slice(0, 8);
        const preenchidos: Partial<ClienteLookupFields> = {
          nome: data.nome_fantasia || data.razao_social || '',
          razao_social: data.razao_social || '',
          email: data.email || '',
          telefone: data.ddd_telefone_1 || '',
          cep: cep ? formatCep(cep) : '',
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          cidade: data.municipio || '',
          estado: data.uf || '',
        };
        setForm((current) => {
          const merged = { ...current };
          (Object.keys(preenchidos) as Array<keyof typeof preenchidos>).forEach((key) => {
            const currentValue = current[key] || '';
            const previousLookupValue = cnpjLookupValues.current[key];
            if (!currentValue.trim() || currentValue === previousLookupValue) {
              merged[key] = preenchidos[key] || '';
            }
          });
          return merged;
        });
        cnpjLookupValues.current = preenchidos;
        setCnpjStatus('Dados do CNPJ encontrados. Confira e complete as informações.');
      } catch (cause) {
        if (!controller.signal.aborted) {
          setCnpjStatus(cause instanceof Error ? cause.message : 'Falha ao consultar CNPJ.');
        }
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [form.documento, form.tipo]);

  const role = empresaAtiva?.role || user?.role || '';
  const loadClients = useCallback(async () => {
    if (!empresaAtiva?.id || !role) return;
    setLoading(true);
    setError('');
    try {
      const result = await ClientService.findMany({ empresa_id: empresaAtiva.id, busca, limit: 100, order_by: 'nome', order_dir: 'asc' }, role);
      setRows(result.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }, [empresaAtiva?.id, role, busca]);

  useEffect(() => { void loadClients(); }, [loadClients, reload]);

  const abrirNovo = () => {
    setEditing(null);
    setForm(emptyForm);
    setCepStatus('');
    setCnpjStatus('');
    cnpjLookupValues.current = {};
    setError('');
    setOpen(true);
  };

  const abrirEdicao = (cliente: Cliente) => {
    setEditing(cliente);
    setForm({
      nome: cliente.nome,
      razao_social: cliente.razao_social || '',
      documento: cliente.documento,
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      cep: formatCep(cliente.cep || cliente.endereco?.cep || ''),
      logradouro: cliente.endereco?.logradouro || '',
      numero: cliente.endereco?.numero || '',
      complemento: cliente.endereco?.complemento || '',
      bairro: cliente.endereco?.bairro || '',
      cidade: cliente.endereco?.cidade || '',
      estado: cliente.endereco?.estado || '',
      tipo: cliente.tipo === 'pf' ? 'pessoa_fisica' : cliente.tipo === 'pj' ? 'pessoa_juridica' : cliente.tipo,
      status: cliente.status,
    });
    setCepStatus('');
    setCnpjStatus('');
    cnpjLookupValues.current = {};
    setError('');
    setOpen(true);
  };

  const alterarTipoDocumento = (tipo: ClientType) => {
    setForm((current) => {
      const next = { ...current, tipo, documento: '' };
      (Object.keys(cnpjLookupValues.current) as Array<keyof ClienteLookupFields>).forEach((key) => {
        if (cnpjLookupValues.current[key] && current[key] === cnpjLookupValues.current[key]) next[key] = '';
      });
      return next;
    });
    cnpjLookupValues.current = {};
    setCnpjStatus('');
  };

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id || !empresaAtiva?.id || !role) return;
    if (!form.tipo) {
      setError('Selecione CPF ou CNPJ antes de preencher os dados do cliente.');
      return;
    }
    const cepDigits = digitsOnly(form.cep);
    if (cepDigits.length > 0 && cepDigits.length !== 8) {
      setError('O CEP deve conter 8 números.');
      return;
    }
    setSaving(true);
    setError('');
    const data = {
      nome: form.nome.trim(),
      razao_social: form.razao_social.trim() || undefined,
      documento: form.documento.trim(),
      email: form.email.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
      cep: digitsOnly(form.cep) ? formatCep(form.cep) : undefined,
      endereco: {
        logradouro: form.logradouro.trim() || undefined,
        numero: form.numero.trim() || undefined,
        complemento: form.complemento.trim() || undefined,
        bairro: form.bairro.trim() || undefined,
        cidade: form.cidade.trim() || undefined,
        estado: form.estado.trim() || undefined,
        cep: digitsOnly(form.cep) ? formatCep(form.cep) : undefined,
        pais: 'Brasil',
      },
      tipo: form.tipo,
      status: form.status,
    };
    try {
      if (editing) {
        await ClientService.update(editing.id, empresaAtiva.id, data, user.id, role);
      } else {
        await ClientService.create({ ...data, empresa_id: empresaAtiva.id } satisfies CreateClienteData, user.id, role);
      }
      setOpen(false);
      setReload((value) => value + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar cliente');
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (cliente: Cliente) => {
    if (!user?.id || !empresaAtiva?.id || !role || !window.confirm(`Excluir ${cliente.nome}?`)) return;
    setError('');
    try {
      await ClientService.delete(cliente.id, empresaAtiva.id, role);
      setReload((value) => value + 1);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Falha ao excluir cliente');
    }
  };

  const filtered = useMemo(() => rows.filter((row) => showHidden ? hiddenIds.has(row.id) : !hiddenIds.has(row.id)), [rows, showHidden, hiddenIds]);
  const tipoLabel = (tipo: ClientType) => tipo === 'pessoa_fisica' || tipo === 'pf' ? 'Pessoa física' : 'Pessoa jurídica';

  return (
    <div className="max-w-7xl space-y-4">
      <PageHeader title="Clientes" description="Base comercial e contatos" actions={
        <>
          <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={() => exportCsv('clientes', filtered.map((r) => ({ Nome: r.nome, Documento: r.documento, Email: r.email || '', Tipo: tipoLabel(r.tipo), Status: r.status })))}>CSV</Button>
          <Button variant="outline" size="sm" leftIcon={<FileText className="w-4 h-4" />} onClick={() => exportPdf('Clientes', `<table><thead><tr><th>Nome</th><th>Documento</th><th>E-mail</th><th>Tipo</th></tr></thead><tbody>${filtered.map((r) => `<tr><td>${escapeHtml(r.nome)}</td><td>${escapeHtml(r.documento)}</td><td>${escapeHtml(r.email || '')}</td><td>${tipoLabel(r.tipo)}</td></tr>`).join('')}</tbody></table>`)}>PDF</Button>
          <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={abrirNovo}>Novo</Button>
        </>
      } />
      {error && !open && <div role="alert" className="rounded-lg border border-erro/30 bg-erro/10 px-4 py-3 text-sm text-erro">{error}</div>}
      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border-color">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <Input aria-label="Buscar cliente" placeholder="Buscar cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-10" />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowHidden((value) => !value)}>{showHidden ? 'Exibir ativos' : `Exibir ocultos (${hiddenCount})`}</Button>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-text-secondary">Carregando clientes…</div> : filtered.length === 0 ? (
          <div className="p-8"><EmptyState title="Nenhum cliente" description="Cadastre seu primeiro cliente." icon={<Users className="w-6 h-6" />} /></div>
        ) : (
          <AdminAccordionList items={filtered.map((r) => ({
            id: r.id, title: r.nome, subtitle: r.documento,
            details: [
              { label: 'E-mail', value: r.email }, { label: 'Telefone', value: r.telefone },
              { label: 'Tipo', value: tipoLabel(r.tipo) }, { label: 'Status', value: r.status },
              { label: 'Razão social', value: r.razao_social },
              { label: 'Endereço', value: [r.endereco?.logradouro, r.endereco?.numero, r.endereco?.complemento, r.endereco?.bairro, r.endereco?.cidade, r.endereco?.estado, r.cep || r.endereco?.cep].filter(Boolean).join(', ') || '—' },
            ],
            actions: <>
              <Button variant="outline" size="sm" leftIcon={<Eye className="h-4 w-4" />} onClick={() => setViewing(r)}>Visualizar</Button>
              <Button variant="ghost" size="sm" leftIcon={<EyeOff className="h-4 w-4" />} onClick={() => toggleHidden(r.id)}>{showHidden ? 'Reexibir' : 'Ocultar'}</Button>
              {canManage && <><Button variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => abrirEdicao(r)}>Editar</Button><Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-4 w-4 text-erro" />} onClick={() => void excluir(r)}>Excluir</Button></>}
            </>,
          }))} />
        )}
      </Card>
      {(canManage || (!editing && open)) && <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar cliente' : 'Novo cliente'} size="lg" footer={<><Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancelar</Button><Button form="cliente-form" type="submit" loading={saving}>{editing ? 'Salvar alterações' : 'Salvar'}</Button></>}>
        <form id="cliente-form" onSubmit={salvar} className="grid sm:grid-cols-2 gap-4">
          {error && <div role="alert" className="sm:col-span-2 rounded-lg border border-erro/30 bg-erro/10 px-4 py-3 text-sm text-erro">{error}</div>}
          <div className="sm:col-span-2">
            <label htmlFor="cliente-tipo" className="mb-1.5 block text-sm font-medium">Primeiro, escolha o documento</label>
            <select id="cliente-tipo" required className="w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5 text-sm" value={form.tipo} onChange={(e) => alterarTipoDocumento(e.target.value as ClientType)}>
              <option value="" disabled>Selecione CPF ou CNPJ</option>
              <option value="pessoa_fisica">CPF · Pessoa física</option>
              <option value="pessoa_juridica">CNPJ · Pessoa jurídica</option>
            </select>
          </div>
          {form.tipo && <>
          <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          <Input label="Razão social" value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
          <div>
            <Input label={form.tipo === 'pessoa_fisica' || form.tipo === 'pf' ? 'CPF' : 'CNPJ'} value={form.documento} onChange={(e) => setForm((current) => ({ ...current, documento: e.target.value }))} required maxLength={form.tipo === 'pessoa_fisica' || form.tipo === 'pf' ? 14 : 18} inputMode="numeric" aria-describedby="cliente-cnpj-status" hint={form.tipo === 'pessoa_juridica' || form.tipo === 'pj' ? 'Ao informar os 14 números do CNPJ, consultaremos os dados automaticamente.' : undefined} rightIcon={cnpjStatus.startsWith('Consultando') ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : undefined} />
            {cnpjStatus && <p id="cliente-cnpj-status" role="status" className={`mt-1 text-xs ${/não foi|não encontrado|falha/i.test(cnpjStatus) ? 'text-erro' : cnpjStatus.startsWith('Dados') ? 'text-brand' : 'text-text-secondary'}`}>{cnpjStatus}</p>}
          </div>
          <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Telefone" type="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          <div className="sm:col-span-2 rounded-xl border border-border-color p-4">
            <h3 className="mb-3 text-sm font-semibold">Endereço do cliente</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Input label="CEP" inputMode="numeric" autoComplete="postal-code" maxLength={9} placeholder="00000-000" value={form.cep} onChange={(event) => {
                  const cep = formatCep(event.target.value);
                  setForm((current) => ({ ...current, cep }));
                }} aria-describedby="cliente-cep-status" />
                {cepStatus && <p id="cliente-cep-status" role="status" className={`mt-1 text-xs ${/não foi|não encontrado|falha/i.test(cepStatus) ? 'text-erro' : 'text-text-secondary'}`}>{cepStatus}</p>}
              </div>
              <Input label="Logradouro" autoComplete="address-line1" value={form.logradouro} onChange={(event) => setForm({ ...form, logradouro: event.target.value })} />
              <Input label="Número" value={form.numero} onChange={(event) => setForm({ ...form, numero: event.target.value })} />
              <Input label="Complemento" autoComplete="address-line2" value={form.complemento} onChange={(event) => setForm({ ...form, complemento: event.target.value })} />
              <Input label="Bairro" autoComplete="address-level3" value={form.bairro} onChange={(event) => setForm({ ...form, bairro: event.target.value })} />
              <Input label="Cidade" autoComplete="address-level2" value={form.cidade} onChange={(event) => setForm({ ...form, cidade: event.target.value })} />
              <Input label="UF" autoComplete="address-level1" maxLength={2} value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value.toUpperCase() })} />
            </div>
          </div>
          <div>
            <label htmlFor="cliente-status" className="text-sm font-medium block mb-1.5">Status</label>
            <select id="cliente-status" className="w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ClientStatus })}>
              <option value="ativo">Ativo</option><option value="inativo">Inativo</option><option value="suspenso">Suspenso</option><option value="prospecto">Prospecto</option><option value="arquivado">Arquivado</option>
            </select>
          </div>
          </>}
        </form>
      </Modal>}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Visualizar cliente" footer={<Button variant="outline" onClick={() => setViewing(null)}>Fechar</Button>}>
        {viewing && <dl className="grid gap-3 sm:grid-cols-2">{[['Nome', viewing.nome], ['Razão social', viewing.razao_social], ['CPF/CNPJ', viewing.documento], ['E-mail', viewing.email], ['Telefone', viewing.telefone], ['Tipo', tipoLabel(viewing.tipo)], ['Status', viewing.status], ['Endereço', [viewing.endereco?.logradouro, viewing.endereco?.numero, viewing.endereco?.complemento, viewing.endereco?.bairro, viewing.endereco?.cidade, viewing.endereco?.estado, viewing.cep || viewing.endereco?.cep].filter(Boolean).join(', ') || '—']].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-bg-secondary p-3"><dt className="text-xs font-medium uppercase text-text-secondary">{label}</dt><dd className="mt-1 break-all text-sm text-text-primary">{value || '—'}</dd></div>)}</dl>}
      </Modal>
    </div>
  );
}
