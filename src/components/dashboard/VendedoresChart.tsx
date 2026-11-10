import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartContainer } from './ChartContainer';

interface VendedoresChartProps {
  data: Array<{ vendedor: string; recebido: number; meta: number; contratos: number }>;
  loading?: boolean;
}

export function VendedoresChart({ data, loading }: VendedoresChartProps) {
  const isEmpty = !data || data.length === 0;

  return (
    <ChartContainer
      title="Desempenho por Vendedor"
      loading={loading}
      empty={isEmpty}
      emptyTitle="Sem dados de vendedores"
      emptyDescription="Não há desempenho de vendedores para exibir no período selecionado."
    >
      <div className="w-full" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" />
            <XAxis
              dataKey="vendedor"
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
              }}
              formatter={(value: number, name: string) => [
                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
                name === 'recebido' ? 'Recebido' : 'Meta',
              ]}
            />
            <Legend
              formatter={(value) => (value === 'recebido' ? 'Recebido' : 'Meta')}
              wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 12 }}
            />
            <Bar dataKey="recebido" fill="var(--color-sucesso)" radius={[4, 4, 0, 0]} name="recebido" />
            <Bar dataKey="meta" fill="var(--color-informacao)" radius={[4, 4, 0, 0]} name="meta" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
