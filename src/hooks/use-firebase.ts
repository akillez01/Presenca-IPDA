import { getAttendanceRecords, getAttendanceStats, getTodayAttendance } from '@/lib/actions';
import type { AttendanceRecord } from '@/lib/types';
import { useEffect, useState } from 'react';
import { useAuth } from './use-auth';

export function useAttendance() {
  const { user } = useAuth(); // Adicionar verificação de usuário
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({
    present: 0,
    justified: 0,
    absent: 0,
    total: 0,
    attendanceRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllAttendance = async () => {
    if (!user) return; // Só buscar se usuário autenticado
    
    try {
      setLoading(true);
      const records = await getAttendanceRecords();
      setAttendanceRecords(records);
    } catch (err) {
      setError('Erro ao carregar registros de presença');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayAttendance = async () => {
    if (!user) return; // Só buscar se usuário autenticado
    
    try {
      setLoading(true);
      const records = await getTodayAttendance();
      setTodayAttendance(records);
    } catch (err) {
      setError('Erro ao carregar presença de hoje');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!user) return; // Só buscar se usuário autenticado
    
    try {
      const statsData = await getAttendanceStats();
      setStats(statsData);
    } catch (err) {
      setError('Erro ao carregar estatísticas');
      console.error(err);
    }
  };

  const refreshData = async () => {
    await Promise.all([
      fetchAllAttendance(),
      fetchTodayAttendance(),
      fetchStats()
    ]);
  };

  useEffect(() => {
    // Só buscar dados se o usuário estiver autenticado
    if (user) {
      refreshData();
    } else {
      setLoading(false); // Parar loading se não houver usuário
    }
  }, [user]); // Adicionar user como dependência

  return {
    attendanceRecords,
    todayAttendance,
    stats,
    loading,
    error,
    refreshData,
    fetchAllAttendance,
    fetchTodayAttendance,
    fetchStats
  };
}

export function useFirebaseConnection() {
  const { user } = useAuth(); // Adicionar verificação de usuário
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const testConnection = async () => {
      // Só testar conexão se o usuário estiver autenticado
      if (!user) {
        setIsConnected(false);
        setConnectionError(null);
        return;
      }

      try {
        // Test basic connection by attempting to fetch stats
        await getAttendanceStats();
        setIsConnected(true);
        setConnectionError(null);
      } catch (error) {
        setIsConnected(false);
        setConnectionError('Erro de conexão com Firebase');
        console.error('Firebase connection error:', error);
      }
    };

    testConnection();
  }, [user]); // Adicionar user como dependência

  return { isConnected, connectionError };
}
