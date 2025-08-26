'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAnalyticsSync } from '@/hooks/use-analytics-sync';
import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { AttendanceAnalytics } from './attendance-analytics';
import { HistoricalData } from './historical-data';

export function SynchronizedAnalytics() {
  const {
    stats,
    attendanceRecords,
    todayRecords,
    syncStatus,
    forceSync,
    isDataFresh,
    dataQuality,
    shouldShowAnalytics,
    shouldShowLoading,
    shouldShowError,
    shouldShowEmpty,
    error
  } = useAnalyticsSync();

  // Estado de carregamento
  if (shouldShowLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <p>Sincronizando dados do Firebase...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Estado de erro
  if (shouldShowError) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao sincronizar com Firebase: {error}
          </AlertDescription>
        </Alert>
        <Card>
          <CardContent className="text-center py-8">
            <Button onClick={forceSync} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Tentar Reconectar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verificação de dados
  const hasData = stats && todayRecords && attendanceRecords;
  const hasRecordsToday = todayRecords && todayRecords.length > 0;
  const hasHistoricalData = attendanceRecords && attendanceRecords.length > 0;

  return (
    <div className="space-y-8">
      {/* Status de Sincronização */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {syncStatus.isConnected ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-500" />
            )}
            Status de Sincronização
            <Badge variant={syncStatus.isConnected ? "default" : "destructive"}>
              {syncStatus.isConnected ? "Conectado" : "Desconectado"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Dados em tempo real conectados ao Firebase
            {!isDataFresh && (
              <span className="text-orange-600 ml-2">
                (Dados podem estar desatualizados)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${syncStatus.isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-sm">
                {syncStatus.isConnected ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {attendanceRecords?.length || 0} registros totais
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {todayRecords?.length || 0} registros hoje
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default">
                {stats?.attendanceRate || 0}% presença
              </Badge>
            </div>
          </div>
          
          {/* Qualidade dos Dados */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Qualidade dos dados: {dataQuality.overall}%
              <span className="ml-2">
                Última sincronização: {syncStatus.lastSync.toLocaleTimeString()}
              </span>
            </div>
            <Button 
              onClick={forceSync} 
              variant="outline" 
              size="sm" 
              className="gap-2"
              disabled={shouldShowLoading}
            >
              <RefreshCw className={`h-4 w-4 ${shouldShowLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Detalhados */}
      {hasData && hasRecordsToday ? (
        <>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Análise Detalhada</h2>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Dados em Tempo Real
              </Badge>
            </div>
            <AttendanceAnalytics />
          </div>

          {/* Dados Históricos */}
          {hasHistoricalData && <HistoricalData />}
        </>
      ) : (
        /* Estado sem dados */
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhum registro hoje</h3>
            <p className="text-muted-foreground mb-4">
              Os analytics aparecerão quando houver registros de presença para hoje.
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Conectado ao Firebase: ✅</p>
              <p>• Total de registros históricos: {attendanceRecords?.length || 0}</p>
              <p>• Registros de hoje: {todayRecords?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Info (apenas em desenvolvimento) */}
    </div>
  );
}
