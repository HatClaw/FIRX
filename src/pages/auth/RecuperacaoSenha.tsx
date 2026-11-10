import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase/client';

export default function RecuperacaoSenha() {
  const navigate = useNavigate();
  const resetMode = new URLSearchParams(window.location.search).get('redefinir') === '1';
  const vendorActivation = new URLSearchParams(window.location.search).get('flow') === 'vendor-activation';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      if (resetMode) {
        if (password.length < 8) throw new Error('A nova senha deve ter pelo menos 8 caracteres.');
        if (password !== confirmation) throw new Error('As senhas não coincidem.');
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        if (vendorActivation) {
          const { data, error: notificationError } = await supabase.functions.invoke('smtp-mailer', {
            body: { action: 'notify_vendor_activated' },
          });
          const notificationFailed = notificationError || data?.notifications?.some((result: { notified?: boolean }) => !result.notified);
          setNotice(notificationFailed
            ? 'Senha definida e cadastro ativado. O envio do aviso ao administrador ficou pendente.'
            : 'Senha definida e cadastro ativado. Você já pode acessar a área do vendedor.');
          window.setTimeout(() => navigate('/dashboard', { replace: true }), 1800);
        } else {
          setNotice('Senha alterada. Você já pode entrar com a nova senha.');
          window.setTimeout(() => navigate('/auth', { replace: true }), 1200);
        }
      } else {
        if (!email.trim()) throw new Error('Informe o e-mail da sua conta.');
        const base = new URL(import.meta.env.BASE_URL, window.location.origin);
        const redirectTo = new URL('recuperar-senha?redefinir=1', base).toString();
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (resetError) throw resetError;
        setNotice('Se existir uma conta para este e-mail, enviaremos o link de redefinição.');
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível concluir a solicitação.');
    } finally { setBusy(false); }
  };

  return <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-transparent px-4 py-6">
    <div className="w-full max-w-md rounded-lg border border-border-color bg-bg-secondary p-6 shadow-sm sm:p-8">
      <div className="mb-6 text-center"><h1 className="text-2xl font-bold text-text-primary">{vendorActivation ? 'Ative seu cadastro' : resetMode ? 'Definir nova senha' : 'Recuperar senha'}</h1><p className="mt-1 text-sm text-text-secondary">{vendorActivation ? 'Crie uma senha para concluir a ativação da sua conta de vendedor.' : resetMode ? 'Escolha uma senha segura para sua conta.' : 'Enviaremos instruções para seu e-mail.'}</p></div>
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        {resetMode ? <><Input label="Nova senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} leftIcon={<Lock className="h-4 w-4" />} autoComplete="new-password" minLength={8} required /><Input label="Confirme a senha" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} leftIcon={<Lock className="h-4 w-4" />} autoComplete="new-password" minLength={8} required /></> : <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} leftIcon={<Mail className="h-4 w-4" />} autoComplete="email" required />}
        {error && <p className="text-sm text-erro" role="alert">{error}</p>}
        {notice && <p className="text-sm text-brand" role="status">{notice}</p>}
        <Button type="submit" className="w-full" loading={busy}>{vendorActivation ? 'Definir senha e ativar cadastro' : resetMode ? 'Alterar senha' : 'Enviar instruções'}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-text-secondary"><Link to="/auth" className="inline-flex items-center gap-1 text-verde-discreto hover:underline"><ArrowLeft className="h-4 w-4" /> Voltar ao login</Link></p>
    </div>
  </div>;
}
