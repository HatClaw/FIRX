import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface AdminAccordionItem {
  id: string;
  title: string;
  subtitle?: string;
  details: Array<{ label: string; value: ReactNode }>;
  actions?: ReactNode;
}

export function AdminAccordionList({ items, emptyMessage = 'Nenhum item para exibir.' }: { items: AdminAccordionItem[]; emptyMessage?: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (!items.length) return <p className="p-4 text-center text-sm text-text-secondary">{emptyMessage}</p>;

  return (
    <div className="space-y-2 p-3" aria-label="Registros em lista expansível">
      {items.map((item) => (
        <details key={item.id} open={expandedId === item.id} onToggle={(event) => {
          if (event.currentTarget.open) setExpandedId(item.id);
          else if (expandedId === item.id) setExpandedId(null);
        }} className="admin-accordion-card group min-w-0 overflow-hidden rounded-xl border border-border-color bg-bg-primary transition-[border-color,box-shadow] duration-200">
          <summary onClick={(event) => {
            event.preventDefault();
            setExpandedId((current) => current === item.id ? null : item.id);
          }} className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-semibold text-text-primary">{item.title}</span>
              {item.subtitle && <span className="mt-0.5 block break-all text-xs text-text-secondary">{item.subtitle}</span>}
            </span>
            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-text-secondary transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 border-t border-border-color bg-bg-secondary/40 p-3">
            <dl className="grid gap-2 sm:grid-cols-2">
              {item.details.map(({ label, value }) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">{label}</dt>
                  <dd className="mt-0.5 break-all text-sm text-text-primary">{value || '—'}</dd>
                </div>
              ))}
            </dl>
            {item.actions && <div className="flex flex-wrap items-center justify-end gap-1 border-t border-border-color pt-2">{item.actions}</div>}
          </div>
        </details>
      ))}
    </div>
  );
}

