import { analytics } from '@/lib/firebase';
import { useEffect, useState } from 'react';

export function useAnalytics() {
  const [isAnalyticsReady, setIsAnalyticsReady] = useState(false);  useEffect(() => {
    // Só habilitar analytics em produção e com domínio válido
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isLocalhost = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
       window.location.hostname === '127.0.0.1' ||
       window.location.hostname.includes('.local'));

    if (isDevelopment || isLocalhost) {
      return;
    }

    if (analytics) {
      setIsAnalyticsReady(true);
    }
  }, []);

  const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
    if (isAnalyticsReady && analytics) {
      try {
        // Só usar analytics se estiver realmente disponível
        import('firebase/analytics').then(({ logEvent }) => {
          if (analytics) {
            logEvent(analytics, eventName, parameters);
          }
        }).catch(() => {
          // Silently fail in production
        });
      } catch {
        // Silently fail in production
      }
    }
  };

  return {
    isAnalyticsReady,
    trackEvent,
  };
}
