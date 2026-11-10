import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Volume2, VolumeX, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileBottomNav } from './MobileBottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { cn } from '@/lib/utils';
import { getRecentDashboardActivity, subscribeToDashboardActivity } from '@/services/dashboard-activity-service';
import { navItems } from '@/config/nav';
import { LiveChat } from '@/components/chat/LiveChat';

export function AppLayout() {
  const { user, logout, empresaAtiva } = useAuth();
  const { isAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; time: string; read: boolean }>>([]);
  const [soundEnabled, setSoundEnabled] = useState(() => typeof window === 'undefined' || localStorage.getItem('growmoney-alert-sound-enabled') !== 'false');
  const [liveAlert, setLiveAlert] = useState<{ id: string; title: string; time: string } | null>(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const chatAvailable = Boolean(empresaAtiva?.id && user?.id && ['admin', 'gestor', 'vendedor'].includes(user.role));
  const audioContextRef = useRef<AudioContext | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenNotificationIds = useRef(new Set<string>());

  const enableAudioFromGesture = useCallback(() => {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return;
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      if (audioContextRef.current.state === 'suspended') void audioContextRef.current.resume();
    } catch {
      // The visual notification remains available when audio is unsupported.
    }
  }, []);

  const playNotificationChime = useCallback(() => {
    if (!soundEnabled) return;
    void (async () => {
      try {
        if (!audioContextRef.current) audioContextRef.current = new AudioContext();
        const context = audioContextRef.current;
        if (context.state === 'suspended') await context.resume();
        if (context.state !== 'running') return;

        const startAt = context.currentTime + 0.02;
        [659.25, 880].forEach((frequency, index) => {
          const start = startAt + index * 0.16;
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(frequency, start);
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.exponentialRampToValueAtTime(0.16, start + 0.035);
          gain.gain.setValueAtTime(0.16, start + 0.11);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(start);
          oscillator.stop(start + 0.29);
        });
      } catch {
        // Browsers may block audio until the user interacts; the visual alert remains active.
      }
    })();
  }, [soundEnabled]);

  const alertIncomingChatMessage = useCallback(() => {
    playNotificationChime();
    const now = new Date();
    const time = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(now);
    setLiveAlert({ id: `chat-${now.getTime()}`, title: 'Nova mensagem no chat ao vivo', time });
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => setLiveAlert(null), 5000);
  }, [playNotificationChime]);

  useEffect(() => {
    const unlockAudio = () => enableAudioFromGesture();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [enableAudioFromGesture]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const activity = await getRecentDashboardActivity(empresaAtiva?.id || null, 8);
      const readIds = new Set<string>(JSON.parse(localStorage.getItem(`growmoney-read-notifications:${user.id}`) || '[]'));
      setNotifications(activity.map((item) => ({
        id: item.id,
        title: `${item.actorName} ${item.action === 'created' ? 'criou' : item.action === 'updated' ? 'alterou' : 'excluiu'} ${item.entity.replace(/[_-]+/g, ' ')}`,
        time: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(item.occurredAt)),
        read: readIds.has(item.id),
      })));
    } catch {
      setNotifications([]);
    }
  }, [empresaAtiva?.id, user]);

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);

  useEffect(() => {
    if (!user?.id) return;
    return subscribeToDashboardActivity(empresaAtiva?.id || null, user.id, isAdmin, (event) => {
      if (seenNotificationIds.current.has(event.id)) return;
      seenNotificationIds.current.add(event.id);
      const time = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo',
      }).format(new Date(event.occurredAt));

      setNotifications((current) => [
        { id: event.id, title: event.title, time, read: false },
        ...current.filter((notification) => notification.id !== event.id),
      ].slice(0, 20));
      setLiveAlert({ id: event.id, title: event.title, time });
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
      alertTimerRef.current = setTimeout(() => setLiveAlert(null), 5000);
      playNotificationChime();
    });
  }, [empresaAtiva?.id, isAdmin, playNotificationChime, user?.id]);

  useEffect(() => () => {
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    if (audioContextRef.current) void audioContextRef.current.close();
  }, []);

  const toggleNotificationSound = () => {
    enableAudioFromGesture();
    setSoundEnabled((enabled) => {
      localStorage.setItem('growmoney-alert-sound-enabled', String(!enabled));
      return !enabled;
    });
  };

  const markNotificationRead = (id: string) => {
    if (!user?.id) return;
    setNotifications((current) => {
      const storageKey = `growmoney-read-notifications:${user.id}`;
      const readIds = new Set<string>(JSON.parse(localStorage.getItem(storageKey) || '[]'));
      readIds.add(id);
      localStorage.setItem(storageKey, JSON.stringify([...readIds].slice(-100)));
      return current.map((notification) => notification.id === id ? { ...notification, read: true } : notification);
    });
  };

  // Fecha drawer mobile ao mudar de rota
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const layoutUser = user ? { name: user.nome, email: user.email, avatar: user.avatar } : undefined;
  const visibleNavItems = [
    ...navItems.map(({ icon: Icon, ...item }) => ({ ...item, icon: <Icon className="w-5 h-5" /> })),
    ...(isAdmin ? [{ label: 'Painel Admin', href: '/admin', icon: <ShieldCheck className="w-5 h-5" />, prominent: true }] : []),
  ];

  return (
    <div className="min-h-dvh bg-transparent">
      <div className="hidden md:block">
        <Sidebar
          items={visibleNavItems}
          user={layoutUser}
          collapsed={sidebarCollapsed}
          onCollapse={setSidebarCollapsed}
        />
      </div>

      <div
        className={cn(
          'md:hidden fixed inset-0 z-50 transition-opacity duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        <div
          className={cn(
            'absolute left-0 top-0 bottom-0 w-[min(100%,20rem)] bg-bg-primary shadow-xl transition-transform duration-300 ease-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <Sidebar
            items={visibleNavItems}
            user={layoutUser}
            embedded
            onCollapse={() => setMobileOpen(false)}
          />
        </div>
      </div>

      <div
        className={cn(
          'transition-[margin-left] duration-300 ease-in-out',
          'md:ml-72',
          sidebarCollapsed && 'md:ml-24'
        )}
      >
        <Header
          onMenuToggle={() => {
            if (window.matchMedia('(max-width: 767px)').matches) {
              setMobileOpen((o) => !o);
            } else {
              setSidebarCollapsed((c) => !c);
            }
          }}
          user={layoutUser}
          notifications={notifications}
          onNotificationRead={markNotificationRead}
          soundEnabled={soundEnabled}
          onToggleSound={toggleNotificationSound}
          chatUnreadCount={chatUnreadCount}
          onOpenChat={chatAvailable ? () => setChatOpen(true) : undefined}
          onLogout={handleLogout}
        />
        <main className="p-4 md:p-6 lg:p-8 mobile-nav-pad animate-in" role="main">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav isAdmin={isAdmin} />
      <LiveChat open={chatOpen} onOpenChange={setChatOpen} onUnreadCount={setChatUnreadCount} onIncomingMessage={alertIncomingChatMessage} />
      {liveAlert && (
        <div
          key={liveAlert.id}
          role="alert"
          aria-live="assertive"
          className="fixed right-4 top-20 z-[80] w-[min(24rem,calc(100vw-2rem))] animate-in rounded-2xl border border-brand/40 bg-bg-primary p-4 shadow-2xl ring-1 ring-brand/20"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-text-primary">Atualização no sistema</p>
              <p className="mt-1 break-words text-sm text-text-primary">{liveAlert.title}</p>
              <p className="mt-1 text-xs text-text-secondary">{liveAlert.time}</p>
            </div>
            <button onClick={() => setLiveAlert(null)} aria-label="Fechar notificação" className="rounded-lg p-1 text-text-secondary hover:bg-bg-tertiary">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

