import {
    getAttendanceByDateRange,
    getWeeklyAttendanceStats
} from '@/lib/actions';
import { db } from '@/lib/firebase';
import type { AttendanceRecord } from '@/lib/types';
import { collection, onSnapshot } from 'firebase/firestore';
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

  // Atualização em tempo real dos dados de presença
  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = onSnapshot(collection(db, 'attendance'), async (snapshot) => {
      try {
        const records: AttendanceRecord[] = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Prioriza timestamp sobre createdAt para exibir a data mais recente (mesma lógica do presenca-mysql.ts)
          let timestamp: Date;
          if (data.timestamp) {
            timestamp = processFirebaseTimestamp(data, 'timestamp');
          } else {
            timestamp = processFirebaseTimestamp(data, 'createdAt');
          }
          
          const createdAt = processFirebaseTimestamp(data, 'createdAt');
          
          return {
            id: doc.id,
            timestamp: timestamp, // Usa a data mais recente (timestamp ou createdAt)
            fullName: data.fullName ?? '',
            cpf: data.cpf ?? '',
            reclassification: data.reclassification ?? '',
            pastorName: data.pastorName ?? '',
            region: data.region ?? '',
            churchPosition: data.churchPosition ?? '',
            city: data.city ?? '',
            shift: data.shift ?? '',
            status: data.status ?? '',
            createdAt: createdAt,
          };
        });
        const totalRecords = records.length;
        const presentCount = records.filter((r: any) => r.status === 'Presente').length;
        const justifiedCount = records.filter((r: any) => r.status === 'Justificado').length;
        const absentCount = records.filter((r: any) => r.status === 'Ausente').length;
        const byShift: Record<string, number> = {};
        const byRegion: Record<string, number> = {};
        const byPosition: Record<string, number> = {};
        const byReclassification: Record<string, number> = {};
        records.forEach((r: any) => {
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
          records: records // Os records já têm o timestamp correto processado acima
        };
        setReportData(customReportData);
        // Atualiza estatísticas semanais
        const weeklyRaw = await getWeeklyAttendanceStats();
        // Converter para WeeklyStats[]
        const weekly: WeeklyStats[] = Object.entries(weeklyRaw).map(([date, present]) => ({
          date,
          present,
          total: present,
          rate: 0 // Adapte se necessário
        }));
        setWeeklyStats(weekly);
        setLoading(false);
      } catch (err) {
        setError('Erro ao carregar dados dos relatórios');
        setLoading(false);
        console.error('Report data error:', err);
      }
    }, (err) => {
      setError('Erro ao conectar ao banco de dados');
      setLoading(false);
    });
    return () => unsub();
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
      
      const byShift = {
        Manhã: records.filter(r => r.shift === 'Manhã' && r.status === 'Presente').length,
        Tarde: records.filter(r => r.shift === 'Tarde' && r.status === 'Presente').length,
        Noite: records.filter(r => r.shift === 'Noite' && r.status === 'Presente').length,
      };
      
      const byRegion = {
        Norte: records.filter(r => r.region === 'Norte' && r.status === 'Presente').length,
        Sul: records.filter(r => r.region === 'Sul' && r.status === 'Presente').length,
        Leste: records.filter(r => r.region === 'Leste' && r.status === 'Presente').length,
        Oeste: records.filter(r => r.region === 'Oeste' && r.status === 'Presente').length,
        Central: records.filter(r => r.region === 'Central' && r.status === 'Presente').length,
      };
      
      const byPosition = {
        Pastor: records.filter(r => r.churchPosition === 'Pastor' && r.status === 'Presente').length,
        Diácono: records.filter(r => r.churchPosition === 'Diácono' && r.status === 'Presente').length,
        Presbítero: records.filter(r => r.churchPosition === 'Presbítero' && r.status === 'Presente').length,
        Membro: records.filter(r => r.churchPosition === 'Membro' && r.status === 'Presente').length,
        Outro: records.filter(r => r.churchPosition === 'Outro' && r.status === 'Presente').length,
      };
      
      const byReclassification = {
        Membro: records.filter(r => r.reclassification === 'Membro' && r.status === 'Presente').length,
        Visitante: records.filter(r => r.reclassification === 'Visitante' && r.status === 'Presente').length,
        Obreiro: records.filter(r => r.reclassification === 'Obreiro' && r.status === 'Presente').length,
      };
      
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
    // removido: atualização agora é em tempo real
  };

  useEffect(() => {
    // removido: atualização agora é em tempo real
  }, []);

  return {
    reportData,
    weeklyStats,
    loading,
    error,
    refreshData,
    fetchDateRangeData
  };
}

export function useRealtimeReports() {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const reportsHook = useReports();

  useEffect(() => {
    // Auto-refresh every 30 seconds for real-time updates
    const interval = setInterval(() => {
      reportsHook.refreshData();
      setLastUpdate(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    ...reportsHook,
    lastUpdate
  };
}
