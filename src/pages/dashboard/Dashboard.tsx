import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, FileText, RefreshCw, TrendingUp, Users, Wallet } from 'lucide-react';
import { Cell, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button, Card, PageHeader } from '@/components/ui';
import { InstallPwaButton } from '@/components/pwa/InstallPwaButton';
import { useAuth } from '@/contexts/AuthContext';
import { getRecentDashboardActivity, type DashboardActivity } from '@/services/dashboard-activity-service';
import { getDashboardOverview, type DashboardOverview } from '@/services/dashboard-overview-service';
import { formatBRL } from '@/lib/export';
import { DashboardShortcuts } from '@/components/dashboard/DashboardShortcuts';

const entityLabels: Record<string, string> = {
  clients: 'cliente', client_historico: 'histórico de cliente', contratos: 'contrato', gm_contracts: 'contrato', contrato_historico: 'histórico de contrato',
  signature_envelopes: 'envelope de assinatura', signature_signers: 'signatário', gm_financial_entries: 'lançamento financeiro', parcelas: 'parcela',
  lancamentos: 'lançamento', empresas: 'empresa', services: 'serviço', vendedores: 'vendedor', agenda: 'compromisso',
};
const actionLabels: Record<DashboardActivity['action'], string> = { created: 'criou', updated: 'alterou', deleted: 'excluiu' };
const colors = ['var(--brand)', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];
const formatExactTime = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
const currencyTooltip = (value: number) => formatBRL(Number(value));

export default function Dashboard() {
  const { user, empresaAtiva } = useAuth();
  const [activity, setActivity] = useState<DashboardActivity[]>([]);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextActivity, nextOverview] = await Promise.all([
        getRecentDashboardActivity(empresaAtiva?.id || null, 20),
        getDashboardOverview(empresaAtiva?.id || null),
      ]);
      setActivity(nextActivity);
      setOverview(nextOverview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o dashboard.');
    } finally {
      setLoading(false);
    }
  }, [empresaAtiva?.id]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const metrics = overview ? [
    { label: 'Clientes', value: overview.resumo.clientes.toLocaleString('pt-BR'), icon: Users },
    { label: 'Contratos', value: overview.resumo.contratos.toLocaleString('pt-BR'), icon: FileText },
    { label: 'Total recebido', value: formatBRL(overview.resumo.recebido), icon: Wallet },
    { label: 'Em atraso', value: overview.resumo.parcelasAtrasadas.toLocaleString('pt-BR'), icon: AlertTriangle },
  ] : [];

  return (
    <div className="max-w-7xl space-y-5">
      <PageHeader title="Dashboard" description={empresaAtiva ? `Indicadores e atualizações de ${empresaAtiva.nome}.` : 'Indicadores pessoais e atualizações recentes.'}
        actions={<div className="flex flex-wrap items-center gap-2"><InstallPwaButton className="min-h-9 px-3 py-2 text-xs sm:text-sm" /><Button variant="outline" size="sm" leftIcon={<RefreshCw className="h-4 w-4" />} disabled={loading} onClick={() => void loadDashboard()}>Atualizar</Button></div>} />

      {error && <p className="rounded-lg border border-erro/30 bg-erro/10 p-3 text-sm text-erro" role="alert">{error}</p>}
      {!empresaAtiva && <p className="rounded-lg border border-border-color bg-bg-secondary p-3 text-sm text-text-secondary">Selecione ou cadastre uma empresa para visualizar indicadores detalhados.</p>}

      {user?.id && <DashboardShortcuts userId={user.id} />}

      <section aria-label="Indicadores principais" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="card-premium animate-in p-4">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs font-medium text-text-secondary">{metric.label}</p><p className="mt-2 truncate text-xl font-bold tabular-nums">{loading ? '—' : metric.value}</p></div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand"><metric.icon className="h-4 w-4" /></span></div>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]" aria-label="Gráficos do sistema">
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Fluxo financeiro</h2><p className="mt-1 text-xs text-text-secondary">Recebimentos e valores previstos nos últimos seis meses</p></div><TrendingUp className="h-4 w-4 text-brand" aria-hidden="true" /></div>
          <div className="h-64 min-w-0 sm:h-72">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={overview?.receitaMensal || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis width={50} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Number(value) / 1000}k`} />
              <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 12 }} formatter={(value: number) => currencyTooltip(value)} />
              <Line type="monotone" dataKey="previsto" name="Previsto" stroke="var(--text-secondary)" strokeDasharray="5 5" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive animationDuration={1100} />
              <Line type="monotone" dataKey="recebido" name="Recebido" stroke="var(--brand)" strokeWidth={3} dot={{ r: 3, fill: 'var(--brand)' }} activeDot={{ r: 6 }} isAnimationActive animationDuration={1300} />
            </LineChart></ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Contratos por status</h2><p className="mt-1 text-xs text-text-secondary">Distribuição dos contratos da empresa</p>
          <div className="relative h-64 min-w-0">
            {overview?.contratosPorStatus.length ? <ResponsiveContainer width="100%" height="100%"><PieChart>
              <Pie data={overview.contratosPorStatus} dataKey="total" nameKey="status" innerRadius="52%" outerRadius="78%" paddingAngle={3} isAnimationActive animationDuration={1100}>
                {overview.contratosPorStatus.map((item, index) => <Cell key={item.status} fill={colors[index % colors.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 12 }} />
            </PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-center text-sm text-text-secondary">{loading ? 'Carregando gráfico…' : 'Ainda não há contratos para exibir'}</div>}
          </div>
          {!!overview?.contratosPorStatus.length && <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            {overview.contratosPorStatus.map((item, index) => <li key={item.status} className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} /><span className="truncate text-text-secondary">{item.status}</span><strong className="ml-auto">{item.total}</strong></li>)}
          </ul>}
        </Card>
      </section>

      <Card className="overflow-hidden" padding="none">
        <div className="border-b border-border-color px-5 py-4"><h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Últimas alterações</h2><p className="mt-1 text-xs text-text-secondary">Eventos detalhados de clientes, contratos, assinaturas, financeiro e outros módulos.</p></div>
        {loading ? <p className="p-8 text-center text-sm text-text-secondary" role="status">Carregando atualizações…</p> : activity.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center"><Activity className="h-6 w-6 text-text-secondary" aria-hidden="true" /><p className="text-sm font-medium">Nenhuma alteração registrada</p><p className="text-xs text-text-secondary">As atualizações aparecerão aqui quando forem registradas.</p></div>
        ) : <ol className="divide-y divide-border-color">{activity.slice(0, 8).map((item) => {
          const entity = entityLabels[item.entity] || item.entity.replace(/[_-]+/g, ' ');
          return <li key={item.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0">
            <p className="text-sm"><span className="font-semibold">{item.actorName || 'Usuário'}</span> {actionLabels[item.action]} <span className="font-medium">{entity}</span></p>
            {item.changedFields.length > 0 && <p className="mt-1 text-xs text-text-secondary">Campos alterados: {item.changedFields.map((field) => field.replace(/[_-]+/g, ' ')).join(', ')}</p>}
            <p className="mt-1 text-xs text-text-secondary">Escopo: {item.scope === 'company' ? 'empresa ativa' : 'pessoal'}</p>
          </div><time className="shrink-0 text-xs text-text-secondary sm:text-right" dateTime={item.occurredAt} title={item.occurredAt}>{formatExactTime(item.occurredAt)} (horário de Brasília)</time></li>;
        })}</ol>}
      </Card>
    </div>
  );
}
