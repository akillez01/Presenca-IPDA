'use client';

import { AttendanceMonitoringPanel } from '@/components/attendance/monitoring-panel';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function MonitoringPage() {
  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-gray-50">
        <AttendanceMonitoringPanel />
      </div>
    </ProtectedRoute>
  );
}