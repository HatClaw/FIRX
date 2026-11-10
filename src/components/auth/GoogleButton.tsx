import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type Props = {
  label?: string;
  className?: string;
};

export function GoogleButton({ label = 'Continuar com Google', className }: Props) {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onClick = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha no Google');
      setLoading(false);
    }
  };

  return (
    <div className={cn('w-full space-y-2', className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={cn(
          'w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 min-h-[42px]',
          'rounded-xl border border-border-color bg-bg-primary text-text-primary text-sm font-semibold',
          'hover:bg-bg-tertiary transition-colors pressable',
          'disabled:opacity-60 disabled:pointer-events-none',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand'
        )}
      >
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#EA4335"
            d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 2.9.7 3.6 1.4l2.4-2.4C16.7 3.9 14.6 3 12 3 6.9 3 2.8 7.1 2.8 12.2S6.9 21.4 12 21.4c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.2-1.5H12z"
          />
          <path
            fill="#34A853"
            d="M3.9 14.5l3-1.1c.7 2 2.7 3.4 5.1 3.4 1.4 0 2.6-.5 3.5-1.3l3 2.3c-1.8 1.7-4.2 2.7-6.5 2.7-3.9 0-7.2-2.6-8.1-6z"
          />
          <path
            fill="#4A90E2"
            d="M20.6 12.7c0-.5-.1-.9-.2-1.3H12v3.1h4.8c-.2.9-.8 1.8-1.7 2.4l3 2.3c1.8-1.6 2.5-4 2.5-6.5z"
          />
          <path
            fill="#FBBC05"
            d="M6.9 13.4l-.3-.2-3 1.1C4.5 16.8 7.9 19.5 12 19.5c1.8 0 3.5-.6 4.8-1.6l-3-2.3c-.8.5-1.8.8-2.8.8-2.2 0-4.1-1.5-4.1-3z"
          />
        </svg>
        {loading ? 'Redirecionando…' : label}
      </button>
      {error && (
        <p className="text-xs text-erro text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

