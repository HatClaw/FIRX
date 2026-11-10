import { Building2, Users, FileText, Activity, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, PageHeader, Badge } from '@/components/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

const areas = [
  { label: 'Empresas', description: 'Cadastros, status e dados empresariais.', to: '/admin/empresas', icon: Building2 },
  { label: 'Usuários', description: 'Contas vinculadas à plataforma.', to: '/admin/usuarios', icon: Users },
  { label: 'Sistema', description: 'Identidade e integrações configuradas.', to: '/admin/sistema', icon: Activity },
  { label: 'Auditoria', description: 'Eventos registrados nesta sessão.', to: '/admin/auditoria', icon: FileText },
];

export default function AdminDashboard() {
  const { session } = useAdminAuth();

  return (
    <div className="max-w-6xl space-y-5 sm:space-y-6">
      <PageHeader
        title="Visão geral"
        description={`Bem-vindo, ${session?.username || 'administrador'}. Acesse as áreas administrativas da plataforma.`}
      />

      <Card className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="h-10 w-10 shrink-0 rounded-full bg-brand/10 text-brand flex items-center justify-center">
          <ShieldCheck aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-text-primary">Sessão administrativa ativa</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            {session?.loggedAt
              ? `Iniciada em ${new Date(session.loggedAt).toLocaleString('pt-BR')}.`
              : 'A sessão atual está autenticada.'}
          </p>
        </div>
        <Badge variant="success" className="self-start sm:self-auto">Autenticado</Badge>
      </Card>

      <section aria-labelledby="admin-areas-heading" className="space-y-3">
        <div>
          <h2 id="admin-areas-heading" className="font-semibold text-text-primary">Áreas administrativas</h2>
          <p className="text-sm text-text-secondary mt-1">Escolha uma área para consultar e gerenciar os dados.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {areas.map(({ label, description, to, icon: Icon }) => (
            <Link key={to} to={to} className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-xl">
              <Card className="h-full p-4 transition-colors group-hover:border-brand/40 group-hover:bg-bg-tertiary/50">
                <div className="flex items-start justify-between gap-3">
                  <span className="h-10 w-10 shrink-0 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <ArrowRight aria-hidden="true" className="h-4 w-4 text-text-secondary transition-transform group-hover:translate-x-1" />
                </div>
                <h3 className="mt-4 font-semibold text-text-primary">{label}</h3>
                <p className="mt-1 text-sm text-text-secondary">{description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="p-4 sm:p-5">
          <h2 className="font-semibold">Indicadores da plataforma</h2>
          <div className="mt-3 flex items-start gap-3 rounded-lg bg-bg-secondary p-3">
            <Activity aria-hidden="true" className="w-5 h-5 text-text-secondary mt-0.5 shrink-0" />
            <p className="text-sm text-text-secondary">Os totais globais serão exibidos quando os dados estiverem disponíveis para esta sessão administrativa.</p>
          </div>
        </Card>
        <Card className="p-4 sm:p-5 space-y-3">
          <h2 className="font-semibold">Proteja sua conta</h2>
          <p className="text-sm text-text-secondary">Mantenha as credenciais administrativas atualizadas.</p>
          <Link to="/admin/seguranca" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">
            Configurar segurança <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </Card>
      </div>
    </div>
  );
}
