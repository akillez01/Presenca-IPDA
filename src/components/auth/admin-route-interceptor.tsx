'use client';

import { useAuth } from '@/hooks/use-auth';
import { isSuperUser } from '@/lib/auth';
import { useEffect } from 'react';

export function AdminRouteInterceptor({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const hasAdminAccess =
    !!user &&
    (
      isSuperUser(user.email || '') ||
      (user as any).role === 'admin' ||
      (user as any).canManageUsers === true ||
      (Array.isArray((user as any).permissions) &&
        ['config', 'admin_users', 'user_management', 'settings'].some((permission) =>
          (user as any).permissions.includes(permission)
        ))
    );

  useEffect(() => {
    // Intercepta tentativas de acesso à área admin
    const currentPath = window.location.pathname;
    if (currentPath.includes('/admin') && !loading) {
      if (!user || !hasAdminAccess) {
        console.log('🚨 INTERCEPTOR: Acesso não autorizado à área admin - REDIRECIONANDO');
        window.location.replace('/');
      }
    }
  }, [user, loading, hasAdminAccess]);

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
  if (!user || !hasAdminAccess) {
    return null;
  }

  // Se chegou até aqui, é super usuário - mostrar conteúdo
  return <>{children}</>;
}
