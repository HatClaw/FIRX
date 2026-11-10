import { Shield } from 'lucide-react';
import { Card, EmptyState, Badge, PageHeader } from '@/components/ui';

const logs = [
  { id: '1', acao: 'Login', usuario: 'sistema', quando: 'Hoje', detalhe: 'Sessão iniciada' },
];

export default function Auditoria() {
  return (
    <div className="max-w-7xl space-y-4">
      <PageHeader title="Auditoria" description="Trilha de ações sensíveis no sistema" />
      <Card padding="none" className="overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8"><EmptyState title="Sem eventos" description="Ações relevantes aparecerão aqui." icon={<Shield className="w-6 h-6" />} /></div>
        ) : (
          <ul className="divide-y divide-border-color">
            {logs.map((l) => (
              <li key={l.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <Badge variant="info">{l.acao}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{l.detalhe}</p>
                  <p className="text-xs text-text-secondary">{l.usuario}</p>
                </div>
                <span className="text-xs text-text-secondary">{l.quando}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

