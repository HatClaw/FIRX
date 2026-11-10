import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

/** Collapsible theme selector tucked into the right edge of the viewport. */
export function FloatingThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const selectTheme = (nextTheme: 'light' | 'dark') => {
    if (theme !== nextTheme) toggleTheme();
    setExpanded(false);
  };

  return (
    <div
      className="fixed right-3 top-1/2 z-[45] flex h-14 w-12 -translate-y-1/2 items-center justify-end"
      role="group"
      aria-label="Seletor de tema"
    >
      <div
        id="floating-theme-options"
        aria-hidden={!expanded}
        className={`absolute right-14 top-1/2 flex items-center gap-1 rounded-2xl border border-border-color bg-bg-primary/95 p-1.5 shadow-xl backdrop-blur-md transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${expanded ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        style={{ transform: `translate(${expanded ? '0' : 'calc(100% + 3.5rem)'}, -50%)` }}
        data-expanded={expanded}
      >
        <button
          type="button"
          aria-label="Ativar tema claro"
          aria-pressed={theme === 'light'}
          tabIndex={expanded ? 0 : -1}
          onClick={() => selectTheme('light')}
          className={`flex h-10 items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset ${theme === 'light' ? 'bg-brand text-[#1c1008]' : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'}`}
        >
          <Sun aria-hidden="true" className="size-4 shrink-0" />
          <span>Claro</span>
        </button>
        <button
          type="button"
          aria-label="Ativar tema escuro"
          aria-pressed={theme === 'dark'}
          tabIndex={expanded ? 0 : -1}
          onClick={() => selectTheme('dark')}
          className={`flex h-10 items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset ${theme === 'dark' ? 'bg-brand text-[#1c1008]' : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'}`}
        >
          <Moon aria-hidden="true" className="size-4 shrink-0" />
          <span>Escuro</span>
        </button>
      </div>
      <button
        type="button"
        aria-label={expanded ? 'Recolher seletor de tema' : 'Expandir seletor de tema'}
        aria-expanded={expanded}
        aria-controls="floating-theme-options"
        onClick={() => setExpanded((value) => !value)}
        className={`relative z-10 flex h-14 w-12 shrink-0 items-center justify-center rounded-l-2xl border border-border-color bg-bg-primary/95 text-text-primary shadow-xl backdrop-blur-md transition-[transform,color,background-color] duration-300 ease-out hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset motion-reduce:transition-none ${expanded ? 'translate-x-0' : 'theme-switcher-pulse translate-x-1/4'}`}
      >
        {theme === 'light' ? <Sun aria-hidden="true" className="size-5" /> : <Moon aria-hidden="true" className="size-5" />}
      </button>
    </div>
  );
}
