import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { supabase } from '@/lib/supabase/client';
import { criarLinkArquivo } from '@/services/file-storage';
import { hasPermission as checkPermission } from '@/lib/permissions';
import type { UserSession, Empresa } from '@/lib/auth-types';

interface AuthContextValue {
  user: UserSession | null;
  empresas: Empresa[];
  empresaAtiva: Empresa | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (nome: string, email: string, senha: string, empresaNome: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  switchEmpresa: (empresaId: string) => void;
  refreshEmpresas: () => Promise<void>;
  updateProfile: (nome: string, avatarPath?: string | null) => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

function displayNameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const meta = user.user_metadata || {};
  return (
    (meta.full_name as string) ||
    (meta.name as string) ||
    (meta.nome as string) ||
    (user.email ? user.email.split('@')[0] : 'Usuario')
  );
}

function getAuthCallbackUrl() {
  const appBaseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL('auth/callback', appBaseUrl).toString();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaAtiva, setEmpresaAtiva] = useState<Empresa | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserCompanies = useCallback(async (userId: string): Promise<Empresa[]> => {
    try {
      const { data, error } = await supabase
        .from('empresa_members')
        .select(`empresa_id, role, empresas (id, nome, cnpj)`)
        .eq('usuario_id', userId)
        .eq('status', 'aceito');

      if (error) {
        console.warn('Falha ao carregar empresas:', error.message);
        setEmpresas([]);
        setEmpresaAtiva(null);
        return [];
      }

      const loadedEmpresas: Empresa[] = (data || []).map((m: any) => ({
        id: m.empresas?.id ?? m.empresa_id,
        nome: m.empresas?.nome ?? 'Empresa',
        cnpj: m.empresas?.cnpj ?? null,
        role: m.role,
      }));
      setEmpresas(loadedEmpresas);

      if (loadedEmpresas.length > 0) {
        const savedId = localStorage.getItem('empresaAtiva');
        const active =
          loadedEmpresas.find((e) => e.id === savedId) || loadedEmpresas[0];
        setEmpresaAtiva(active);
        return loadedEmpresas;
      }
      setEmpresaAtiva(null);
      return loadedEmpresas;
    } catch (err) {
      console.warn('Erro ao carregar empresas', err);
      return [];
    }
  }, []);

  const ensureProfileAndEmpresa = useCallback(
    async (authUser: {
      id: string;
      email?: string | null;
      user_metadata?: Record<string, unknown>;
    }) => {
      const nome = displayNameFromUser(authUser);
      const email = authUser.email || '';

      await supabase.from('profiles').upsert({
        id: authUser.id,
        email,
        nome,
      });

      // A global platform admin is provisioned server-side and does not need a
      // tenant created as a side effect of opening the admin dashboard.
      const { data: isGlobalAdmin } = await supabase.rpc('is_platform_admin');
      if (isGlobalAdmin === true) return;

      // Agency-only accounts should not receive an unrelated commercial tenant.
      const { data: isMarketingMember, error: marketingMembershipError } = await supabase.rpc('is_marketing_member');
      if (!marketingMembershipError && isMarketingMember === true) return;

      const { data: memberships } = await supabase
        .from('empresa_members')
        .select('id')
        .eq('usuario_id', authUser.id)
        .eq('status', 'aceito')
        .limit(1);

      if (memberships && memberships.length > 0) return;

      const empresaNome =
        (authUser.user_metadata?.empresa as string) ||
        `${nome.split(' ')[0]} · Empresa`;

      const { data: novaEmpresa, error: empresaError } = await supabase
        .from('empresas')
        .insert({
          nome: empresaNome,
          responsavel_id: authUser.id,
          configuracoes: {},
        })
        .select('*')
        .single();

      if (empresaError) {
        console.warn('empresa OAuth:', empresaError.message);
        return;
      }

      if (novaEmpresa) {
        await supabase.from('empresa_members').insert({
          empresa_id: novaEmpresa.id,
          usuario_id: authUser.id,
          role: 'admin',
          status: 'aceito',
          aceito_em: new Date().toISOString(),
        });
      }
    },
    []
  );

  const hydrateFromSession = useCallback(
    async (session: {
      user: {
        id: string;
        email?: string | null;
        user_metadata?: Record<string, unknown>;
      };
      access_token: string;
      expires_at?: number;
    }) => {
      await ensureProfileAndEmpresa(session.user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      const loadedEmpresas = await loadUserCompanies(session.user.id);
      const savedId = localStorage.getItem('empresaAtiva');
      const activeEmpresa = loadedEmpresas.find((empresa) => empresa.id === savedId) || loadedEmpresas[0] || null;
      const sessionUser: UserSession = {
        id: session.user.id,
        email: session.user.email || profile?.email || '',
        nome: profile?.nome || displayNameFromUser(session.user),
        avatar_url: profile?.avatar_url || null,
        avatar: profile?.avatar_url
          ? await criarLinkArquivo(profile.avatar_url, 60 * 60).catch(() => undefined)
          : undefined,
        // Application permissions follow the active tenant membership. Platform
        // access remains a separate trusted platform_admins authorization.
        role: (activeEmpresa?.role || (loadedEmpresas.length > 0 ? profile?.role : null) || 'vendedor') as UserSession['role'],
        empresa_id: activeEmpresa?.id || null,
        empresas: loadedEmpresas.map(({ id, nome, role }) => ({ id, nome, role: role || 'vendedor' })),
        token: session.access_token,
        expira_em: String(session.expires_at || ''),
      };
      setUser(sessionUser);
    },
    [ensureProfileAndEmpresa, loadUserCompanies]
  );

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          await hydrateFromSession(session as any);
        }
      } catch (err) {
        console.warn('Erro ao restaurar sessao', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setEmpresas([]);
        setEmpresaAtiva(null);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        try {
          await hydrateFromSession(session as any);
        } catch (e) {
          console.warn('hydrate auth', e);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateFromSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw new Error(`Falha ao autenticar: ${error.message}`);
      if (!data.session) throw new Error('Sessão não criada');
      await hydrateFromSession(data.session as any);
    },
    [hydrateFromSession]
  );

  const loginWithGoogle = useCallback(async () => {
    const redirectTo = getAuthCallbackUrl();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });
    if (error) throw new Error(error.message || 'Falha ao iniciar login com Google');
  }, []);

  const register = useCallback(
    async (nome: string, email: string, senha: string, empresaNome: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome, empresa: empresaNome }, emailRedirectTo: getAuthCallbackUrl() },
      });
      if (error) throw new Error(error.message || 'Falha ao registrar');
      if (!data.user) throw new Error('Usuário não retornado após cadastro');

      if (!data.session) {
        throw new Error(
          'Conta criada. Verifique seu e-mail para confirmar o cadastro e depois faça login.'
        );
      }

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        nome,
      });
      if (profileError) {
        console.warn('profiles upsert:', profileError.message);
      }

      const { data: novaEmpresa, error: empresaError } = await supabase
        .from('empresas')
        .insert({
          nome: empresaNome,
          responsavel_id: data.user.id,
          configuracoes: {},
        })
        .select('*')
        .single();

      if (empresaError) {
        throw new Error(`Conta criada, mas falha ao criar empresa: ${empresaError.message}`);
      }

      if (novaEmpresa) {
        const { error: memberError } = await supabase.from('empresa_members').insert({
          empresa_id: novaEmpresa.id,
          usuario_id: data.user.id,
          role: 'admin',
          status: 'aceito',
          aceito_em: new Date().toISOString(),
        });
        if (memberError) {
          console.warn('empresa_members:', memberError.message);
        }
      }

      const session: UserSession = {
        id: data.user.id,
        email,
        nome,
        role: 'admin',
        empresa_id: novaEmpresa?.id || null,
        empresas: novaEmpresa
          ? [{ id: novaEmpresa.id, nome: empresaNome, role: 'admin' }]
          : [],
        token: data.session?.access_token || '',
        expira_em: String(data.session?.expires_at || ''),
      };

      setUser(session);
      if (novaEmpresa) {
        const emp: Empresa = {
          id: novaEmpresa.id,
          nome: empresaNome,
          cnpj: null,
          role: 'admin',
        };
        setEmpresaAtiva(emp);
        setEmpresas([emp]);
        localStorage.setItem('empresaAtiva', novaEmpresa.id);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setEmpresas([]);
    setEmpresaAtiva(null);
    localStorage.removeItem('empresaAtiva');
  }, []);

  const switchEmpresa = useCallback(
    (empresaId: string) => {
      const empresa = empresas.find((e) => e.id === empresaId);
      if (empresa) {
        setEmpresaAtiva(empresa);
        setUser((current) => current ? {
          ...current,
          role: (empresa.role || 'vendedor') as UserSession['role'],
          empresa_id: empresa.id,
        } : current);
        localStorage.setItem('empresaAtiva', empresaId);
      }
    },
    [empresas]
  );

  const refreshEmpresas = useCallback(async () => {
    if (user) {
      const loadedEmpresas = await loadUserCompanies(user.id);
      const active = loadedEmpresas.find((empresa) => empresa.id === empresaAtiva?.id) || loadedEmpresas[0] || null;
      if (active) {
        setEmpresaAtiva(active);
        setUser((current) => current ? {
          ...current,
          role: (active.role || 'vendedor') as UserSession['role'],
          empresa_id: active.id,
          empresas: loadedEmpresas.map(({ id, nome, role }) => ({ id, nome, role: role || 'vendedor' })),
        } : current);
      } else {
        setEmpresaAtiva(null);
        setUser((current) => current ? { ...current, role: 'vendedor', empresa_id: null, empresas: [] } : current);
      }
    }
  }, [user, empresaAtiva, loadUserCompanies]);

  const updateProfile = useCallback(async (nome: string, avatarPath?: string | null) => {
    if (!user) throw new Error('Entre na sua conta para atualizar o perfil.');
    const updates: { nome: string; avatar_url?: string | null } = { nome: nome.trim() };
    if (avatarPath !== undefined) updates.avatar_url = avatarPath;
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(`Não foi possível salvar o perfil: ${error.message}`);
    if (!data) throw new Error('Perfil não encontrado ou sem permissão para alterá-lo.');

    const path = updates.avatar_url === undefined ? user.avatar_url : updates.avatar_url;
    const avatar = path ? await criarLinkArquivo(path, 60 * 60).catch(() => undefined) : undefined;
    setUser((current) => current ? { ...current, nome: updates.nome, avatar_url: path, avatar } : current);
  }, [user]);

  const refreshAvatar = useCallback(async () => {
    if (!user?.avatar_url) return;
    const avatar = await criarLinkArquivo(user.avatar_url, 60 * 60).catch(() => undefined);
    setUser((current) => current?.id === user.id ? { ...current, avatar } : current);
  }, [user?.id, user?.avatar_url]);

  useEffect(() => {
    if (!user?.avatar_url) return;
    void refreshAvatar();
    const interval = window.setInterval(() => void refreshAvatar(), 50 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [refreshAvatar, user?.avatar_url]);

  const hasPermissionCb = useCallback(
    (permission: string) => {
      const role = empresaAtiva?.role || user?.role;
      if (!role) return false;
      return checkPermission(role as any, permission as any);
    },
    [empresaAtiva?.role, user?.role]
  );

  const value: AuthContextValue = {
    user,
    empresas,
    empresaAtiva,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    loginWithGoogle,
    logout,
    switchEmpresa,
    refreshEmpresas,
    updateProfile,
    hasPermission: hasPermissionCb,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

