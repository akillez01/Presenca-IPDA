'use client';

import { UserManagementPanel } from '@/components/admin/user-management-panel';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { ClientOnly } from '@/components/utils/client-only';

// Forçar renderização dinâmica (não pré-renderizar para export)
export const dynamic = 'force-dynamic';

export default function UsersManagementPage() {
  return (
    <ClientOnly fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    }>
      <ProtectedRoute adminOnly>
        <div className="min-h-screen bg-gray-50">
          <UserManagementPanel />
        </div>
      </ProtectedRoute>
    </ClientOnly>
  );
}