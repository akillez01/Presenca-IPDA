'use client';

import { useAuth } from '@/hooks/use-auth';
import { getUserType, UserType } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface RoutePermission {
  path: string;
  allowedUserTypes: UserType[];
  redirectPath?: string;
}

// Configuração de permissões por rota
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Rotas apenas para super usuários
  {
    path: '/reports',
    allowedUserTypes: [UserType.SUPER_USER],
    redirectPath: '/'
  },
  {
    path: '/admin/users',
    allowedUserTypes: [UserType.SUPER_USER],
    redirectPath: '/'
  },
  {
    path: '/config',
    allowedUserTypes: [UserType.SUPER_USER],
    redirectPath: '/'
  },
  
  // Rotas para usuários básicos e super usuários
  {
    path: '/',
    allowedUserTypes: [UserType.BASIC_USER, UserType.SUPER_USER]
  },
  {
    path: '/register',
    allowedUserTypes: [UserType.BASIC_USER, UserType.SUPER_USER]
  },
  {
    path: '/presencadecadastrados',
    allowedUserTypes: [UserType.BASIC_USER, UserType.SUPER_USER]
  },
  {
    path: '/cartaderecomendacao',
    allowedUserTypes: [UserType.BASIC_USER, UserType.SUPER_USER]
  },
  {
    path: '/cartaderecomendacao1dia',
    allowedUserTypes: [UserType.BASIC_USER, UserType.SUPER_USER]
  }
];

interface RouteGuardProps {
  children: React.ReactNode;
  currentPath: string;
}

export function RouteGuard({ children, currentPath }: RouteGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      const userType = getUserType(user.email || '');
      
      // Encontrar permissão para a rota atual
      const routePermission = ROUTE_PERMISSIONS.find(
        permission => permission.path === currentPath
      );

      // Se não há configuração específica, permitir acesso
      if (!routePermission) {
        return;
      }

      // Verificar se o tipo de usuário tem permissão
      if (!routePermission.allowedUserTypes.includes(userType)) {
        const redirectPath = routePermission.redirectPath || '/';
        router.push(redirectPath);
        return;
      }
    }
  }, [user, loading, currentPath, router]);

  // Ainda carregando
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Não autenticado - deixar o AuthGuard lidar com isso
  if (!user) {
    return <>{children}</>;
  }

  const userType = getUserType(user.email || '');
  
  // Encontrar permissão para a rota atual
  const routePermission = ROUTE_PERMISSIONS.find(
    permission => permission.path === currentPath
  );

  // Se não há configuração específica, permitir acesso
  if (!routePermission) {
    return <>{children}</>;
  }

  // Verificar se o tipo de usuário tem permissão
  if (!routePermission.allowedUserTypes.includes(userType)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Acesso Negado</h2>
          <p className="text-gray-600 mb-6">
            Você não tem permissão para acessar esta página.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Hook para verificar permissões
export function useRoutePermission(path: string) {
  const { user } = useAuth();
  
  if (!user) return false;
  
  const userType = getUserType(user.email || '');
  const routePermission = ROUTE_PERMISSIONS.find(
    permission => permission.path === path
  );

  if (!routePermission) return true;
  
  return routePermission.allowedUserTypes.includes(userType);
}
