/**
 * Hook para integração PWA e Service Worker
 * Gerencia cache offline, sincronização e notificações
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

interface PWAState {
  isOnline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  hasUpdate: boolean;
  isSyncing: boolean;
  offlineData: any[];
  cacheSize: number;
}

interface PWAActions {
  installPWA: () => Promise<void>;
  updateApp: () => Promise<void>;
  syncOfflineData: () => Promise<void>;
  clearCache: () => Promise<void>;
  cacheData: (data: any[]) => Promise<void>;
  getOfflineData: () => Promise<any[]>;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  showNotification: (title: string, options?: NotificationOptions) => Promise<void>;
}

export function usePWA(): PWAState & PWAActions {
  const [state, setState] = useState<PWAState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isInstallable: false,
    isInstalled: false,
    hasUpdate: false,
    isSyncing: false,
    offlineData: [],
    cacheSize: 0
  });

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Registrar Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      registerServiceWorker();
    }
  }, []);

  // Listeners para eventos de conectividade
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      syncOfflineData();
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    // Listener para prompt de instalação
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setState(prev => ({ ...prev, isInstallable: true }));
    };

    // Listener para app instalado
    const handleAppInstalled = () => {
      setState(prev => ({ ...prev, isInstalled: true, isInstallable: false }));
      setDeferredPrompt(null);
      console.log('PWA instalado com sucesso');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Verificar se está instalado como PWA
  useEffect(() => {
    const checkInstalled = () => {
      const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                   (window.navigator as any).standalone ||
                   document.referrer.includes('android-app://');
      
      setState(prev => ({ ...prev, isInstalled: isPWA }));
    };

    checkInstalled();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkInstalled);
    
    return () => {
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', checkInstalled);
    };
  }, []);

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      setRegistration(reg);

      // Verificar updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setState(prev => ({ ...prev, hasUpdate: true }));
            }
          });
        }
      });

      // Listener para mensagens do Service Worker
      navigator.serviceWorker.addEventListener('message', handleSWMessage);

      // Verificar se há update imediatamente
      reg.update();

      console.log('Service Worker registrado com sucesso');
    } catch (error) {
      console.error('Erro ao registrar Service Worker:', error);
    }
  };

  const handleSWMessage = (event: MessageEvent) => {
    const { type, data } = event.data;

    switch (type) {
      case 'SYNC_COMPLETE':
        setState(prev => ({ ...prev, isSyncing: false }));
        console.log('Sincronização offline completa');
        break;

      case 'OFFLINE_DATA':
        setState(prev => ({ ...prev, offlineData: data }));
        break;

      case 'CACHE_CLEARED':
        setState(prev => ({ ...prev, cacheSize: 0 }));
        console.log('Cache limpo com sucesso');
        break;

      case 'CACHE_SIZE_UPDATE':
        setState(prev => ({ ...prev, cacheSize: data.size }));
        break;
    }
  };

  const installPWA = useCallback(async () => {
    if (!deferredPrompt) {
      throw new Error('PWA não pode ser instalado neste momento');
    }

    try {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      
      if (result.outcome === 'accepted') {
        setState(prev => ({ ...prev, isInstallable: false }));
        setDeferredPrompt(null);
      }
    } catch (error) {
      console.error('Erro ao instalar PWA:', error);
      throw error;
    }
  }, [deferredPrompt]);

  const updateApp = useCallback(async () => {
    if (!registration || !registration.waiting) {
      throw new Error('Nenhuma atualização disponível');
    }

    try {
      // Enviar mensagem para o SW pular a espera
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Recarregar a página após a atualização
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      setState(prev => ({ ...prev, hasUpdate: false }));
    } catch (error) {
      console.error('Erro ao atualizar app:', error);
      throw error;
    }
  }, [registration]);

  const syncOfflineData = useCallback(async () => {
    if (!navigator.serviceWorker.controller) {
      throw new Error('Service Worker não disponível');
    }

    setState(prev => ({ ...prev, isSyncing: true }));

    try {
      // Registrar sync para execução em background
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        // @ts-ignore - sync API não está tipado mas existe
        await registration.sync.register('background-sync-attendance');
      } else {
        // Fallback: sync imediato
        const messageChannel = new MessageChannel();
        
        return new Promise<void>((resolve) => {
          messageChannel.port1.onmessage = (event) => {
            if (event.data.type === 'SYNC_COMPLETE') {
              setState(prev => ({ ...prev, isSyncing: false }));
              resolve();
            }
          };

          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage(
              { type: 'FORCE_SYNC' },
              [messageChannel.port2]
            );
          }
        });
      }
    } catch (error) {
      setState(prev => ({ ...prev, isSyncing: false }));
      console.error('Erro ao sincronizar dados offline:', error);
      throw error;
    }
  }, []);

  const clearCache = useCallback(async (): Promise<void> => {
    if (!navigator.serviceWorker.controller) {
      throw new Error('Service Worker não disponível');
    }

    try {
      const messageChannel = new MessageChannel();
      
      return new Promise<void>((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          if (event.data.type === 'CACHE_CLEARED') {
            resolve();
          }
        };

        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage(
            { type: 'CLEAR_CACHE' },
            [messageChannel.port2]
          );
        }
      });
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      throw error;
    }
  }, []);

  const cacheData = useCallback(async (data: any[]) => {
    if (!navigator.serviceWorker.controller) {
      throw new Error('Service Worker não disponível');
    }

    try {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CACHE_ATTENDANCE_DATA',
          data
        });

        console.log('Dados enviados para cache:', data.length, 'registros');
      }
    } catch (error) {
      console.error('Erro ao cachear dados:', error);
      throw error;
    }
  }, []);

  const getOfflineData = useCallback(async (): Promise<any[]> => {
    if (!navigator.serviceWorker.controller) {
      return [];
    }

    try {
      const messageChannel = new MessageChannel();
      
      return new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          if (event.data.type === 'OFFLINE_DATA') {
            resolve(event.data.data || []);
          }
        };

        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage(
            { type: 'GET_OFFLINE_DATA' },
            [messageChannel.port2]
          );
        }
      });
    } catch (error) {
      console.error('Erro ao recuperar dados offline:', error);
      return [];
    }
  }, []);

  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      throw new Error('Notificações não suportadas neste navegador');
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    return permission;
  }, []);

  const showNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    const permission = await requestNotificationPermission();
    
    if (permission !== 'granted') {
      throw new Error('Permissão de notificação negada');
    }

    if ('serviceWorker' in navigator && registration) {
      // Usar Service Worker para notificações (funciona mesmo com app fechado)
      await registration.showNotification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        ...options
      });
    } else {
      // Fallback para notificação normal
      new Notification(title, {
        icon: '/icons/icon-192x192.png',
        ...options
      });
    }
  }, [registration, requestNotificationPermission]);

  return {
    ...state,
    installPWA,
    updateApp,
    syncOfflineData,
    clearCache,
    cacheData,
    getOfflineData,
    requestNotificationPermission,
    showNotification
  };
}

// Hook para notificações de presença
export function usePresenceNotifications() {
  const { showNotification, requestNotificationPermission } = usePWA();

  const notifyAttendanceMarked = useCallback(async (name: string, status: string) => {
    try {
      await showNotification('Presença Registrada', {
        body: `${name} marcado como ${status}`,
        tag: 'attendance-marked',
        icon: '/icons/icon-192x192.png'
      });
    } catch (error) {
      console.log('Erro ao enviar notificação:', error);
    }
  }, [showNotification]);

  const notifySync = useCallback(async (count: number) => {
    try {
      await showNotification('Sincronização Completa', {
        body: `${count} registros sincronizados com sucesso`,
        tag: 'sync-complete',
        icon: '/icons/icon-sync.png'
      });
    } catch (error) {
      console.log('Erro ao enviar notificação de sync:', error);
    }
  }, [showNotification]);

  const notifyOfflineMode = useCallback(async () => {
    try {
      await showNotification('Modo Offline', {
        body: 'Aplicação funcionando offline. Dados serão sincronizados quando voltar online.',
        tag: 'offline-mode',
        icon: '/icons/icon-offline.png'
      });
    } catch (error) {
      console.log('Erro ao enviar notificação offline:', error);
    }
  }, [showNotification]);

  return {
    requestNotificationPermission,
    notifyAttendanceMarked,
    notifySync,
    notifyOfflineMode
  };
}