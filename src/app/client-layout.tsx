'use client';

import { AuthGuard } from '@/components/auth/auth-guard';
import { RouteGuard } from '@/components/auth/route-guard';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Header } from '@/components/layout/header';
import { SidebarProvider } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const DEBUG = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG === 'true';

// Rotas públicas: acessíveis sem login, sem o menu/sidebar interno do sistema.
const PUBLIC_PATHS: string[] = [];

// O build do Plesk usa trailingSlash: true, então em produção o pathname vem
// com barra final (ex.: "/login/"); em dev/local vem sem barra.
function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // No Android (Capacitor), a StatusBar pode sobrepor o WebView e esconder o header.
    // Forçamos "não sobrepor" no runtime para garantir consistência entre dispositivos.
    const isCapacitorNative =
      typeof window !== 'undefined' &&
      Boolean((window as any).Capacitor?.isNativePlatform?.() || (window as any).Capacitor);
    if (!isCapacitorNative) return;

    (async () => {
      try {
        const mod = await import('@capacitor/status-bar');
        const StatusBar = mod.StatusBar;
        const Style = mod.Style;
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#3b82f6' });
      } catch {
        // No-op: se o plugin não estiver disponível, seguimos sem ajustar.
      }
    })();
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (DEBUG) {
    console.log('🔧 ClientLayout Debug:', { pathname });
  }

  // Evita mismatch de hidratação: só renderiza após montar no cliente
  if (!mounted) return null;

  // Páginas públicas ficam fora do shell autenticado (sem sidebar/header/AuthGuard)
  if (pathname && PUBLIC_PATHS.includes(normalizePath(pathname))) {
    return <>{children}</>;
  }

  return (
    // Deixar aberto por padrão melhora a UX e evita percepção de "sumiu o menu"
    <SidebarProvider defaultOpen={true} suppressHydrationWarning>
      <div className="flex min-h-screen w-full" suppressHydrationWarning>
        <AppSidebar />
        <div className="flex-1 min-w-0">
          <Header />
          <main className="p-4 sm:p-6 md:p-8">
            <AuthGuard>
              <RouteGuard currentPath={pathname ?? ''}>
                {children}
              </RouteGuard>
            </AuthGuard>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
