'use client';

import { useAuth } from '@/hooks/use-auth';
import { isBasicUser, isSuperUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface BasicUserGuardProps {
  children: React.ReactNode;
  fallbackPath?: string;
  allowSuperUser?: boolean;
}

/**
 * Guard que permite acesso apenas para usuários básicos
 * (e opcionalmente super usuários se allowSuperUser=true)
 */
export function BasicUserGuard({ 
  children, 
  fallbackPath = '/', 
  allowSuperUser = true 
}: BasicUserGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      const userEmail = user.email || '';
      const isBasic = isBasicUser(userEmail);
      const isSuper = isSuperUser(userEmail);
      
      // Se não é usuário básico e não permite super usuário, redirecionar
      if (!isBasic && !(allowSuperUser && isSuper)) {
        router.push(fallbackPath);
        return;
      }
    }
  }, [user, loading, router, fallbackPath, allowSuperUser]);

  // Ainda carregando
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Não autenticado
  if (!user) {
    return null;
  }

  const userEmail = user.email || '';
  const isBasic = isBasicUser(userEmail);
  const isSuper = isSuperUser(userEmail);

  // Verificar se tem permissão
  if (!isBasic && !(allowSuperUser && isSuper)) {
    return null;
  }

  return <>{children}</>;
}
