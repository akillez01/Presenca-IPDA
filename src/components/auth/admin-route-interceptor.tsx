'use client';

import { useAuth } from '@/hooks/use-auth';
import { isSuperUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AdminRouteInterceptor({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Intercepta tentativas de acesso à área admin
    const currentPath = window.location.pathname;
    if (currentPath.includes('/admin') && !loading) {
      if (!user || !isSuperUser(user.email || '')) {
        console.log('🚨 INTERCEPTOR: Acesso não autorizado à área admin - REDIRECIONANDO');
        window.location.replace('/');
      }
    }
  }, [user, loading]);

  // Se estiver carregando, mostrar loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Se não for super usuário, não renderizar nada (já redirecionou)
  if (!user || !isSuperUser(user.email || '')) {
    return null;
  }

  // Se chegou até aqui, é super usuário - mostrar conteúdo
  return <>{children}</>;
}
