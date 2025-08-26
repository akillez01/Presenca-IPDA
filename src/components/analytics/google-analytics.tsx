"use client";

import Script from "next/script";
import { useEffect } from "react";

interface GoogleAnalyticsProps {
  measurementId?: string;
}

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  // Retornar null imediatamente se não há measurementId
  if (!measurementId || measurementId === 'undefined' || measurementId.trim() === '') {
    return null;
  }

  useEffect(() => {
    // Verificar se deve inicializar o Analytics
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!measurementId || measurementId === 'undefined') return;
    
    const hostname = window.location.hostname;
    
    // Lista de domínios/padrões inválidos para Analytics
    const invalidPatterns = [
      /^localhost$/,
      /^127\.0\.0\.1$/,
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^\d+\.\d+\.\d+\.\d+$/, // IPs em geral
      /\.local$/,
      /^[^.]+$/, // Hostnames sem domínio
    ];
    
    // Verificar se o domínio é válido
    const isValidDomain = !invalidPatterns.some(pattern => pattern.test(hostname)) && hostname.includes(".");
    
    if (!isValidDomain) {
      return;
    }
    
    // Verificar se é HTTPS em produção
    if (window.location.protocol !== "https:") {
      return;
    }
  }, [measurementId]);
  
  // Não renderizar se não estiver em produção ou sem measurementId válido
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const invalidPatterns = [
      /^localhost$/,
      /^127\.0\.0\.1$/,
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^\d+\.\d+\.\d+\.\d+$/,
      /\.local$/,
      /^[^.]+$/,
    ];
    
    const isInvalidDomain = invalidPatterns.some(pattern => pattern.test(hostname)) || !hostname.includes(".");
    
    if (isInvalidDomain || process.env.NODE_ENV !== "production" || !measurementId || measurementId === 'undefined') {
      return null;
    }
  }
  
  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            
            gtag('config', '${measurementId}', {
              cookie_domain: '${typeof window !== "undefined" ? window.location.hostname : "auto"}',
              cookie_flags: 'SameSite=None;Secure',
              anonymize_ip: true,
              allow_google_signals: false,
              cookie_expires: ${60 * 60 * 24 * 30}, // 30 dias
              page_title: document.title,
              page_location: window.location.href,
              send_page_view: true
            });
          `,
        }}
      />
    </>
  );
}
