import { AuthGuard } from '@/components/auth/auth-guard';
import { SuperUserGuard } from '@/components/auth/super-user-guard';
import { SystemConfigManager } from '@/components/system/system-config-manager';

export default function ConfigPage() {
  return (
    <AuthGuard>
      <SuperUserGuard>
        <SystemConfigManager />
      </SuperUserGuard>
    </AuthGuard>
  );
}
