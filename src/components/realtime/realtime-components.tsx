'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtimeAttendance } from '@/hooks/use-realtime';
import { Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export function RealtimeIndicator() {
  const { loading, error } = useRealtimeAttendance();
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    if (!loading && !error) {
      setLastUpdate(new Date());
    }
  }, [loading, error]);

  const isConnected = !loading && !error;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          Status da Conexão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "Conectado" : "Desconectado"}
          </Badge>
          
          {isConnected && (
            <p className="text-xs text-muted-foreground">
              Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
            </p>
          )}
          
          {error && (
            <p className="text-xs text-red-600">
              {error}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function LiveStats() {
  const { stats, todayRecords } = useRealtimeAttendance();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Hoje</CardTitle>
          <Badge variant="outline">{todayRecords.length}</Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">
            registros de presença
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Presentes</CardTitle>
          <Badge variant="default" className="bg-green-100 text-green-800">
            {stats.present}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.present}</div>
          <p className="text-xs text-muted-foreground">
            pessoas presentes
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Justificados</CardTitle>
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            {stats.justified}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{stats.justified}</div>
          <p className="text-xs text-muted-foreground">
            faltas justificadas
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taxa de Presença</CardTitle>
          <Badge variant={stats.attendanceRate >= 80 ? "default" : "destructive"}>
            {stats.attendanceRate}%
          </Badge>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${stats.attendanceRate >= 80 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.attendanceRate}%
          </div>
          <p className="text-xs text-muted-foreground">
            de presença hoje
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
