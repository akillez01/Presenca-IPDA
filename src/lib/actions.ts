import { updateAttendanceStatus as updateAttendanceStatusBase } from "./presenca-mysql";

export async function updateAttendanceStatus(id: string, status: string, absentReason?: string, timestamp?: Date) {
  return updateAttendanceStatusBase(id, status, absentReason, timestamp);
}

export async function updateAttendanceRecord(id: string, data: any) {
  return updateAttendanceRecordFirebase(id, data);
}
// Exportação explícita para uso no client
    export { getAllPresencas };
// Firebase: relatório de presença (exemplo básico)
export async function getAttendanceReportData(start?: Date, end?: Date) {
  if (start && end) {
    return await getPresencasByDateRange(start, end);
  }
  // Busca todos os dados se não houver filtro
  const records = await getPresencas();
  // Processa os dados para o formato ReportData
  const totalRecords = records.length;
  const presentCount = records.filter(r => r.status === 'Presente').length;
  const justifiedCount = records.filter(r => r.status === 'Justificado').length;
  const absentCount = records.filter(r => r.status === 'Ausente').length;
  const byShift = {
    Manhã: records.filter(r => r.shift === 'Manhã' && r.status === 'Presente').length,
    Tarde: records.filter(r => r.shift === 'Tarde' && r.status === 'Presente').length,
    Noite: records.filter(r => r.shift === 'Noite' && r.status === 'Presente').length,
  };
  const byRegion: Record<string, number> = {};
  records.forEach(r => {
    if (r.region && r.status === 'Presente') {
      byRegion[r.region] = (byRegion[r.region] || 0) + 1;
    }
  });
  const byPosition: Record<string, number> = {};
  records.forEach(r => {
    if (r.churchPosition && r.status === 'Presente') {
      byPosition[r.churchPosition] = (byPosition[r.churchPosition] || 0) + 1;
    }
  });

  // Top 10 cargos com mais presença
  const topPositions = Object.entries(byPosition)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([cargo, count]) => ({ cargo, count }));
  const byReclassification: Record<string, number> = {};
  records.forEach(r => {
    if (r.reclassification && r.status === 'Presente') {
      byReclassification[r.reclassification] = (byReclassification[r.reclassification] || 0) + 1;
    }
  });
  const attendanceRate = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;
  // Converter Presenca para AttendanceRecord (adiciona timestamp)
  // Retorna os registros originais do Firestore, sem conversão extra
  const attendanceRecords = records;
  return {
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
    records: attendanceRecords
  };
}

// Firebase: estatísticas semanais (exemplo básico)
export async function getWeeklyAttendanceStats() {
  // Busca os últimos 7 dias
  const today = new Date();
  today.setHours(0,0,0,0);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);
  const presencas = await getPresencasByDateRange(weekAgo, today);
  // Agrupa por dia usando timestamp processado
  const stats: Record<string, number> = {};
  presencas.forEach((p: any) => {
    // Usa timestamp que já foi processado pela função mapDocumentToPresenca
    const d = p.timestamp ? p.timestamp.toISOString().slice(0,10) : '';
    if (d) stats[d] = (stats[d] || 0) + 1;
  });
  return stats;
}
// Firebase: consulta por intervalo de datas
export async function getAttendanceByDateRange(start: Date, end: Date) {
  return await getPresencasByDateRange(start, end);
}

import {
    addPresenca,
    deleteAttendanceRecord,
    getAllPresencas,
    getPresencaByCpf,
    getPresencas,
    getPresencasByDateRange,
    getPresencaStats,
    updateAttendanceRecord as updateAttendanceRecordFirebase
} from "./presenca-mysql";
import type { AttendanceFormValues } from "./schemas";

export async function addAttendance(data: AttendanceFormValues) {
  try {
    // Impedir duplicidade de CPF para todo o tempo
    const cleanCpf = (data.cpf || '').replace(/\D/g, '');
    const existing = await getPresencaByCpf(cleanCpf);
    if (existing) {
      return { success: false, error: "Já existe um registro para este CPF. Não é possível cadastrar novamente." };
    }
    // Insere no Firestore
    await addPresenca({
      fullName: data.fullName,
      cpf: cleanCpf,
      birthday: data.aniversario || "",
      reclassification: data.reclassification,
      pastorName: data.pastorName,
      region: data.region,
      churchPosition: data.churchPosition,
      city: data.city,
      shift: data.shift,
      status: "Presente"
    });
    return { success: true };
  } catch (e) {
    console.error("Error adding document: ", e);
    return { success: false, error: "Falha ao registrar presença. Verifique as configurações do banco de dados." };
  }
}

// Firebase: consulta todos os registros ou por filtros (data e status)
export async function getAttendanceRecords(params?: { 
  startDate?: string, 
  endDate?: string, 
  status?: string,
  region?: string,
  churchPosition?: string 
}) {
  // Utilitário para converter para início/fim do dia em America/Manaus
  function toManausDay(dateStr: string, endOfDay = false): Date {
    // Espera yyyy-mm-dd
    const [y, m, d] = dateStr.split("-");
    const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0));
    // Converte para Manaus
    return new Date(dt.toLocaleString("en-US", { timeZone: "America/Manaus" }));
  }

  // Se houver filtros de data, usa a função específica de range
  if (params && params.startDate && params.endDate) {
    const start = toManausDay(params.startDate, false);
    const end = toManausDay(params.endDate, true);
    let records = await getPresencasByDateRange(start, end);
    
    // Aplica filtros adicionais se necessário
    if (params.status) {
      records = records.filter(r => r.status === params.status);
    }
    if (params.region) {
      records = records.filter(r => r.region === params.region);
    }
    if (params.churchPosition) {
      records = records.filter(r => r.churchPosition === params.churchPosition);
    }
    
    return records;
  }

  // Busca todos os registros e aplica filtros localmente
  const all = await getPresencas();
  return all.filter(r => {
    let match = true;
    
    // Filtro por data
    if (params?.startDate) {
      const start = toManausDay(params.startDate, false);
      const registroDate = new Date(r.timestamp.toLocaleString("en-US", { timeZone: "America/Manaus" }));
      match = registroDate >= start;
    }
    if (params?.endDate) {
      const end = toManausDay(params.endDate, true);
      const registroDate = new Date(r.timestamp.toLocaleString("en-US", { timeZone: "America/Manaus" }));
      match = match && registroDate <= end;
    }
    
    // Filtro por status
    if (params?.status && match) {
      match = r.status === params.status;
    }
    
    // Filtro por região
    if (params?.region && match) {
      match = r.region === params.region;
    }
    
    // Filtro por cargo
    if (params?.churchPosition && match) {
      match = r.churchPosition === params.churchPosition;
    }
    
    return match;
  });
}


// Firebase: consulta estatísticas
export async function getAttendanceStats() {
  return await getPresencaStats();
}

// Firebase: consulta registros do dia
export async function getTodayAttendance() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return await getPresencasByDateRange(today, tomorrow);
}

// Função para excluir um registro de presença
export async function deleteAttendance(id: string) {
  try {
    await deleteAttendanceRecord(id);
    return { success: true };
  } catch (e) {
    console.error("Error deleting document: ", e);
    return { success: false, error: "Falha ao excluir registro de presença." };
  }
}
