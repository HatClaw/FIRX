import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { navItems } from '@/config/nav';
import { moveShortcut, normalizeShortcutHrefs } from '@/lib/dashboard-shortcuts';
import { Card } from '@/components/ui';

export function DashboardShortcuts({ userId }: { userId: string }) {
  const storageKey = `growmoney-dashboard-shortcuts:${userId}`;
  const [hrefs, setHrefs] = useState<string[]>(() => normalizeShortcutHrefs(
    typeof window === 'undefined' ? null : JSON.parse(localStorage.getItem(storageKey) || 'null')
  ));
  const [editing, setEditing] = useState(false);
  const [draggedHref, setDraggedHref] = useState<string | null>(null);
  const [dropHref, setDropHref] = useState<string | null>(null);
  const selected = useMemo(() => hrefs.map((href) => navItems.find((item) => item.href === href)).filter((item): item is (typeof navItems)[number] => Boolean(item)), [hrefs]);
  const available = navItems.filter((item) => !hrefs.includes(item.href));

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(hrefs)); }, [hrefs, storageKey]);

  const updateOrder = (from: number, to: number) => setHrefs((current) => moveShortcut(current, from, to));

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-sm font-semibold">Acesso rápido</h2><p className="mt-1 text-xs text-text-secondary">Seus atalhos para as seções mais usadas.</p></div>
        <button type="button" onClick={() => setEditing((value) => !value)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border-color px-3 text-sm font-medium text-text-secondary transition-colors hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-expanded={editing}>
          {editing ? <X className="h-4 w-4"/> : <Pencil className="h-4 w-4"/>}{editing ? 'Concluir' : 'Editar atalhos'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {selected.map((item, index) => <div key={item.href} onDragOver={(event) => { if (editing && draggedHref) { event.preventDefault(); setDropHref(item.href); } }} onDragLeave={() => setDropHref((current) => current === item.href ? null : current)} onDrop={(event) => {
          event.preventDefault();
          const from = hrefs.indexOf(draggedHref || '');
          const to = hrefs.indexOf(item.href);
          updateOrder(from, to); setDraggedHref(null); setDropHref(null);
        }} className={`relative min-w-0 rounded-2xl transition-all ${dropHref === item.href ? 'ring-2 ring-brand ring-offset-2 ring-offset-bg-primary' : ''} ${draggedHref === item.href ? 'opacity-45' : ''}`}>
          <Link to={item.href} draggable={editing} onDragStart={(event) => { setDraggedHref(item.href); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.href); }} onDragEnd={() => { setDraggedHref(null); setDropHref(null); }} className="group flex min-h-[104px] flex-col items-start justify-between rounded-2xl border border-border-color bg-bg-secondary/70 p-3 transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:bg-brand/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:min-h-[116px] sm:p-4">
            <div className="flex w-full items-start justify-between gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-white"><item.icon aria-hidden="true" className="h-5 w-5"/></span>{editing && <GripVertical aria-hidden="true" className="mt-1 h-4 w-4 cursor-grab text-text-disabled"/>}</div>
            <span className="mt-4 truncate text-sm font-semibold text-text-primary">{item.label}</span>
          </Link>
          {editing && <div className="mt-2 flex items-center justify-between gap-1">
            <div className="flex gap-1"><button type="button" disabled={index === 0} onClick={() => updateOrder(index, index - 1)} aria-label={`Mover ${item.label} para cima`} className="rounded-lg p-2 text-text-secondary hover:bg-bg-tertiary disabled:opacity-30"><ArrowUp className="h-4 w-4"/></button><button type="button" disabled={index === selected.length - 1} onClick={() => updateOrder(index, index + 1)} aria-label={`Mover ${item.label} para baixo`} className="rounded-lg p-2 text-text-secondary hover:bg-bg-tertiary disabled:opacity-30"><ArrowDown className="h-4 w-4"/></button></div>
            <button type="button" onClick={() => setHrefs((current) => current.filter((href) => href !== item.href))} aria-label={`Remover atalho ${item.label}`} className="rounded-lg p-2 text-text-secondary hover:bg-erro/10 hover:text-erro"><X className="h-4 w-4"/></button>
          </div>}
        </div>)}
      </div>

      {editing && <div className="border-t border-border-color pt-4"><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Adicionar seção</h3>{available.length ? <div className="flex flex-wrap gap-2">{available.map((item) => <button type="button" key={item.href} onClick={() => setHrefs((current) => [...current, item.href])} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border-color px-3 text-sm text-text-secondary transition-colors hover:border-brand/50 hover:bg-brand/5 hover:text-brand"><item.icon className="h-4 w-4" aria-hidden="true"/><span>{item.label}</span><Plus className="h-3.5 w-3.5" aria-hidden="true"/></button>)}</div> : <p className="text-sm text-text-secondary">Todas as seções já estão nos seus atalhos.</p>}</div>}
      {editing && <p className="text-xs text-text-secondary">Arraste os cartões para reordenar ou use as setas. A ordem fica salva neste dispositivo.</p>}
    </Card>
  );
}
