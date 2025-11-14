'use client';

import { UserManagementPanel } from '@/components/admin/user-management-panel';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function UsersManagementPage() {
  return (
    <ProtectedRoute adminOnly>
      <div className="min-h-screen bg-gray-50">
        <UserManagementPanel />
      </div>
    </ProtectedRoute>
  );
}