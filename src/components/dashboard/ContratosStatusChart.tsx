import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { ChartContainer } from './ChartContainer';

interface ContratosStatusChartProps {
  data: Array<{ status: string; valor: number; count: number }>;
  loading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  Assinado: 'var(--color-sucesso)',
  Pendente: 'var(--color-aviso)',
  Rascunho: 'var(--color-cinza-medio)',
  Cancelado: 'var(--color-erro)',
  Expirado: 'var(--color-informacao)',
};

export function ContratosStatusChart({ data, loading }: ContratosStatusChartProps) {
  const isEmpty = !data || data.length === 0;

  return (
    <ChartContainer
      title="Contratos por Status"
      loading={loading}
      empty={isEmpty}
      emptyTitle="Sem contratos registrados"
      emptyDescription="Não há contratos para exibir no período selecionado."
    >
      <div className="w-full" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="valor"
              nameKey="status"
              cx="50%"
              cy="50%"
              outerRadius={110}
              innerRadius={50}
              label={({ status, percent }) =>
                `${status} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={true}
            >
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={STATUS_COLORS[entry.status] || 'var(--color-cinza-medio)'}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
              }}
              formatter={(value: number, name: string, props: any) => [
                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
                props?.status || name,
              ]}
            />
            <Legend
              formatter={(value) => value}
              wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
