import { Shield } from 'lucide-react';
import { Card, PageHeader, Badge, EmptyState } from '@/components/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useEffect, useState } from 'react';
import { getRecentAdminAuditEvents } from '@/services/admin-audit-service';
import type { AdminAuditEvent } from '@/repositories/admin-audit-repository';

export default function AdminAuditoria() {
  const { session } = useAdminAuth();
  const [logs, setLogs] = useState<AdminAuditEvent[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getRecentAdminAuditEvents()
      .then((data) => {
        if (!active) return;
        setLogs(data);
      })
      .catch((queryError: unknown) => {
        if (!active) return;
        setError(queryError instanceof Error ? queryError.message : 'Não foi possível carregar a auditoria.');
      });
    return () => { active = false; };
  }, [session?.id]);

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-5">
      <PageHeader title="Auditoria" description="Eventos administrativos da plataforma" />
      {error && <p role="alert" className="rounded-lg bg-erro/10 px-3 py-2 text-sm text-erro">{error}</p>}
      <Card padding="none" className="overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Sem eventos"
              description="Ainda não há eventos disponíveis para esta sessão."
              icon={<Shield className="w-6 h-6" />}
            />
          </div>
        ) : (
          <ul className="divide-y divide-border-color">
            {logs.map((l) => (
              <li
                key={l.id}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
              >
                <Badge variant="info">{l.action}</Badge>
                <p className="text-sm flex-1">
                  {l.email || 'Administrador'}
                  {l.details && Object.keys(l.details).length > 0 ? ` · ${JSON.stringify(l.details)}` : ''}
                </p>
                <span className="text-xs text-text-secondary sm:text-right sm:shrink-0">
                  {l.created_at && !Number.isNaN(new Date(l.created_at).getTime())
                    ? new Date(l.created_at).toLocaleString('pt-BR')
                    : 'Horário não disponível'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
