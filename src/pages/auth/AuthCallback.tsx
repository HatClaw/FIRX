import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { LoadingSpinner } from '@/components/ui';
import { BrandLogo } from '@/components/brand/BrandLogo';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session) {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
          }
        }

        const {
          data: { session: s2 },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (s2) {
          const flow = new URLSearchParams(window.location.search).get('flow');
          if (flow === 'vendor-activation') {
            navigate('/recuperar-senha?redefinir=1&flow=vendor-activation', { replace: true });
            return;
          }
          navigate('/dashboard', { replace: true });
        } else {
          setError('Não foi possível concluir o login. Tente novamente.');
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro no retorno do Google.');
        }
      }
    }

    finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-transparent p-4">
      <BrandLogo linkTo={false} heightClass="h-16" className="opacity-90" />
      {error ? (
        <div className="text-center space-y-3">
          <p className="text-sm text-erro max-w-sm">{error}</p>
          <button
            type="button"
            className="text-sm text-brand hover:underline"
            onClick={() => navigate('/auth', { replace: true })}
          >
            Voltar ao login
          </button>
        </div>
      ) : (
        <>
          <LoadingSpinner />
          <p className="text-sm text-text-secondary">Conectando com o Google…</p>
        </>
      )}
    </div>
  );
}

