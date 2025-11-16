'use client';

import { AuthGuard } from '@/components/auth/auth-guard';
import { RouteGuard } from '@/components/auth/route-guard';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Header } from '@/components/layout/header';
import { SidebarProvider } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const publicRoutes = ['/login', '/register', '/forgot-password'];

const DEBUG = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG === 'true';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isPublicRoute = pathname ? publicRoutes.some(route => 
    pathname.startsWith(route)
  ) : false;

  if (DEBUG && mounted) {
    console.log('🔧 ClientLayout Debug:', { pathname, isPublicRoute });
  }

  // Renderiza wrapper genérico durante SSR/hidratação para evitar mismatch
  if (!mounted) {
    return (
      <div suppressHydrationWarning>
        {children}
      </div>
    );
  }

  if (isPublicRoute) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        {children}
      </div>
    );
  }

  return (
    <AuthGuard>
      <RouteGuard currentPath={pathname ?? ''}>
        <SidebarProvider defaultOpen={false}>
          <div className="flex min-h-screen" suppressHydrationWarning>
            <AppSidebar />
            <div className="flex-1">
              <Header />
              <main className="p-4 sm:p-6 md:p-8">
                {children}
              </main>
            </div>
          </div>
        </SidebarProvider>
      </RouteGuard>
    </AuthGuard>
  );
}