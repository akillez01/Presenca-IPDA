'use client';

import { useAuth } from '@/hooks/use-auth';
import {
    batchUpdateAttendances,
    getAttendanceRecords,
    getAuditReport,
    processCPFAtomic,
    updateAttendanceStatusAtomic
} from '@/lib/attendance-manager';
import type { AttendanceRecord } from '@/lib/types';
import { useCallback, useEffect, useState } from 'react';

export function useAttendanceManager() {
  const { user } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Função para buscar registros com controle de concorrência
  const fetchAttendanceRecords = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      const records = await getAttendanceRecords();
      setAttendanceRecords(records);
    } catch (err: any) {
      setError(`Erro ao carregar registros: ${err.message}`);
      console.error('Erro ao carregar registros:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Função para atualizar status com controle de concorrência
  const updateAttendanceStatus = useCallback(async (
    id: string, 
    status: string, 
    absentReason?: string
  ) => {
    if (!user?.email) {
      return { success: false, message: 'Usuário não autenticado' };
    }

    try {
      const result = await updateAttendanceStatusAtomic(id, status, absentReason, user.email);
      
      // Se foi bem-sucedido, atualizar estado local
      if (result.success && !result.message.includes('Duplicação bloqueada')) {
        setAttendanceRecords(prev => prev.map(record => 
          record.id === id 
            ? { 
                ...record, 
                status, 
                absentReason: absentReason || record.absentReason,
                lastUpdated: new Date(),
                lastUpdatedBy: user.email || undefined
              }
            : record
        ));
      }
      
      return result;
    } catch (err: any) {
      return { 
        success: false, 
        message: `Erro ao atualizar presença: ${err.message}` 
      };
    }
  }, [user]);

  // Função para processar CPF com controle de duplicação
  const processCPF = useCallback(async (cpf: string) => {
    if (!user?.email) {
      return { success: false, message: 'Usuário não autenticado' };
    }

    try {
      const result = await processCPFAtomic(cpf, user.email);
      
      // Se foi bem-sucedido, atualizar estado local
      if (result.success && result.person) {
        setAttendanceRecords(prev => prev.map(record => 
          record.id === result.person!.id 
            ? { ...record, ...result.person }
            : record
        ));
      }
      
      return result;
    } catch (err: any) {
      return { 
        success: false, 
        message: `Erro ao processar CPF: ${err.message}` 
      };
    }
  }, [user]);

  // Função para atualização em lote
  const batchUpdateAttendance = useCallback(async (
    updates: Array<{ id: string; status: string; absentReason?: string }>
  ) => {
    if (!user?.email) {
      return { success: false, results: [], errors: ['Usuário não autenticado'] };
    }

    try {
      const result = await batchUpdateAttendances(updates, user.email);
      
      // Atualizar estado local com sucessos
      if (result.results.length > 0) {
        setAttendanceRecords(prev => {
          const updatedRecords = [...prev];
          
          result.results.forEach(({ id, status, absentReason, result: updateResult }) => {
            if (updateResult?.success) {
              const index = updatedRecords.findIndex(r => r.id === id);
              if (index !== -1) {
                updatedRecords[index] = {
                  ...updatedRecords[index],
                  status,
                  absentReason: absentReason || updatedRecords[index].absentReason,
                  lastUpdated: new Date(),
                  lastUpdatedBy: user.email || undefined
                };
              }
            }
          });
          
          return updatedRecords;
        });
      }
      
      return result;
    } catch (err: any) {
      return { 
        success: false, 
        results: [], 
        errors: [`Erro no lote: ${err.message}`] 
      };
    }
  }, [user]);

  // Função para buscar logs de auditoria
  const fetchAuditLogs = useCallback(async (hours: number = 24) => {
    try {
      const logs = await getAuditReport(hours);
      setAuditLogs(logs);
      return logs;
    } catch (err: any) {
      console.error('Erro ao buscar logs de auditoria:', err);
      return [];
    }
  }, []);

  // Estatísticas com dados em tempo real
  const getStats = useCallback(() => {
    const presente = attendanceRecords.filter(r => r.status === 'Presente').length;
    const justificado = attendanceRecords.filter(r => r.status === 'Justificado').length;
    const ausente = attendanceRecords.filter(r => r.status === 'Ausente').length;
    const total = attendanceRecords.length;
    const attendanceRate = total > 0 ? (presente / total) * 100 : 0;

    return {
      presente,
      justificado,
      ausente,
      total,
      attendanceRate: Math.round(attendanceRate * 100) / 100
    };
  }, [attendanceRecords]);

  // Auto-fetch dos dados ao carregar
  useEffect(() => {
    fetchAttendanceRecords();
  }, [fetchAttendanceRecords]);

  return {
    // Estados
    attendanceRecords,
    loading,
    error,
    auditLogs,
    
    // Funções principais
    fetchAttendanceRecords,
    updateAttendanceStatus,
    processCPF,
    batchUpdateAttendance,
    fetchAuditLogs,
    
    // Utilitários
    getStats,
    
    // Info do usuário
    userEmail: user?.email,
    isAuthenticated: !!user
  };
}

// Hook para monitoramento de performance
export function useAttendanceMonitoring() {
  const [performanceMetrics, setPerformanceMetrics] = useState({
    averageResponseTime: 0,
    successRate: 0,
    errorRate: 0,
    totalOperations: 0
  });

  const recordOperation = useCallback((
    operation: string, 
    duration: number, 
    success: boolean
  ) => {
    setPerformanceMetrics(prev => {
      const newTotal = prev.totalOperations + 1;
      const newSuccessRate = success 
        ? ((prev.successRate * prev.totalOperations) + 1) / newTotal
        : (prev.successRate * prev.totalOperations) / newTotal;
      
      return {
        averageResponseTime: ((prev.averageResponseTime * prev.totalOperations) + duration) / newTotal,
        successRate: newSuccessRate * 100,
        errorRate: (1 - newSuccessRate) * 100,
        totalOperations: newTotal
      };
    });
  }, []);

  return {
    performanceMetrics,
    recordOperation
  };
}

// Hook específico para monitoramento de sistema
export function useSystemMonitoring() {
  const [systemMetrics, setSystemMetrics] = useState({
    activeOperations: 0,
    queueLength: 0,
    peakConcurrency: 0,
    lastActivity: new Date(),
    connectionStatus: 'connected' as 'connected' | 'disconnected' | 'slow',
    memoryUsage: 0,
    networkLatency: 0
  });

  const updateSystemMetrics = useCallback(() => {
    // Simular métricas de sistema em tempo real
    setSystemMetrics(prev => ({
      ...prev,
      activeOperations: Math.floor(Math.random() * 5),
      queueLength: Math.floor(Math.random() * 10),
      peakConcurrency: Math.max(prev.peakConcurrency, Math.floor(Math.random() * 20)),
      lastActivity: new Date(),
      connectionStatus: Math.random() > 0.95 ? 'slow' : 'connected',
      memoryUsage: Math.random() * 100,
      networkLatency: Math.random() * 500
    }));
  }, []);

  useEffect(() => {
    // Atualizar métricas em tempo real a cada 3 segundos
    const interval = setInterval(updateSystemMetrics, 3000);
    
    // Primeira atualização
    updateSystemMetrics();
    
    return () => clearInterval(interval);
  }, [updateSystemMetrics]);

  return {
    systemMetrics,
    updateSystemMetrics
  };
}