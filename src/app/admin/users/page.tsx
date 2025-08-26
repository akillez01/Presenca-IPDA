'use client';

import { UserManagement } from '@/components/admin/user-management';
import { AdminRouteInterceptor } from '@/components/auth/admin-route-interceptor';
import { SuperUserGuard } from '@/components/auth/super-user-guard';

export default function UsersManagementPage() {
  return (
    <AdminRouteInterceptor>
      <SuperUserGuard fallbackUrl="/">
        <div className="container mx-auto py-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Usuários</h1>
              <p className="text-muted-foreground">
                Visualize e gerencie todos os usuários do sistema. Adicione novos usuários com diferentes níveis de permissão.
              </p>
            </div>
            
            {/* Componente unificado de gerenciamento */}
            <UserManagement />
          </div>
        </div>
      </SuperUserGuard>
    </AdminRouteInterceptor>
  );
}
