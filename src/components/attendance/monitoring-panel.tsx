'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAttendanceManager, useAttendanceMonitoring, useSystemMonitoring } from '@/hooks/use-attendance-manager';
import { AlertTriangle, CheckCircle, Clock, Users, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export function AttendanceMonitoringPanel() {
  const { 
    auditLogs, 
    fetchAuditLogs, 
    userEmail,
    getStats 
  } = useAttendanceManager();
  
  const { performanceMetrics } = useAttendanceMonitoring();
  const { systemMetrics } = useSystemMonitoring();
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const stats = getStats();

  useEffect(() => {
    // Buscar logs iniciais
    fetchAuditLogs(24);
    
    // Configurar refresh automático a cada 30 segundos
    const interval = setInterval(() => {
      fetchAuditLogs(24);
      setLastRefresh(new Date());
    }, 30000);
    
    setRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchAuditLogs]);

  const handleManualRefresh = () => {
    fetchAuditLogs(24);
    setLastRefresh(new Date());
  };

  // Análise dos logs
  const recentErrors = auditLogs.filter(log => 
    log.event.includes('ERROR') || log.event.includes('FAILED')
  ).slice(0, 10);

  const duplicatesBlocked = auditLogs.filter(log => 
    log.event === 'DUPLICATE_ATTENDANCE_BLOCKED'
  );

  const successfulOperations = auditLogs.filter(log => 
    log.event === 'ATTENDANCE_UPDATE_SUCCESS' || 
    log.event === 'CPF_PRESENCE_REGISTERED'
  );

  const recentActivity = auditLogs.slice(0, 20);
  
  const userActivity = auditLogs.reduce((acc: any, log) => {
    const user = log.data?.userEmail || 'unknown';
    if (!acc[user]) acc[user] = 0;
    acc[user]++;
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitor de Concorrência</h1>
          <p className="text-muted-foreground">
            Monitoramento em tempo real do sistema de presença
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={handleManualRefresh} variant="outline" size="sm">
            <Clock className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <span className="text-sm text-muted-foreground">
            Última atualização: {lastRefresh.toLocaleTimeString('pt-BR')}
          </span>
        </div>
      </div>

      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="h-4 w-4 mr-2 text-blue-600" />
              Total de Membros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
              Presentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.presente}</div>
            <p className="text-xs text-muted-foreground">
              {stats.attendanceRate.toFixed(1)}% de presença
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <XCircle className="h-4 w-4 mr-2 text-red-600" />
              Duplicações Bloqueadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{duplicatesBlocked.length}</div>
            <p className="text-xs text-muted-foreground">
              Últimas 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 text-yellow-600" />
              Operações com Erro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{recentErrors.length}</div>
            <p className="text-xs text-muted-foreground">
              Últimas 24h
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas de Performance</CardTitle>
          <CardDescription>
            Estatísticas de desempenho do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Tempo Médio de Resposta</div>
              <div className="text-2xl font-bold">
                {performanceMetrics.averageResponseTime.toFixed(0)}ms
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Taxa de Sucesso</div>
              <div className="text-2xl font-bold text-green-600">
                {performanceMetrics.successRate.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Taxa de Erro</div>
              <div className="text-2xl font-bold text-red-600">
                {performanceMetrics.errorRate.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total de Operações</div>
              <div className="text-2xl font-bold">
                {performanceMetrics.totalOperations}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Atividade por Usuário */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade por Usuário</CardTitle>
          <CardDescription>
            Operações realizadas por cada usuário nas últimas 24h
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(userActivity)
              .sort(([,a], [,b]) => (b as number) - (a as number))
              .slice(0, 10)
              .map(([user, count]) => (
                <div key={user} className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    {user === userEmail ? `${user} (você)` : user}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Number(count)} operações
                  </span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Logs Recentes */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade Recente</CardTitle>
          <CardDescription>
            Últimas 20 operações no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentActivity.map((log, index) => (
              <div key={`${log.id}-${index}`} className="flex items-start gap-3 p-2 border rounded">
                <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" 
                     style={{
                       backgroundColor: 
                         log.event.includes('SUCCESS') ? '#10b981' :
                         log.event.includes('ERROR') || log.event.includes('FAILED') ? '#ef4444' :
                         log.event.includes('BLOCKED') ? '#f59e0b' : '#6b7280'
                     }} 
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">
                      {log.event.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {log.timestamp?.toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                  {log.data && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {log.data.fullName && `👤 ${log.data.fullName} • `}
                      {log.data.userEmail && `📧 ${log.data.userEmail} • `}
                      {log.data.attempt && `🔄 Tentativa ${log.data.attempt}`}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Duplicações Bloqueadas Detalhadas */}
      {duplicatesBlocked.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Duplicações Bloqueadas</CardTitle>
            <CardDescription>
              Tentativas de registro duplicado que foram automaticamente bloqueadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {duplicatesBlocked.slice(0, 10).map((log, index) => (
                <div key={`dup-${log.id}-${index}`} className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded">
                  <div>
                    <span className="text-sm font-medium">
                      {log.data?.fullName || 'Desconhecido'}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      Status: {log.data?.status} • 
                      Usuário: {log.data?.userEmail} • 
                      Diferença: {log.data?.timeDiff?.toFixed(1) || 0} min
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {log.timestamp?.toLocaleTimeString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}