import { TrendingUp, DollarSign, Users, FileText } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';
import { formatBRL } from '@/lib/export';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const data = [
  { mes: 'Jan', vendas: 42000 },
  { mes: 'Fev', vendas: 51000 },
  { mes: 'Mar', vendas: 48000 },
  { mes: 'Abr', vendas: 62000 },
  { mes: 'Mai', vendas: 58000 },
  { mes: 'Jun', vendas: 71000 },
];

export default function DashboardExecutivo() {
  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader title="Dashboard executivo" description="Visão consolidada de performance" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Receita YTD', value: formatBRL(332000), icon: DollarSign },
          { label: 'Clientes ativos', value: '128', icon: Users },
          { label: 'Contratos', value: '47', icon: FileText },
          { label: 'Crescimento', value: '+15%', icon: TrendingUp },
        ].map((k) => (
          <Card key={k.label} className="p-4 card-premium">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-text-secondary font-medium">{k.label}</p>
                <p className="text-xl font-bold mt-1 tabular-nums">{k.value}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                <k.icon className="w-4 h-4" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-4">Vendas por mês</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 12 }} formatter={(v: number) => formatBRL(v)} />
              <Bar dataKey="vendas" fill="var(--brand)" radius={[6, 6, 0, 0]} animationDuration={1000} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

