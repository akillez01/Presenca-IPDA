// Função para retornar os dados do dashboard principal (dados reais do banco)
export async function getDashboardPrincipal(): Promise<{
  presentesHoje: number;
  justificadosHoje: number;
  ausentesHoje: number;
  taxaPresencaHoje: number;
  totalHoje: number;
  totalGeral: number;
}> {
  // Calcula início e fim do dia em America/Manaus
  const nowManaus = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Manaus' }));
  const inicioManaus = new Date(Date.UTC(nowManaus.getFullYear(), nowManaus.getMonth(), nowManaus.getDate(), 0, 0, 0));
  const fimManaus = new Date(Date.UTC(nowManaus.getFullYear(), nowManaus.getMonth(), nowManaus.getDate(), 23, 59, 59, 999));
  // Busca registros de hoje
  const qHoje = query(
    collection(db, "attendance"),
    where("createdAt", ">=", Timestamp.fromDate(inicioManaus)),
    where("createdAt", "<=", Timestamp.fromDate(fimManaus))
  );
  const snapshotHoje = await getDocs(qHoje);
  let presentesHoje = 0, justificadosHoje = 0, ausentesHoje = 0;
  snapshotHoje.docs.forEach(doc => {
    const data = doc.data();
    if (data.status === "Presente") presentesHoje++;
    else if (data.status === "Justificado") justificadosHoje++;
    else if (data.status === "Ausente") ausentesHoje++;
  });
  const totalHoje = snapshotHoje.docs.length;
  const taxaPresencaHoje = totalHoje > 0 ? Math.round((presentesHoje / totalHoje) * 10000) / 100 : 0;
  // Busca total geral
  const snapshotGeral = await getDocs(collection(db, "attendance"));
  const totalGeral = snapshotGeral.docs.length;
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
  // Calcula início e fim dos últimos 7 dias em America/Manaus
  const nowManaus = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Manaus' }));
  const inicio = new Date(Date.UTC(nowManaus.getFullYear(), nowManaus.getMonth(), nowManaus.getDate()-6, 0, 0, 0));
  const fim = new Date(Date.UTC(nowManaus.getFullYear(), nowManaus.getMonth(), nowManaus.getDate(), 23, 59, 59, 999));
  const q = query(
    collection(db, "attendance"),
    where("createdAt", ">=", Timestamp.fromDate(inicio)),
    where("createdAt", "<=", Timestamp.fromDate(fim))
  );
  const snapshot = await getDocs(q);
  // Monta array de presenças
  const presencas: Presenca[] = snapshot.docs.map(doc => {
    const data = doc.data();
    let createdAt: Date = new Date();
    if (data.createdAt) {
      if (typeof data.createdAt.toDate === "function") {
        createdAt = data.createdAt.toDate();
      } else if (data.createdAt instanceof Date) {
        createdAt = data.createdAt;
      } else if (typeof data.createdAt === "number") {
        createdAt = new Date(data.createdAt);
      } else if (typeof data.createdAt === "string") {
        const d = new Date(data.createdAt);
        if (!isNaN(d.getTime())) createdAt = d;
      }
    }
    return {
      id: doc.id,
      timestamp: createdAt,
      fullName: data.fullName ?? "",
      cpf: data.cpf ?? "",
      birthday: data.birthday ?? "",
      reclassification: data.reclassification ?? "",
      pastorName: data.pastorName ?? "",
      region: data.region ?? "",
      churchPosition: data.churchPosition ?? "",
      city: data.city ?? "",
      shift: data.shift ?? "",
      status: data.status ?? "",
      createdAt,
    };
  });
  // Usa função utilitária para agrupar por dia
  return agruparPresencasPorDia(presencas);
}
// Função para retornar o total de presentes do dia atual (UTC)
export async function getPresentesHoje(): Promise<number> {
  const hoje = new Date();
  // UTC: considera o início e fim do dia em UTC
  const inicioUTC = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0));
  const fimUTC = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999));
  const q = query(
    collection(db, "attendance"),
    where("createdAt", ">=", Timestamp.fromDate(inicioUTC)),
    where("createdAt", "<=", Timestamp.fromDate(fimUTC))
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.filter(doc => {
    const data = doc.data();
    return data.status === "Presente";
  }).length;
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
    if (!p.createdAt) return;
    // Converte para o timezone de Manaus
    const d = new Date(p.createdAt.toLocaleString('en-US', { timeZone: 'America/Manaus' }));
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
import { collection, deleteDoc, doc, getDocs, query, Timestamp, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";

// Função utilitária para processar timestamps do Firestore
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

// Função utilitária para mapear documentos do Firestore para o tipo Presenca
function mapDocumentToPresenca(doc: any): Presenca {
  const data = doc.data();
  
  // Prioriza timestamp sobre createdAt para exibir a data mais recente
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
    fullName: data.fullName ?? "",
    cpf: data.cpf ?? "",
    birthday: data.birthday ?? "",
    reclassification: data.reclassification ?? "",
    pastorName: data.pastorName ?? "",
    region: data.region ?? "",
    churchPosition: data.churchPosition ?? "",
    city: data.city ?? "",
    shift: data.shift ?? "",
    status: data.status ?? "",
    absentReason: data.absentReason ?? "",
    createdAt,
  };
}

// Atualiza o status de presença de um membro pelo id
export async function updateAttendanceStatus(id: string, status: string, absentReason?: string, timestamp?: Date) {
  const docRef = doc(db, "attendance", id);
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
  
  // Converte timestamp se fornecido
  if (data.timestamp) {
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
  status: string;
  absentReason?: string; // Motivo da falta/justificativa
  createdAt?: Date;
};

export async function getPresencas(): Promise<Presenca[]> {
  const snapshot = await getDocs(collection(db, "attendance"));
  return snapshot.docs.map(mapDocumentToPresenca);
}

export async function addPresenca(data: Omit<Presenca, 'id' | 'timestamp' | 'createdAt'>) {
  const { addDoc } = await import("firebase/firestore");
  // Garante que o campo timestamp seja preenchido corretamente
  const now = new Date();
  const docRef = await addDoc(collection(db, "attendance"), {
    ...data,
    timestamp: Timestamp.fromDate(now),
    createdAt: Timestamp.fromDate(now),
  });
  return docRef.id;
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
        status: data.status ?? "",
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
      status: data.status ?? "",
      createdAt,
    } as Presenca;
  }
  return null;
}

export async function getAllPresencas(): Promise<Presenca[]> {
  const snapshot = await getDocs(collection(db, "attendance"));
  return snapshot.docs.map(mapDocumentToPresenca);
}

export async function getPresencasByDateRange(start: Date, end: Date): Promise<Presenca[]> {
  // Garante que o filtro sempre considera o início e fim do dia em America/Manaus
  const startManaus = new Date(new Date(start).toLocaleString('en-US', { timeZone: 'America/Manaus' }));
  const endManaus = new Date(new Date(end).toLocaleString('en-US', { timeZone: 'America/Manaus' }));
  const startDay = new Date(Date.UTC(startManaus.getFullYear(), startManaus.getMonth(), startManaus.getDate(), 0, 0, 0));
  const endDay = new Date(Date.UTC(endManaus.getFullYear(), endManaus.getMonth(), endManaus.getDate(), 23, 59, 59, 999));
  const q = query(
    collection(db, "attendance"),
    where("createdAt", ">=", Timestamp.fromDate(startDay)),
    where("createdAt", "<=", Timestamp.fromDate(endDay))
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(mapDocumentToPresenca)
    .filter((p: Presenca) => p.createdAt && p.createdAt instanceof Date);
}

// Nova função para filtrar por status específico
export async function getPresencasByStatus(status: string): Promise<Presenca[]> {
  const q = query(collection(db, "attendance"), where("status", "==", status));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapDocumentToPresenca);
}

// Nova função para filtrar por status e data
export async function getPresencasByStatusAndDate(status: string, start: Date, end: Date): Promise<Presenca[]> {
  const startManaus = new Date(new Date(start).toLocaleString('en-US', { timeZone: 'America/Manaus' }));
  const endManaus = new Date(new Date(end).toLocaleString('en-US', { timeZone: 'America/Manaus' }));
  const startDay = new Date(Date.UTC(startManaus.getFullYear(), startManaus.getMonth(), startManaus.getDate(), 0, 0, 0));
  const endDay = new Date(Date.UTC(endManaus.getFullYear(), endManaus.getMonth(), endManaus.getDate(), 23, 59, 59, 999));
  
  const q = query(
    collection(db, "attendance"),
    where("status", "==", status),
    where("createdAt", ">=", Timestamp.fromDate(startDay)),
    where("createdAt", "<=", Timestamp.fromDate(endDay))
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapDocumentToPresenca);
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
  await deleteDoc(docRef);
}
