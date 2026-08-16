import { collection, doc, getDocs, query, runTransaction, Timestamp, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import {
  buildAttendanceSessionKey,
  createMemberProfile,
  getMemberRecordByCpf,
  getAttendanceByCpfForSession,
  getManausDateKey,
  normalizeShift,
  normalizeCpf,
  upsertMemberProfile,
} from "./member-data";
import {
    deleteAttendanceRecord,
    getAllPresencas,
    getPresencas,
    getPresencasByCpf,
    getPresencasByDateRange,
    getPresencaStats,
    updateAttendanceRecord as updateAttendanceRecordFirebase,
    updateAttendanceStatus as updateAttendanceStatusBase,
} from "./presenca-mysql";
import type { AttendanceFormValues } from "./schemas";
import type { AttendanceRecord } from "./types";

const MANAUS_TIME_ZONE = "America/Manaus";

function formatManausTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    timeZone: MANAUS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function updateAttendanceStatus(id: string, status: string, absentReason?: string, timestamp?: Date) {
  return updateAttendanceStatusBase(id, status, absentReason, timestamp);
}

export async function updateAttendanceRecord(id: string, data: any) {
  const result = await updateAttendanceRecordFirebase(id, data);

  if (data && typeof data.cpf === "string" && normalizeCpf(data.cpf)) {
    await upsertMemberProfile(data, {
      lastPresenceAt: data.timestamp instanceof Date ? data.timestamp : undefined,
    });
  }

  return result;
}

export async function getAttendanceByCpf(cpf: string) {
  return getMemberRecordByCpf(cpf);
}

function buildAttendancePayloadFromMember(
  member: Partial<AttendanceRecord>,
  status: string,
  absentReason?: string,
  timestamp?: Date
) {
  const cleanCpf = normalizeCpf(member.cpf || "");
  const normalizedShift = normalizeShift(member.shift || "Manhã");
  const attendanceTimestamp = timestamp ?? new Date();

  return {
    fullName: member.fullName || "",
    cpf: cleanCpf,
    birthday: member.birthday || "",
    reclassification: member.reclassification || "",
    pastorName: member.pastorName || "",
    region: member.region || "",
    churchPosition: member.churchPosition || "",
    city: member.city || "",
    shift: normalizedShift,
    totvs: member.totvs || "",
    etda: member.etda || "",
    phone: member.phone || "",
    status,
    absentReason: absentReason || "",
    photoUrl: member.photoUrl ?? null,
    timestamp: attendanceTimestamp,
    createdAt: attendanceTimestamp,
    attendanceDateKey: getManausDateKey(attendanceTimestamp),
    attendanceKey: buildAttendanceSessionKey(cleanCpf, attendanceTimestamp, normalizedShift),
    memberId: cleanCpf,
  };
}

async function createAttendanceSessionRecord(
  payload: ReturnType<typeof buildAttendancePayloadFromMember>,
  referenceDate: Date,
  conflictBehavior: "error" | "update"
) {
  const attendanceKey = buildAttendanceSessionKey(payload.cpf, referenceDate, payload.shift);
  const attendanceDateKey = getManausDateKey(referenceDate);
  const docRef = doc(db, "attendance", attendanceKey);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);

    if (snap.exists()) {
      if (conflictBehavior === "error") {
        return { id: docRef.id, mode: "existing" as const };
      }

      transaction.update(docRef, {
        ...payload,
        attendanceKey,
        attendanceDateKey,
        timestamp: Timestamp.fromDate(referenceDate),
        lastUpdated: Timestamp.fromDate(referenceDate),
        updatedAt: Timestamp.fromDate(referenceDate),
      });

      return { id: docRef.id, mode: "updated" as const };
    }

    transaction.set(docRef, {
      ...payload,
      attendanceKey,
      attendanceDateKey,
      timestamp: Timestamp.fromDate(referenceDate),
      createdAt: Timestamp.fromDate(referenceDate),
      lastUpdated: Timestamp.fromDate(referenceDate),
      updatedAt: Timestamp.fromDate(referenceDate),
      sourceCollection: "attendance",
    });

    return { id: docRef.id, mode: "created" as const };
  });
}

export async function syncMemberProfile(
  data: Partial<AttendanceRecord> | AttendanceFormValues,
  options?: { lastPresenceAt?: Date | null }
) {
  return upsertMemberProfile(data, options);
}

export async function registerAttendanceByCpf(
  cpf: string,
  status: string = "Presente",
  absentReason?: string,
  timestamp: Date = new Date()
) {
  const cleanCpf = normalizeCpf(cpf);
  if (!cleanCpf) {
    return { success: false, error: "CPF invalido para registrar presenca." };
  }

  const member = await getMemberRecordByCpf(cleanCpf);
  if (!member) {
    return { success: false, error: `Pessoa com CPF ${cleanCpf} nao encontrada no cadastro.` };
  }

  const normalizedShift = normalizeShift(member.shift || "Manhã");

  const sessionRecord = await getAttendanceByCpfForSession(cleanCpf, normalizedShift, timestamp);

  if (sessionRecord) {
    await updateAttendanceStatusBase(sessionRecord.id, status, absentReason, timestamp);
    await upsertMemberProfile(
      {
        ...member,
        cpf: cleanCpf,
        shift: normalizedShift,
        status,
        absentReason,
      },
      { lastPresenceAt: timestamp }
    );

    return {
      success: true,
      id: sessionRecord.id,
      record: {
        ...sessionRecord.record,
        status,
        absentReason: absentReason || "",
        timestamp,
        lastUpdated: timestamp,
      } as AttendanceRecord,
      mode: "updated" as const,
    };
  }

  const payload = buildAttendancePayloadFromMember(
    {
      ...member,
      cpf: cleanCpf,
      shift: normalizedShift,
    },
    status,
    absentReason,
    timestamp
  );

  const created = await createAttendanceSessionRecord(payload, timestamp, "update");

  await upsertMemberProfile(
    {
      ...member,
      cpf: cleanCpf,
      shift: normalizedShift,
      status,
      absentReason,
    },
    { lastPresenceAt: timestamp }
  );

  return {
    success: true,
    id: created.id,
    record: {
      id: created.id,
      ...payload,
      timestamp,
      createdAt: timestamp,
      lastUpdated: timestamp,
      sourceCollection: "attendance",
    } as AttendanceRecord,
    mode: created.mode,
  };
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

// Firebase: histórico completo de um CPF, independente do período carregado na tela
export async function getAttendanceHistoryByCpf(cpf: string) {
  return await getPresencasByCpf(cpf);
}

export async function addAttendance(data: AttendanceFormValues) {
  try {
    const cleanCpf = normalizeCpf(data.cpf);
    const normalizedStatus = data.status || 'Presente';
    const normalizedShift = normalizeShift(data.shift || 'Manhã');
    const normalizedBirthday = data.birthday ? data.birthday.trim() : '';
    const currentTimestamp = new Date();
    const existingSession = await getAttendanceByCpfForSession(cleanCpf, normalizedShift, currentTimestamp);

    if (existingSession) {
      const recordedAt =
        existingSession.record.timestamp ??
        existingSession.record.lastUpdated ??
        existingSession.record.createdAt ??
        currentTimestamp;
      const timeLabel = recordedAt ? ` às ${formatManausTime(recordedAt)}` : "";

      console.log(`❌ CPF ${cleanCpf} já registrado na sessão ${normalizedShift}: ${existingSession.record.fullName}${timeLabel}`);
      return {
        success: false,
        error: `Este CPF (${data.cpf}) já possui um registro nesta sessão (${normalizedShift}) para ${existingSession.record.fullName}${timeLabel}. Se deseja apenas atualizar o status, use a página "Presença de Cadastrados".`,
      };
    }

    const registroData = buildAttendancePayloadFromMember(
      {
        ...data,
        cpf: cleanCpf,
        birthday: normalizedBirthday,
        shift: normalizedShift,
        status: normalizedStatus,
      } as Partial<AttendanceRecord>,
      normalizedStatus,
      undefined,
      currentTimestamp
    );
    
    console.log('📝 Dados do registro a serem salvos:');
    console.log('   - Nome:', registroData.fullName);
    console.log('   - CPF:', registroData.cpf);
    console.log('   - Sessão:', registroData.attendanceKey);
    console.log('   - Photo URL presente?', registroData.photoUrl ? 'SIM ✅' : 'NÃO ❌');
    if (registroData.photoUrl) {
      console.log('   - Photo URL tipo:', registroData.photoUrl.startsWith('data:') ? 'BASE64' : 'URL');
      console.log('   - Photo URL tamanho:', Math.round(registroData.photoUrl.length / 1024), 'KB');
    }

    const created = await createAttendanceSessionRecord(registroData, currentTimestamp, "error");
    if (created.mode === "existing") {
      return {
        success: false,
        error: `Este CPF (${data.cpf}) já acabou de ser registrado nesta sessão (${normalizedShift}). Atualize a lista antes de tentar novamente.`,
      };
    }

    await upsertMemberProfile(
      {
        ...data,
        cpf: cleanCpf,
        birthday: normalizedBirthday,
        shift: normalizedShift,
        status: normalizedStatus,
      },
      { lastPresenceAt: currentTimestamp }
    );

    console.log(`✅ Registro criado com sucesso para ${data.fullName} (CPF: ${data.cpf}) - ID: ${created.id}`);
    return { success: true, id: created.id };
  } catch (e) {
    console.error("❌ Error adding document: ", e);
    return { success: false, error: "Falha ao registrar presença. Verifique as configurações do banco de dados." };
  }
}

// Cadastro de membro na coleção "members" (sem registrar presença)
export async function addMember(data: AttendanceFormValues) {
  try {
    const cleanCpf = normalizeCpf(data.cpf);
    if (!cleanCpf) {
      return { success: false, error: 'CPF inválido para cadastro de membro.' };
    }

    await createMemberProfile({
      ...data,
      cpf: cleanCpf,
      shift: normalizeShift(data.shift || "Manhã"),
      status: data.status || 'Ausente',
    });

    return { success: true };
  } catch (error) {
    console.error('Erro ao cadastrar membro:', error);
    if (error instanceof Error && error.message === "MEMBER_ALREADY_EXISTS") {
      return {
        success: false,
        error: "Ja existe um membro cadastrado com este CPF. Para evitar sobrescrever dados, use a tela de edicao em vez de cadastrar novamente.",
      };
    }
    return { success: false, error: 'Falha ao cadastrar o membro.' };
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
    const normalized = dateStr.includes("T") ? dateStr.slice(0, 10) : dateStr;
    const [y, m, d] = normalized.split("-");
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
    let photoUrl: string | null = null;
    let deletedByApi = false;

    const currentUser = auth.currentUser;

    if (currentUser) {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/admin/attendance", {
        method: "DELETE",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      let payload: any = null;

      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (response.ok && payload?.success) {
        photoUrl = typeof payload.photoUrl === "string" ? payload.photoUrl : null;
        deletedByApi = true;
      } else if (![404, 405, 501].includes(response.status)) {
        return {
          success: false,
          error: payload?.message || "Falha ao excluir registro de presença.",
        };
      }
    }

    if (!deletedByApi) {
      const deletedRecord = await deleteAttendanceRecord(id);
      photoUrl = typeof deletedRecord.photoUrl === "string" ? deletedRecord.photoUrl : null;
    }
    
    // Se tinha foto, deletar do Storage
    if (photoUrl) {
      try {
        const { getStoragePathFromUrl, deleteAttendancePhoto } = await import('@/lib/attendance-photo');
        const storagePath = getStoragePathFromUrl(photoUrl);
        
        if (storagePath) {
          await deleteAttendancePhoto(storagePath);
          console.log('🗑️ Foto excluída do Storage:', storagePath);
        }
      } catch (photoError) {
        console.warn('⚠️ Erro ao excluir foto, mas registro foi deletado:', photoError);
        // Continua mesmo se falhar ao deletar a foto
      }
    }
    
    return { success: true };
  } catch (e) {
    console.error("Error deleting document: ", e);
    return { success: false, error: "Falha ao excluir registro de presença." };
  }
}
