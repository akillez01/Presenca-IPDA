import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  startAfter,
  Timestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { AttendanceFormValues } from "@/lib/schemas";
import type { AttendanceRecord } from "@/lib/types";

const MANAUS_TIME_ZONE = "America/Manaus";

type FirestoreLikeRecord = Partial<AttendanceRecord> & Record<string, unknown>;

function toDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const parsed = (value as { toDate?: () => Date }).toDate?.();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }

  if (typeof value === "number" || typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

export function normalizeCpf(value: string | undefined | null) {
  return (value || "").replace(/\D/g, "");
}

export function normalizeShift(value: string | undefined | null) {
  const normalized = (value || "").trim();
  return normalized || "Manhã";
}

export function getManausDateKey(referenceDate: Date = new Date()) {
  const manausDate = new Date(
    referenceDate.toLocaleString("en-US", { timeZone: MANAUS_TIME_ZONE })
  );

  return `${manausDate.getFullYear()}-${String(manausDate.getMonth() + 1).padStart(2, "0")}-${String(
    manausDate.getDate()
  ).padStart(2, "0")}`;
}

function slugifyShift(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildAttendanceSessionKey(
  cpf: string,
  referenceDate: Date = new Date(),
  shift?: string | null
) {
  const cleanCpf = normalizeCpf(cpf);
  const normalizedShift = normalizeShift(shift);
  const dateKey = getManausDateKey(referenceDate);

  return `${dateKey}__${slugifyShift(normalizedShift)}__${cleanCpf}`;
}

function toAttendanceLikeRecord(
  id: string,
  data: FirestoreLikeRecord,
  sourceCollection: AttendanceRecord["sourceCollection"]
): AttendanceRecord {
  const timestamp =
    toDate(data.timestamp) ??
    toDate(data.lastPresenceAt) ??
    toDate(data.createdAt) ??
    toDate(data.updatedAt) ??
    new Date();
  const createdAt = toDate(data.createdAt) ?? timestamp;

  return {
    id,
    memberId: id,
    sourceCollection,
    timestamp,
    createdAt,
    updatedAt: toDate(data.updatedAt) ?? undefined,
    lastUpdated: toDate(data.lastUpdated) ?? undefined,
    lastPresenceAt: toDate(data.lastPresenceAt),
    fullName: typeof data.fullName === "string" ? data.fullName : "",
    cpf: normalizeCpf(typeof data.cpf === "string" ? data.cpf : id),
    birthday: typeof data.birthday === "string" ? data.birthday : "",
    cfoCourse: typeof data.cfoCourse === "string" ? data.cfoCourse : undefined,
    reclassification: typeof data.reclassification === "string" ? data.reclassification : "",
    pastorName: typeof data.pastorName === "string" ? data.pastorName : "",
    region: typeof data.region === "string" ? data.region : "",
    churchPosition: typeof data.churchPosition === "string" ? data.churchPosition : "",
    city: typeof data.city === "string" ? data.city : "",
    shift: typeof data.shift === "string" ? data.shift : "",
    totvs: typeof data.totvs === "string" ? data.totvs : "",
    etda: typeof data.etda === "string" ? data.etda : "",
    phone: typeof data.phone === "string" ? data.phone : undefined,
    status: typeof data.status === "string" ? data.status : "Ausente",
    photoUrl: typeof data.photoUrl === "string" ? data.photoUrl : data.photoUrl === null ? null : null,
    absentReason: typeof data.absentReason === "string" ? data.absentReason : "",
  };
}

function getRecordSortTime(record: AttendanceRecord) {
  return (
    record.lastPresenceAt?.getTime() ??
    record.timestamp?.getTime() ??
    record.createdAt?.getTime() ??
    0
  );
}

function isSameManausDay(left: Date, right: Date) {
  const leftManaus = new Date(left.toLocaleString("en-US", { timeZone: MANAUS_TIME_ZONE }));
  const rightManaus = new Date(right.toLocaleString("en-US", { timeZone: MANAUS_TIME_ZONE }));

  return (
    leftManaus.getFullYear() === rightManaus.getFullYear() &&
    leftManaus.getMonth() === rightManaus.getMonth() &&
    leftManaus.getDate() === rightManaus.getDate()
  );
}

export function extractMemberProfileFields(
  data: Partial<AttendanceRecord> | AttendanceFormValues
) {
  const cpf = normalizeCpf(typeof data.cpf === "string" ? data.cpf : "");

  return {
    cpf,
    fullName: typeof data.fullName === "string" ? data.fullName : "",
    birthday: typeof data.birthday === "string" ? data.birthday : "",
    cfoCourse: typeof data.cfoCourse === "string" ? data.cfoCourse : "",
    reclassification: typeof data.reclassification === "string" ? data.reclassification : "",
    pastorName: typeof data.pastorName === "string" ? data.pastorName : "",
    region: typeof data.region === "string" ? data.region : "",
    churchPosition: typeof data.churchPosition === "string" ? data.churchPosition : "",
    city: typeof data.city === "string" ? data.city : "",
    shift: typeof data.shift === "string" ? data.shift : "",
    totvs: typeof data.totvs === "string" ? data.totvs : "",
    etda: typeof data.etda === "string" ? data.etda : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    photoUrl:
      typeof data.photoUrl === "string"
        ? data.photoUrl
        : data.photoUrl === null
          ? null
          : null,
    status: typeof data.status === "string" ? data.status : "Ausente",
  };
}

export async function upsertMemberProfile(
  data: Partial<AttendanceRecord> | AttendanceFormValues,
  options?: { lastPresenceAt?: Date | null }
) {
  const profile = extractMemberProfileFields(data);
  if (!profile.cpf) {
    throw new Error("CPF invalido para sincronizacao de membro.");
  }

  const memberRef = doc(db, "members", profile.cpf);
  const memberSnap = await getDoc(memberRef);
  const existingData = memberSnap.exists() ? (memberSnap.data() as FirestoreLikeRecord) : null;
  const createdAt = toDate(existingData?.createdAt) ?? new Date();
  const existingLastPresenceAt = toDate(existingData?.lastPresenceAt);
  const nextLastPresenceAt =
    options?.lastPresenceAt ?? existingLastPresenceAt ?? null;

  await setDoc(
    memberRef,
    {
      ...profile,
      createdAt: Timestamp.fromDate(createdAt),
      updatedAt: Timestamp.now(),
      lastPresenceAt: nextLastPresenceAt ? Timestamp.fromDate(nextLastPresenceAt) : null,
      memberId: profile.cpf,
      sourceCollection: "members",
    },
    { merge: true }
  );

  invalidateMemberDirectoryCache();

  const savedSnap = await getDoc(memberRef);
  return savedSnap.exists()
    ? toAttendanceLikeRecord(savedSnap.id, savedSnap.data() as FirestoreLikeRecord, "members")
    : null;
}

export async function createMemberProfile(
  data: Partial<AttendanceRecord> | AttendanceFormValues
) {
  const profile = extractMemberProfileFields(data);
  if (!profile.cpf) {
    throw new Error("CPF invalido para cadastro de membro.");
  }

  const memberRef = doc(db, "members", profile.cpf);

  await runTransaction(db, async (transaction) => {
    const memberSnap = await transaction.get(memberRef);

    if (memberSnap.exists()) {
      throw new Error("MEMBER_ALREADY_EXISTS");
    }

    const now = Timestamp.now();

    transaction.set(memberRef, {
      ...profile,
      createdAt: now,
      updatedAt: now,
      lastPresenceAt: null,
      memberId: profile.cpf,
      sourceCollection: "members",
    });
  });

  invalidateMemberDirectoryCache();

  const savedSnap = await getDoc(memberRef);
  return savedSnap.exists()
    ? toAttendanceLikeRecord(savedSnap.id, savedSnap.data() as FirestoreLikeRecord, "members")
    : null;
}

export async function getMemberRecordByCpf(cpf: string): Promise<AttendanceRecord | null> {
  const cleanCpf = normalizeCpf(cpf);
  if (!cleanCpf) return null;

  const memberRef = doc(db, "members", cleanCpf);
  const memberSnap = await getDoc(memberRef);

  if (memberSnap.exists()) {
    return toAttendanceLikeRecord(memberSnap.id, memberSnap.data() as FirestoreLikeRecord, "members");
  }

  const attendanceQuery = query(collection(db, "attendance"), where("cpf", "==", cleanCpf));
  const attendanceSnap = await getDocs(attendanceQuery);
  const fallbackRecords = attendanceSnap.docs
    .map((snap) => toAttendanceLikeRecord(snap.id, snap.data() as FirestoreLikeRecord, "attendance-fallback"))
    .sort((left, right) => getRecordSortTime(right) - getRecordSortTime(left));

  return fallbackRecords[0] ?? null;
}

export async function getTodayAttendanceByCpf(cpf: string, referenceDate: Date = new Date()) {
  const cleanCpf = normalizeCpf(cpf);
  if (!cleanCpf) {
    return null;
  }

  const attendanceQuery = query(collection(db, "attendance"), where("cpf", "==", cleanCpf));
  const attendanceSnap = await getDocs(attendanceQuery);

  const todayRecord = attendanceSnap.docs
    .map((snap) => ({
      id: snap.id,
      ref: snap.ref,
      record: toAttendanceLikeRecord(snap.id, snap.data() as FirestoreLikeRecord, "attendance"),
    }))
    .sort((left, right) => getRecordSortTime(right.record) - getRecordSortTime(left.record))
    .find(({ record }) => Boolean(record.timestamp && isSameManausDay(record.timestamp, referenceDate)));

  return todayRecord ?? null;
}

export async function getAttendanceByCpfForSession(
  cpf: string,
  shift?: string | null,
  referenceDate: Date = new Date()
) {
  const cleanCpf = normalizeCpf(cpf);
  if (!cleanCpf) {
    return null;
  }

  const targetShift = normalizeShift(shift).toLowerCase();
  const targetDateKey = getManausDateKey(referenceDate);
  const targetAttendanceKey = buildAttendanceSessionKey(cleanCpf, referenceDate, shift);
  const attendanceQuery = query(collection(db, "attendance"), where("cpf", "==", cleanCpf));
  const attendanceSnap = await getDocs(attendanceQuery);

  const matchingRecord = attendanceSnap.docs
    .map((snap) => {
      const data = snap.data() as FirestoreLikeRecord;
      const record = toAttendanceLikeRecord(snap.id, data, "attendance");
      const recordDate = record.timestamp ?? record.createdAt ?? new Date();
      const recordShift = normalizeShift(typeof data.shift === "string" ? data.shift : record.shift).toLowerCase();
      const recordDateKey =
        typeof data.attendanceDateKey === "string" && data.attendanceDateKey
          ? data.attendanceDateKey
          : getManausDateKey(recordDate);
      const recordAttendanceKey =
        typeof data.attendanceKey === "string" && data.attendanceKey
          ? data.attendanceKey
          : buildAttendanceSessionKey(record.cpf, recordDate, record.shift);

      return {
        id: snap.id,
        ref: snap.ref,
        record,
        recordShift,
        recordDateKey,
        recordAttendanceKey,
      };
    })
    .filter(({ recordShift, recordDateKey, recordAttendanceKey }) => {
      if (recordAttendanceKey === targetAttendanceKey) {
        return true;
      }

      return recordDateKey === targetDateKey && recordShift === targetShift;
    })
    .sort((left, right) => getRecordSortTime(right.record) - getRecordSortTime(left.record))[0];

  return matchingRecord ?? null;
}

const DIRECTORY_PAGE_SIZE = 2000;
// Orçamento de tempo por coleção: evita travar a leitura do diretório indefinidamente
// caso a coleção cresça muito ou a rede esteja lenta — devolve o que já foi lido.
const DIRECTORY_FETCH_BUDGET_MS = 20000;

// Lê uma coleção inteira em páginas (em vez de um getDocs sem limite),
// respeitando um orçamento de tempo por chamada.
async function getAllDocsPaginated(collectionName: string) {
  const startedAt = Date.now();
  const collectionRef = collection(db, collectionName);
  const docs: QueryDocumentSnapshot<DocumentData>[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;

  while (true) {
    const pageQuery = cursor
      ? query(collectionRef, orderBy(documentId()), startAfter(cursor), limit(DIRECTORY_PAGE_SIZE))
      : query(collectionRef, orderBy(documentId()), limit(DIRECTORY_PAGE_SIZE));

    const snapshot = await getDocs(pageQuery);
    docs.push(...snapshot.docs);

    if (snapshot.size < DIRECTORY_PAGE_SIZE) {
      break;
    }

    if (Date.now() - startedAt > DIRECTORY_FETCH_BUDGET_MS) {
      console.warn(`⏱️ Orçamento de tempo excedido buscando "${collectionName}" — devolvendo ${docs.length} documentos parciais.`);
      break;
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  return docs;
}

// Cache de 5 minutos — reduz leituras duplicadas do Firestore em múltiplas chamadas
let _directoryCache: { data: AttendanceRecord[]; expiresAt: number } | null = null;
const DIRECTORY_CACHE_TTL_MS = 5 * 60 * 1000;

export function invalidateMemberDirectoryCache() {
  _directoryCache = null;
}

export async function getMemberDirectoryRecords(): Promise<AttendanceRecord[]> {
  if (_directoryCache && Date.now() < _directoryCache.expiresAt) {
    return _directoryCache.data;
  }

  const membersDocs = await getAllDocsPaginated("members");
  const directory = new Map<string, AttendanceRecord>();

  membersDocs.forEach((snap) => {
    const record = toAttendanceLikeRecord(snap.id, snap.data() as FirestoreLikeRecord, "members");
    if (record.cpf) {
      directory.set(record.cpf, record);
    }
  });

  // Só consulta attendance para membros que não têm perfil em members (fallback legado)
  if (directory.size === 0) {
    const attendanceDocs = await getAllDocsPaginated("attendance");
    attendanceDocs.forEach((snap) => {
      const record = toAttendanceLikeRecord(snap.id, snap.data() as FirestoreLikeRecord, "attendance-fallback");
      if (!record.cpf) return;
      const existing = directory.get(record.cpf);
      if (!existing) {
        directory.set(record.cpf, record);
      } else if (getRecordSortTime(record) > getRecordSortTime(existing)) {
        directory.set(record.cpf, {
          ...existing,
          ...record,
          id: existing.id,
          memberId: existing.memberId ?? existing.id,
          sourceCollection: existing.sourceCollection ?? "members",
        });
      }
    });
  }

  const result = Array.from(directory.values()).sort((left, right) => left.fullName.localeCompare(right.fullName));
  _directoryCache = { data: result, expiresAt: Date.now() + DIRECTORY_CACHE_TTL_MS };
  return result;
}
