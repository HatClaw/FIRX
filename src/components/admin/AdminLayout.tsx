import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  Shield,
  LogOut,
  Server,
  Menu,
  X,
  FileText,
  FileSignature,
  FolderOpen,
  Wallet,
  ArrowLeft,
  CircleUserRound,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { BrandLogo } from '@/components/brand/BrandLogo';

const nav = [
  { to: '/admin', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/admin/empresas', label: 'Empresas', icon: Building2 },
  { to: '/admin/usuarios', label: 'Usuários', icon: Users },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/contratos', label: 'Contratos', icon: FileText },
  { to: '/admin/assinaturas', label: 'Assinaturas', icon: FileSignature },
  { to: '/admin/arquivos', label: 'Arquivos', icon: FolderOpen },
  { to: '/admin/financeiro', label: 'Financeiro', icon: Wallet },
  { to: '/admin/sistema', label: 'Sistema', icon: Server },
  { to: '/admin/auditoria', label: 'Auditoria', icon: Shield },
  { to: '/admin/seguranca', label: 'Segurança', icon: Settings },
];

export function AdminLayout() {
  const { session, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    setMenuOpen(false);
    void logout().finally(() => navigate('/admin/login'));
  };

  const closeMenu = () => setMenuOpen(false);

  const handleAdminLogout = () => {
    setProfileOpen(false);
    handleLogout();
  };

  const sidebar = (
    <>
      <div className="h-24 sm:h-28 px-4 flex items-center border-b border-border-color shrink-0">
        <Link to="/admin" onClick={closeMenu} className="flex flex-col gap-0.5">
          <BrandLogo linkTo={false} heightClass="h-14 sm:h-[60px]" className="max-w-[220px]" />
          <span className="text-[10px] uppercase tracking-widest text-brand font-semibold">
            Painel Admin
          </span>
        </Link>
      </div>

      <nav aria-label="Navegação administrativa" className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={closeMenu}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-3 sm:py-2.5 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                isActive
                  ? 'bg-brand/15 text-brand'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              )
            }
          >
            <item.icon aria-hidden="true" className="w-4 h-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-border-color shrink-0">
        <p className="text-xs text-text-secondary px-2 mb-2 truncate" title={session?.email}>
          {session?.email}
        </p>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full min-h-11 flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-erro hover:bg-erro/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <LogOut aria-hidden="true" className="w-4 h-4" /> Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-bg-secondary flex">
      <aside className="hidden lg:flex w-72 shrink-0 border-r border-border-color bg-bg-primary flex-col">
        {sidebar}
      </aside>

      {menuOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={closeMenu}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}
      <aside
        id="admin-mobile-navigation"
        aria-label="Menu administrativo"
        aria-hidden={!menuOpen}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] flex-col border-r border-border-color bg-bg-primary shadow-xl transition-transform duration-200 lg:hidden',
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex justify-end p-2">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={closeMenu}
            className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-text-secondary hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {sidebar}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <header className="min-h-16 border-b border-border-color bg-bg-primary px-3 sm:px-6 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h1 className="text-xs sm:text-sm font-semibold text-text-primary">Administração da plataforma</h1>
            <p className="hidden sm:block text-xs text-text-secondary">Gestão global · {BRAND.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              aria-label="Voltar ao sistema"
              title="Voltar ao sistema"
              className="min-h-11 min-w-11 flex items-center justify-center gap-2 rounded-lg text-brand hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:px-3"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
              <span className="hidden text-xs font-semibold sm:inline">Voltar ao sistema</span>
            </Link>
            <div className="relative">
              <button
                type="button"
                aria-label="Perfil do administrador"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-controls="admin-profile-menu"
                title="Perfil do administrador"
                onClick={() => setProfileOpen((open) => !open)}
                className="min-h-11 min-w-11 flex items-center justify-center rounded-full text-brand hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <CircleUserRound aria-hidden="true" className="h-6 w-6" />
              </button>
              {profileOpen && (
                <div
                  id="admin-profile-menu"
                  role="menu"
                  aria-label="Opções do perfil do administrador"
                  className="absolute right-0 z-50 mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border-color bg-bg-primary py-2 shadow-xl"
                >
                  <div className="border-b border-border-color px-4 py-2">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {session?.username || 'Administrador'}
                    </p>
                    <p className="truncate text-xs text-text-secondary">{session?.email}</p>
                  </div>
                  <Link
                    to="/admin/seguranca"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                    className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                  >
                    <Shield aria-hidden="true" className="h-4 w-4" /> Segurança da conta
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleAdminLogout}
                    className="flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-erro hover:bg-erro/10"
                  >
                    <LogOut aria-hidden="true" className="h-4 w-4" /> Sair
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-controls="admin-mobile-navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-text-primary hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:hidden"
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


