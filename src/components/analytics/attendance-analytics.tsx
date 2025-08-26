'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtimeAttendance } from '@/hooks/use-realtime';
import { Users2 } from 'lucide-react';

export function AttendanceAnalytics() {
  const { attendanceRecords, stats, loading, error } = useRealtimeAttendance();

  if (loading || error || !stats) {
    return null;
  }

  // Agrupamento dos últimos 7 dias usando timezone America/Manaus
    const getLast7Days = () => {
        // Corrige para usar o timezone America/Manaus corretamente
        const todayManaus = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Manaus' }));
        const days: Array<{
            date: string;
            total: number;
            present: number;
            justified: number;
            absent: number;
            rate: number;
        }> = [];
        for (let i = 6; i >= 0; i--) {
            // Calcula a data do dia no timezone America/Manaus
            const d = new Date(todayManaus);
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            // Define o início e fim do dia em Manaus
            const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 4, 0, 0));
            const end = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 27, 59, 59, 999));
            // Remove duplicados por id
            const recordsMap = new Map();
            attendanceRecords.forEach(record => {
                const recordDate = record.createdAt instanceof Date ? record.createdAt : new Date(record.createdAt);
                // Ajusta para o timezone America/Manaus
                const manausDate = new Date(recordDate.toLocaleString('en-US', { timeZone: 'America/Manaus' }));
                if (manausDate >= start && manausDate <= end) {
                    recordsMap.set(record.id, record);
                }
            });
            const records = Array.from(recordsMap.values());
            days.push({
                date: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
                total: records.length,
                present: records.filter(r => r.status === 'Presente').length,
                justified: records.filter(r => r.status === 'Justificado').length,
                absent: records.filter(r => r.status === 'Ausente').length,
                rate: records.length > 0 ? Math.round((records.filter(r => r.status === 'Presente').length / records.length) * 100) : 0
            });
        }
        return days;
    };

  // Exibe apenas os 6 dias anteriores, removendo o dia atual
  const last7Days = getLast7Days().slice(0, 6);

  const topPositions = Object.entries(stats.byPosition)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5);

  const topReclassifications = Object.entries(stats.byReclassification)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5);
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Últimos 7 Dias - Tabela (apenas em análise detalhada) */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users2 className="h-4 w-4" />
            Últimos 7 Dias
          </CardTitle>
          <CardDescription>
            Análise detalhada das presenças
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {last7Days.map((day, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium min-w-[80px]">{day.date}</div>
                  <Badge variant="outline" className="min-w-[60px] justify-center">
                    {day.total} total
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                    {day.present} presentes
                  </Badge>
                  {day.justified > 0 && (
                    <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      {day.justified} justificados
                    </Badge>
                  )}
                  {day.absent > 0 && (
                    <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
                      {day.absent} ausentes
                    </Badge>
                  )}
                  <div className="text-sm font-medium text-primary ml-2">
                    {day.rate}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {/* ...restante dos cards do dashboard... */}
    </div>
  );
}
