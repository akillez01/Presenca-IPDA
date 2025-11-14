import {
    getAttendanceByDateRange,
    getWeeklyAttendanceStats
} from '@/lib/actions';
import { getAttendanceRecords } from '@/lib/api-actions'; // Usar API que preserva datas originais
import type { AttendanceRecord } from '@/lib/types';
import { useEffect, useState } from 'react';

// Função utilitária para processar timestamps do Firestore (mesma lógica do presenca-mysql.ts)
function processFirebaseTimestamp(data: any, field: 'timestamp' | 'createdAt'): Date {
  const value = data[field];
  if (!value) return new Date();
  
  try {
    if (typeof value.toDate === "function") {
      return value.toDate();
    } else if (value instanceof Date) {
      return value;
    } else if (typeof value === "number") {
      return new Date(value);
    } else if (typeof value === "string") {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
  } catch (e) {
    // Se houver erro na conversão, retorna data atual
  }
  
  return new Date();
}

export interface ReportData {
  summary: {
    total: number;
    present: number;
    justified: number;
    absent: number;
    attendanceRate: number;
  };
  byShift: Record<string, number>;
  byRegion: Record<string, number>;
  byPosition: Record<string, number>;
  byReclassification: Record<string, number>;
  records: AttendanceRecord[];
}

export interface WeeklyStats {
  date: string;
  present: number;
  total: number;
  rate: number;
}

export function useReports() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Usa a API que preserva as datas originais
      const records = await getAttendanceRecords();
      
      if (!records || !Array.isArray(records)) {
        throw new Error('Nenhum registro encontrado');
      }

      // Processa os registros preservando as datas originais
      const processedRecords: AttendanceRecord[] = records.map(data => ({
        id: data.id,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        fullName: data.fullName ?? '',
        cpf: data.cpf ?? '',
        reclassification: data.reclassification ?? '',
        pastorName: data.pastorName ?? '',
        region: data.region ?? '',
        churchPosition: data.churchPosition ?? '',
        city: data.city ?? '',
        shift: data.shift ?? '',
        status: data.status ?? 'Presente',
        createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
        lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : undefined,
        absentReason: data.absentReason ?? '',
        birthday: data.birthday ?? '',
      }));

      const totalRecords = processedRecords.length;
      const presentCount = processedRecords.filter(r => r.status === 'Presente').length;
      const justifiedCount = processedRecords.filter(r => r.status === 'Justificado').length;
      const absentCount = processedRecords.filter(r => r.status === 'Ausente').length;
      
      const byShift: Record<string, number> = {};
      const byRegion: Record<string, number> = {};
      const byPosition: Record<string, number> = {};
      const byReclassification: Record<string, number> = {};
      
      processedRecords.forEach(r => {
        if (r.shift) {
          byShift[r.shift] = (byShift[r.shift] || 0) + (r.status === 'Presente' ? 1 : 0);
        }
        if (r.region) {
          byRegion[r.region] = (byRegion[r.region] || 0) + (r.status === 'Presente' ? 1 : 0);
        }
        if (r.churchPosition) {
          byPosition[r.churchPosition] = (byPosition[r.churchPosition] || 0) + (r.status === 'Presente' ? 1 : 0);
        }
        if (r.reclassification) {
          byReclassification[r.reclassification] = (byReclassification[r.reclassification] || 0) + (r.status === 'Presente' ? 1 : 0);
        }
      });
      
      const attendanceRate = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;
      
      const customReportData: ReportData = {
        summary: {
          total: totalRecords,
          present: presentCount,
          justified: justifiedCount,
          absent: absentCount,
          attendanceRate: Math.round(attendanceRate * 100) / 100
        },
        byShift,
        byRegion,
        byPosition,
        byReclassification,
        records: processedRecords
      };
      
      setReportData(customReportData);
      
      // Atualiza estatísticas semanais
      try {
        const weeklyRaw = await getWeeklyAttendanceStats();
        const weekly: WeeklyStats[] = Object.entries(weeklyRaw).map(([date, present]) => ({
          date,
          present,
          total: present,
          rate: 0
        }));
        setWeeklyStats(weekly);
      } catch (weeklyError) {
        console.warn('Erro ao carregar estatísticas semanais:', weeklyError);
        setWeeklyStats([]);
      }
      
    } catch (err) {
      console.error('Erro ao carregar dados de relatório:', err);
      setError('Erro ao carregar dados de relatório');
    } finally {
      setLoading(false);
    }
  };

  // Atualização inicial
  useEffect(() => {
    fetchData();
  }, []);

  const fetchDateRangeData = async (startDate: Date, endDate: Date) => {
    try {
      setLoading(true);
      const records = await getAttendanceByDateRange(startDate, endDate);
      
      // Process the data similar to getAttendanceReportData
      const totalRecords = records.length;
      const presentCount = records.filter(r => r.status === 'Presente').length;
      const justifiedCount = records.filter(r => r.status === 'Justificado').length;
      const absentCount = records.filter(r => r.status === 'Ausente').length;
      
      const byShift: Record<string, number> = {};
      const byRegion: Record<string, number> = {};
      const byPosition: Record<string, number> = {};
      const byReclassification: Record<string, number> = {};
      
      records.forEach(r => {
        if (r.shift) {
          byShift[r.shift] = (byShift[r.shift] || 0) + (r.status === 'Presente' ? 1 : 0);
        }
        if (r.region) {
          byRegion[r.region] = (byRegion[r.region] || 0) + (r.status === 'Presente' ? 1 : 0);
        }
        if (r.churchPosition) {
          byPosition[r.churchPosition] = (byPosition[r.churchPosition] || 0) + (r.status === 'Presente' ? 1 : 0);
        }
        if (r.reclassification) {
          byReclassification[r.reclassification] = (byReclassification[r.reclassification] || 0) + (r.status === 'Presente' ? 1 : 0);
        }
      });
      
      const attendanceRate = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;
      
      const customReportData: ReportData = {
        summary: {
          total: totalRecords,
          present: presentCount,
          justified: justifiedCount,
          absent: absentCount,
          attendanceRate: Math.round(attendanceRate * 100) / 100
        },
        byShift,
        byRegion,
        byPosition,
        byReclassification,
        records
      };
      
      setReportData(customReportData);
      return customReportData;
    } catch (err) {
      setError('Erro ao carregar dados por período');
      console.error('Date range data error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    fetchData();
  };

  return {
    reportData,
    weeklyStats,
    loading,
    error,
    refreshData,
    fetchDateRangeData
  };
}

export interface RealtimeReportsOptions {
  refreshIntervalMs?: number;
}

export function useRealtimeReports(options?: RealtimeReportsOptions) {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const reportsHook = useReports();
  const refreshInterval = options?.refreshIntervalMs ?? 30000;

  useEffect(() => {
    // Auto-refresh using the configured interval for real-time updates
    const interval = setInterval(() => {
      reportsHook.refreshData();
      setLastUpdate(new Date());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [reportsHook, refreshInterval]);

  return {
    ...reportsHook,
    lastUpdate
  };
}
