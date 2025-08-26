'use client';

import { db } from '@/lib/firebase';
import type { SystemConfig } from '@/lib/types';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from './use-auth';

// Configurações padrão do sistema
const DEFAULT_CONFIG: Omit<SystemConfig, 'lastUpdated' | 'updatedBy'> = {
  reclassificationOptions: ['Local', 'Setorial', 'Central', 'Casa de oração', 'Estadual', 'Regional'],
  regionOptions: ['Norte', 'Sul', 'Leste', 'Oeste', 'Central'],
  churchPositionOptions: [
    'Conselheiro(a)',
    'Financeiro(a)', 
    'Pastor',
    'Presbítero',
    'Diácono',
    'Cooperador(a)',
    'Líder Reação',
    'Líder Simplifique', 
    'Líder Creative',
    'Líder Discipulus',
    'Líder Adore',
    'Auxiliar Expansão (a)',
    'Etda Professor(a)',
    'Coordenador Etda (a)',
    'Líder Galileu (a)',
    'Líder Adote uma alma (a)',
    'Membro',
    'Outro'
  ],
  shiftOptions: ['Manhã', 'Tarde', 'Noite'],
  statusOptions: ['Presente', 'Ausente', 'Justificado']
};

export function useSystemConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const configRef = doc(db, 'system', 'config');
    
    // Listener em tempo real para mudanças na configuração
    const unsubscribe = onSnapshot(
      configRef,
      (snapshot) => {
        try {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setConfig({
              ...data,
              lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate() : (data.lastUpdated || new Date()),
            } as SystemConfig);
          } else {
            // Se não existir, usar configuração padrão
            setConfig({
              ...DEFAULT_CONFIG,
              lastUpdated: new Date(),
              updatedBy: user.uid,
            });
          }
          setError(null);
        } catch (err) {
          console.error('Erro ao carregar configuração:', err);
          setError('Erro ao carregar configuração do sistema');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error('Erro no listener de configuração:', err);
        setError('Erro de conexão com as configurações');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const updateConfig = async (newConfig: Partial<SystemConfig>) => {
    if (!user || !config) return;

    try {
      const configRef = doc(db, 'system', 'config');
      await updateDoc(configRef, {
        ...newConfig,
        lastUpdated: new Date(),
        updatedBy: user.uid,
      });
    } catch (err) {
      console.error('Erro ao atualizar configuração:', err);
      throw new Error('Erro ao atualizar configuração do sistema');
    }
  };

  return {
    config,
    loading,
    error,
    updateConfig,
  };
}

export function useRealtimeAttendance(selectedDate?: string) {
  const { user } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [todayRecords, setTodayRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const attendanceRef = collection(db, 'attendance');

    // Listener em tempo real para todos os registros de presença
    const unsubscribe = onSnapshot(
      attendanceRef,
      (snapshot) => {
        try {
          const records = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
          }));

          setAttendanceRecords(records);

          // Determina a data para filtragem (hoje ou data selecionada)
          let targetDate: Date;
          if (selectedDate) {
            // Usa a data selecionada
            targetDate = new Date(selectedDate + 'T00:00:00');
          } else {
            // Usa hoje como padrão
            targetDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Manaus' }));
          }

          // Filtra registros da data especificada usando timezone America/Manaus
          const targetDateManaus = new Date(targetDate.toLocaleString('en-US', { timeZone: 'America/Manaus' }));
          const startOfDay = new Date(Date.UTC(targetDateManaus.getFullYear(), targetDateManaus.getMonth(), targetDateManaus.getDate(), 0, 0, 0));
          const endOfDay = new Date(Date.UTC(targetDateManaus.getFullYear(), targetDateManaus.getMonth(), targetDateManaus.getDate(), 23, 59, 59, 999));

          const filteredRecords = records.filter(record => {
            // Prioriza timestamp sobre createdAt (mesma lógica do presenca-mysql.ts)
            const recordDate = record.timestamp || record.createdAt;
            const recordDateObj = recordDate instanceof Date ? recordDate : new Date(recordDate);
            const recordDateManaus = new Date(recordDateObj.toLocaleString('en-US', { timeZone: 'America/Manaus' }));
            
            return recordDateManaus >= startOfDay && recordDateManaus <= endOfDay;
          });

          setTodayRecords(filteredRecords);
          setError(null);
        } catch (err) {
          console.error('Erro ao processar registros:', err);
          setError('Erro ao processar dados de presença');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error('Erro no listener de presença:', err);
        setError('Erro de conexão com dados de presença');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, selectedDate]); // Adiciona selectedDate como dependência

  // Calcular estatísticas em tempo real
  const stats = {
    present: todayRecords.filter(r => r.status === 'Presente').length,
    justified: todayRecords.filter(r => r.status === 'Justificado').length,
    absent: todayRecords.filter(r => r.status === 'Ausente').length,
    total: todayRecords.length,
    attendanceRate: todayRecords.length > 0 
      ? Math.round((todayRecords.filter(r => r.status === 'Presente').length / todayRecords.length) * 100)
      : 0,
    // Estatísticas por turno
    byShift: {
      morning: todayRecords.filter(r => r.shift === 'Manhã').length,
      afternoon: todayRecords.filter(r => r.shift === 'Tarde').length,
      night: todayRecords.filter(r => r.shift === 'Noite').length,
    },
    // Estatísticas por região
    byRegion: {
      north: todayRecords.filter(r => r.region === 'Norte').length,
      south: todayRecords.filter(r => r.region === 'Sul').length,
      east: todayRecords.filter(r => r.region === 'Leste').length,
      west: todayRecords.filter(r => r.region === 'Oeste').length,
      center: todayRecords.filter(r => r.region === 'Central').length,
    },
    // Estatísticas por cargo (top 10)
    byPosition: Object.fromEntries(
      Object.entries(todayRecords.reduce<Record<string, number>>((acc, record) => {
        const position = record.churchPosition;
        acc[position] = (acc[position] || 0) + 1;
        return acc;
      }, {}))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    ),
    // Estatísticas por reclassificação
    byReclassification: todayRecords.reduce((acc, record) => {
      const reclassification = record.reclassification;
      acc[reclassification] = (acc[reclassification] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return {
    attendanceRecords,
    todayRecords,
    stats,
    loading,
    error,
  };
}
