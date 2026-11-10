import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, RefreshCw, Search, Trash2, Users } from 'lucide-react';
import { Button, Card, EmptyState, Input, Modal, PageHeader } from '@/components/ui';
import { AdminUserService, type AdminCompanyOption, type AdminUser } from '@/services/admin-user-service';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { AdminAccordionList } from '@/components/admin/AdminAccordionList';
import { useAdminHiddenRecords } from '@/hooks/useAdminHiddenRecords';

type UserForm = { nome: string; telefone: string; email: string; empresaId: string };
const blankForm: UserForm = { nome: '', telefone: '', email: '', empresaId: '' };

export default function AdminUsuarios() {
  const { isAdmin } = useAdminAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [companies, setCompanies] = useState<AdminCompanyOption[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [viewing, setViewing] = useState<AdminUser | null>(null);
  const { hiddenIds, hiddenCount, showHidden, setShowHidden, toggleHidden } = useAdminHiddenRecords('usuarios');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await AdminUserService.list();
      setUsers(result.users); setCompanies(result.companies);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao carregar usuários.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => (showHidden ? hiddenIds.has(user.id) : !hiddenIds.has(user.id))
      && (!term || `${user.nome} ${user.email} ${user.role} ${user.memberships.map((item) => item.empresa_nome).join(' ')}`.toLowerCase().includes(term)));
  }, [users, search, showHidden, hiddenIds]);

  const newUser = () => { setEditing(null); setForm({ ...blankForm, empresaId: companies[0]?.id || '' }); setError(''); setNotice(''); setOpen(true); };
  const editUser = (user: AdminUser) => { setEditing(user); setForm({ ...blankForm, nome: user.nome, telefone: user.telefone || '' }); setError(''); setOpen(true); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      if (editing) await AdminUserService.update(editing.id, form.nome, form.telefone);
      else {
        const result = await AdminUserService.create(form.empresaId, form.email, form.nome);
        if (result.emailSent) setNotice(result.message);
        else setError(result.message);
      }
      setOpen(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao salvar usuário.'); }
    finally { setSaving(false); }
  };

  const deleteUser = async (user: AdminUser) => {
    const membership = user.memberships.find((item) => item.role === 'vendedor');
    if (!membership || user.memberships.length !== 1 || !window.confirm(`Excluir a conta de ${user.nome} (${user.email})? Esta ação não pode ser desfeita.`)) return;
    setError('');
    try { await AdminUserService.delete(membership.empresa_id, user.id); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao excluir usuário.'); }
  };

  return (
    <div className="max-w-7xl space-y-4">
      <PageHeader title="Usuários" description="Contas, dados de perfil e vínculos empresariais" actions={<div className="flex gap-2"><Button size="sm" variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()}>Atualizar</Button>{isAdmin && <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} disabled={!companies.length} onClick={newUser}>Novo vendedor</Button>}</div>} />
      {error && !open && <div className="rounded-xl border border-erro/30 bg-erro/10 p-4 text-sm text-erro" role="alert">{error}</div>}
      {notice && <div className="rounded-xl border border-brand/30 bg-brand/10 p-4 text-sm text-text-primary" role="status">{notice}</div>}
      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-color p-4"><div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" /><Input aria-label="Buscar usuários" placeholder="Buscar nome, e-mail ou empresa..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" /></div><Button type="button" variant="outline" size="sm" onClick={() => setShowHidden((value) => !value)}>{showHidden ? 'Exibir itens ativos' : `Exibir ocultos (${hiddenCount})`}</Button><p className="w-full text-xs text-text-secondary">Ocultar afeta somente esta lista neste navegador; a conta continua ativa.</p></div>
        {loading ? <p className="p-8 text-center text-sm text-text-secondary">Carregando usuários…</p> : filtered.length === 0 ? <div className="p-8"><EmptyState title="Nenhum usuário" description="As contas disponíveis aparecerão aqui." icon={<Users className="h-6 w-6" />} /></div> : (
          <>
          <AdminAccordionList items={filtered.map((user) => ({
            id: user.id,
            title: user.nome || 'Usuário sem nome',
            subtitle: user.email,
            details: [
              { label: 'Papel', value: user.role },
              { label: 'Empresas', value: user.memberships.map((membership) => membership.empresa_nome).join(', ') || 'Sem vínculo' },
              ...(user.telefone ? [{ label: 'Telefone', value: user.telefone }] : []),
            ],
            actions: <>
              <Button variant="outline" size="sm" leftIcon={<Eye className="h-4 w-4" />} onClick={() => setViewing(user)}>Visualizar</Button>
              <Button variant="ghost" size="sm" leftIcon={<EyeOff className="h-4 w-4" />} onClick={() => toggleHidden(user.id)}>{showHidden ? 'Reexibir' : 'Ocultar'}</Button>
              {isAdmin && <UserActions user={user} canDelete={user.role === 'vendedor' && user.memberships.length === 1 && user.memberships[0]?.role === 'vendedor'} onEdit={editUser} onDelete={(selected) => void deleteUser(selected)} />}
            </>,
          }))} />
          </>
        )}
      </Card>
      {isAdmin && <Modal open={open} onClose={() => !saving && setOpen(false)} title={editing ? 'Editar usuário' : 'Criar usuário vendedor'} footer={<><Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancelar</Button><Button form="admin-user-form" type="submit" loading={saving}>{editing ? 'Salvar alterações' : 'Criar usuário'}</Button></>}>
        <form id="admin-user-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">{error && <div className="sm:col-span-2 rounded-lg border border-erro/30 bg-erro/10 p-3 text-sm text-erro" role="alert">{error}</div>}
          <Input label="Nome" required value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} />
          {editing ? <Input label="Telefone" type="tel" value={form.telefone} onChange={(event) => setForm({ ...form, telefone: event.target.value })} /> : <>
            <Input label="E-mail" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <p className="sm:col-span-2 text-sm text-text-secondary">O vendedor receberá um link de ativação por e-mail e definirá a própria senha ao abrir o convite.</p>
            <div className="sm:col-span-2"><label htmlFor="new-user-company" className="mb-1.5 block text-sm font-medium">Empresa</label><select id="new-user-company" className="w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5 text-sm" required value={form.empresaId} onChange={(event) => setForm({ ...form, empresaId: event.target.value })}><option value="">Selecione a empresa…</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.nome}</option>)}</select><p className="mt-1 text-xs text-text-secondary">A conta criada terá papel de vendedor na empresa selecionada.</p></div>
          </>}
        </form>
      </Modal>}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Visualizar usuário" footer={<Button variant="outline" onClick={() => setViewing(null)}>Fechar</Button>}>
        {viewing && <dl className="grid gap-3 sm:grid-cols-2">{[
          ['Nome', viewing.nome], ['E-mail', viewing.email], ['Papel', viewing.role], ['Telefone', viewing.telefone || '—'],
          ['Empresas', viewing.memberships.map((item) => item.empresa_nome).join(', ') || 'Sem vínculo'],
        ].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-bg-secondary p-3"><dt className="text-xs font-medium uppercase text-text-secondary">{label}</dt><dd className="mt-1 break-all text-sm text-text-primary">{value}</dd></div>)}</dl>}
      </Modal>
    </div>
  );
}

function UserActions({ user, canDelete, onEdit, onDelete }: { user: AdminUser; canDelete: boolean; onEdit: (user: AdminUser) => void; onDelete: (user: AdminUser) => void }) {
  return <>
    <Button variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />} aria-label={`Editar ${user.nome}`} onClick={() => onEdit(user)}>Editar</Button>
    <Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-4 w-4 text-erro" />} aria-label={`Excluir ${user.nome}`} disabled={!canDelete} title={canDelete ? 'Excluir conta' : 'Apenas contas de vendedor vinculadas a uma única empresa podem ser excluídas por este fluxo'} onClick={() => onDelete(user)}>Excluir</Button>
  </>;
}
