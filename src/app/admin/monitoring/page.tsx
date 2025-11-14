/**
 * Página do Painel de Monitoramento do Sistema
 * Rota: /admin/monitoring
 */

import SystemMonitoringPanel from '@/components/system-monitoring-panel';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Monitoramento do Sistema - IPDA',
  description: 'Painel de monitoramento de backups, rate limiting e auditoria',
};

export default function MonitoringPage() {
  return (
    <div className="container mx-auto p-6">
      <SystemMonitoringPanel />
    </div>
  );
}