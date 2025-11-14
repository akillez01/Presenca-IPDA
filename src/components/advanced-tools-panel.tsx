/**
 * Painel de Ferramentas Avançadas
 * Integra PWA, Bulk Operations, Export/Import e outras funcionalidades
 */

'use client';

import BulkOperationsManager from '@/components/bulk-operations-manager';
import ExportImportManager from '@/components/export-import-manager';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { usePWA } from '@/hooks/use-pwa';
import {
    BarChart3,
    BookOpen,
    Database,
    Download,
    Layers,
    Settings,
    Shield,
    Smartphone,
    Upload,
    Wifi,
    Wrench,
    Zap
} from 'lucide-react';
import { useState } from 'react';

export default function AdvancedToolsPanel() {
  const { user } = useAuth();
  const pwa = usePWA();
  const [activeTab, setActiveTab] = useState('bulk-operations');

  if (!user) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Você precisa estar logado para acessar as ferramentas avançadas.
        </AlertDescription>
      </Alert>
    );
  }

  const isAdmin = user.role === 'admin';

  if (!isAdmin) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Acesso restrito a administradores do sistema.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Ferramentas Avançadas</h1>
          <p className="text-gray-600 mt-2">
            Operações em massa, export/import, PWA e funcionalidades administrativas
          </p>
        </div>
        
        {/* Status PWA */}
        <div className="flex gap-2">
          <Badge variant={pwa.isOnline ? "default" : "destructive"} className="flex items-center gap-1">
            <Wifi className="h-3 w-3" />
            {pwa.isOnline ? 'Online' : 'Offline'}
          </Badge>
          
          {pwa.isInstalled && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Smartphone className="h-3 w-3" />
              PWA Instalado
            </Badge>
          )}
          
          {pwa.isSyncing && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              Sincronizando
            </Badge>
          )}
        </div>
      </div>

      {/* Resumo das Funcionalidades */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PWA Status</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pwa.isInstalled ? 'Ativo' : 'Disponível'}
            </div>
            <p className="text-xs text-muted-foreground">
              Cache: {(pwa.cacheSize / 1024 / 1024).toFixed(2)} MB
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dados Offline</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pwa.offlineData.length}</div>
            <p className="text-xs text-muted-foreground">
              Registros em cache
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operações</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Disponível</div>
            <p className="text-xs text-muted-foreground">
              Bulk ops e import/export
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs das Ferramentas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="bulk-operations" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Bulk Operations
          </TabsTrigger>
          <TabsTrigger value="export-import" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export/Import
          </TabsTrigger>
          <TabsTrigger value="pwa-config" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            PWA Config
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bulk-operations" className="space-y-4">
          <BulkOperationsManager
            collectionName="presencas"
            userId={user.uid}
            onOperationComplete={(result) => {
              console.log('Bulk operation completed:', result);
            }}
          />
        </TabsContent>

        <TabsContent value="export-import" className="space-y-4">
          <ExportImportManager
            collectionName="presencas"
            userId={user.uid}
            onOperationComplete={(result) => {
              console.log('Export/Import completed:', result);
            }}
          />
        </TabsContent>

        <TabsContent value="pwa-config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Configurações PWA
              </CardTitle>
              <CardDescription>
                Gerencie as funcionalidades Progressive Web App
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status PWA Detalhado */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Status da Aplicação</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Online:</span>
                      <Badge variant={pwa.isOnline ? "default" : "destructive"}>
                        {pwa.isOnline ? 'Sim' : 'Não'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Instalável:</span>
                      <Badge variant={pwa.isInstallable ? "default" : "secondary"}>
                        {pwa.isInstallable ? 'Sim' : 'Não'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Instalado:</span>
                      <Badge variant={pwa.isInstalled ? "default" : "secondary"}>
                        {pwa.isInstalled ? 'Sim' : 'Não'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Atualização:</span>
                      <Badge variant={pwa.hasUpdate ? "destructive" : "default"}>
                        {pwa.hasUpdate ? 'Disponível' : 'Atualizado'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Cache e Dados</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Tamanho do Cache:</span>
                      <span>{(pwa.cacheSize / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dados Offline:</span>
                      <span>{pwa.offlineData.length} registros</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sincronizando:</span>
                      <Badge variant={pwa.isSyncing ? "default" : "secondary"}>
                        {pwa.isSyncing ? 'Sim' : 'Não'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações PWA */}
              <div className="space-y-3">
                <h4 className="font-medium">Ações Disponíveis</h4>
                <div className="grid grid-cols-2 gap-3">
                  {pwa.isInstallable && (
                    <button
                      onClick={pwa.installPWA}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Instalar PWA
                    </button>
                  )}

                  {pwa.hasUpdate && (
                    <button
                      onClick={pwa.updateApp}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      Atualizar App
                    </button>
                  )}

                  <button
                    onClick={pwa.syncOfflineData}
                    disabled={pwa.isSyncing}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <Layers className="h-4 w-4" />
                    {pwa.isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                  </button>

                  <button
                    onClick={pwa.clearCache}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    <Wrench className="h-4 w-4" />
                    Limpar Cache
                  </button>
                </div>
              </div>

              {/* Notificações */}
              <div className="space-y-3">
                <h4 className="font-medium">Notificações</h4>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={pwa.requestNotificationPermission}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    Solicitar Permissão
                  </button>

                  <button
                    onClick={() => pwa.showNotification('Teste PWA', {
                      body: 'Notificação de teste do sistema IPDA',
                      icon: '/icon-192x192.png'
                    })}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    <Zap className="h-4 w-4" />
                    Testar Notificação
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics Avançado
              </CardTitle>
              <CardDescription>
                Métricas detalhadas e insights do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">Analytics em Desenvolvimento</h3>
                <p className="text-gray-600 mb-4">
                  Dashboard executivo com métricas avançadas será implementado em breve.
                </p>
                <Badge variant="outline">Em Desenvolvimento</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer com Links Úteis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Recursos Adicionais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <h4 className="font-medium mb-2">Documentação</h4>
              <p className="text-sm text-gray-600 mb-2">
                Guias de uso e documentação técnica
              </p>
              <Badge variant="outline">Em Breve</Badge>
            </div>
            
            <div className="text-center">
              <h4 className="font-medium mb-2">Real-time Sync</h4>
              <p className="text-sm text-gray-600 mb-2">
                WebSockets para atualizações em tempo real
              </p>
              <Badge variant="outline">Planejado</Badge>
            </div>
            
            <div className="text-center">
              <h4 className="font-medium mb-2">Mobile App</h4>
              <p className="text-sm text-gray-600 mb-2">
                Aplicativo nativo para smartphones
              </p>
              <Badge variant="outline">Futuro</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}