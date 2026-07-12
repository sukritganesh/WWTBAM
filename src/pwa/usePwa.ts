import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export interface PwaStatus {
  offlineReady: boolean;
  updateAvailable: boolean;
  online: boolean;
  applyUpdate: () => Promise<void>;
}

export function usePwa(): PwaStatus {
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [updater, setUpdater] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onOfflineReady: () => setOfflineReady(true),
      onNeedRefresh: () => setUpdateAvailable(true),
      onRegisteredSW: () => {
        if (navigator.serviceWorker.controller) setOfflineReady(true);
      }
    });
    setUpdater(() => updateSW);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    void navigator.serviceWorker?.ready.then(() => {
      if (navigator.serviceWorker.controller) setOfflineReady(true);
    });
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return {
    offlineReady,
    updateAvailable,
    online,
    applyUpdate: async () => {
      if (updater) await updater(true);
    }
  };
}
