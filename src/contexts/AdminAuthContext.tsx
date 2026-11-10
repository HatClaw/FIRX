import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase/client';
import type { AdminSession } from '@/lib/admin-auth';

interface AdminAuthValue {
  session: AdminSession | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updatePassword: (current: string, next: string) => Promise<void>;
  updateUsername: (username: string, password: string) => Promise<void>;
  credentialsUsername: string;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}

function toAdminSession(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  last_sign_in_at?: string;
} | null): AdminSession | null {
  if (!user) return null;
  const email = user.email || '';
  return {
    id: user.id,
    email,
    username: String(user.user_metadata?.full_name || email || 'Administrador'),
    loggedAt: user.last_sign_in_at || new Date().toISOString(),
  };
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAdminSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        setSession(null);
        return;
      }
      const { data: authorized, error: authorizationError } = await supabase.rpc('is_platform_admin');
      setSession(authorizationError || authorized !== true
        ? null
        : toAdminSession(data.user as Parameters<typeof toAdminSession>[0]));
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void refreshAdminSession().finally(() => {
      if (mounted) setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        setSession(null);
        return;
      }
      window.setTimeout(() => { if (mounted) void refreshAdminSession(); }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refreshAdminSession]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error('E-mail ou senha inválidos.');
    const { data: authorized, error: authorizationError } = await supabase.rpc('is_platform_admin');
    const adminSession = !authorizationError && authorized === true ? toAdminSession(data.user) : null;
    if (!adminSession) {
      await supabase.auth.signOut();
      throw new Error('Esta conta não possui acesso administrativo à plataforma.');
    }
    setSession(adminSession);
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    setSession(null);
    if (error) throw new Error(`Falha ao encerrar sessão: ${error.message}`);
  }, []);

  const updatePassword = useCallback(async (current: string, next: string) => {
    if (next.length < 8) throw new Error('A nova senha deve ter pelo menos 8 caracteres.');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.email) throw new Error('Sessão expirada. Entre novamente.');
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
    if (verifyError) throw new Error('Senha atual incorreta.');
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) throw new Error(`Falha ao alterar senha: ${error.message}`);
  }, []);

  const updateUsername = useCallback(async (username: string, password: string) => {
    const cleanUsername = username.trim();
    if (!cleanUsername) throw new Error('Nome inválido.');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.email) throw new Error('Sessão expirada. Entre novamente.');
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (verifyError) throw new Error('Senha atual incorreta.');
    const { error } = await supabase.auth.updateUser({ data: { full_name: cleanUsername } });
    if (error) throw new Error(`Falha ao alterar nome: ${error.message}`);
    await refreshAdminSession();
  }, [refreshAdminSession]);

  const value: AdminAuthValue = {
    session,
    isAdmin: !!session,
    isLoading,
    login,
    logout,
    updatePassword,
    updateUsername,
    credentialsUsername: session?.username || '',
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
