import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  label: string;
  value: number;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  format?: 'currency' | 'number' | 'percent';
  icon?: ReactNode;
}

function formatValue(value: number, format?: 'currency' | 'number' | 'percent'): string {
  if (format === 'currency') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  }
  if (format === 'percent') {
    return `${value >= 0 ? '+' : ''}${value}%`;
  }
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function KPICard({ label, value, change, changeType = 'neutral', format, icon }: KPICardProps) {
  const isPositive = changeType === 'positive';
  const isNegative = changeType === 'negative';

  return (
    <div
      className={cn(
        'bg-bg-primary border border-border-color rounded-lg shadow-sm p-4',
        'flex flex-col gap-3'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-verde-discreto/10 flex items-center justify-center text-verde-discreto">
            {icon}
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary">
          {formatValue(value, format)}
        </p>
        {change !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-sm font-medium mt-1',
              isPositive && 'text-sucesso',
              isNegative && 'text-erro',
              changeType === 'neutral' && 'text-text-secondary'
            )}
            aria-label={`Mudança de ${change >= 0 ? '+' : ''}${change}%`}
          >
            {change >= 0 ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
            {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
    </div>
  );
}
