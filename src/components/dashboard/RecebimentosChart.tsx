import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartContainer } from './ChartContainer';

interface RecebimentosChartProps {
  data: Array<{ periodo: string; recebido: number; previsto: number }>;
  loading?: boolean;
}

export function RecebimentosChart({ data, loading }: RecebimentosChartProps) {
  const isEmpty = !data || data.length === 0;

  return (
    <ChartContainer
      title="Evolução de Recebimentos"
      loading={loading}
      empty={isEmpty}
      emptyTitle="Sem dados de recebimento"
      emptyDescription="Não há recebimentos registrados para o período selecionado."
    >
      <div className="w-full" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" />
            <XAxis
              dataKey="periodo"
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
                name === 'recebido' ? 'Recebido' : 'Previsto',
              ]}
            />
            <Legend
              formatter={(value) => (value === 'recebido' ? 'Recebido' : 'Previsto')}
              wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="recebido"
              stroke="var(--color-sucesso)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              name="recebido"
            />
            <Line
              type="monotone"
              dataKey="previsto"
              stroke="var(--color-informacao)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              name="previsto"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
