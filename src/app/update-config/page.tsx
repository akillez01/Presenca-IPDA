import { AuthGuard } from '@/components/auth/auth-guard';
import { SuperUserGuard } from '@/components/auth/super-user-guard';
import ConfigUpdater from '@/components/system/config-updater';

export default function UpdateConfigPage() {
  return (
    <AuthGuard>
      <SuperUserGuard>
        <div className="container mx-auto p-6">
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold">Atualizar Configurações</h1>
              <p className="text-muted-foreground">
                Atualize as configurações do sistema com os novos cargos na igreja
              </p>
            </div>
          
            <ConfigUpdater />
          </div>
        </div>
      </SuperUserGuard>
    </AuthGuard>
  );
}
