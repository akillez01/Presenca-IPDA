'use client';

import { useEffect, useState } from 'react';
import { useRealtimeAttendance } from './use-realtime';

export interface SyncStatus {
  isConnected: boolean;
  lastSync: Date;
  dataCount: number;
  errors: string[];
  retryCount: number;
}

export function useAnalyticsSync() {
  const realtimeData = useRealtimeAttendance();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isConnected: false,
    lastSync: new Date(),
    dataCount: 0,
    errors: [],
    retryCount: 0
  });

  useEffect(() => {
    // Atualizar status de sincronização
    setSyncStatus(prev => ({
      ...prev,
      isConnected: !realtimeData.loading && !realtimeData.error,
      lastSync: new Date(),
      dataCount: realtimeData.attendanceRecords?.length || 0,
      errors: realtimeData.error ? [realtimeData.error] : [],
    }));
  }, [realtimeData.loading, realtimeData.error, realtimeData.attendanceRecords]);

  // Função para forçar re-sincronização
  const forceSync = () => {
    setSyncStatus(prev => ({
      ...prev,
      retryCount: prev.retryCount + 1,
      lastSync: new Date()
    }));
    // O useRealtimeAttendance já tem listeners automáticos
    // então apenas atualizamos o status
  };

  // Verificar se os dados estão atualizados (últimos 5 minutos)
  const isDataFresh = () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return syncStatus.lastSync > fiveMinutesAgo;
  };

  // Verificar se há dados suficientes para analytics
  const hasEnoughData = () => {
    return (realtimeData.todayRecords?.length || 0) > 0;
  };

  // Calcular métricas de qualidade dos dados
  const dataQuality = {
    completeness: realtimeData.todayRecords?.length > 0 ? 100 : 0,
    accuracy: !realtimeData.error ? 100 : 0,
    timeliness: isDataFresh() ? 100 : 50,
    overall: 0
  };
  
  dataQuality.overall = Math.round(
    (dataQuality.completeness + dataQuality.accuracy + dataQuality.timeliness) / 3
  );

  // Calcular stats se não houver
  const stats = realtimeData.stats || {
    totalRegistros: realtimeData.attendanceRecords?.length || 0,
    presentes: realtimeData.todayRecords?.filter(r => r.status === 'Presente').length || 0,
    ausentes: realtimeData.todayRecords?.filter(r => r.status === 'Ausente').length || 0,
    justificados: realtimeData.todayRecords?.filter(r => r.status === 'Justificado').length || 0,
    attendanceRate: realtimeData.todayRecords?.length ? 
      Math.round((realtimeData.todayRecords.filter(r => r.status === 'Presente').length / realtimeData.todayRecords.length) * 100) : 0
  };

  return {
    ...realtimeData,
    stats, // Usar stats calculados se necessário
    syncStatus,
    forceSync,
    isDataFresh: isDataFresh(),
    hasEnoughData: hasEnoughData(),
    dataQuality,
    
    // Helpers para componentes
    shouldShowAnalytics: hasEnoughData() && !realtimeData.loading && !realtimeData.error,
    shouldShowLoading: realtimeData.loading,
    shouldShowError: !!realtimeData.error,
    shouldShowEmpty: !realtimeData.loading && !realtimeData.error && !hasEnoughData(),
  };
}
