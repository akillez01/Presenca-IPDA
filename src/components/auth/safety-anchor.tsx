'use client';

import { useEffect } from 'react';

interface SafetyAnchorProps {
  targetUrl?: string;
  delay?: number;
}

export function SafetyAnchor({ targetUrl = '/', delay = 2000 }: SafetyAnchorProps) {
  useEffect(() => {
    console.log('⚓ Safety Anchor ativo - garantindo redirecionamento');
    
    // Função que FORÇA redirecionamento sem falha
    const forceRedirect = () => {
      try {
        // Método 1: Mais direto possível
        window.location = targetUrl as any;
      } catch (error) {
        try {
          // Método 2: Replace
          window.location.replace(targetUrl);
        } catch (error2) {
          try {
            // Método 3: Href
            window.location.href = targetUrl;
          } catch (error3) {
            try {
              // Método 4: Assign
              window.location.assign(targetUrl);
            } catch (error4) {
              // Método 5: Último recurso - recarregar na raiz
              console.error('🚨 Todos os métodos de redirecionamento falharam - recarregando');
              window.location.reload();
            }
          }
        }
      }
    };

    // Executar após delay
    const timer = setTimeout(forceRedirect, delay);
    
    // Também executar imediatamente se detectar que está em página admin
    if (window.location.pathname.includes('/admin')) {
      console.log('⚓ Detectada página admin - redirecionamento imediato');
      forceRedirect();
    }

    return () => clearTimeout(timer);
  }, [targetUrl, delay]);

  return null; // Componente invisível
}

// Hook que pode ser usado em qualquer lugar
export function useSafetyRedirect(shouldRedirect: boolean, targetUrl: string = '/') {
  useEffect(() => {
    if (shouldRedirect) {
      console.log('🔒 useSafetyRedirect ativo - redirecionando para:', targetUrl);
      
      // Tentativas sequenciais com delays
      setTimeout(() => window.location.replace(targetUrl), 100);
      setTimeout(() => window.location.href = targetUrl, 500);
      setTimeout(() => window.location.assign(targetUrl), 1000);
      setTimeout(() => { window.location = targetUrl as any; }, 1500);
    }
  }, [shouldRedirect, targetUrl]);
}

// Componente que monitora e força redirecionamento se user ficar na página admin
export function AdminPageMonitor() {
  useEffect(() => {
    const checkAndRedirect = () => {
      const currentPath = window.location.pathname;
      
      // Se ainda estiver em página admin após alguns segundos, forçar saída
      if (currentPath.includes('/admin')) {
        console.log('🚨 AdminPageMonitor: Ainda em página admin - FORÇANDO SAÍDA');
        
        // Limpeza + redirecionamento
        localStorage.clear();
        sessionStorage.clear();
        
        // Múltiplas tentativas
        window.location.replace('/');
        setTimeout(() => window.location.href = '/', 200);
        setTimeout(() => window.location.assign('/'), 400);
        setTimeout(() => { window.location = '/' as any; }, 600);
      }
    };

    // Verificar após 3 segundos
    const timer = setTimeout(checkAndRedirect, 3000);
    
    return () => clearTimeout(timer);
  }, []);

  return null;
}
