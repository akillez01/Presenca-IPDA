'use client';

import { useAuth } from '@/hooks/use-auth';
import { getUserType, UserType } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface RoutePermission {
  path: string;
  allowedUserTypes: UserType[];
  allowedRoles?: string[]; // Adicionar suporte para roles do Firestore
  allowedPermissions?: string[];
  redirectPath?: string;
}

// Configuração de permissões por rota
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Rotas para editores e super usuários (relatórios)
  {
    path: '/reports',
    allowedUserTypes: [UserType.EDITOR_USER, UserType.SUPER_USER],
    allowedRoles: ['editor', 'admin', 'super'],
    allowedPermissions: ['reports'],
    redirectPath: '/'
  },
  {
    path: '/admin/users',
    allowedUserTypes: [UserType.SUPER_USER],
    allowedRoles: ['admin', 'super'],
    allowedPermissions: ['admin_users'],
    redirectPath: '/'
  },
  {
    path: '/config',
    allowedUserTypes: [UserType.SUPER_USER],
    allowedRoles: ['admin', 'super'],
    allowedPermissions: ['config'],
    redirectPath: '/'
  },
  
  // Rotas para usuários básicos, editores e super usuários
  {
    path: '/',
    allowedUserTypes: [UserType.BASIC_USER, UserType.EDITOR_USER, UserType.SUPER_USER],
    allowedRoles: ['basic_user', 'user', 'editor', 'admin', 'super'],
    allowedPermissions: ['dashboard']
  },
  {
    path: '/register',
    allowedUserTypes: [UserType.BASIC_USER, UserType.EDITOR_USER, UserType.SUPER_USER],
    allowedRoles: ['basic_user', 'user', 'editor', 'admin', 'super'],
    allowedPermissions: ['register']
  },
  {
    path: '/presencadecadastrados',
    allowedUserTypes: [UserType.BASIC_USER, UserType.EDITOR_USER, UserType.SUPER_USER],
    allowedRoles: ['basic_user', 'user', 'editor', 'admin', 'super'],
    allowedPermissions: ['presencadecadastrados']
  },
  {
    path: '/cartaderecomendacao',
    allowedUserTypes: [UserType.BASIC_USER, UserType.EDITOR_USER, UserType.SUPER_USER],
    allowedRoles: ['basic_user', 'user', 'editor', 'admin', 'super'],
    allowedPermissions: ['letters']
  },
  {
    path: '/cartaderecomendacao1dia',
    allowedUserTypes: [UserType.BASIC_USER, UserType.EDITOR_USER, UserType.SUPER_USER],
    allowedRoles: ['basic_user', 'user', 'editor', 'admin', 'super'],
    allowedPermissions: ['letters']
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
      const userClaimsType = (user as any).userType as UserType | undefined;
      const userType = userClaimsType || getUserType(user.email || '');
      const userRole = (user as any).role || 'basic_user';
      const userPermissions = Array.isArray((user as any).permissions) ? (user as any).permissions : [];
      
      console.log('🔐 RouteGuard Debug:', {
        currentPath,
        userEmail: user.email,
        userType,
        userRole,
        userPermissions,
        loading
      });
      
      // Encontrar permissão para a rota atual
      const routePermission = ROUTE_PERMISSIONS.find(
        permission => permission.path === currentPath
      );

      console.log('🔍 Route Permission:', routePermission);

      // Se não há configuração específica, permitir acesso
      if (!routePermission) {
        console.log('✅ Permitindo acesso - nenhuma configuração específica');
        return;
      }

      // Verificar se o tipo de usuário OU role tem permissão
      const hasUserTypePermission = routePermission.allowedUserTypes.includes(userType);
      const hasRolePermission = routePermission.allowedRoles?.includes(userRole) || false;
      const hasPermissionClaim = routePermission.allowedPermissions ?
        routePermission.allowedPermissions.some(permission => userPermissions.includes(permission)) : false;

      if (!hasUserTypePermission && !hasRolePermission && !hasPermissionClaim) {
        console.log('❌ Acesso negado - nem tipo de usuário nem role permitidos');
        
        // Evitar loop infinito ao redirecionar para a página inicial
        if (currentPath === '/') {
          console.log('🔄 Já está na página inicial, não redirecionando');
          return;
        }
        
        const redirectPath = routePermission.redirectPath || '/';
        console.log('🔄 Redirecionando para:', redirectPath);
        router.push(redirectPath);
        return;
      } else {
        console.log('✅ Acesso permitido', { hasUserTypePermission, hasRolePermission, hasPermissionClaim });
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

  const userClaimsType = (user as any).userType as UserType | undefined;
  const userType = userClaimsType || getUserType(user.email || '');
  const userRole = (user as any).role || 'basic_user';
  const userPermissions = Array.isArray((user as any).permissions) ? (user as any).permissions : [];
  
  // Encontrar permissão para a rota atual
  const routePermission = ROUTE_PERMISSIONS.find(
    permission => permission.path === currentPath
  );

  console.log('🔐 RouteGuard Render Check:', {
    currentPath,
    userEmail: user.email,
    userType,
    userRole,
    routePermission,
    hasUserTypePermission: routePermission ? routePermission.allowedUserTypes.includes(userType) : true,
    hasRolePermission: routePermission ? routePermission.allowedRoles?.includes(userRole) : true,
    hasPermissionClaim: routePermission?.allowedPermissions ? routePermission.allowedPermissions.some(permission => userPermissions.includes(permission)) : true
  });

  // Se não há configuração específica, permitir acesso
  if (!routePermission) {
    return <>{children}</>;
  }

  // Verificar se o tipo de usuário OU role tem permissão
  const hasUserTypePermission = routePermission.allowedUserTypes.includes(userType);
  const hasRolePermission = routePermission.allowedRoles?.includes(userRole) || false;
  const hasPermissionClaim = routePermission.allowedPermissions ? routePermission.allowedPermissions.some(permission => userPermissions.includes(permission)) : false;

  if (!hasUserTypePermission && !hasRolePermission && !hasPermissionClaim) {
    console.log('❌ Renderizando Acesso Negado');
    
    // Se estiver na página inicial e não tiver permissão, isso é um problema de configuração
    // Vamos permitir o acesso para evitar loop infinito
    if (currentPath === '/') {
      console.log('🚨 PROBLEMA: Usuário não tem permissão para página inicial, permitindo acesso para evitar loop');
      return <>{children}</>;
    }
    
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
  
  const userClaimsType = (user as any).userType as UserType | undefined;
  const userType = userClaimsType || getUserType(user.email || '');
  const userRole = (user as any).role || 'basic_user';
  const userPermissions = Array.isArray((user as any).permissions) ? (user as any).permissions : [];
  const routePermission = ROUTE_PERMISSIONS.find(
    permission => permission.path === path
  );

  if (!routePermission) return true;
  
  const hasUserTypePermission = routePermission.allowedUserTypes.includes(userType);
  const hasRolePermission = routePermission.allowedRoles?.includes(userRole) || false;
  const hasPermissionClaim = routePermission.allowedPermissions ? routePermission.allowedPermissions.some(permission => userPermissions.includes(permission)) : false;
  
  return hasUserTypePermission || hasRolePermission || hasPermissionClaim;
}
