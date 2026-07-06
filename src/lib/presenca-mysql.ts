// Função para retornar os dados do dashboard principal (dados reais do banco)
export async function getDashboardPrincipal(): Promise<{
  presentesHoje: number;
  justificadosHoje: number;
  ausentesHoje: number;
  taxaPresencaHoje: number;
  totalHoje: number;
  totalGeral: number;
}> {
  const nowManaus = new Date(new Date().toLocaleString("en-US", { timeZone: MANAUS_TIME_ZONE }));
  const presencasHoje = await getPresencasByDateRange(nowManaus, nowManaus);
  let presentesHoje = 0, justificadosHoje = 0, ausentesHoje = 0;
  presencasHoje.forEach((presenca) => {
    if (presenca.status === "Presente") presentesHoje++;
    else if (presenca.status === "Justificado") justificadosHoje++;
    else if (presenca.status === "Ausente") ausentesHoje++;
  });
  const totalHoje = presencasHoje.length;
  const taxaPresencaHoje = totalHoje > 0 ? Math.round((presentesHoje / totalHoje) * 10000) / 100 : 0;
  // Busca total geral
  const countSnapshot = await getCountFromServer(collection(db, "attendance"));
  const totalGeral = countSnapshot.data().count;
  return {
    presentesHoje,
    justificadosHoje,
    ausentesHoje,
    taxaPresencaHoje,
    totalHoje,
    totalGeral,
  };
}
// Função para detalhar os últimos 7 dias de presença (dados reais do banco)
export async function getResumoUltimos7Dias(): Promise<Array<{
  data: string;
  total: number;
  presentes: number;
  justificados: number;
  ausentes: number;
  porcentagem: number;
}>> {
  const nowManaus = new Date(new Date().toLocaleString("en-US", { timeZone: MANAUS_TIME_ZONE }));
  const inicio = new Date(Date.UTC(nowManaus.getFullYear(), nowManaus.getMonth(), nowManaus.getDate() - 6, 0, 0, 0));
  const fim = new Date(Date.UTC(nowManaus.getFullYear(), nowManaus.getMonth(), nowManaus.getDate(), 23, 59, 59, 999));
  const presencas = await getPresencasByDateRange(inicio, fim);

  return agruparPresencasPorDia(presencas);
}
// Função para retornar o total de presentes do dia atual (UTC)
export async function getPresentesHoje(): Promise<number> {
  const presencasHoje = await getPresencasByDateRange(new Date(), new Date());
  return presencasHoje.filter((presenca) => presenca.status === "Presente").length;
}
// Função utilitária para agrupar presenças por dia
export function agruparPresencasPorDia(presencas: Presenca[]): Array<{
  data: string;
  total: number;
  presentes: number;
  justificados: number;
  ausentes: number;
  porcentagem: number;
}> {
  // Agrupa por data (YYYY-MM-DD) considerando timezone de Manaus
  const grupos: Record<string, Presenca[]> = {};
  presencas.forEach(p => {
    const effectiveDate = getEffectiveAttendanceDate(p);
    if (!effectiveDate) return;
    // Converte para o timezone de Manaus
    const d = new Date(effectiveDate.toLocaleString('en-US', { timeZone: MANAUS_TIME_ZONE }));
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(p);
  });
  // Monta o array de resultados
  return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b)).map(([data, arr]) => {
    const total = arr.length;
    const presentes = arr.filter(p => p.status === "Presente").length;
    const justificados = arr.filter(p => p.status === "Justificado").length;
    const ausentes = arr.filter(p => p.status === "Ausente").length;
    const porcentagem = total > 0 ? Math.round((presentes / total) * 10000) / 100 : 0;
    return { data, total, presentes, justificados, ausentes, porcentagem };
  });
}
import { Timestamp, collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";

const MANAUS_TIME_ZONE = "America/Manaus";

// Retorna null quando não há data válida — evita poluir filtros de data com "agora"
function processFirebaseTimestamp(data: any, field: 'timestamp' | 'createdAt'): Date | null {
  const value = data[field];
  if (!value) return null;

  try {
    if (typeof value.toDate === "function") {
      const d = value.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    }
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === "number") {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === "string") {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
  } catch {
    // timestamp malformado — não propagar
  }

  return null;
}

function getEffectiveAttendanceDate(presenca: Pick<Presenca, "timestamp" | "createdAt">): Date | null {
  const value = presenca.timestamp ?? presenca.createdAt ?? null;
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null;
}

function getTimeZoneOffsetMinutes(referenceDate: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(referenceDate);

  const offsetPart = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  const match = offsetPart.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);

  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);

  return sign * (hours * 60 + minutes);
}

function toUtcFromManausLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number
) {
  const utcGuess = new Date(Date.UTC(year, month, day, hour, minute, second, millisecond));
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, MANAUS_TIME_ZONE);

  return new Date(utcGuess.getTime() - offsetMinutes * 60_000);
}

function buildManausDayRange(start: Date, end: Date) {
  const startManaus = new Date(new Date(start).toLocaleString("en-US", { timeZone: MANAUS_TIME_ZONE }));
  const endManaus = new Date(new Date(end).toLocaleString("en-US", { timeZone: MANAUS_TIME_ZONE }));

  return {
    startDay: toUtcFromManausLocal(
      startManaus.getFullYear(),
      startManaus.getMonth(),
      startManaus.getDate(),
      0,
      0,
      0,
      0
    ),
    endDay: toUtcFromManausLocal(
      endManaus.getFullYear(),
      endManaus.getMonth(),
      endManaus.getDate(),
      23,
      59,
      59,
      999
    ),
  };
}

// Função utilitária para mapear documentos do Firestore para o tipo Presenca
function mapDocumentToPresenca(doc: any): Presenca {
  const data = doc.data();

  // Prioriza timestamp; usa createdAt como fallback; nunca usa "agora" como data de registro
  const timestamp =
    processFirebaseTimestamp(data, 'timestamp') ??
    processFirebaseTimestamp(data, 'createdAt') ??
    new Date(0); // epoch — indica dado sem data válida, visível nos filtros como 01/01/1970

  const createdAt = processFirebaseTimestamp(data, 'createdAt') ?? timestamp;

  return {
    id: doc.id,
    timestamp,
    fullName: data.fullName ?? "",
    cpf: data.cpf ?? "",
    birthday: data.birthday ?? "",
    reclassification: data.reclassification ?? "",
    pastorName: data.pastorName ?? "",
    region: data.region ?? "",
    churchPosition: data.churchPosition ?? "",
    city: data.city ?? "",
    shift: data.shift ?? "",
    totvs: data.totvs ?? "",
    etda: data.etda ?? "",
    status: data.status ?? "",
    absentReason: data.absentReason ?? "",
    photoUrl: data.photoUrl ?? null,
    createdAt,
  };
}

// Atualiza o status de presença de um membro pelo id
export async function updateAttendanceStatus(id: string, status: string, absentReason?: string, timestamp?: Date) {
  const docRef = doc(db, "attendance", id);
  
  // ✅ PROTEÇÃO CONTRA DUPLICAÇÃO: Verificar se já foi registrado hoje
  const docSnapshot = await getDoc(docRef);
  if (docSnapshot.exists()) {
    const currentData = docSnapshot.data();
    const now = new Date();
    
    // Verificar se já tem o mesmo status registrado recentemente
    if (currentData.status === status && currentData.lastUpdated) {
      const lastUpdate = currentData.lastUpdated.toDate();
      const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
      
      // Se foi atualizado com o mesmo status há menos de 5 minutos, bloquear
      if (diffMinutes < 5) {
        const nome = currentData.fullName || "pessoa";
        throw new Error(`❌ ${nome} já tem status "${status}" registrado há ${Math.round(diffMinutes)} minuto(s). Duplicação bloqueada.`);
      }
    }
  }
  
  const updateData: any = { 
    status,
    lastUpdated: timestamp ? Timestamp.fromDate(timestamp) : Timestamp.now()
  };
  
  if (absentReason !== undefined) {
    updateData.absentReason = absentReason;
  }
  
  // Atualiza timestamp se fornecido
  if (timestamp) {
    updateData.timestamp = Timestamp.fromDate(timestamp);
  }
  
  await updateDoc(docRef, updateData);
}

// Atualiza todos os campos de um registro de presença
export async function updateAttendanceRecord(id: string, data: Partial<Presenca>) {
  const docRef = doc(db, "attendance", id);
  const updateData: any = {
    ...data,
    lastUpdated: Timestamp.now()
  };
  
  // Remove campos undefined para não sobrescrever com valores vazios
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });
  
  // ✅ PROTEÇÃO: Remove timestamp se não for explicitamente para registrar presença
  // timestamp só deve ser atualizado via updateAttendanceStatus, não via updateAttendanceRecord
  if (updateData.timestamp && !data.timestamp) {
    delete updateData.timestamp;
  }
  
  // Converte timestamp se fornecido EXPLICITAMENTE (para registrar presença)
  if (data.timestamp && data.timestamp instanceof Date) {
    updateData.timestamp = Timestamp.fromDate(data.timestamp);
  }
  
  await updateDoc(docRef, updateData);
}

export type Presenca = {
  id: string;
  timestamp: Date;
  fullName: string;
  cpf: string;
  birthday?: string; // Campo de aniversário
  reclassification: string;
  pastorName: string;
  region: string;
  churchPosition: string;
  city: string;
  shift: string;
  totvs?: string;
  etda?: string;
  status: string;
  absentReason?: string; // Motivo da falta/justificativa
  createdAt?: Date;
  photoUrl?: string | null;
};

export async function getPresencas(): Promise<Presenca[]> {
  const snapshot = await getDocs(collection(db, "attendance"));
  return snapshot.docs.map(mapDocumentToPresenca);
}

// @deprecated — use registerAttendanceByCpf em actions.ts que garante chave determinística e anti-duplicação por transação.
export async function addPresenca(
  data: Omit<Presenca, 'id' | 'timestamp' | 'createdAt'> & {
    timestamp?: Date;
    createdAt?: Date;
    shift?: string;
    cpf?: string;
  }
) {
  const { setDoc, doc: firestoreDoc, runTransaction } = await import("firebase/firestore");

  const now = data.timestamp ?? data.createdAt ?? new Date();
  const cleanCpf = (data.cpf ?? '').replace(/\D/g, '');
  const shift = (data.shift ?? 'Manhã').trim() || 'Manhã';

  // Chave determinística: {data}__{turno}__{cpf}  — impede duplicatas mesmo com ID aleatório
  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Manaus', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const shiftSlug = shift.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const deterministicId = cleanCpf ? `${dateKey}__${shiftSlug}__${cleanCpf}` : `${dateKey}__${shiftSlug}__${Date.now()}`;

  const docRef = firestoreDoc(db, 'attendance', deterministicId);

  const documentData = {
    ...data,
    attendanceKey: deterministicId,
    attendanceDateKey: dateKey,
    timestamp: Timestamp.fromDate(now),
    createdAt: Timestamp.fromDate(now),
  };

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef);
    if (snap.exists()) return; // já existe — não sobrescreve
    tx.set(docRef, documentData);
  });

  return deterministicId;
}

export async function getAttendance(): Promise<Presenca[]> {
  const snapshot = await getDocs(collection(db, "attendance"));
  return snapshot.docs
    .map((doc: any) => {
      const data = doc.data();
      let createdAt: Date | undefined = undefined;
      if (data.createdAt) {
        if (typeof data.createdAt.toDate === "function") {
          createdAt = data.createdAt.toDate();
        } else if (data.createdAt instanceof Date) {
          createdAt = data.createdAt;
        } else if (typeof data.createdAt === "number") {
          createdAt = new Date(data.createdAt);
        }
      }
      return {
        id: doc.id,
        fullName: data.fullName ?? "",
        cpf: data.cpf ?? "",
        birthday: data.birthday ?? "",
        reclassification: data.reclassification ?? "",
        pastorName: data.pastorName ?? "",
        region: data.region ?? "",
        churchPosition: data.churchPosition ?? "",
        city: data.city ?? "",
        shift: data.shift ?? "",
        totvs: data.totvs ?? "",
        etda: data.etda ?? "",
        status: data.status ?? "",
        photoUrl: data.photoUrl ?? null,
        createdAt,
      } as Presenca;
    })
    .filter((p: Presenca) => p.createdAt && p.createdAt instanceof Date);
}

export async function getPresencaByCpf(cpf: string): Promise<Presenca | null> {
  const q = query(collection(db, "attendance"), where("cpf", "==", cpf));
  const snapshot = await getDocs(q);
  if (snapshot.docs.length > 0) {
    const doc = snapshot.docs[0];
    const data = doc.data();
    let createdAt: Date | undefined = undefined;
    if (data.createdAt) {
      if (typeof data.createdAt.toDate === "function") {
        createdAt = data.createdAt.toDate();
      } else if (data.createdAt instanceof Date) {
        createdAt = data.createdAt;
      } else if (typeof data.createdAt === "number") {
        createdAt = new Date(data.createdAt);
      }
    }
    return {
      id: doc.id,
      fullName: data.fullName ?? "",
      cpf: data.cpf ?? "",
      birthday: data.birthday ?? "",
      reclassification: data.reclassification ?? "",
      pastorName: data.pastorName ?? "",
      region: data.region ?? "",
      churchPosition: data.churchPosition ?? "",
      city: data.city ?? "",
      shift: data.shift ?? "",
      totvs: data.totvs ?? "",
      etda: data.etda ?? "",
      status: data.status ?? "",
        photoUrl: data.photoUrl ?? null,
      createdAt,
    } as Presenca;
  }
  return null;
}

export async function getAllPresencas(): Promise<Presenca[]> {
  const q = query(
    collection(db, "attendance"),
    orderBy("timestamp", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapDocumentToPresenca);
}

export async function getPresencasByDateRange(start: Date, end: Date): Promise<Presenca[]> {
  const { startDay, endDay } = buildManausDayRange(start, end);
  const q = query(
    collection(db, "attendance"),
    where("timestamp", ">=", Timestamp.fromDate(startDay)),
    where("timestamp", "<=", Timestamp.fromDate(endDay))
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapDocumentToPresenca);
}

// Nova função para filtrar por status específico
export async function getPresencasByStatus(status: string): Promise<Presenca[]> {
  const q = query(collection(db, "attendance"), where("status", "==", status));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapDocumentToPresenca);
}

// Nova função para filtrar por status e data
export async function getPresencasByStatusAndDate(status: string, start: Date, end: Date): Promise<Presenca[]> {
  const presencas = await getPresencasByDateRange(start, end);
  return presencas.filter((presenca) => presenca.status === status);
}

export async function getPresencasByRegion(region: string): Promise<Presenca[]> {
  const q = query(collection(db, "attendance"), where("region", "==", region));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapDocumentToPresenca);
}

export async function getPresencaStats() {
  const snapshot = await getDocs(collection(db, "attendance"));
  const rows = snapshot.docs.map(doc => doc.data());
  const stats: any = {
    total: rows.length,
    present: rows.filter((r: any) => r.status === "Presente").length,
    justified: rows.filter((r: any) => r.status === "Justificado").length,
    absent: rows.filter((r: any) => r.status === "Ausente").length,
    byShift: {} as Record<string, number>,
    byRegion: {} as Record<string, number>,
    byPosition: {} as Record<string, number>,
    byReclassification: {} as Record<string, number>,
  };
  for (const r of rows) {
    if (r.status === "Presente") {
      stats.byShift[r.shift] = (stats.byShift[r.shift] || 0) + 1;
      stats.byRegion[r.region] = (stats.byRegion[r.region] || 0) + 1;
      stats.byPosition[r.churchPosition] = (stats.byPosition[r.churchPosition] || 0) + 1;
      stats.byReclassification[r.reclassification] = (stats.byReclassification[r.reclassification] || 0) + 1;
    }
  }
  stats.attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 10000) / 100 : 0;
  return stats;
}

// Função para excluir um registro de presença
export async function deleteAttendanceRecord(id: string) {
  const docRef = doc(db, "attendance", id);
  
  // Buscar o documento antes de deletar para pegar a URL da foto
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data();
    const photoUrl = data.photoUrl;
    
    // Se tem foto, retornar URL para exclusão (será deletada em actions.ts)
    await deleteDoc(docRef);
    
    return { photoUrl };
  }
  
  await deleteDoc(docRef);
  return { photoUrl: null };
}
