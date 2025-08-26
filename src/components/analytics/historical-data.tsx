'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtimeAttendance } from '@/hooks/use-realtime';
import { Calendar, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';

export function HistoricalData() {
  const { attendanceRecords, loading, error } = useRealtimeAttendance();

  const historicalStats = useMemo(() => {
    if (!attendanceRecords || attendanceRecords.length === 0) {
      return {
        last7Days: [],
        totalWeek: 0,
        averageDaily: 0,
        trend: 'stable' as 'up' | 'down' | 'stable'
      };
    }

    // Calcular dados dos últimos 7 dias usando createdAt e timezone America/Manaus
    const todayManaus = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Manaus' }));
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayManaus);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      // Início e fim do dia em Manaus
      const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 4, 0, 0));
      const end = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 27, 59, 59, 999));
      // Filtra registros do Firebase por createdAt ajustado para Manaus
      const dayRecords = attendanceRecords.filter(record => {
        const recordDate = record.createdAt instanceof Date ? record.createdAt : new Date(record.createdAt);
        const manausDate = new Date(recordDate.toLocaleString('en-US', { timeZone: 'America/Manaus' }));
        return manausDate >= start && manausDate <= end;
      });
      last7Days.push({
        date: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        total: dayRecords.length,
        present: dayRecords.filter(r => r.status === 'Presente').length,
        absent: dayRecords.filter(r => r.status === 'Ausente').length,
        justified: dayRecords.filter(r => r.status === 'Justificado').length,
        rate: dayRecords.length > 0 ? Math.round((dayRecords.filter(r => r.status === 'Presente').length / dayRecords.length) * 100) : 0
      });
    }

    const totalWeek = last7Days.reduce((sum, day) => sum + day.total, 0);
    const averageDaily = Math.round(totalWeek / 7);
    
    // Calcular tendência (comparando primeiros 3 dias com últimos 3 dias)
    const firstHalf = last7Days.slice(0, 3).reduce((sum, day) => sum + day.total, 0) / 3;
    const secondHalf = last7Days.slice(-3).reduce((sum, day) => sum + day.total, 0) / 3;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (secondHalf > firstHalf * 1.1) trend = 'up';
    else if (secondHalf < firstHalf * 0.9) trend = 'down';

    return {
      last7Days,
      totalWeek,
      averageDaily,
      trend
    };
  }, [attendanceRecords]);

  if (loading || error) {
    return null;
  }

  const getTrendIcon = () => {
    switch (historicalStats.trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />;
      default:
        return <TrendingUp className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendColor = () => {
    switch (historicalStats.trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dados Históricos</h2>
        <div className="flex items-center gap-2">
          {getTrendIcon()}
          <span className={`text-sm font-medium ${getTrendColor()}`}>
            {historicalStats.trend === 'up' ? 'Crescendo' : 
             historicalStats.trend === 'down' ? 'Decrescendo' : 'Estável'}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Resumo da Semana */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Resumo Semanal
            </CardTitle>
            <CardDescription>
              Estatísticas dos últimos 7 dias
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total da semana:</span>
              <Badge variant="secondary">{historicalStats.totalWeek}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Média diária:</span>
              <Badge variant="outline">{historicalStats.averageDaily}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Tendência:</span>
              <div className="flex items-center gap-1">
                {getTrendIcon()}
                <span className={`text-sm ${getTrendColor()}`}>
                  {historicalStats.trend === 'up' ? 'Crescimento' : 
                   historicalStats.trend === 'down' ? 'Queda' : 'Estável'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ...outros cards do dashboard histórico... */}
      </div>
    </div>
  );
}
