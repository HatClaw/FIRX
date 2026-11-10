import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Calendar } from 'lucide-react';

interface FiltrosDashboard {
  periodo: '7d' | '30d' | '90d' | '6m' | '12m' | 'custom';
  data_init?: string;
  data_fim?: string;
  vendedor_id?: string;
}

interface DashboardFiltersProps {
  onFiltersChange: (filtros: FiltrosDashboard) => void;
  vendedores: Array<{ id: string; nome: string }>;
}

export function DashboardFilters({ onFiltersChange, vendedores }: DashboardFiltersProps) {
  const [periodo, setPeriodo] = useState<FiltrosDashboard['periodo']>('30d');
  const [dataInit, setDataInit] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [vendedorId, setVendedorId] = useState('');

  const periodos: Array<{ value: FiltrosDashboard['periodo']; label: string }> = [
    { value: '7d', label: '7 dias' },
    { value: '30d', label: '30 dias' },
    { value: '90d', label: '90 dias' },
    { value: '6m', label: '6 meses' },
    { value: '12m', label: '12 meses' },
    { value: 'custom', label: 'Personalizado' },
  ];

  function applyFilters() {
    const filtros: FiltrosDashboard = { periodo };
    if (periodo === 'custom') {
      filtros.data_init = dataInit;
      filtros.data_fim = dataFim;
    }
    if (vendedorId) {
      filtros.vendedor_id = vendedorId;
    }
    onFiltersChange(filtros);
  }

  function handlePeriodChange(value: FiltrosDashboard['periodo']) {
    setPeriodo(value);
    if (value !== 'custom') {
      setDataInit('');
      setDataFim('');
    }
  }

  return (
    <div className="bg-bg-primary border border-border-color rounded-lg shadow-sm p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">Período</span>
            <div className="inline-flex rounded-md border border-border-color bg-bg-secondary">
              {periodos.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handlePeriodChange(p.value)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium transition-colors',
                    'first:rounded-l-md last:rounded-r-md',
                    periodo === p.value
                      ? 'bg-verde-discreto text-branco'
                      : 'text-text-secondary hover:bg-bg-tertiary'
                  )}
                  aria-pressed={periodo === p.value}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {periodo === 'custom' && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">Data início</span>
              <Input
                type="date"
                value={dataInit}
                onChange={(e) => setDataInit(e.target.value)}
                leftIcon={<Calendar className="w-4 h-4" />}
              />
            </div>
          )}

          {periodo === 'custom' && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">Data fim</span>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                leftIcon={<Calendar className="w-4 h-4" />}
              />
            </div>
          )}

          <div className="flex flex-col gap-1 min-w-[200px]">
            <span className="text-xs font-medium text-text-secondary">Vendedor</span>
            <select
              value={vendedorId}
              onChange={(e) => setVendedorId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-verde-discreto"
              aria-label="Filtrar por vendedor"
            >
              <option value="">Todos os vendedores</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" onClick={applyFilters}>
            Atualizar
          </Button>
        </div>
      </div>
    </div>
  );
}
