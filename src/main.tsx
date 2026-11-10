import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { AdminAuthProvider } from '@/contexts/AdminAuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminProtectedRoute } from '@/components/admin/AdminProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { SonarGrid } from '@/components/ui/sonar-grid';
import { FloatingThemeSwitcher } from '@/components/ui/FloatingThemeSwitcher';
import { FirstVisitIntro } from '@/components/brand/FirstVisitIntro';
import VendedorWorkspace from '@/pages/dashboard/VendedorWorkspace';
import Visitas from '@/pages/dashboard/Visitas';
import { GlobalFooter } from '@/components/layout/GlobalFooter';
import './index.css';

import LandingPage from '@/pages/public/LandingPage';
import Login from '@/pages/auth/Login';
import Cadastro from '@/pages/auth/Cadastro';
import AuthCallback from '@/pages/auth/AuthCallback';
import RecuperacaoSenha from '@/pages/auth/RecuperacaoSenha';
import TermosUso from '@/pages/auth/TermosUso';
import Privacidade from '@/pages/auth/Privacidade';
import Dashboard from '@/pages/dashboard/Dashboard';
import DashboardExecutivo from '@/pages/dashboard/DashboardExecutivo';
import Clientes from '@/pages/dashboard/Clientes';
import Contratos from '@/pages/dashboard/Contratos';
import ContratoNovo from '@/pages/dashboard/ContratoNovo';
import Servicos from '@/pages/dashboard/Servicos';
import Vendedores from '@/pages/dashboard/Vendedores';
import Agenda from '@/pages/dashboard/Agenda';
import Financeiro from '@/pages/dashboard/Financeiro';
import Relatorios from '@/pages/dashboard/Relatorios';
import Auditoria from '@/pages/dashboard/Auditoria';
import Configuracoes from '@/pages/dashboard/Configuracoes';
import Perfil from '@/pages/dashboard/Perfil';
import Empresas from '@/pages/dashboard/Empresas';
import Assinaturas from '@/pages/dashboard/Assinaturas';
import AssinaturaDetalhe from '@/pages/dashboard/AssinaturaDetalhe';
import AssinarDocumento from '@/pages/public/AssinarDocumento';
import MarketingWorkspace from '@/pages/marketing/MarketingWorkspace';

import AdminLogin from '@/pages/admin/AdminLogin';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminEmpresas from '@/pages/admin/AdminEmpresas';
import AdminUsuarios from '@/pages/admin/AdminUsuarios';
import AdminRecursos from '@/pages/admin/AdminRecursos';
import AdminArquivos from '@/pages/admin/AdminArquivos';
import AdminSistema from '@/pages/admin/AdminSistema';
import AdminAuditoria from '@/pages/admin/AdminAuditoria';
import AdminSeguranca from '@/pages/admin/AdminSeguranca';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Basename para subpasta (ex.: /grow) — Vite injeta import.meta.env.BASE_URL */
const routerBasename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';

function App() {
  return (
    <div className="relative isolate min-h-dvh">
      <SonarGrid
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        color="var(--brand)"
        spacing={32}
        baseOpacity={0.22}
        pingEvery={4.5}
        speed={220}
        ringWidth={100}
        amplitude={1.5}
        interactive={false}
      />
      <div className="relative z-10 min-h-dvh">
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <AuthProvider>
                <AdminAuthProvider>
                  <BrowserRouter basename={routerBasename === '/' ? undefined : routerBasename}>
                    <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/auth" element={<Login />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/cadastro" element={<Cadastro />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/recuperar-senha" element={<RecuperacaoSenha />} />
                  <Route path="/termos" element={<TermosUso />} />
                  <Route path="/privacidade" element={<Privacidade />} />
                  <Route path="/assinar/:token" element={<AssinarDocumento />} />

                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route element={<AdminProtectedRoute />}>
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<AdminDashboard />} />
                      <Route path="empresas" element={<AdminEmpresas />} />
                      <Route path="usuarios" element={<AdminUsuarios />} />
                      <Route path="clientes" element={<AdminRecursos resource="clientes" />} />
                      <Route path="contratos" element={<AdminRecursos resource="contratos" />} />
                      <Route path="assinaturas" element={<AdminRecursos resource="assinaturas" />} />
                      <Route path="arquivos" element={<AdminArquivos />} />
                      <Route path="financeiro" element={<AdminRecursos resource="financeiro" />} />
                      <Route path="sistema" element={<AdminSistema />} />
                      <Route path="auditoria" element={<AdminAuditoria />} />
                      <Route path="seguranca" element={<AdminSeguranca />} />
                    </Route>
                  </Route>

                  <Route element={<ProtectedRoute />}>
                    <Route path="/vendedor" element={<VendedorWorkspace />} />
                    <Route path="/vendedor/contrato" element={<SellerContractRoute />} />
                    <Route element={<WorkspaceRoleRoute />}>
                    <Route element={<AppLayout />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/dashboard/executivo" element={<DashboardExecutivo />} />
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/clients" element={<Clientes />} />
                      <Route path="/contratos" element={<Contratos />} />
                      <Route path="/contratos/novo" element={<ContratoNovo />} />
                      <Route path="/assinaturas" element={<Assinaturas />} />
                      <Route path="/assinaturas/:id" element={<AssinaturaDetalhe />} />
                      <Route path="/servicos" element={<Servicos />} />
                      <Route path="/vendedores" element={<Vendedores />} />
                      <Route path="/agenda" element={<Agenda />} />
                      <Route path="/visitas" element={<Visitas />} />
                      <Route path="/financeiro" element={<Financeiro />} />
                      <Route path="/relatorios" element={<Relatorios />} />
                      <Route path="/auditoria" element={<Auditoria />} />
                      <Route path="/configuracoes" element={<Configuracoes />} />
                      <Route path="/perfil" element={<Perfil />} />
                      <Route path="/empresas" element={<Empresas />} />
                      <Route path="/marketing" element={<MarketingWorkspace />} />
                    </Route>
                    </Route>
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                    <FirstVisitIntro />
                    <GlobalFooter />
                    <FloatingThemeSwitcher />
                  </BrowserRouter>
                </AdminAuthProvider>
              </AuthProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </StrictMode>
      </div>
    </div>
  );
}

function WorkspaceRoleRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user?.role === 'vendedor') return <Navigate to="/vendedor" replace />;
  return <Outlet />;
}

function SellerContractRoute() {
  const { user, empresaAtiva, isLoading } = useAuth();
  if (isLoading) return null;
  if (user?.role !== 'vendedor' && empresaAtiva?.role !== 'vendedor') return <Navigate to="/dashboard" replace />;
  return <ContratoNovo vendedorMode />;
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Elemento #root nao encontrado no HTML');
}

createRoot(rootEl).render(<App />);



