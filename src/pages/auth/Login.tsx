import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Card } from '@/components/ui';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { BRAND } from '@/lib/brand';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { InstallPwaButton } from '@/components/pwa/InstallPwaButton';
import { BrandLogo } from '@/components/brand/BrandLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('auth-layout-active');
    return () => document.body.classList.remove('auth-layout-active');
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Erro ao entrar. Verifique e-mail e senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-screen w-full flex items-center justify-center bg-transparent overflow-x-clip px-3 py-[max(.5rem,env(safe-area-inset-top))] pb-[max(.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3">
      <Card className="auth-card w-full max-w-md !border-border-color !bg-bg-primary/90 !shadow-lg backdrop-blur-xl p-4 sm:p-6 md:p-7">
        <div className="auth-brand text-center mb-4 sm:mb-5 space-y-2">
          <BrandLogo linkTo={false} heightClass="h-auto max-h-[min(14svh,88px)]" className="auth-logo mx-auto w-full max-w-[min(100%,260px)]" />
          <p className="auth-tagline text-text-secondary text-xs leading-4">{BRAND.tagline}</p>
        </div>

        <GoogleButton label="Entrar com Google" className="auth-google" />

        <div className="auth-divider relative my-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-color" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-bg-primary px-2 text-text-secondary">ou e-mail</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form space-y-3">
          <Input
            type="email"
            label="E-mail"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
            autoComplete="email"
          />
          <Input
            type={showPassword ? 'text' : 'password'}
            label="Senha"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            required
            autoComplete="current-password"
          />
          {error && (
            <p className="text-sm text-erro" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="w-full" loading={loading}>
            Entrar
          </Button>
        </form>

        <div className="auth-footer mt-3 text-center text-sm">
          <Link to="/recuperar-senha" className="text-verde-discreto hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        <div className="auth-footer mt-1 text-center text-sm text-text-secondary">
          Não tem conta?{' '}
          <Link to="/cadastro" className="text-verde-discreto hover:underline">
            Cadastre-se
          </Link>
        </div>
        <InstallPwaButton className="auth-pwa mt-3 w-full" />
      </Card>
    </main>
  );
}

