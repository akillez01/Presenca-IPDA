/**
 * Painel de Monitoramento do Sistema
 * Interface para visualizar backups, rate limits e logs de auditoria
 */

'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuditSeverity, auditSystem } from '@/lib/audit-system';
import { backupSystem } from '@/lib/backup-system';
import { rateLimitSystem } from '@/lib/rate-limit-system';
import {
    Activity,
    AlertTriangle,
    CheckCircle,
    Database,
    Download,
    RefreshCw,
    Shield,
    Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface SystemStatus {
  backups: {
    total: number;
    lastBackup?: Date;
    totalSize: string;
    success: boolean;
  };
  rateLimiting: {
    enabled: boolean;
    activeConnections: number;
    totalRequests: number;
    blockedRequests: number;
  };
  audit: {
    enabled: boolean;
    totalEvents: number;
    criticalEvents: number;
    recentActivity: number;
  };
}

export default function SystemMonitoringPanel() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    backups: { total: 0, totalSize: '0 MB', success: true },
    rateLimiting: { enabled: true, activeConnections: 0, totalRequests: 0, blockedRequests: 0 },
    audit: { enabled: true, totalEvents: 0, criticalEvents: 0, recentActivity: 0 }
  });

  const [backups, setBackups] = useState<any[]>([]);
  const [auditStats, setAuditStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar status do sistema
  useEffect(() => {
    loadSystemStatus();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSystemStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Carregar dados de backup
      const backupList = await backupSystem.listBackups();
      const totalSize = backupList.reduce((sum, backup) => sum + backup.fileSize, 0);

      // Carregar métricas de rate limiting
      const rateLimitMetrics = rateLimitSystem.getMetrics();
      const rateLimitConfig = rateLimitSystem.getConfig();

      // Carregar estatísticas de auditoria
      const auditStatistics = await auditSystem.generateStatistics(7); // Últimos 7 dias

      setBackups(backupList);
      setAuditStats(auditStatistics);

      setSystemStatus({
        backups: {
          total: backupList.length,
          lastBackup: backupList[0]?.timestamp,
          totalSize: formatBytes(totalSize),
          success: backupList.length > 0
        },
        rateLimiting: {
          enabled: rateLimitConfig.enabled,
          activeConnections: rateLimitMetrics.activeConnections,
          totalRequests: rateLimitMetrics.totalRequests,
          blockedRequests: rateLimitMetrics.blockedRequests
        },
        audit: {
          enabled: auditSystem.getConfig().enabled,
          totalEvents: auditStatistics.totalEvents,
          criticalEvents: auditStatistics.eventsBySeverity[AuditSeverity.CRITICAL] || 0,
          recentActivity: auditStatistics.recentActivity.length
        }
      });

    } catch (err) {
      console.error('Erro ao carregar status do sistema:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setIsLoading(true);
      const result = await backupSystem.createBackup();
      
      if (result.success && result.metadata && result.filePath) {
        const sizeKB = Math.round(result.metadata.fileSize / 1024);
        const storageType = result.filePath.startsWith('download:') ? 'Download direto' : 
                          result.filePath.startsWith('localStorage:') ? 'LocalStorage' : 'Arquivo';
        
        setError(`✅ Backup criado com sucesso! Tamanho: ${sizeKB}KB, Método: ${storageType}`);
        
        // Log da ação
        await auditSystem.logUserAction(
          'current-user', // Em produção, pegar do contexto de auth
          'create_backup',
          'backup',
          result.metadata.id,
          { 
            source: 'monitoring_panel',
            fileSize: result.metadata.fileSize,
            storageMethod: storageType,
            recordCount: result.metadata.recordCount
          }
        );
      } else {
        setError('❌ Falha ao criar backup');
      }
      
      await loadSystemStatus();

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao criar backup';
      setError(`❌ Erro: ${errorMsg}`);
      console.error('Erro no backup:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm('Tem certeza que deseja restaurar este backup? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setIsLoading(true);
      await backupSystem.restoreFromBackup(backupId);
      await loadSystemStatus();

      // Log da ação
      await auditSystem.logUserAction(
        'current-user',
        'restore_backup',
        'backup',
        backupId,
        { source: 'monitoring_panel' }
      );

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao restaurar backup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm('Tem certeza que deseja excluir este backup?')) {
      return;
    }

    try {
      setIsLoading(true);
      // Implementar método de exclusão de backup
      console.log('Excluindo backup:', backupId);
      await loadSystemStatus();

      // Log da ação
      await auditSystem.logUserAction(
        'current-user',
        'delete_backup',
        'backup',
        backupId,
        { source: 'monitoring_panel' }
      );

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir backup');
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Manaus'
    }).format(date);
  };

  if (isLoading && !systemStatus) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando status do sistema...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Monitoramento do Sistema</h1>
          <p className="text-gray-600">
            Acompanhe backups, rate limiting e auditoria em tempo real
          </p>
        </div>
        <Button onClick={loadSystemStatus} variant="outline" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Alertas de erro */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Cards de status geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Backups</CardTitle>
            <Database className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStatus.backups.total}</div>
            <p className="text-xs text-gray-600">
              {systemStatus.backups.lastBackup
                ? `Último: ${formatDate(systemStatus.backups.lastBackup)}`
                : 'Nenhum backup encontrado'
              }
            </p>
            <div className="flex items-center mt-2">
              {systemStatus.backups.success ? (
                <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600 mr-1" />
              )}
              <span className="text-xs">
                {systemStatus.backups.totalSize}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limiting</CardTitle>
            <Shield className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStatus.rateLimiting.activeConnections}</div>
            <p className="text-xs text-gray-600">Conexões ativas</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span>Total: {systemStatus.rateLimiting.totalRequests}</span>
                <span>Bloqueados: {systemStatus.rateLimiting.blockedRequests}</span>
              </div>
              <Progress 
                value={(systemStatus.rateLimiting.blockedRequests / Math.max(1, systemStatus.rateLimiting.totalRequests)) * 100} 
                className="h-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auditoria</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStatus.audit.totalEvents}</div>
            <p className="text-xs text-gray-600">Eventos registrados (7 dias)</p>
            <div className="flex items-center mt-2 space-x-2">
              {systemStatus.audit.criticalEvents > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {systemStatus.audit.criticalEvents} críticos
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {systemStatus.audit.recentActivity} recentes
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs com detalhes */}
      <Tabs defaultValue="backups" className="space-y-4">
        <TabsList>
          <TabsTrigger value="backups">Backups</TabsTrigger>
          <TabsTrigger value="rate-limiting">Rate Limiting</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        {/* Tab de Backups */}
        <TabsContent value="backups" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Gerenciamento de Backups</h3>
            <Button onClick={handleCreateBackup} disabled={isLoading}>
              <Database className="h-4 w-4 mr-2" />
              Criar Backup
            </Button>
          </div>

          <div className="grid gap-4">
            {backups.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">Nenhum backup encontrado</p>
                  <Button onClick={handleCreateBackup} className="mt-4">
                    Criar Primeiro Backup
                  </Button>
                </CardContent>
              </Card>
            ) : (
              backups.map((backup) => (
                <Card key={backup.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">Backup {backup.id.slice(0, 8)}</h4>
                          <Badge variant="outline" className="text-green-600">Sucesso</Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          {formatDate(backup.timestamp)}
                        </p>
                        <div className="flex space-x-4 text-xs text-gray-500">
                          <span>ID: {backup.id.slice(0, 8)}</span>
                          <span>Dados: Backup completo</span>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreBackup(backup.id)}
                          disabled={isLoading}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Restaurar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteBackup(backup.id)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Tab de Rate Limiting */}
        <TabsContent value="rate-limiting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Rate Limiting</CardTitle>
              <CardDescription>
                Sistema de controle de taxa para prevenir sobrecarga
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <Badge variant={systemStatus.rateLimiting.enabled ? "default" : "secondary"}>
                    {systemStatus.rateLimiting.enabled ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">Conexões Ativas</p>
                  <p className="text-2xl font-bold">{systemStatus.rateLimiting.activeConnections}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Total de Requests</p>
                  <p className="text-2xl font-bold">{systemStatus.rateLimiting.totalRequests}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Requests Bloqueados</p>
                  <p className="text-2xl font-bold text-red-600">{systemStatus.rateLimiting.blockedRequests}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Auditoria */}
        <TabsContent value="audit" className="space-y-4">
          {auditStats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Eventos por Tipo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(auditStats.eventsByType)
                      .filter(([, count]) => (count as number) > 0)
                      .sort(([,a], [,b]) => (b as number) - (a as number))
                      .slice(0, 5)
                      .map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center">
                          <span className="text-sm">{type}</span>
                          <Badge variant="outline">{count as number}</Badge>
                        </div>
                      ))
                    }
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Usuários Mais Ativos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {auditStats.topUsers.slice(0, 5).map((user: any) => (
                      <div key={user.userId} className="flex justify-between items-center">
                        <span className="text-sm">{user.userId}</span>
                        <Badge variant="outline">{user.count} eventos</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Atividade Recente</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {auditStats.recentActivity.slice(0, 10).map((event: any, index: number) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b">
                        <div>
                          <p className="text-sm font-medium">{event.description}</p>
                          <p className="text-xs text-gray-500">
                            {event.userId} • {formatDate(event.timestamp.toDate())}
                          </p>
                        </div>
                        <Badge 
                          variant={
                            event.severity === AuditSeverity.CRITICAL ? "destructive" :
                            event.severity === AuditSeverity.HIGH ? "default" :
                            "secondary"
                          }
                        >
                          {event.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}