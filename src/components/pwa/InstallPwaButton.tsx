import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredInstallPrompt: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notifyInstallState = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  installed = window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  // Capture beforeinstallprompt as soon as the app bundle loads. Auth may take
  // long enough that the dashboard button mounts after the browser event.
  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    deferredInstallPrompt = event as InstallPromptEvent;
    notifyInstallState();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredInstallPrompt = null;
    notifyInstallState();
  });
}

export function InstallPwaButton({ className }: { className?: string }) {
  const [installPrompt, setInstallPrompt] = useState(deferredInstallPrompt);
  const [isInstalled, setIsInstalled] = useState(installed);

  useEffect(() => {
    const syncState = () => {
      setInstallPrompt(deferredInstallPrompt);
      setIsInstalled(installed);
    };
    listeners.add(syncState);
    syncState();
    return () => { listeners.delete(syncState); };
  }, []);

  if (isInstalled || !installPrompt) return null;

  const install = async () => {
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      deferredInstallPrompt = null;
      notifyInstallState();
    }
  };

  return (
    <Button type="button" variant="outline" onClick={install} className={cn('gap-2', className)}>
      <Download aria-hidden="true" className="h-4 w-4" />
      Instalar app
    </Button>
  );
}
