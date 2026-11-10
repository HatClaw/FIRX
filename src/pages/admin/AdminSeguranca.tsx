import { useState } from 'react';
import { useEffect } from 'react';
import { Button, Input, Card, PageHeader } from '@/components/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

export default function AdminSeguranca() {
  const { updatePassword, updateUsername, credentialsUsername } = useAdminAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [newUser, setNewUser] = useState(credentialsUsername);
  const [userPass, setUserPass] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeForm, setActiveForm] = useState<'password' | 'username' | null>(null);

  useEffect(() => {
    if (!msg && !err) return;
    const timeout = window.setTimeout(() => {
      setMsg('');
      setErr('');
    }, 6000);
    return () => window.clearTimeout(timeout);
  }, [msg, err]);

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    setActiveForm('password');
    if (next.length < 8) {
      setErr('Use uma nova senha com pelo menos 8 caracteres.');
      setActiveForm(null);
      return;
    }
    if (next !== confirm) {
      setErr('A confirmação não confere com a nova senha.');
      setActiveForm(null);
      return;
    }
    setLoading(true);
    try {
      await updatePassword(current, next);
      setMsg('Senha alterada com sucesso.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao alterar senha.');
    } finally {
      setLoading(false);
      setActiveForm(null);
    }
  };

  const onChangeUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    setActiveForm('username');
    setLoading(true);
    try {
      await updateUsername(newUser, userPass);
      setMsg('Nome de exibição atualizado.');
      setUserPass('');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao alterar usuário.');
    } finally {
      setLoading(false);
      setActiveForm(null);
    }
  };

  return (
    <div className="max-w-2xl space-y-5 sm:space-y-6">
      <PageHeader title="Segurança" description="Gerencie as credenciais da sua conta administrativa" />

      {(msg || err) && (
        <p
          className={`text-sm rounded-lg px-3 py-2 ${
            err ? 'text-erro bg-erro/10' : 'text-brand bg-brand/10'
          }`}
          role={err ? 'alert' : 'status'}
        >
          {err || msg}
        </p>
      )}

      <Card className="p-5 space-y-4">
        <div>
          <h2 className="font-semibold">Alterar senha</h2>
          <p className="text-sm text-text-secondary mt-1">Escolha uma senha com pelo menos 8 caracteres.</p>
        </div>
        <form onSubmit={onChangePassword} className="space-y-3">
          <Input label="Senha atual" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" disabled={loading} />
          <Input label="Nova senha" type="password" value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="new-password" minLength={8} disabled={loading} />
          <Input label="Confirmar nova senha" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" minLength={8} disabled={loading} />
          <Button type="submit" loading={loading && activeForm === 'password'} disabled={loading && activeForm !== 'password'} className="w-full sm:w-auto">
            Salvar nova senha
          </Button>
        </form>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h2 className="font-semibold">Alterar usuário admin</h2>
          <p className="text-sm text-text-secondary mt-1">Atualize o nome exibido no painel. A identificação de acesso continua sendo o e-mail da conta.</p>
        </div>
        <form onSubmit={onChangeUser} className="space-y-3">
          <Input label="Novo usuário" value={newUser} onChange={(e) => setNewUser(e.target.value)} required autoComplete="username" disabled={loading} />
          <Input label="Confirme com a senha atual" type="password" value={userPass} onChange={(e) => setUserPass(e.target.value)} required autoComplete="current-password" disabled={loading} />
          <Button type="submit" variant="outline" loading={loading && activeForm === 'username'} disabled={loading && activeForm !== 'username'} className="w-full sm:w-auto">
            Atualizar usuário
          </Button>
        </form>
      </Card>
    </div>
  );
}
