'use client';

import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return; // Aguardar carregamento
    
    // Se não estiver logado e não estiver na página de login, redirecionar para login
    if (!user && pathname !== '/login' && pathname !== '/login/') {
      router.replace('/login');
      return;
    }
    
    // Se estiver logado e na página de login, redirecionar para home
    if (user && (pathname === '/login' || pathname === '/login/')) {
      router.replace('/');
      return;
    }
  }, [user, loading, router, pathname]);

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Se não estiver logado e estiver tentando acessar página protegida, mostrar loading
  if (!user && pathname !== '/login' && pathname !== '/login/') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Redirecionando para login...</p>
        </div>
      </div>
    );
  }

  // Se estiver na página de login mas já logado, mostrar loading durante redirecionamento
  if (user && (pathname === '/login' || pathname === '/login/')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Login bem-sucedido! Redirecionando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
