import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, FolderOpen, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Button, Card, EmptyState, Input, Modal, PageHeader } from '@/components/ui';
import { AdminFileService, ADMIN_FILE_MAX_BYTES, type AdminFile } from '@/services/admin-file-service';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { AdminAccordionList } from '@/components/admin/AdminAccordionList';
import { useAdminHiddenRecords } from '@/hooks/useAdminHiddenRecords';

const formatSize = (size: number) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;

export default function AdminArquivos() {
  const { isAdmin } = useAdminAuth();
  const [rows, setRows] = useState<AdminFile[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminFile | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [categoria, setCategoria] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const { hiddenIds, hiddenCount, showHidden, setShowHidden, toggleHidden } = useAdminHiddenRecords('arquivos');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await AdminFileService.list()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao listar arquivos.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => (showHidden ? hiddenIds.has(row.id) : !hiddenIds.has(row.id))
      && (!term || `${row.original_name} ${row.categoria} ${row.content_type}`.toLowerCase().includes(term)));
  }, [rows, search, showHidden, hiddenIds]);

  const create = () => { setEditing(null); setFile(null); setCategoria(''); setNome(''); setError(''); setOpen(true); };
  const edit = (row: AdminFile) => { setEditing(row); setFile(null); setCategoria(row.categoria); setNome(row.original_name); setError(''); setOpen(true); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      if (editing) await AdminFileService.update(editing.id, { categoria, original_name: nome });
      else if (file) await AdminFileService.upload(file, categoria);
      else throw new Error('Selecione um arquivo para enviar.');
      setOpen(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao salvar arquivo.'); }
    finally { setSaving(false); }
  };
  const download = async (row: AdminFile) => {
    setBusyId(row.id); setError('');
    try { window.open(await AdminFileService.getDownloadUrl(row), '_blank', 'noopener,noreferrer'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao abrir arquivo.'); }
    finally { setBusyId(''); }
  };
  const remove = async (row: AdminFile) => {
    if (!window.confirm(`Excluir “${row.original_name}” do armazenamento e remover seu cadastro? Esta ação não pode ser desfeita.`)) return;
    setBusyId(row.id); setError('');
    try { await AdminFileService.delete(row); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao excluir arquivo.'); }
    finally { setBusyId(''); }
  };

  return (
    <div className="max-w-7xl space-y-4">
      <PageHeader title="Arquivos" description="Arquivos privados enviados à plataforma" actions={<div className="flex gap-2"><Button size="sm" variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()}>Atualizar</Button>{isAdmin && <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={create}>Enviar arquivo</Button>}</div>} />
      {error && !open && <div className="rounded-xl border border-erro/30 bg-erro/10 p-4 text-sm text-erro" role="alert">{error}</div>}
      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-color p-4"><div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" /><Input aria-label="Buscar arquivos" placeholder="Buscar arquivo ou categoria..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" /></div><Button type="button" variant="outline" size="sm" onClick={() => setShowHidden((value) => !value)}>{showHidden ? 'Exibir itens ativos' : `Exibir ocultos (${hiddenCount})`}</Button><p className="w-full text-xs text-text-secondary">Ocultar afeta somente esta lista neste navegador; o arquivo permanece armazenado.</p></div>
        {loading ? <p className="p-8 text-center text-sm text-text-secondary">Carregando arquivos…</p> : filtered.length === 0 ? <div className="p-8"><EmptyState title="Nenhum arquivo" description="Arquivos enviados aparecerão aqui." icon={<FolderOpen className="h-6 w-6" />} /></div> : (
          <>
            <AdminAccordionList items={filtered.map((row) => ({
              id: row.id,
              title: row.original_name,
              subtitle: `${row.categoria} · ${formatSize(row.size_bytes)}`,
              details: [
                { label: 'Tipo', value: row.content_type || '—' },
                { label: 'Enviado em', value: row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '—' },
              ],
              actions: <>
                <Button variant="outline" size="sm" leftIcon={<Eye className="h-4 w-4" />} aria-label={`Visualizar ${row.original_name}`} loading={busyId === row.id} onClick={() => void download(row)}>Visualizar</Button>
                <Button variant="ghost" size="sm" leftIcon={<EyeOff className="h-4 w-4" />} aria-label={showHidden ? 'Reexibir arquivo' : 'Ocultar arquivo'} onClick={() => toggleHidden(row.id)}>{showHidden ? 'Reexibir' : 'Ocultar'}</Button>
                {isAdmin && <><Button variant="ghost" size="sm" leftIcon={<Pencil className="h-4 w-4" />} aria-label={`Editar ${row.original_name}`} disabled={!!busyId} onClick={() => edit(row)}>Editar</Button><Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-4 w-4 text-erro" />} aria-label={`Excluir ${row.original_name}`} disabled={!!busyId} onClick={() => void remove(row)}>Excluir</Button></>}
              </>,
            }))} />
          </>
        )}
      </Card>
      {isAdmin && <Modal open={open} onClose={() => !saving && setOpen(false)} title={editing ? 'Editar arquivo' : 'Enviar arquivo'} footer={<><Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancelar</Button><Button form="admin-file-form" type="submit" loading={saving}>{editing ? 'Salvar alterações' : 'Enviar'}</Button></>}>
        <form id="admin-file-form" onSubmit={save} className="space-y-4">{error && <div className="rounded-lg border border-erro/30 bg-erro/10 p-3 text-sm text-erro" role="alert">{error}</div>}
          {!editing && <div><label htmlFor="admin-file-picker" className="mb-1.5 block text-sm font-medium">Arquivo</label><input ref={inputRef} id="admin-file-picker" type="file" required className="w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2 text-sm" onChange={(event) => setFile(event.target.files?.[0] || null)} /><p className="mt-1 text-xs text-text-secondary">Tamanho máximo: {formatSize(ADMIN_FILE_MAX_BYTES)}.</p>{file && file.size > ADMIN_FILE_MAX_BYTES && <p className="mt-1 text-sm text-erro">O arquivo excede o limite permitido.</p>}</div>}
          <Input label="Nome do arquivo" required value={nome || (file && !editing ? file.name : '')} disabled={!editing} onChange={(event) => setNome(event.target.value)} />
          <Input label="Categoria" required value={categoria} onChange={(event) => setCategoria(event.target.value)} />
        </form>
      </Modal>}
    </div>
  );
}
