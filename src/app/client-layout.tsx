'use client';

import { AuthGuard } from '@/components/auth/auth-guard';
import { RouteGuard } from '@/components/auth/route-guard';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Header } from '@/components/layout/header';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { SidebarProvider } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

const publicRoutes = ['/login', '/register', '/forgot-password'];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isPublicRoute = pathname ? publicRoutes.some(route => 
    pathname.startsWith(route)
  ) : false;

  console.log('🔧 ClientLayout Debug:', { pathname, isPublicRoute });

  if (isPublicRoute) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20" suppressHydrationWarning>
        <Suspense fallback={<LoadingSpinner fullScreen />}>
          {children}
        </Suspense>
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
                <Suspense fallback={<LoadingSpinner />}>
                  {children}
                </Suspense>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </RouteGuard>
    </AuthGuard>
  );
}