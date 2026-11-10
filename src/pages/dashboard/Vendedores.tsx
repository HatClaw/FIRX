import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Download, Eye, EyeOff, ImagePlus, Mail, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { Button, Card, EmptyState, Input, Modal, PageHeader } from '@/components/ui';
import { AdminAccordionList } from '@/components/admin/AdminAccordionList';
import { useAdminHiddenRecords } from '@/hooks/useAdminHiddenRecords';
import { exportCsv, formatBRL } from '@/lib/export';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { criarLinkArquivo, excluirArquivo, uploadArquivo } from '@/services/file-storage';
import { cpfValido, formatarCpf, somenteDigitos } from '@/lib/vendedor-validation';

type Vendedor = { id: string; nome: string; email: string; meta_mensal: number | null; status: 'ativo' | 'inativo' | 'suspenso'; identificador_interno: string; foto_path: string | null; foto_url?: string; cpf?: string | null; data_nascimento?: string | null; cep?: string | null; logradouro?: string | null; numero?: string | null; complemento?: string | null; bairro?: string | null; cidade?: string | null; uf?: string | null };
const emptyForm = { nome: '', email: '', meta: '', cpf: '', dataNascimento: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' };

export default function Vendedores() {
  const { user, empresaAtiva, hasPermission } = useAuth();
  const { isAdmin } = useAdminAuth();
  const canManage = isAdmin || empresaAtiva?.role === 'admin';
  const [rows, setRows] = useState<Vendedor[]>([]);
  const [busca, setBusca] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cpfStatus, setCpfStatus] = useState('');
  const [cepStatus, setCepStatus] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState('');
  const [editing, setEditing] = useState<Vendedor | null>(null);
  const [viewing, setViewing] = useState<Vendedor | null>(null);
  const { hiddenIds, hiddenCount, showHidden, setShowHidden, toggleHidden } = useAdminHiddenRecords('vendedores-operacional');
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!foto) { setFotoPreview(''); return; }
    const preview = URL.createObjectURL(foto);
    setFotoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [foto]);

  useEffect(() => {
    const cep = somenteDigitos(form.cep);
    if (cep.length !== 8) { setCepStatus(''); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCepStatus('Buscando endereço…');
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Não foi possível consultar o CEP.');
        const data = await response.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
        if (data.erro) throw new Error('CEP não encontrado.');
        if (controller.signal.aborted) return;
        setForm((current) => ({ ...current, logradouro: data.logradouro || current.logradouro, bairro: data.bairro || current.bairro, cidade: data.localidade || current.cidade, uf: data.uf || current.uf }));
        setCepStatus('Endereço localizado. Confira os dados.');
      } catch (lookupError) {
        if (!controller.signal.aborted) setCepStatus(lookupError instanceof Error ? lookupError.message : 'Falha ao consultar CEP.');
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [form.cep]);

  const load = useCallback(async () => {
    if (!empresaAtiva?.id) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error: loadError } = await supabase.from('vendedores')
      .select('id, nome, email, meta_mensal, status, identificador_interno, foto_path, cpf, data_nascimento, cep, logradouro, numero, complemento, bairro, cidade, uf')
      .eq('empresa_id', empresaAtiva.id).order('nome', { ascending: true });
    if (loadError) setError(`Não foi possível carregar vendedores: ${loadError.message}`);
    else {
      const withPhotos = await Promise.all(((data || []) as Vendedor[]).map(async (row) => ({
        ...row,
        foto_url: row.foto_path ? await criarLinkArquivo(row.foto_path).catch(() => '') : '',
      })));
      setRows(withPhotos); setError('');
    }
    setLoading(false);
  }, [empresaAtiva?.id]);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => rows.filter((row) => (showHidden ? hiddenIds.has(row.id) : !hiddenIds.has(row.id)) && `${row.nome} ${row.email}`.toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR'))), [rows, busca, showHidden, hiddenIds]);

  const salvar = async () => {
    if (!empresaAtiva?.id || !user?.id) { setError('Selecione uma empresa para cadastrar vendedores.'); return; }
    if (!form.nome.trim() || (!editing && !form.email.trim())) { setError('Informe nome e e-mail do vendedor.'); return; }
    if (form.cpf && !cpfValido(form.cpf)) { setCpfStatus('CPF inválido. Confira os números digitados.'); setError('Corrija o CPF antes de continuar.'); return; }
    if (foto && (!foto.type.match(/^image\/(jpeg|png|webp)$/) || foto.size > 5 * 1024 * 1024)) { setError('A foto deve ser JPG, PNG ou WebP e ter até 5 MB.'); return; }
    setSaving(true); setError(''); setNotice('');
    let fotoPath: string | undefined;
    try {
      if (foto) fotoPath = (await uploadArquivo(foto, 'fotos')).caminho;
    } catch (uploadError) {
      setSaving(false); setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível enviar a foto.'); return;
    }
    if (editing) {
      const { data, error: updateError } = await supabase.functions.invoke('admin-users', { body: {
        action: 'update', empresaId: empresaAtiva.id, vendedorId: editing.id,
        nome: form.nome.trim(), email: form.email.trim().toLowerCase(), metaMensal: Number(form.meta) || 0,
        cpf: somenteDigitos(form.cpf), dataNascimento: form.dataNascimento,
        cep: form.cep, logradouro: form.logradouro, numero: form.numero,
        complemento: form.complemento, bairro: form.bairro, cidade: form.cidade, uf: form.uf,
        fotoPath: fotoPath ?? editing.foto_path,
      } });
      setSaving(false);
      if (updateError) {
        if (fotoPath) await excluirArquivo(fotoPath).catch(() => undefined);
        const context = (updateError as Error & { context?: unknown }).context;
        const payload = context instanceof Response ? await context.clone().json().catch(() => null) as { error?: unknown } | null : null;
        setError(typeof payload?.error === 'string' ? payload.error : `Não foi possível atualizar o vendedor: ${updateError.message}`); return;
      }
      if (fotoPath && editing.foto_path && fotoPath !== editing.foto_path) await excluirArquivo(editing.foto_path).catch(() => undefined);
      setOpen(false); setEditing(null); setForm(emptyForm); setFoto(null); setCpfStatus(''); setCepStatus(''); await load();
      if (data?.email !== editing.email) setNotice('Dados atualizados. O novo e-mail já é o login do vendedor; reenvie a ativação se a conta ainda estiver pendente.');
      return;
    }
    const { data, error: saveError } = await supabase.functions.invoke('admin-users', {
      body: {
        action: 'create', empresaId: empresaAtiva.id,
        nome: form.nome.trim(), email: form.email.trim().toLowerCase(),
        metaMensal: Number(form.meta) || 0,
        cpf: somenteDigitos(form.cpf), dataNascimento: form.dataNascimento,
        cep: form.cep, logradouro: form.logradouro, numero: form.numero,
        complemento: form.complemento, bairro: form.bairro, cidade: form.cidade, uf: form.uf,
        fotoPath,
      },
    });
    setSaving(false);
    if (saveError) {
      if (fotoPath) await excluirArquivo(fotoPath).catch(() => undefined);
      const context = (saveError as Error & { context?: unknown }).context;
      const payload = context instanceof Response
        ? await context.clone().json().catch(() => null) as { error?: unknown } | null
        : null;
      setError(typeof payload?.error === 'string' ? payload.error : `Não foi possível salvar o vendedor: ${saveError.message}`);
      return;
    }
    setOpen(false); setForm(emptyForm); setFoto(null); setCpfStatus(''); setCepStatus(''); await load();
    if (data?.emailSent === false) setError(data.message || 'O vendedor foi cadastrado, mas o e-mail de ativação não foi enviado.');
  };
  const excluir = async (row: Vendedor) => {
    if (!empresaAtiva?.id || !confirm(`Excluir ${row.nome} da equipe?`)) return;
    const { error: deleteError } = await supabase.from('vendedores').delete().eq('id', row.id).eq('empresa_id', empresaAtiva.id);
    if (deleteError) setError(`Não foi possível excluir o vendedor: ${deleteError.message}`);
    else await load();
  };
  const reenviarAtivacao = async (row: Vendedor) => {
    if (!empresaAtiva?.id || row.status !== 'inativo') return;
    setSaving(true); setError(''); setNotice('');
    const { data, error: resendError } = await supabase.functions.invoke('admin-users', { body: { action: 'resend_activation', empresaId: empresaAtiva.id, vendedorId: row.id } });
    setSaving(false);
    if (resendError) {
      const context = (resendError as Error & { context?: unknown }).context;
      const payload = context instanceof Response ? await context.clone().json().catch(() => null) as { error?: unknown } | null : null;
      setError(typeof payload?.error === 'string' ? payload.error : `Não foi possível reenviar o convite: ${resendError.message}`); return;
    }
    setNotice(data?.message || `Link de ativação enviado para ${row.email}.`);
  };
  const fecharModal = () => {
    if (saving) return;
    setOpen(false); setEditing(null); setFoto(null); setForm(emptyForm); setError(''); setCpfStatus(''); setCepStatus('');
  };
  const editar = (row: Vendedor) => { setEditing(row); setFoto(null); setForm({ ...emptyForm, nome: row.nome, email: row.email, meta: String(row.meta_mensal || 0), cpf: row.cpf || '', dataNascimento: row.data_nascimento || '', cep: row.cep || '', logradouro: row.logradouro || '', numero: row.numero || '', complemento: row.complemento || '', bairro: row.bairro || '', cidade: row.cidade || '', uf: row.uf || '' }); setError(''); setOpen(true); };

  return <div className="max-w-7xl space-y-4">
    <PageHeader title="Vendedores" description="Equipe comercial e metas" actions={<>
      <Button variant="outline" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={() => exportCsv('vendedores', filtered.map((r) => ({ Nome: r.nome, Email: r.email, Meta: r.meta_mensal || 0 })))}>CSV</Button>
      {canManage && hasPermission('vendedores:write') && <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setForm(emptyForm); setError(''); setOpen(true); }}>Novo</Button>}
    </>} />
    {error && !open && <p className="rounded-lg border border-erro/30 bg-erro/10 p-3 text-sm text-erro" role="alert">{error}</p>}
    {notice && !open && <p className="rounded-lg border border-brand/30 bg-brand/10 p-3 text-sm text-text-primary" role="status">{notice}</p>}
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-color p-4"><div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" /><Input placeholder="Buscar vendedor..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-10" /></div><Button type="button" variant="outline" size="sm" onClick={() => setShowHidden((value) => !value)}>{showHidden ? 'Exibir ativos' : `Exibir ocultos (${hiddenCount})`}</Button></div>
      {loading ? <p className="p-8 text-center text-sm text-text-secondary">Carregando equipe…</p> : filtered.length === 0 ? <div className="p-8"><EmptyState title="Nenhum vendedor" description="Adicione sua equipe comercial." icon={<Users className="h-6 w-6" />} /></div> :
        <AdminAccordionList items={filtered.map((row) => ({ id: row.id, title: row.nome, subtitle: row.email, details: [{ label: 'Meta mensal', value: formatBRL(row.meta_mensal || 0) }, { label: 'Status', value: row.status === 'inativo' ? 'Aguardando ativação' : row.status }, { label: 'CPF', value: row.cpf || '—' }, { label: 'Endereço', value: [row.logradouro, row.numero, row.bairro, row.cidade, row.uf].filter(Boolean).join(', ') || '—' }, { label: 'Identificador interno', value: row.identificador_interno }, { label: 'Foto', value: row.foto_path ? 'Cadastrada' : 'Não cadastrada' }], actions: <><Button variant="outline" size="sm" leftIcon={<Eye className="h-4 w-4" />} onClick={() => setViewing(row)}>Visualizar</Button><Button variant="ghost" size="sm" leftIcon={<EyeOff className="h-4 w-4" />} onClick={() => toggleHidden(row.id)}>{showHidden ? 'Reexibir' : 'Ocultar'}</Button>{canManage && hasPermission('vendedores:write') && <><Button variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => editar(row)}>Editar</Button>{row.status === 'inativo' && <Button variant="outline" size="sm" disabled={saving} leftIcon={<Mail className="h-4 w-4" />} onClick={() => void reenviarAtivacao(row)}>Reenviar ativação</Button>}<Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-4 w-4 text-erro" />} onClick={() => void excluir(row)}>Excluir</Button></>}</> }))} />}
    </Card>
    {canManage && hasPermission('vendedores:write') && <Modal open={open} onClose={fecharModal} title={editing ? 'Editar vendedor' : 'Novo vendedor'} size="xl" footer={<><Button variant="outline" disabled={saving} onClick={fecharModal}>Cancelar</Button><Button loading={saving} onClick={() => void salvar()}>{editing ? 'Salvar alterações' : 'Salvar vendedor'}</Button></>}>
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-border-color bg-bg-secondary">{fotoPreview ? <img src={fotoPreview} alt="Prévia da foto do vendedor" className="h-full w-full object-cover" /> : editing?.foto_url ? <img src={editing.foto_url} alt={`Foto de ${editing.nome}`} className="h-full w-full object-cover" /> : <Users className="h-9 w-9 text-text-secondary" />}</div>
          <div className="space-y-2"><p className="font-medium">Foto do vendedor</p><p className="text-sm text-text-secondary">JPG, PNG ou WebP, até 5 MB.</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" leftIcon={<Camera className="h-4 w-4" />} onClick={() => cameraRef.current?.click()}>Fotografar</Button><Button type="button" variant="outline" size="sm" leftIcon={<ImagePlus className="h-4 w-4" />} onClick={() => uploadRef.current?.click()}>Enviar foto</Button></div><input ref={cameraRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={(e) => setFoto(e.target.files?.[0] || null)} /><input ref={uploadRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFoto(e.target.files?.[0] || null)} /></div>
        </section>
        <section className="space-y-3"><h3 className="font-semibold">{editing ? 'Dados do vendedor' : 'Dados pessoais'}</h3><div className="grid gap-4 sm:grid-cols-2"><Input label="Nome completo" autoComplete="name" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /><Input label="E-mail de acesso" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /><Input label="CPF" inputMode="numeric" autoComplete="off" value={form.cpf} onChange={(e) => { const cpf = formatarCpf(e.target.value); setForm({ ...form, cpf }); setCpfStatus(cpf.replace(/\D/g, '').length === 11 ? (cpfValido(cpf) ? 'CPF válido.' : 'CPF inválido.') : ''); }} onBlur={() => form.cpf && setCpfStatus(cpfValido(form.cpf) ? 'CPF válido.' : 'CPF inválido.')} hint="Validação dos dígitos verificadores. O CPF não revela nome ou nascimento." />{cpfStatus && <p className={`text-sm ${cpfStatus.includes('inválido') ? 'text-erro' : 'text-text-secondary'}`} role="status">{cpfStatus}</p>}<Input label="Data de nascimento" type="date" autoComplete="bday" value={form.dataNascimento} onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })} /><Input label="Meta mensal (R$)" type="number" min="0" step="0.01" value={form.meta} onChange={(e) => setForm({ ...form, meta: e.target.value })} /></div>{editing && <p className="text-sm text-text-secondary">Alterar o e-mail também altera o login do vendedor. Para contas aguardando ativação, você poderá reenviar o link após salvar.</p>}{!editing && <p className="text-sm text-text-secondary">O vendedor receberá um link de ativação por e-mail e definirá a própria senha ao abrir o convite.</p>}</section>
        <section className="space-y-3"><h3 className="font-semibold">Endereço</h3><div className="grid gap-4 sm:grid-cols-2"><Input label="CEP" inputMode="numeric" autoComplete="postal-code" maxLength={9} value={form.cep} onChange={(e) => setForm({ ...form, cep: somenteDigitos(e.target.value).slice(0, 8) })} hint="Ao informar os 8 dígitos, consultamos o endereço automaticamente." /><Input label="Logradouro" autoComplete="street-address" value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} /><Input label="Número" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /><Input label="Complemento" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} /><Input label="Bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} /><Input label="Cidade" autoComplete="address-level2" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /><Input label="UF" autoComplete="address-level1" maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase().slice(0, 2) })} />{cepStatus && <p className="text-sm text-text-secondary sm:col-span-2" role="status">{cepStatus}</p>}</div></section>
        {error && <p className="text-sm text-erro" role="alert">{error}</p>}
      </div>
    </Modal>}
    <Modal open={!!viewing} onClose={() => setViewing(null)} title="Visualizar vendedor" footer={<Button variant="outline" onClick={() => setViewing(null)}>Fechar</Button>}>{viewing && <dl className="grid gap-3 sm:grid-cols-2">{[['Nome', viewing.nome], ['E-mail', viewing.email], ['CPF', viewing.cpf || '—'], ['Nascimento', viewing.data_nascimento ? new Date(`${viewing.data_nascimento}T00:00:00`).toLocaleDateString('pt-BR') : '—'], ['Meta mensal', formatBRL(viewing.meta_mensal || 0)], ['Status', viewing.status === 'inativo' ? 'Aguardando ativação' : viewing.status], ['CEP', viewing.cep || '—'], ['Endereço', [viewing.logradouro, viewing.numero, viewing.complemento, viewing.bairro, viewing.cidade, viewing.uf].filter(Boolean).join(', ') || '—'], ['Identificador', viewing.identificador_interno]].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-bg-secondary p-3"><dt className="text-xs font-medium uppercase text-text-secondary">{label}</dt><dd className="mt-1 break-all text-sm text-text-primary">{value}</dd></div>)}{viewing.foto_url && <img src={viewing.foto_url} alt={`Foto de ${viewing.nome}`} className="h-24 w-24 rounded-full object-cover" />}</dl>}</Modal>
  </div>;
}
