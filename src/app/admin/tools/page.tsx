/**
 * Página de Ferramentas Avançadas do Sistema
 * Rota: /admin/tools
 */

import AdvancedToolsPanel from '@/components/advanced-tools-panel';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ferramentas Avançadas - IPDA',
  description: 'Operações em massa, export/import e configurações PWA',
};

export default function AdvancedToolsPage() {
  return (
    <div className="container mx-auto p-6">
      <AdvancedToolsPanel />
    </div>
  );
}