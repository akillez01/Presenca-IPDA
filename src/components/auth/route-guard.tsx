'use client';

import { useAuth } from '@/hooks/use-auth';
import { getUserType, UserType } from '@/lib/auth';
import { NavigationPermission } from '@/lib/user-access';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const DEBUG = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG === 'true';

interface RoutePermission {
  path: string;
  allowedUserTypes: (UserType | string)[];
  allowedRoles?: string[]; // Adicionar suporte para roles do Firestore
  allowedPermissions?: NavigationPermission[];
  redirectPath?: string;
}

// Configuração de permissões por rota
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Rotas para editores e super usuários (relatórios)
  {
    path: '/reports',
    allowedUserTypes: [UserType.EDITOR_USER, UserType.SUPER_USER, 'ADMIN_USER'],
    allowedRoles: ['editor', 'admin', 'super'],
    allowedPermissions: ['reports'],
    redirectPath: '/'
  },
  {
    path: '/admin/users',
    allowedUserTypes: [UserType.SUPER_USER, 'ADMIN_USER'],
    allowedRoles: ['admin', 'super'],
    allowedPermissions: ['admin_users'],
    redirectPath: '/'
  },
  {
    path: '/config',
    allowedUserTypes: [UserType.SUPER_USER, 'ADMIN_USER'],
    allowedRoles: ['admin', 'super'],
    allowedPermissions: ['config'],
    redirectPath: '/'
  },
  
  // Rotas para usuários básicos, editores e super usuários
  {
    path: '/',
    allowedUserTypes: [UserType.BASIC_USER, UserType.BAPTISM_USER, UserType.EDITOR_USER, UserType.SUPER_USER, 'ADMIN_USER'],
    allowedRoles: ['basic_user', 'baptism_user', 'user', 'editor', 'admin', 'super'],
    allowedPermissions: ['dashboard']
  },
  {
    path: '/register',
    allowedUserTypes: [UserType.BASIC_USER, UserType.EDITOR_USER, UserType.SUPER_USER, 'ADMIN_USER'],
    allowedRoles: ['basic_user', 'user', 'editor', 'admin', 'super'],
    allowedPermissions: ['register']
  },
  {
    path: '/presencadecadastrados',
    allowedUserTypes: [UserType.BASIC_USER, UserType.EDITOR_USER, UserType.SUPER_USER, 'ADMIN_USER'],
    allowedRoles: ['basic_user', 'user', 'editor', 'admin', 'super'],
    allowedPermissions: ['presencadecadastrados']
  },
  {
    path: '/cartaderecomendacao',
    allowedUserTypes: [UserType.BASIC_USER, UserType.EDITOR_USER, UserType.SUPER_USER, 'ADMIN_USER'],
    allowedRoles: ['basic_user', 'user', 'editor', 'admin', 'super'],
    allowedPermissions: ['letters']
  },
  {
    path: '/cartaderecomendacao1dia',
    allowedUserTypes: [UserType.BASIC_USER, UserType.EDITOR_USER, UserType.SUPER_USER, 'ADMIN_USER'],
    allowedRoles: ['basic_user', 'user', 'editor', 'admin', 'super'],
    allowedPermissions: ['letters']
  },
  {
    path: '/batismo',
    allowedUserTypes: [UserType.BASIC_USER, UserType.BAPTISM_USER, UserType.EDITOR_USER, UserType.SUPER_USER, 'ADMIN_USER'],
    allowedRoles: ['basic_user', 'baptism_user', 'user', 'editor', 'admin', 'super'],
    allowedPermissions: ['baptism']
  },
  {
    path: '/scanner',
    allowedUserTypes: [UserType.BASIC_USER, UserType.EDITOR_USER, UserType.SUPER_USER, 'ADMIN_USER'],
    allowedRoles: ['basic_user', 'user', 'editor', 'admin', 'super'],
    allowedPermissions: ['scanner']
  },
];

function hasRouteAccess(
  routePermission: RoutePermission,
  userType: UserType | string,
  userRole: string,
  userPermissions: string[]
) {
  if (
    userType === UserType.SUPER_USER ||
    userType === 'ADMIN_USER' ||
    userRole === 'admin' ||
    userRole === 'super'
  ) {
    return true;
  }

  const normalizedPermissions = Array.isArray(userPermissions) ? userPermissions : [];

  if (normalizedPermissions.length > 0 && routePermission.allowedPermissions?.length) {
    return routePermission.allowedPermissions.some((permission) => normalizedPermissions.includes(permission));
  }

  const hasUserTypePermission = routePermission.allowedUserTypes.includes(userType);
  const hasRolePermission = routePermission.allowedRoles?.includes(userRole) || false;
  const hasPermissionClaim = routePermission.allowedPermissions
    ? routePermission.allowedPermissions.some((permission) => normalizedPermissions.includes(permission))
    : false;

  return hasUserTypePermission || hasRolePermission || hasPermissionClaim;
}

interface RouteGuardProps {
  children: React.ReactNode;
  currentPath: string;
}

export function RouteGuard({ children, currentPath }: RouteGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && user) {
      const userClaimsType = (user as any).userType as UserType | undefined;
      const userType = userClaimsType || getUserType(user.email || '');
      const userRole = (user as any).role || 'basic_user';
      const userPermissions = Array.isArray((user as any).permissions) ? (user as any).permissions : [];
      
      if (DEBUG) {
        console.log('🔐 RouteGuard Debug:', {
          currentPath,
          userEmail: user.email,
          userType,
          userRole,
          userPermissions,
          loading
        });
      }
      
      // Encontrar permissão para a rota atual
      const routePermission = ROUTE_PERMISSIONS.find(
        permission => permission.path === currentPath
      );

      if (DEBUG) {
        console.log('🔍 Route Permission:', routePermission);
      }

      // Se não há configuração específica, permitir acesso
      if (!routePermission) {
        if (DEBUG) console.log('✅ Permitindo acesso - nenhuma configuração específica');
        return;
      }

      // Verificar se o tipo de usuário OU role tem permissão
      const hasAccess = hasRouteAccess(routePermission, userType, userRole, userPermissions);

      if (!hasAccess) {
        if (DEBUG) console.log('❌ Acesso negado - nem tipo de usuário nem role permitidos');
        
        // Evitar loop infinito ao redirecionar para a página inicial
        if (currentPath === '/') {
          if (DEBUG) console.log('🔄 Já está na página inicial, não redirecionando');
          return;
        }
        
        const redirectPath = routePermission.redirectPath || '/';
        if (DEBUG) console.log('🔄 Redirecionando para:', redirectPath);
        router.push(redirectPath);
        return;
      } else {
        if (DEBUG) console.log('✅ Acesso permitido', { hasAccess, userPermissions });
      }
    }
  }, [user, loading, currentPath, router]);

  // Unificar saída inicial até montagem para reduzir alterações na árvore
  const showLoading = !mounted || loading;
  if (showLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" suppressHydrationWarning>
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-current border-r-transparent" />
      </div>
    );
  }

  // Não autenticado - AuthGuard controla
  if (!user) return <>{children}</>;

  const userClaimsType = (user as any).userType as UserType | undefined;
  const userType = userClaimsType || getUserType(user.email || '');
  const userRole = (user as any).role || 'basic_user';
  const userPermissions = Array.isArray((user as any).permissions) ? (user as any).permissions : [];
  
  // Encontrar permissão para a rota atual
  const routePermission = ROUTE_PERMISSIONS.find(
    permission => permission.path === currentPath
  );

  if (DEBUG) {
    console.log('🔐 RouteGuard Render Check:', {
      currentPath,
      userEmail: user.email,
      userType,
      userRole,
      routePermission,
      hasAccess: routePermission ? hasRouteAccess(routePermission, userType, userRole, userPermissions) : true
    });
  }

  // Se não há configuração específica, permitir acesso
  if (!routePermission) {
    return <>{children}</>;
  }

  // Verificar se o tipo de usuário OU role tem permissão
  const hasAccess = hasRouteAccess(routePermission, userType, userRole, userPermissions);

  if (!hasAccess) {
  if (DEBUG) console.log('❌ Renderizando Acesso Negado');
    
    // Se estiver na página inicial e não tiver permissão, isso é um problema de configuração
    // Vamos permitir o acesso para evitar loop infinito
    if (currentPath === '/') {
      if (DEBUG) console.log('🚨 PROBLEMA: Usuário não tem permissão para página inicial, permitindo acesso para evitar loop');
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
  
  return hasRouteAccess(routePermission, userType, userRole, userPermissions);
}
