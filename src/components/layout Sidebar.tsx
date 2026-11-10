import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

interface SidebarProps {
  items: NavItem[];
  logo?: string;
  user?: { name: string; email: string; avatar?: string };
  onCollapse?: (collapsed: boolean) => void;
}

export function Sidebar({ items, logo, user, onCollapse }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    onCollapse?.(next);
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen flex flex-col',
        'bg-bg-primary border-r border-border-color',
        'transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64'
      )}
      aria-label="Navegação principal"
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-border-color">
        {logo ? (
          <img src={logo} alt="GrowMoney" className={cn('transition-all', collapsed ? 'w-8 h-8 mx-auto' : 'w-32 h-auto')} />
        ) : (
          <span className={cn('font-bold text-xl text-verde-discreto', collapsed && 'sr-only')}>GrowMoney</span>
        )}
        <button
          onClick={toggleCollapse}
          className={cn(
            'ml-auto p-1.5 rounded-md hover:bg-bg-tertiary',
            'focus:outline-none focus:ring-2 focus:ring-verde-discreto',
            'transition-colors'
          )}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <svg
            className={cn('w-5 h-5 transition-transform', collapsed && 'rotate-180')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md',
                    'text-sm font-medium transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-verde-discreto',
                    isActive
                      ? 'bg-verde-discreto/10 text-verde-discreto'
                      : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="flex-shrink-0 w-5 h-5">{item.icon}</span>
                  <span className={cn('transition-opacity', collapsed && 'opacity-0 w-0')}>{item.label}</span>
                  {item.badge && !collapsed && (
                    <span className="ml-auto text-xs bg-verde-discreto text-branco px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      {user && (
        <div className="border-t border-border-color p-3">
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-verde-discreto flex items-center justify-center text-branco text-sm font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className={cn('min-w-0', collapsed && 'hidden')}>
              <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
              <p className="text-xs text-text-secondary truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
