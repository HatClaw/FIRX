import { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { AlertCircle, AlertTriangle } from 'lucide-react';

interface ChartContainerProps {
  title: string;
  children: ReactNode;
  loading?: boolean;
  error?: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ChartContainer({
  title,
  children,
  loading,
  error,
  empty,
  emptyTitle,
  emptyDescription,
}: ChartContainerProps) {
  return (
    <Card
      header={
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      }
    >
      {loading && (
        <div className="flex flex-col items-center justify-center py-12" role="status" aria-live="polite">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-sm text-text-secondary">Carregando dados...</p>
        </div>
      )}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-12" role="alert" aria-live="assertive">
          <div className="w-14 h-14 rounded-full bg-erro/10 flex items-center justify-center mb-3">
            <AlertCircle className="w-7 h-7 text-erro" />
          </div>
          <p className="text-sm text-erro text-center max-w-sm">{error}</p>
        </div>
      )}
      {!loading && !error && empty && (
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8" />}
          title={emptyTitle || 'Nenhum dado disponível'}
          description={emptyDescription || 'Não há informações para exibir no período selecionado.'}
        />
      )}
      {!loading && !error && !empty && children}
    </Card>
  );
}
