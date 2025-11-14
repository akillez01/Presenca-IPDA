import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { Toaster } from '@/components/ui/toaster';
import type { Metadata } from 'next';
import { ClientLayout } from './client-layout';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://ipda.app.br'),
  title: {
    default: 'IPDA - Sistema de Presença',
    template: '%s | IPDA'
  },
  description: 'Sistema de controle de presença para Igreja Pentecostal Deus é Amor',
  icons: [
    {
      rel: 'icon',
      type: 'image/png',
      url: '/images/logodeuseamor.png',
      sizes: '32x32'
    },
    {
      rel: 'icon',
      type: 'image/png',
      url: '/images/logodeuseamor.png',
      sizes: '192x192'
    },
    {
      rel: 'apple-touch-icon',
      url: '/images/logodeuseamor.png',
      sizes: '180x180'
    }
  ],
  openGraph: {
    title: 'IPDA - Sistema de Presença',
    description: 'Sistema de controle de presença para Igreja Pentecostal Deus é Amor',
    images: [
      {
        url: '/images/logodeuseamor.png',
        width: 1200,
        height: 630,
        alt: 'Logo IPDA'
      }
    ],
    url: '/',
    siteName: 'IPDA - Sistema de Presença',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IPDA - Sistema de Presença',
    description: 'Sistema de controle de presença para Igreja Pentecostal Deus é Amor',
    images: ['/images/logodeuseamor.png'],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="IPDA Presença" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        
        {/* Preload de fontes */}
        <link 
          rel="preload" 
          href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" 
          as="style" 
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap"
          media="all"
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap"
          />
        </noscript>
      </head>
      <body className="font-body bg-background antialiased min-h-screen w-full" suppressHydrationWarning>
        {process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID && (
          <GoogleAnalytics 
            measurementId={process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID} 
          />
        )}
        <ClientLayout>{children}</ClientLayout>
        <Toaster />
      </body>
    </html>
  );
}