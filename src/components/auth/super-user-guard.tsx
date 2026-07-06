'use client';

import { useAuth } from '@/hooks/use-auth';
import { isSuperUser } from '@/lib/auth';
import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { EmergencyEscape } from './emergency-escape';

interface SuperUserGuardProps {
  children: React.ReactNode;
  fallbackUrl?: string;
}

export function SuperUserGuard({ children, fallbackUrl = '/' }: SuperUserGuardProps) {
  const { user, loading } = useAuth();

  const hasAdminAccess = Boolean(
    user &&
      (
        isSuperUser(user.email || '') ||
        (user as any).role === 'admin' ||
        (user as any).canManageUsers === true ||
        (Array.isArray((user as any).permissions) &&
          ['config', 'admin_users', 'user_management', 'settings'].some((permission) =>
            (user as any).permissions.includes(permission)
          ))
      )
  );

  useEffect(() => {
    // REDIRECIONAMENTO IMEDIATO E MÚLTIPLO para usuários não autorizados
    if (!loading) {
      if (!user) {
        console.log('🚨 Usuário não logado - redirecionamento imediato');
        // Múltiplas tentativas de redirecionamento
        setTimeout(() => window.location.replace('/'), 100);
        setTimeout(() => window.location.href = '/', 500);
        setTimeout(() => window.location.assign('/'), 1000);
        return;
      }
      
      if (user && !hasAdminAccess) {
        console.log('🚨 Usuário sem permissão - redirecionamento imediato');
        // Múltiplas tentativas de redirecionamento  
        setTimeout(() => window.location.replace(fallbackUrl), 100);
        setTimeout(() => window.location.href = fallbackUrl, 500);
        setTimeout(() => window.location.assign(fallbackUrl), 1000);
        return;
      }
    }
  }, [user, loading, fallbackUrl, hasAdminAccess]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6 text-center">
            <div className="space-y-4">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500" />
              <div className="space-y-2">
                <h3 className="font-semibold">Verificando Permissões</h3>
                <p className="text-sm text-muted-foreground">
                  Aguarde enquanto validamos seu acesso...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <EmergencyEscape />;
  }

  // Not a super user
  if (!hasAdminAccess) {
    return <EmergencyEscape />;
  }

  // Admin - show content
  return <>{children}</>;
}
