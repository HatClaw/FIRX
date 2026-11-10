import { useLocation } from 'react-router-dom';

/** Shared attribution displayed on every application route. */
export function GlobalFooter() {
  const { pathname } = useLocation();
  // The public landing page has its own brand and legal footer.
  if (pathname === '/') return null;

  return (
    <footer className="relative z-10 mt-auto flex min-h-14 w-full items-center justify-center border-t border-border-color/70 bg-bg-primary/75 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] pl-4 pr-28 backdrop-blur-sm sm:pr-32">
      <div className="flex max-w-full items-center justify-center gap-2.5 text-xs font-medium text-text-secondary sm:text-sm">
        <span>Desenvolvido por</span>
        <a
          href="https://agenciaafrica.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-text-primary transition-colors hover:text-brand"
        >
          Agência AFRICA
        </a>
      </div>
    </footer>
  );
}
