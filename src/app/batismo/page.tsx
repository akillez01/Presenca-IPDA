"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db, storage } from "@/lib/firebase";
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, Timestamp } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  FileDown,
  FileText,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const dynamic = "force-dynamic";

const PDF_SOURCE_PATH = "/doc/Cadastro%20de%20batismo.pdf";
const PHOTO_ASPECT_RATIO = 3 / 4; // 3x4 (largura/altura)
const PHOTO_MAX_WIDTH = 900;
const PHOTO_MAX_HEIGHT = 1200;
const BAPTISM_COLLECTION = "baptism_records";
const BAPTISM_STORAGE_ROOT = "batismo-files";

type BaptismDocumentKey =
  | "rgCpfCopy"
  | "residenceProof"
  | "birthCertificate"
  | "marriageCertificate"
  | "deathCertificate"
  | "militaryCertificate";

type BaptismDocumentMeta = {
  key: BaptismDocumentKey;
  label: string;
  fileName: string;
  mimeType: string;
  size: number;
  updatedAt: string;
  storagePath?: string;
  downloadUrl?: string;
};

type BaptismDocumentChecklistItem = {
  key: BaptismDocumentKey;
  label: string;
  description: string;
  required: boolean;
};

const DOCUMENT_DEFINITIONS: Record<
  BaptismDocumentKey,
  Omit<BaptismDocumentChecklistItem, "required">
> = {
  rgCpfCopy: {
    key: "rgCpfCopy",
    label: "Cópias do RG e CPF",
    description: "Envie um PDF ou imagem com RG e CPF.",
  },
  residenceProof: {
    key: "residenceProof",
    label: "Comprovante de residência",
    description: "Conta, declaração ou comprovante equivalente.",
  },
  birthCertificate: {
    key: "birthCertificate",
    label: "Certidão de nascimento",
    description: "Certidão com averbações, quando houver.",
  },
  marriageCertificate: {
    key: "marriageCertificate",
    label: "Certidão de casamento",
    description: "Certidão com todas as averbações.",
  },
  deathCertificate: {
    key: "deathCertificate",
    label: "Certidão de óbito",
    description: "Obrigatória para viúvo(a).",
  },
  militaryCertificate: {
    key: "militaryCertificate",
    label: "Documento militar",
    description: "Anexe quando aplicável ao membro.",
  },
};

function isBaptismDocumentKey(value: string): value is BaptismDocumentKey {
  return value in DOCUMENT_DEFINITIONS;
}

type BaptismFormData = {
  baptismYear: string;
  baptismMonth: "" | "Março" | "Setembro";

  fullName: string;
  phone: string;
  birthDate: string; // yyyy-mm-dd ou dd/mm/aaaa
  rg: string;
  cpf: string;
  photoDataUrl: string; // base64 local ou URL pública no Storage
  photoStoragePath?: string;

  maritalStatus: "" | "Solteiro(a)" | "Casado(a)" | "Viúvo(a)" | "Divorciado/Separado e sozinho";
  maritalDate: string; // yyyy-mm-dd ou dd/mm/aaaa

  address: string;
  addressNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;

  spiritualParentName: string; // vazio => marca "Não"
  howArrived: "" | "Família" | "Amigo(a)" | "Visita no lar" | "Folheto" | "Rádio" | "Outro";
  howArrivedOther: string;

  arrivalSituation: "" | "Aceitou" | "Reconciliou" | "Uniu";

  acceptedJesusWhere: "" | "IPDA" | "Outro ministério";
  otherMinistry: string;

  congregationAddress: string;
  congregationNumber: string;
  congregationNeighborhood: string;
  congregationCity: string;
  congregationState: string;

  dirigenteName: string;
  dirigentePhone: string;
  sucursalName: string;
  documents: Partial<Record<BaptismDocumentKey, BaptismDocumentMeta>>;
};

type BaptismRecord = {
  id: string;
  fullName: string;
  cpf: string;
  baptismYear: string;
  baptismMonth: string;
  congregation: string;
  createdAt: string;
  formData: BaptismFormData;
  updatedAt?: string;
};

type IssueField = keyof BaptismFormData | "photoDataUrl" | "general";

type FormIssue = {
  field: IssueField;
  message: string;
};

type FormAnalysis = {
  errors: FormIssue[];
  warnings: FormIssue[];
};

type PreviewMode = "filled" | "original";

function createEmptyForm(): BaptismFormData {
  return {
    baptismYear: new Date().getFullYear().toString(),
    baptismMonth: "",

    fullName: "",
    phone: "",
    birthDate: "",
    rg: "",
    cpf: "",
    photoDataUrl: "",
    photoStoragePath: "",

    maritalStatus: "",
    maritalDate: "",

    address: "",
    addressNumber: "",
    neighborhood: "",
    city: "",
    state: "",
    cep: "",

    spiritualParentName: "",
    howArrived: "",
    howArrivedOther: "",

    arrivalSituation: "",

    acceptedJesusWhere: "",
    otherMinistry: "",

    congregationAddress: "",
    congregationNumber: "",
    congregationNeighborhood: "",
    congregationCity: "",
    congregationState: "",

    dirigenteName: "",
    dirigentePhone: "",
    sucursalName: "",
    documents: {},
  };
}

function createMockForm(): BaptismFormData {
  return normalizeFormForDocument({
    baptismYear: new Date().getFullYear().toString(),
    baptismMonth: "Março",

    fullName: "Joao Carlos Mendes",
    phone: "92991554433",
    birthDate: "1989-08-14",
    rg: "MG-12.345.678",
    cpf: "52998224725",
    photoDataUrl: "",
    photoStoragePath: "",

    maritalStatus: "Casado(a)",
    maritalDate: "2014-11-22",

    address: "Rua das Oliveiras",
    addressNumber: "145",
    neighborhood: "Planalto",
    city: "Manaus",
    state: "AM",
    cep: "69044110",

    spiritualParentName: "Maria Helena Mendes",
    howArrived: "Amigo(a)",
    howArrivedOther: "",

    arrivalSituation: "Aceitou",

    acceptedJesusWhere: "IPDA",
    otherMinistry: "",

    congregationAddress: "Avenida Brasil",
    congregationNumber: "700",
    congregationNeighborhood: "Compensa",
    congregationCity: "Manaus",
    congregationState: "AM",

    dirigenteName: "Pr. Elias Ferreira",
    dirigentePhone: "92988112233",
    sucursalName: "Sucursal Manaus Centro",
    documents: {},
  });
}

function buildRecordFromForm(
  formData: BaptismFormData,
  options?: {
    id?: string;
    createdAt?: string;
  }
): BaptismRecord {
  const normalized = normalizeFormForDocument(formData);

  return {
    id: options?.id ?? createRecordId(),
    fullName: normalized.fullName,
    cpf: normalized.cpf,
    baptismYear: normalized.baptismYear,
    baptismMonth: normalized.baptismMonth,
    congregation: normalized.sucursalName || normalized.congregationCity || "-",
    createdAt: options?.createdAt ?? new Date().toISOString(),
    formData: normalized,
  };
}

function normalizeFormData(data?: Partial<BaptismFormData> | null): BaptismFormData {
  const base = createEmptyForm();
  const merged = { ...base, ...(data ?? {}) };
  return {
    ...merged,
    documents: { ...base.documents, ...(data?.documents ?? {}) },
  };
}

function createRecordId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}`;
}

function sanitizeStorageFileName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "arquivo";
}

function toIsoString(value: unknown, fallback: string) {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return fallback;
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return fallback;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, stripUndefinedDeep(item)]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

function mapFirestoreRecord(id: string, payload: Record<string, unknown>): BaptismRecord {
  const createdAt = toIsoString(payload.createdAt, new Date().toISOString());
  const updatedAt = payload.updatedAt ? toIsoString(payload.updatedAt, createdAt) : undefined;
  const parsedForm = normalizeFormData((payload.formData as Partial<BaptismFormData> | undefined) ?? {});

  const normalizedDocuments = Object.fromEntries(
    Object.entries(parsedForm.documents ?? {})
      .filter(([rawKey]) => isBaptismDocumentKey(rawKey))
      .map(([rawKey, rawMeta]) => {
        const documentKey = rawKey as BaptismDocumentKey;
        const meta = rawMeta as Partial<BaptismDocumentMeta> | undefined;
        return [
          documentKey,
          {
            key: documentKey,
            label: meta?.label || DOCUMENT_DEFINITIONS[documentKey].label,
            fileName: meta?.fileName || "",
            mimeType: meta?.mimeType || "application/octet-stream",
            size: Number(meta?.size || 0),
            updatedAt: toIsoString(meta?.updatedAt, createdAt),
            ...(meta?.storagePath ? { storagePath: meta.storagePath } : {}),
            ...(meta?.downloadUrl ? { downloadUrl: meta.downloadUrl } : {}),
          } satisfies BaptismDocumentMeta,
        ];
      })
  ) as Partial<Record<BaptismDocumentKey, BaptismDocumentMeta>>;

  const formData: BaptismFormData = {
    ...parsedForm,
    documents: normalizedDocuments,
    ...(parsedForm.photoStoragePath ? { photoStoragePath: parsedForm.photoStoragePath } : {}),
  };

  return {
    id,
    fullName: typeof payload.fullName === "string" ? payload.fullName : formData.fullName,
    cpf: typeof payload.cpf === "string" ? payload.cpf : formData.cpf,
    baptismYear: typeof payload.baptismYear === "string" ? payload.baptismYear : formData.baptismYear,
    baptismMonth: typeof payload.baptismMonth === "string" ? payload.baptismMonth : formData.baptismMonth,
    congregation:
      typeof payload.congregation === "string"
        ? payload.congregation
        : formData.sucursalName || formData.congregationCity || "-",
    createdAt,
    updatedAt,
    formData,
  };
}

async function loadRecordsFromFirebase() {
  const recordsRef = collection(db, BAPTISM_COLLECTION);
  const snapshot = await getDocs(query(recordsRef, orderBy("createdAt", "desc")));
  return snapshot.docs.map((snap) => mapFirestoreRecord(snap.id, snap.data() as Record<string, unknown>));
}

async function saveRecordToFirebase(record: BaptismRecord) {
  const docRef = doc(db, BAPTISM_COLLECTION, record.id);
  const payload = stripUndefinedDeep({
    ...record,
    updatedAt: new Date().toISOString(),
  });
  await setDoc(docRef, payload);
}

async function removeStorageFile(storagePath?: string) {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    console.warn("Falha ao remover arquivo do Storage:", error);
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function toManausDateKey(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Manaus",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().split("T")[0];
  }
}

function getErrorDetail(error: unknown) {
  if (!error || typeof error !== "object") return "Erro desconhecido.";
  const code = "code" in error ? String(error.code || "") : "";
  const message = "message" in error ? String(error.message || "") : "";
  if (code && message) return `${code}: ${message}`;
  return message || code || "Erro desconhecido.";
}

function getDocumentChecklist(
  maritalStatus: BaptismFormData["maritalStatus"]
): BaptismDocumentChecklistItem[] {
  const required = new Set<BaptismDocumentKey>(["rgCpfCopy", "residenceProof", "militaryCertificate"]);

  if (maritalStatus.includes("Solteiro")) required.add("birthCertificate");
  if (maritalStatus.includes("Casado")) required.add("marriageCertificate");
  if (maritalStatus.includes("Viúvo")) {
    required.add("marriageCertificate");
    required.add("deathCertificate");
  }
  if (maritalStatus.toLowerCase().includes("divorciado")) {
    required.add("marriageCertificate");
  }

  const order: BaptismDocumentKey[] = [
    "rgCpfCopy",
    "residenceProof",
    "birthCertificate",
    "marriageCertificate",
    "deathCertificate",
    "militaryCertificate",
  ];

  return order.map((key) => ({
    ...DOCUMENT_DEFINITIONS[key],
    required: required.has(key),
  }));
}

function getRequiredDocumentSummary(record: BaptismRecord) {
  const requiredItems = getDocumentChecklist(record.formData.maritalStatus).filter((item) => item.required);
  const attachedRequiredCount = requiredItems.filter((item) => Boolean(record.formData.documents?.[item.key])).length;
  const missingRequiredCount = Math.max(0, requiredItems.length - attachedRequiredCount);

  return {
    requiredCount: requiredItems.length,
    attachedRequiredCount,
    missingRequiredCount,
    isComplete: missingRequiredCount === 0,
  };
}

function toFourDigitYear(yearRaw: string) {
  if (yearRaw.length === 4) return yearRaw;
  if (yearRaw.length !== 2) return yearRaw;
  const y = Number(yearRaw);
  if (Number.isNaN(y)) return yearRaw;
  return String(y <= 30 ? 2000 + y : 1900 + y);
}

function parseDateParts(value: string) {
  const v = value.trim();
  if (!v) return null;

  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return { day: iso[3], month: iso[2], year: iso[1] };
  }

  const br = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (br) {
    return {
      day: br[1].padStart(2, "0"),
      month: br[2].padStart(2, "0"),
      year: toFourDigitYear(br[3]),
    };
  }

  const digits = v.replace(/\D/g, "");
  if (digits.length === 8) {
    const first4 = Number(digits.slice(0, 4));
    if (first4 >= 1900 && first4 <= 2100) {
      return { day: digits.slice(6, 8), month: digits.slice(4, 6), year: digits.slice(0, 4) };
    }
    return { day: digits.slice(0, 2), month: digits.slice(2, 4), year: digits.slice(4, 8) };
  }

  if (digits.length === 6) {
    return {
      day: digits.slice(0, 2),
      month: digits.slice(2, 4),
      year: toFourDigitYear(digits.slice(4, 6)),
    };
  }

  return null;
}

function isValidDateParts(day: string, month: string, year: string) {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (Number.isNaN(d) || Number.isNaN(m) || Number.isNaN(y)) return false;
  if (year.length !== 4 || m < 1 || m > 12 || d < 1 || d > 31) return false;

  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function formatDateParts(day: string, month: string, year: string) {
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

function formatDateField(value?: string) {
  if (!value) return "";
  const v = value.trim();
  if (!v) return "";

  const parts = parseDateParts(v);
  if (!parts) return v;
  if (!isValidDateParts(parts.day, parts.month, parts.year)) return v;
  return formatDateParts(parts.day, parts.month, parts.year);
}

function formatPhoneField(value?: string) {
  if (!value) return "";
  const v = value.trim();
  if (!v) return "";

  let digits = v.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return v;
}

function digitsOnly(value?: string) {
  return (value || "").replace(/\D/g, "");
}

function collapseWhitespace(value?: string) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function formatCpfField(value?: string) {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCepField(value?: string) {
  const digits = digitsOnly(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatStateField(value?: string) {
  return (value || "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

function formatYearField(value?: string) {
  return digitsOnly(value).slice(0, 4);
}

function isValidPhoneField(value?: string) {
  let digits = digitsOnly(value);
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  return digits.length === 10 || digits.length === 11;
}

function isValidCepField(value?: string) {
  return digitsOnly(value).length === 8;
}

function isValidCpfField(value?: string) {
  const digits = digitsOnly(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(digits[i]) * (10 - i);
  }
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(digits[i]) * (11 - i);
  }
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === Number(digits[10]);
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function toggleChoice<T extends string>(current: T | "", value: T) {
  return current === value ? "" : value;
}

function makeIssue(field: IssueField, message: string): FormIssue {
  return { field, message };
}

function normalizeFormForDocument(data: BaptismFormData): BaptismFormData {
  const normalized: BaptismFormData = {
    ...data,
    baptismYear: formatYearField(data.baptismYear),
    fullName: collapseWhitespace(data.fullName),
    phone: formatPhoneField(data.phone),
    birthDate: formatDateField(data.birthDate),
    rg: collapseWhitespace(data.rg),
    cpf: formatCpfField(data.cpf),
    photoStoragePath: collapseWhitespace(data.photoStoragePath),
    maritalDate: formatDateField(data.maritalDate),
    address: collapseWhitespace(data.address),
    addressNumber: collapseWhitespace(data.addressNumber),
    neighborhood: collapseWhitespace(data.neighborhood),
    city: collapseWhitespace(data.city),
    state: formatStateField(data.state),
    cep: formatCepField(data.cep),
    spiritualParentName: collapseWhitespace(data.spiritualParentName),
    howArrivedOther: collapseWhitespace(data.howArrivedOther),
    otherMinistry: collapseWhitespace(data.otherMinistry),
    congregationAddress: collapseWhitespace(data.congregationAddress),
    congregationNumber: collapseWhitespace(data.congregationNumber),
    congregationNeighborhood: collapseWhitespace(data.congregationNeighborhood),
    congregationCity: collapseWhitespace(data.congregationCity),
    congregationState: formatStateField(data.congregationState),
    dirigenteName: collapseWhitespace(data.dirigenteName),
    dirigentePhone: formatPhoneField(data.dirigentePhone),
    sucursalName: collapseWhitespace(data.sucursalName),
  };

  if (normalized.howArrived !== "Outro") {
    normalized.howArrivedOther = "";
  }

  if (normalized.acceptedJesusWhere !== "Outro ministério") {
    normalized.otherMinistry = "";
  }

  if ((normalized.photoDataUrl || "").startsWith("data:image/")) {
    normalized.photoStoragePath = "";
  }

  return normalized;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = dataUrl;
  });
}

function getCenteredCropRect(srcWidth: number, srcHeight: number, targetRatio: number) {
  const srcRatio = srcWidth / srcHeight;
  let sx = 0;
  let sy = 0;
  let sw = srcWidth;
  let sh = srcHeight;

  if (srcRatio > targetRatio) {
    sw = Math.round(srcHeight * targetRatio);
    sx = Math.round((srcWidth - sw) / 2);
  } else if (srcRatio < targetRatio) {
    sh = Math.round(srcWidth / targetRatio);
    sy = Math.round((srcHeight - sh) / 2);
  }

  return { sx, sy, sw, sh };
}

async function fileToCompressedJpegDataUrl(file: File) {
  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImageFromDataUrl(rawDataUrl);
  const crop = getCenteredCropRect(img.width, img.height, PHOTO_ASPECT_RATIO);
  const scale = Math.min(1, PHOTO_MAX_WIDTH / crop.sw, PHOTO_MAX_HEIGHT / crop.sh);
  const width = Math.max(1, Math.round(crop.sw * scale));
  const height = Math.max(1, Math.round(crop.sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a foto.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.86);
}

async function sourceToBytes(source: string) {
  const res = await fetch(source);
  if (!res.ok) throw new Error("Não foi possível carregar a imagem.");
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    mimeType: res.headers.get("content-type") || "",
  };
}

async function uploadPhotoToStorage(
  recordId: string,
  photoSource: string,
  previousStoragePath?: string
): Promise<{ photoDataUrl: string; photoStoragePath: string }> {
  const { bytes, mimeType } = await sourceToBytes(photoSource);
  const extension = mimeType.includes("png") ? "png" : "jpg";
  const storagePath = `${BAPTISM_STORAGE_ROOT}/${recordId}/photo-${Date.now()}.${extension}`;
  const uploadRef = ref(storage, storagePath);

  await uploadBytes(uploadRef, bytes, {
    contentType: mimeType || `image/${extension}`,
    customMetadata: {
      recordId,
      category: "baptism-photo",
      uploadedAt: new Date().toISOString(),
    },
  });

  const downloadUrl = await getDownloadURL(uploadRef);

  if (previousStoragePath && previousStoragePath !== storagePath) {
    await removeStorageFile(previousStoragePath);
  }

  return {
    photoDataUrl: downloadUrl,
    photoStoragePath: storagePath,
  };
}

function inferDocumentMimeType(file: File) {
  if (file.type) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

async function uploadDocumentToStorage(recordId: string, documentKey: BaptismDocumentKey, file: File) {
  const safeName = sanitizeStorageFileName(file.name);
  const storagePath = `${BAPTISM_STORAGE_ROOT}/${recordId}/documents/${documentKey}-${Date.now()}-${safeName}`;
  const uploadRef = ref(storage, storagePath);
  const mimeType = inferDocumentMimeType(file);

  await uploadBytes(uploadRef, file, {
    contentType: mimeType,
    customMetadata: {
      recordId,
      documentKey,
      uploadedAt: new Date().toISOString(),
    },
  });

  const downloadUrl = await getDownloadURL(uploadRef);
  return { storagePath, downloadUrl };
}

function stopMediaStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

function createMockPhotoDataUrl(name: string) {
  if (typeof document === "undefined") return "";

  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 400;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const initials = collapseWhitespace(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.arc(150, 140, 68, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillRect(75, 235, 150, 110);

  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 72px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials || "JT", 150, 140);

  ctx.font = "600 24px Arial";
  ctx.fillText("Foto de teste", 150, 368);

  return canvas.toDataURL("image/png");
}

const POS = {
  // Topo: "Batismo de 202__ ( ) Março ( ) Setembro"
  yearLast2: { x: 335, y: 806 },
  monthMarchX: { x: 236.75, y: 790 },
  monthSeptX: { x: 299.37, y: 790 },
  photoBox: { x: 486, y: 670, width: 82, height: 102 },

  // 1) Dados
  fullName: { x: 106, y: 620 },
  phone: { x: 466.27, y: 620 },
  birthDate: { dayX: 130, monthX: 152, yearX: 176, y: 599 },
  rg: { x: 249, y: 599 },
  cpf: { x: 411, y: 599 },

  maritalSolteiroX: { x: 89.14, y: 577 },
  maritalCasadoX: { x: 164.9, y: 577 },
  maritalViuvoX: { x: 351.43, y: 577 },
  maritalDivorciadoX: { x: 415.17, y: 577 },
  maritalDate: { dayX: 266, monthX: 292, yearX: 317, y: 577 },

  address: { x: 76, y: 556 },
  addressNumber: { x: 526, y: 556 },
  neighborhood: { x: 62, y: 534 },
  city: { x: 65, y: 513 },
  state: { x: 346.25, y: 513 },
  cep: { x: 412, y: 513 },

  spiritualNoX: { x: 149.06, y: 492 },
  spiritualYesX: { x: 191.27, y: 492 },
  spiritualName: { x: 288, y: 492 },

  howFamiliaX: { x: 137.13, y: 470 },
  howAmigoX: { x: 195.62, y: 470 },
  howVisitaX: { x: 262.76, y: 470 },
  howFolhetoX: { x: 342.16, y: 470 },
  howRadioX: { x: 402.76, y: 470 },
  howOutroX: { x: 454.74, y: 470 },
  howOtherText: { x: 466, y: 470 },

  arrivalAceitouX: { x: 206.17, y: 449 },
  arrivalReconciliouX: { x: 269.49, y: 449 },
  arrivalUniuX: { x: 350.1, y: 449 },

  acceptedIpdaX: { x: 144.8, y: 427 },
  acceptedOtherX: { x: 195.53, y: 427 },
  otherMinistry: { x: 286.07, y: 427 },

  // 2) Congregação
  congAddress: { x: 76, y: 381 },
  congNumber: { x: 529, y: 381 },
  congNeighborhood: { x: 61, y: 359 },
  congCity: { x: 346.25, y: 359 },
  congState: { x: 537.76, y: 359 },
  dirigenteName: { x: 118, y: 338 },
  dirigentePhone: { x: 479.38, y: 338 },
  sucursalName: { x: 212.45, y: 316 },
};

const PDF_TEXT_RULES: Array<{ field: keyof BaptismFormData; label: string; maxWidth: number }> = [
  { field: "fullName", label: "Nome completo", maxWidth: 350 },
  { field: "phone", label: "Telefone", maxWidth: 95 },
  { field: "birthDate", label: "Data de nascimento", maxWidth: 90 },
  { field: "rg", label: "RG", maxWidth: 120 },
  { field: "cpf", label: "CPF", maxWidth: 150 },
  { field: "maritalDate", label: "Data do casamento", maxWidth: 74 },
  { field: "address", label: "Endereço", maxWidth: 420 },
  { field: "addressNumber", label: "Número", maxWidth: 50 },
  { field: "neighborhood", label: "Bairro", maxWidth: 500 },
  { field: "city", label: "Cidade", maxWidth: 230 },
  { field: "state", label: "UF", maxWidth: 50 },
  { field: "cep", label: "CEP", maxWidth: 120 },
  { field: "spiritualParentName", label: "Pai/Mãe espiritual", maxWidth: 270 },
  { field: "howArrivedOther", label: "Outro motivo de chegada", maxWidth: 140 },
  { field: "otherMinistry", label: "Outro ministério", maxWidth: 240 },
  { field: "congregationAddress", label: "Endereço da congregação", maxWidth: 390 },
  { field: "congregationNumber", label: "Número da congregação", maxWidth: 60 },
  { field: "congregationNeighborhood", label: "Bairro da congregação", maxWidth: 230 },
  { field: "congregationCity", label: "Cidade da congregação", maxWidth: 170 },
  { field: "congregationState", label: "UF da congregação", maxWidth: 50 },
  { field: "dirigenteName", label: "Dirigente", maxWidth: 250 },
  { field: "dirigentePhone", label: "Telefone do dirigente", maxWidth: 120 },
  { field: "sucursalName", label: "Sede sucursal", maxWidth: 320 },
];

let cachedBasePdfBytes: Uint8Array | null = null;
let textMeasureContext: CanvasRenderingContext2D | null = null;

async function fetchPdfBytes(path: string) {
  if (cachedBasePdfBytes) {
    return new Uint8Array(cachedBasePdfBytes);
  }
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Não foi possível carregar o PDF base (${res.status}).`);
  cachedBasePdfBytes = new Uint8Array(await res.arrayBuffer());
  return new Uint8Array(cachedBasePdfBytes);
}

function fitText(text: string, maxWidth: number, measure: (t: string) => number) {
  const v = (text || "").trim();
  if (!v) return "";
  if (measure(v) <= maxWidth) return v;

  let out = v;
  while (out.length > 0 && measure(out + "…") > maxWidth) {
    out = out.slice(0, -1);
  }
  return out.length ? out + "…" : "";
}

function measureTextWidth(text: string) {
  if (!text) return 0;
  if (typeof document === "undefined") return text.length * 5.8;

  if (!textMeasureContext) {
    const canvas = document.createElement("canvas");
    textMeasureContext = canvas.getContext("2d");
  }

  if (!textMeasureContext) return text.length * 5.8;
  textMeasureContext.font = "10.2px Arial";
  return textMeasureContext.measureText(text).width;
}

function analyzeFormForDocument(data: BaptismFormData): FormAnalysis {
  const errors: FormIssue[] = [];
  const warnings: FormIssue[] = [];

  const birthDateParts = parseDateParts(data.birthDate);
  const maritalDateParts = parseDateParts(data.maritalDate);

  if (data.baptismYear.length !== 4) {
    errors.push(makeIssue("baptismYear", "Informe o ano do batismo com 4 dígitos."));
  }
  if (!data.baptismMonth) {
    errors.push(makeIssue("baptismMonth", "Selecione o mês do batismo."));
  }
  if (!data.fullName) {
    errors.push(makeIssue("fullName", "Preencha o nome completo."));
  }
  if (!data.photoDataUrl) {
    errors.push(makeIssue("photoDataUrl", "Adicione a fotografia 3x4."));
  }
  if (!data.birthDate) {
    errors.push(makeIssue("birthDate", "Preencha a data de nascimento."));
  } else if (!birthDateParts || !isValidDateParts(birthDateParts.day, birthDateParts.month, birthDateParts.year)) {
    errors.push(makeIssue("birthDate", "Use uma data de nascimento válida."));
  }
  if (data.phone && !isValidPhoneField(data.phone)) {
    errors.push(makeIssue("phone", "Revise o telefone. Use DDD + número com 10 ou 11 dígitos."));
  }
  if (data.dirigentePhone && !isValidPhoneField(data.dirigentePhone)) {
    errors.push(makeIssue("dirigentePhone", "Revise o telefone do dirigente."));
  }
  if (data.cpf && !isValidCpfField(data.cpf)) {
    errors.push(makeIssue("cpf", "O CPF informado é inválido."));
  }
  if (data.cep && !isValidCepField(data.cep)) {
    errors.push(makeIssue("cep", "O CEP deve ter 8 dígitos."));
  }
  if (data.state && data.state.length !== 2) {
    errors.push(makeIssue("state", "A UF deve conter 2 letras."));
  }
  if (data.congregationState && data.congregationState.length !== 2) {
    errors.push(makeIssue("congregationState", "A UF da congregação deve conter 2 letras."));
  }
  if (data.maritalDate && (!maritalDateParts || !isValidDateParts(maritalDateParts.day, maritalDateParts.month, maritalDateParts.year))) {
    errors.push(makeIssue("maritalDate", "Use uma data de casamento válida."));
  }
  if (data.howArrived === "Outro" && !data.howArrivedOther) {
    errors.push(makeIssue("howArrivedOther", "Descreva como a pessoa chegou na IPDA quando marcar 'Outro'."));
  }
  if (data.acceptedJesusWhere === "Outro ministério" && !data.otherMinistry) {
    errors.push(makeIssue("otherMinistry", "Informe o ministério quando marcar 'Outro ministério'."));
  }

  if (!data.phone) warnings.push(makeIssue("phone", "Telefone vazio. O contato ficará ausente no documento."));
  if (!data.rg) warnings.push(makeIssue("rg", "RG vazio."));
  if (!data.cpf) warnings.push(makeIssue("cpf", "CPF vazio."));
  if (!data.maritalStatus) warnings.push(makeIssue("maritalStatus", "Estado civil não selecionado."));
  if (data.maritalStatus === "Casado(a)" && !data.maritalDate) {
    warnings.push(makeIssue("maritalDate", "Casado(a) sem data do casamento."));
  }
  if (!data.address) warnings.push(makeIssue("address", "Endereço residencial vazio."));
  if (!data.addressNumber) warnings.push(makeIssue("addressNumber", "Número residencial vazio."));
  if (!data.neighborhood) warnings.push(makeIssue("neighborhood", "Bairro vazio."));
  if (!data.city) warnings.push(makeIssue("city", "Cidade vazia."));
  if (!data.state) warnings.push(makeIssue("state", "UF residencial vazia."));
  if (!data.cep) warnings.push(makeIssue("cep", "CEP vazio."));
  if (!data.howArrived) warnings.push(makeIssue("howArrived", "Origem de chegada na IPDA não selecionada."));
  if (data.howArrivedOther && data.howArrived !== "Outro") {
    warnings.push(makeIssue("howArrivedOther", "O texto de 'Outro' será ignorado enquanto a opção 'Outro' não estiver marcada."));
  }
  if (!data.arrivalSituation) warnings.push(makeIssue("arrivalSituation", "Situação de chegada não selecionada."));
  if (!data.acceptedJesusWhere) warnings.push(makeIssue("acceptedJesusWhere", "Informe onde aceitou a Jesus."));
  if (data.otherMinistry && data.acceptedJesusWhere !== "Outro ministério") {
    warnings.push(makeIssue("otherMinistry", "O nome do ministério só entra no PDF quando 'Outro ministério' estiver marcado."));
  }
  if (!data.congregationAddress) warnings.push(makeIssue("congregationAddress", "Endereço da congregação vazio."));
  if (!data.congregationNumber) warnings.push(makeIssue("congregationNumber", "Número da congregação vazio."));
  if (!data.congregationNeighborhood) warnings.push(makeIssue("congregationNeighborhood", "Bairro da congregação vazio."));
  if (!data.congregationCity) warnings.push(makeIssue("congregationCity", "Cidade da congregação vazia."));
  if (!data.congregationState) warnings.push(makeIssue("congregationState", "UF da congregação vazia."));
  if (!data.dirigenteName) warnings.push(makeIssue("dirigenteName", "Nome do dirigente vazio."));
  if (!data.dirigentePhone) warnings.push(makeIssue("dirigentePhone", "Telefone do dirigente vazio."));
  if (!data.sucursalName) warnings.push(makeIssue("sucursalName", "Sede sucursal vazia."));

  for (const rule of PDF_TEXT_RULES) {
    const value = data[rule.field];
    if (!value || typeof value !== "string") continue;
    if (measureTextWidth(value) > rule.maxWidth) {
      warnings.push(makeIssue(rule.field, `${rule.label} está maior que a linha do PDF e pode sair abreviado.`));
    }
  }

  return { errors, warnings };
}

async function buildFilledPdfBytes(data: BaptismFormData) {
  const normalizedData = normalizeFormForDocument(data);
  const pdfBytes = await fetchPdfBytes(PDF_SOURCE_PATH);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const fontSize = 10.2;
  const dateFontSize = 9.6;
  const color = rgb(0.05, 0.05, 0.05);
  const markSize = 9;

  const drawTextLine = (text: string, x: number, y: number, maxWidth?: number, size: number = fontSize) => {
    const value = (text || "").trim();
    if (!value) return;

    const finalText =
      typeof maxWidth === "number"
        ? fitText(value, maxWidth, (t) => font.widthOfTextAtSize(t, size))
        : value;

    page.drawText(finalText, { x, y, size, font, color });
  };

  const drawX = (checked: boolean, x: number, y: number) => {
    if (!checked) return;
    page.drawText("X", { x, y, size: markSize, font, color });
  };

  const drawDateField = (
    text: string,
    pos: { dayX: number; monthX: number; yearX: number; y: number }
  ) => {
    const value = formatDateField(text);
    const parts = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!parts) return;

    page.drawText(parts[1], { x: pos.dayX, y: pos.y, size: dateFontSize, font, color });
    page.drawText(parts[2], { x: pos.monthX, y: pos.y, size: dateFontSize, font, color });
    page.drawText(parts[3], { x: pos.yearX, y: pos.y, size: dateFontSize, font, color });
  };

  const drawPhoto = async () => {
    const photoSource = (normalizedData.photoDataUrl || "").trim();
    if (!photoSource) return;

    try {
      const { bytes, mimeType } = await sourceToBytes(photoSource);
      const lower = `${photoSource} ${mimeType}`.toLowerCase();
      const photoImage = lower.includes("png")
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes);
      const box = POS.photoBox;
      page.drawImage(photoImage, { x: box.x, y: box.y, width: box.width, height: box.height });
    } catch (err) {
      console.error("Não foi possível inserir a foto no PDF.", err);
    }
  };

  // ===== Topo: ano e mês
  const yearRaw = (normalizedData.baptismYear || "").trim();
  const yearDigits = yearRaw.replace(/\D/g, "");
  const year = yearDigits || yearRaw;
  const last2 = year.length >= 2 ? year.slice(-2) : year;
  drawTextLine(last2, POS.yearLast2.x, POS.yearLast2.y);

  drawX(normalizedData.baptismMonth === "Março", POS.monthMarchX.x, POS.monthMarchX.y);
  drawX(normalizedData.baptismMonth === "Setembro", POS.monthSeptX.x, POS.monthSeptX.y);

  // ===== 1) Dados
  drawTextLine(normalizedData.fullName, POS.fullName.x, POS.fullName.y, 350);
  drawTextLine(formatPhoneField(normalizedData.phone), POS.phone.x, POS.phone.y, 95);

  drawDateField(normalizedData.birthDate, POS.birthDate);
  drawTextLine(normalizedData.rg, POS.rg.x, POS.rg.y, 120);
  drawTextLine(normalizedData.cpf, POS.cpf.x, POS.cpf.y, 150);

  drawX(normalizedData.maritalStatus.includes("Solteiro"), POS.maritalSolteiroX.x, POS.maritalSolteiroX.y);
  drawX(normalizedData.maritalStatus.includes("Casado"), POS.maritalCasadoX.x, POS.maritalCasadoX.y);
  drawX(normalizedData.maritalStatus.includes("Viúvo"), POS.maritalViuvoX.x, POS.maritalViuvoX.y);
  drawX(
    normalizedData.maritalStatus.toLowerCase().includes("divorciado"),
    POS.maritalDivorciadoX.x,
    POS.maritalDivorciadoX.y
  );
  drawDateField(normalizedData.maritalDate, POS.maritalDate);

  drawTextLine(normalizedData.address, POS.address.x, POS.address.y, 420);
  drawTextLine(normalizedData.addressNumber, POS.addressNumber.x, POS.addressNumber.y, 50);

  drawTextLine(normalizedData.neighborhood, POS.neighborhood.x, POS.neighborhood.y, 500);

  drawTextLine(normalizedData.city, POS.city.x, POS.city.y, 230);
  drawTextLine(normalizedData.state, POS.state.x, POS.state.y, 50);
  drawTextLine(normalizedData.cep, POS.cep.x, POS.cep.y, 120);

  const hasSpiritual = Boolean((normalizedData.spiritualParentName || "").trim());
  drawX(!hasSpiritual, POS.spiritualNoX.x, POS.spiritualNoX.y);
  drawX(hasSpiritual, POS.spiritualYesX.x, POS.spiritualYesX.y);
  drawTextLine(normalizedData.spiritualParentName, POS.spiritualName.x, POS.spiritualName.y, 270);

  drawX(normalizedData.howArrived === "Família", POS.howFamiliaX.x, POS.howFamiliaX.y);
  drawX(normalizedData.howArrived === "Amigo(a)", POS.howAmigoX.x, POS.howAmigoX.y);
  drawX(normalizedData.howArrived === "Visita no lar", POS.howVisitaX.x, POS.howVisitaX.y);
  drawX(normalizedData.howArrived === "Folheto", POS.howFolhetoX.x, POS.howFolhetoX.y);
  drawX(normalizedData.howArrived === "Rádio", POS.howRadioX.x, POS.howRadioX.y);
  drawX(normalizedData.howArrived === "Outro", POS.howOutroX.x, POS.howOutroX.y);
  drawTextLine(normalizedData.howArrivedOther, POS.howOtherText.x, POS.howOtherText.y, 140);

  drawX(normalizedData.arrivalSituation === "Aceitou", POS.arrivalAceitouX.x, POS.arrivalAceitouX.y);
  drawX(
    normalizedData.arrivalSituation === "Reconciliou",
    POS.arrivalReconciliouX.x,
    POS.arrivalReconciliouX.y
  );
  drawX(normalizedData.arrivalSituation === "Uniu", POS.arrivalUniuX.x, POS.arrivalUniuX.y);

  const acceptedIsIpda = (normalizedData.acceptedJesusWhere || "").toLowerCase().includes("ipda");
  const acceptedIsOther =
    !acceptedIsIpda && Boolean(normalizedData.acceptedJesusWhere || normalizedData.otherMinistry);

  drawX(acceptedIsIpda, POS.acceptedIpdaX.x, POS.acceptedIpdaX.y);
  drawX(acceptedIsOther, POS.acceptedOtherX.x, POS.acceptedOtherX.y);
  drawTextLine(normalizedData.otherMinistry, POS.otherMinistry.x, POS.otherMinistry.y, 240);

  // ===== 2) Congregação
  drawTextLine(normalizedData.congregationAddress, POS.congAddress.x, POS.congAddress.y, 390);
  drawTextLine(normalizedData.congregationNumber, POS.congNumber.x, POS.congNumber.y, 60);

  drawTextLine(normalizedData.congregationNeighborhood, POS.congNeighborhood.x, POS.congNeighborhood.y, 230);
  drawTextLine(normalizedData.congregationCity, POS.congCity.x, POS.congCity.y, 170);
  drawTextLine(normalizedData.congregationState, POS.congState.x, POS.congState.y, 50);

  drawTextLine(normalizedData.dirigenteName, POS.dirigenteName.x, POS.dirigenteName.y, 250);
  drawTextLine(formatPhoneField(normalizedData.dirigentePhone), POS.dirigentePhone.x, POS.dirigentePhone.y, 120);

  drawTextLine(normalizedData.sucursalName, POS.sucursalName.x, POS.sucursalName.y, 320);
  await drawPhoto();

  return await pdfDoc.save();
}

function makeBlobUrl(bytes: Uint8Array | ArrayBuffer) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

export default function BatismoPage() {
  const [records, setRecords] = useState<BaptismRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BaptismFormData>(createEmptyForm);
  const [filters, setFilters] = useState({
    search: "",
    month: "",
    year: "",
    congregation: "",
    date: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [draftRecordId, setDraftRecordId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRefs = useRef<Partial<Record<BaptismDocumentKey, HTMLInputElement | null>>>({});
  const documentCameraInputRefs = useRef<Partial<Record<BaptismDocumentKey, HTMLInputElement | null>>>({});
  const savedDocumentKeysRef = useRef<BaptismDocumentKey[]>([]);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [pendingDocumentFiles, setPendingDocumentFiles] = useState<Partial<Record<BaptismDocumentKey, File>>>({});
  const [pendingDocumentRemovals, setPendingDocumentRemovals] = useState<BaptismDocumentKey[]>([]);
  const [documentActionKey, setDocumentActionKey] = useState<BaptismDocumentKey | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("filled");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const lastPreviewUrlRef = useRef<string | null>(null);

  const orderedRecords = useMemo(
    () => [...records].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [records]
  );
  const normalizedForm = useMemo(() => normalizeFormForDocument(form), [form]);
  const formAnalysis = useMemo(() => analyzeFormForDocument(normalizedForm), [normalizedForm]);
  const documentChecklist = useMemo(() => getDocumentChecklist(form.maritalStatus), [form.maritalStatus]);
  const errorFields = useMemo(() => new Set(formAnalysis.errors.map((issue) => issue.field)), [formAnalysis.errors]);
  const warningFields = useMemo(
    () =>
      new Set(
        formAnalysis.warnings
          .filter((issue) => !errorFields.has(issue.field))
          .map((issue) => issue.field)
      ),
    [errorFields, formAnalysis.warnings]
  );
  const congregationOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        records
          .map((record) => collapseWhitespace(record.congregation))
          .filter(Boolean)
      )
    );
    return values.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [records]);
  const yearOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        records
          .map((record) => String(record.baptismYear || "").trim())
          .filter((value) => /^\d{4}$/.test(value))
      )
    );
    return values.sort((a, b) => Number(b) - Number(a));
  }, [records]);
  const filteredRecords = useMemo(() => {
    const search = collapseWhitespace(filters.search).toLowerCase();
    const selectedMonth = filters.month.trim();
    const selectedYear = filters.year.trim();
    const selectedCongregation = collapseWhitespace(filters.congregation);
    const selectedDate = filters.date.trim();

    return orderedRecords.filter((record) => {
      if (search) {
        const haystack = [
          record.fullName,
          record.cpf,
          record.congregation,
          record.formData.congregationCity,
          record.formData.sucursalName,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");
        if (!haystack.includes(search)) return false;
      }

      if (selectedMonth && record.baptismMonth !== selectedMonth) return false;
      if (selectedYear && record.baptismYear !== selectedYear) return false;
      if (selectedCongregation && collapseWhitespace(record.congregation) !== selectedCongregation) return false;

      if (selectedDate) {
        const savedDateKey = toManausDateKey(record.createdAt);
        if (!savedDateKey || savedDateKey !== selectedDate) return false;
      }

      return true;
    });
  }, [filters, orderedRecords]);
  const dashboardStats = useMemo(() => {
    const monthBreakdown = {
      Março: 0,
      Setembro: 0,
    };
    const congregationCounts = new Map<string, number>();
    let completeRequiredDocs = 0;
    let pendingRequiredDocuments = 0;
    let recordsMissingPhoto = 0;
    let totalAttachedDocuments = 0;

    filteredRecords.forEach((record) => {
      if (record.baptismMonth === "Março") monthBreakdown.Março += 1;
      if (record.baptismMonth === "Setembro") monthBreakdown.Setembro += 1;

      const congregation = collapseWhitespace(record.congregation) || "Sem congregação";
      congregationCounts.set(congregation, (congregationCounts.get(congregation) ?? 0) + 1);

      const requiredSummary = getRequiredDocumentSummary(record);
      if (requiredSummary.isComplete) {
        completeRequiredDocs += 1;
      }
      pendingRequiredDocuments += requiredSummary.missingRequiredCount;

      if (!record.formData.photoDataUrl) {
        recordsMissingPhoto += 1;
      }

      totalAttachedDocuments += Object.keys(record.formData.documents ?? {}).length;
    });

    const topCongregation = Array.from(congregationCounts.entries()).sort(
      ([nameA, countA], [nameB, countB]) => countB - countA || nameA.localeCompare(nameB, "pt-BR")
    )[0];

    return {
      filteredTotal: filteredRecords.length,
      totalRecords: orderedRecords.length,
      completeRequiredDocs,
      completeRequiredRate: filteredRecords.length
        ? Math.round((completeRequiredDocs / filteredRecords.length) * 100)
        : 0,
      pendingRequiredDocuments,
      uniqueCongregations: congregationCounts.size,
      topCongregation: topCongregation
        ? {
            name: topCongregation[0],
            count: topCongregation[1],
          }
        : null,
      monthBreakdown,
      recordsMissingPhoto,
      totalAttachedDocuments,
      averageDocumentsPerRecord: filteredRecords.length
        ? totalAttachedDocuments / filteredRecords.length
        : 0,
      latestCreatedAt: filteredRecords[0]?.createdAt ?? orderedRecords[0]?.createdAt ?? "",
    };
  }, [filteredRecords, orderedRecords]);
  const monthChartData = useMemo(() => {
    const total = dashboardStats.filteredTotal || 1;

    return [
      {
        month: "Março",
        total: dashboardStats.monthBreakdown.Março,
        percent: Math.round((dashboardStats.monthBreakdown.Março / total) * 100),
        fill: "#0ea5e9",
      },
      {
        month: "Setembro",
        total: dashboardStats.monthBreakdown.Setembro,
        percent: Math.round((dashboardStats.monthBreakdown.Setembro / total) * 100),
        fill: "#8b5cf6",
      },
    ];
  }, [dashboardStats]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const firebaseRecords = await loadRecordsFromFirebase();
        if (!active) return;
        setRecords(firebaseRecords);
      } catch (error) {
        console.error(error);
        if (active) {
          alert("Não foi possível carregar os cadastros de batismo no Firebase.");
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (lastPreviewUrlRef.current && lastPreviewUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(lastPreviewUrlRef.current);
      }
      stopMediaStream(cameraStreamRef.current);
      cameraStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    const video = cameraVideoRef.current;
    if (!video) return;
    if (!cameraStream) {
      video.srcObject = null;
      return;
    }
    video.srcObject = cameraStream;
    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch(() => {
        // alguns navegadores podem bloquear autoplay sem interação adicional
      });
    }
  }, [cameraStream]);

  useEffect(() => {
    if (!showForm) return;

    let cancelled = false;
    const t = setTimeout(async () => {
      setIsPreviewLoading(true);
      setPreviewError("");

      try {
        const bytes =
          previewMode === "original"
            ? await fetchPdfBytes(PDF_SOURCE_PATH)
            : await buildFilledPdfBytes(normalizedForm);
        const url = makeBlobUrl(bytes);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }

        if (lastPreviewUrlRef.current && lastPreviewUrlRef.current.startsWith("blob:")) {
          URL.revokeObjectURL(lastPreviewUrlRef.current);
        }
        lastPreviewUrlRef.current = url;
        setPreviewUrl(url);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setPreviewUrl("");
          setPreviewError(
            previewMode === "original"
              ? "Não foi possível carregar o PDF original para pré-visualização."
              : "Não foi possível gerar a pré-visualização preenchida."
          );
        }
      } finally {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      }
    }, previewMode === "filled" ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [normalizedForm, previewMode, showForm]);

  function updateField<K extends keyof BaptismFormData>(field: K, value: BaptismFormData[K]) {
    setForm((prev) => {
      const next = { ...prev, [field]: value } as BaptismFormData;

      if (field === "howArrived" && value !== "Outro") {
        next.howArrivedOther = "";
      }

      if (field === "acceptedJesusWhere" && value !== "Outro ministério") {
        next.otherMinistry = "";
      }

      if (field === "photoDataUrl" && typeof value === "string") {
        if (!value || value.startsWith("data:image/")) {
          next.photoStoragePath = "";
        }
      }

      return next;
    });
  }

  function getInputClass(field: IssueField) {
    const base = "mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900";
    if (errorFields.has(field)) {
      return `${base} border-red-400 bg-red-50`;
    }
    if (warningFields.has(field)) {
      return `${base} border-amber-300 bg-amber-50`;
    }
    return base;
  }

  function closeCamera() {
    stopMediaStream(cameraStreamRef.current);
    cameraStreamRef.current = null;
    setCameraStream(null);
    setCameraError("");
  }

  async function openCamera() {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Seu navegador não suporta câmera. Use o envio de arquivo.");
      return;
    }

    const constraintsList: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: "environment" } }, audio: false },
      { video: { facingMode: { ideal: "user" } }, audio: false },
      { video: true, audio: false },
    ];

    let openedStream: MediaStream | null = null;
    let lastError: unknown = null;

    for (const constraints of constraintsList) {
      try {
        openedStream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!openedStream) {
      console.error(lastError);
      setCameraError("Não foi possível acessar a câmera. Verifique a permissão no navegador.");
      return;
    }

    stopMediaStream(cameraStreamRef.current);
    cameraStreamRef.current = openedStream;
    setCameraStream(openedStream);
  }

  function capturePhotoFromCamera() {
    const video = cameraVideoRef.current;
    if (!video || !cameraStreamRef.current) {
      setCameraError("Abra a câmera antes de capturar.");
      return;
    }

    const srcWidth = video.videoWidth;
    const srcHeight = video.videoHeight;
    if (!srcWidth || !srcHeight) {
      setCameraError("A câmera ainda está iniciando. Tente capturar novamente.");
      return;
    }

    const crop = getCenteredCropRect(srcWidth, srcHeight, PHOTO_ASPECT_RATIO);
    const scale = Math.min(1, PHOTO_MAX_WIDTH / crop.sw, PHOTO_MAX_HEIGHT / crop.sh);
    const width = Math.max(1, Math.round(crop.sw * scale));
    const height = Math.max(1, Math.round(crop.sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCameraError("Não foi possível processar a captura da câmera.");
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);

    const photoDataUrl = canvas.toDataURL("image/jpeg", 0.86);
    updateField("photoDataUrl", photoDataUrl);
    closeCamera();
  }

  async function handlePhotoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Selecione uma imagem válida.");
      return;
    }

    try {
      const photoDataUrl = await fileToCompressedJpegDataUrl(file);
      updateField("photoDataUrl", photoDataUrl);
      closeCamera();
    } catch (err) {
      console.error(err);
      alert("Não foi possível processar a foto. Tente outra imagem.");
    }
  }

  function updateDocumentMeta(documentKey: BaptismDocumentKey, file: File) {
    const mimeType = inferDocumentMimeType(file);
    setForm((prev) => ({
      ...prev,
      documents: {
        ...prev.documents,
        [documentKey]: {
          key: documentKey,
          label: DOCUMENT_DEFINITIONS[documentKey].label,
          fileName: file.name,
          mimeType,
          size: file.size,
          updatedAt: new Date().toISOString(),
        },
      },
    }));
  }

  async function handleDocumentFileChange(documentKey: BaptismDocumentKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const accepted = file.type.startsWith("image/") || file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!accepted) {
      alert("Envie um PDF ou imagem para este documento.");
      return;
    }

    updateDocumentMeta(documentKey, file);
    setPendingDocumentFiles((prev) => ({ ...prev, [documentKey]: file }));
    setPendingDocumentRemovals((prev) => prev.filter((key) => key !== documentKey));
  }

  function handleRemoveDocument(documentKey: BaptismDocumentKey) {
    setForm((prev) => {
      const nextDocuments = { ...prev.documents };
      delete nextDocuments[documentKey];
      return { ...prev, documents: nextDocuments };
    });

    setPendingDocumentFiles((prev) => {
      const next = { ...prev };
      delete next[documentKey];
      return next;
    });

    if (savedDocumentKeysRef.current.includes(documentKey)) {
      setPendingDocumentRemovals((prev) => (prev.includes(documentKey) ? prev : [...prev, documentKey]));
    }
  }

  async function handleOpenDocument(documentKey: BaptismDocumentKey) {
    try {
      setDocumentActionKey(documentKey);

      const pendingFile = pendingDocumentFiles[documentKey];
      if (pendingFile) {
        const url = URL.createObjectURL(pendingFile);
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        return;
      }

      const savedDocument = form.documents[documentKey];
      if (!savedDocument?.downloadUrl) {
        alert("Nenhum arquivo encontrado para este documento.");
        return;
      }

      window.open(savedDocument.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      alert("Não foi possível abrir o documento anexado.");
    } finally {
      setDocumentActionKey(null);
    }
  }

  async function persistPendingDocuments(
    recordId: string,
    documents: Partial<Record<BaptismDocumentKey, BaptismDocumentMeta>>,
    existingRecord: BaptismRecord | null
  ) {
    const nextDocuments = { ...documents };

    for (const [documentKey, file] of Object.entries(pendingDocumentFiles) as Array<[BaptismDocumentKey, File | undefined]>) {
      if (!file) continue;

      const previousPath =
        existingRecord?.formData.documents?.[documentKey]?.storagePath ?? nextDocuments[documentKey]?.storagePath;
      const uploaded = await uploadDocumentToStorage(recordId, documentKey, file);
      if (previousPath && previousPath !== uploaded.storagePath) {
        await removeStorageFile(previousPath);
      }
      const mimeType = inferDocumentMimeType(file);
      nextDocuments[documentKey] = {
        key: documentKey,
        label: DOCUMENT_DEFINITIONS[documentKey].label,
        fileName: file.name,
        mimeType,
        size: file.size,
        updatedAt: new Date().toISOString(),
        storagePath: uploaded.storagePath,
        downloadUrl: uploaded.downloadUrl,
      };
    }

    for (const documentKey of pendingDocumentRemovals) {
      const storagePath =
        existingRecord?.formData.documents?.[documentKey]?.storagePath ?? nextDocuments[documentKey]?.storagePath;
      await removeStorageFile(storagePath);
      delete nextDocuments[documentKey];
    }

    savedDocumentKeysRef.current = Object.keys(nextDocuments) as BaptismDocumentKey[];
    setPendingDocumentFiles({});
    setPendingDocumentRemovals([]);

    return nextDocuments;
  }

  async function persistCurrentForm() {
    const normalized = normalizeFormForDocument(form);
    const analysis = analyzeFormForDocument(normalized);

    setForm(normalized);

    if (analysis.errors.length > 0) {
      const previewErrors = analysis.errors.slice(0, 6).map((issue) => `- ${issue.message}`);
      const remaining = analysis.errors.length - previewErrors.length;
      alert(
        [
          "Corrija os campos obrigatórios antes de salvar:",
          ...previewErrors,
          remaining > 0 ? `- ... e mais ${remaining} pendência(s).` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
      return null;
    }

    const isEditing = Boolean(editingRecordId);
    const existingRecord = isEditing ? records.find((r) => r.id === editingRecordId) : null;

    if (isEditing && !existingRecord) {
      alert("Não foi possível localizar o cadastro para edição. Tente novamente.");
      return null;
    }

    const recordId = existingRecord?.id ?? draftRecordId ?? createRecordId();
    let normalizedToPersist: BaptismFormData = { ...normalized };

    if ((normalizedToPersist.photoDataUrl || "").startsWith("data:image/")) {
      const uploadedPhoto = await uploadPhotoToStorage(
        recordId,
        normalizedToPersist.photoDataUrl,
        existingRecord?.formData.photoStoragePath || normalizedToPersist.photoStoragePath
      );
      normalizedToPersist = {
        ...normalizedToPersist,
        photoDataUrl: uploadedPhoto.photoDataUrl,
        photoStoragePath: uploadedPhoto.photoStoragePath,
      };
    }

    const persistedDocuments = await persistPendingDocuments(recordId, normalizedToPersist.documents, existingRecord ?? null);
    normalizedToPersist = {
      ...normalizedToPersist,
      documents: persistedDocuments,
    };

    const savedRecord = buildRecordFromForm(normalizedToPersist, {
      id: recordId,
      createdAt: existingRecord?.createdAt,
    });
    savedRecord.updatedAt = new Date().toISOString();

    await saveRecordToFirebase(savedRecord);

    setRecords((prev) => {
      const updated = isEditing
        ? prev.map((r) => (r.id === savedRecord.id ? savedRecord : r))
        : [savedRecord, ...prev];
      return updated;
    });

    return savedRecord;
  }

  async function downloadFilledPdf(current: BaptismFormData) {
    const bytes = await buildFilledPdfBytes(current);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `ficha-batismo-${sanitizeFileName(current.fullName || "membro")}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function printFilledPdf(current: BaptismFormData) {
    const bytes = await buildFilledPdfBytes(current);
    const url = makeBlobUrl(bytes);
    const w = window.open(url, "_blank");
    if (!w) return;
    // alguns browsers imprimem melhor após abrir o PDF
    setTimeout(() => w.print(), 700);
  }

  async function handleSave(action: "only" | "pdf" | "print") {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const saved = await persistCurrentForm();
      if (!saved) return;

      if (action === "pdf") await downloadFilledPdf(saved.formData);
      if (action === "print") await printFilledPdf(saved.formData);

      closeCamera();
      setShowForm(false);
      setForm(createEmptyForm());
      setEditingRecordId(null);
      setDraftRecordId(null);
      setPreviewMode("filled");
      setPreviewUrl("");
      setPreviewError("");
    } catch (err) {
      console.error(err);
      alert(`Não foi possível concluir a ação. ${getErrorDetail(err)}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(record: BaptismRecord) {
    if (!confirm(`Deseja excluir o cadastro de batismo de ${record.fullName}?`)) return;

    try {
      await deleteDoc(doc(db, BAPTISM_COLLECTION, record.id));
      await removeStorageFile(record.formData.photoStoragePath);

      const documentPaths = Object.values(record.formData.documents ?? {})
        .map((meta) => meta?.storagePath)
        .filter((value): value is string => Boolean(value));
      await Promise.all(documentPaths.map((path) => removeStorageFile(path)));

      setRecords((prev) => prev.filter((item) => item.id !== record.id));
    } catch (err) {
      console.error(err);
      alert("Não foi possível excluir o cadastro no Firebase.");
    }
  }

  function handleEditRecord(record: BaptismRecord) {
    closeCamera();
    setForm(normalizeFormData(record.formData));
    setEditingRecordId(record.id);
    setDraftRecordId(record.id);
    savedDocumentKeysRef.current = Object.keys(record.formData.documents ?? {}) as BaptismDocumentKey[];
    setPendingDocumentFiles({});
    setPendingDocumentRemovals([]);
    setPreviewMode("filled");
    setShowForm(true);
  }

  function startNewForm() {
    setForm(createEmptyForm());
    setEditingRecordId(null);
    setDraftRecordId(createRecordId());
    savedDocumentKeysRef.current = [];
    setPendingDocumentFiles({});
    setPendingDocumentRemovals([]);
    setPreviewMode("filled");
    setShowForm(true);
  }

  function startMockForm() {
    closeCamera();
    const mockForm = createMockForm();
    mockForm.photoDataUrl = createMockPhotoDataUrl(mockForm.fullName);
    setForm(mockForm);
    setEditingRecordId(null);
    setDraftRecordId(createRecordId());
    savedDocumentKeysRef.current = [];
    setPendingDocumentFiles({});
    setPendingDocumentRemovals([]);
    setPreviewMode("filled");
    setShowForm(true);
  }

  async function createMockMemberRecord() {
    closeCamera();

    const mockForm = createMockForm();
    mockForm.photoDataUrl = createMockPhotoDataUrl(mockForm.fullName);
    mockForm.photoStoragePath = "";

    const stamp = new Date();
    const minute = String(stamp.getMinutes()).padStart(2, "0");
    const second = String(stamp.getSeconds()).padStart(2, "0");
    const recordId = createRecordId();

    try {
      const formWithName = {
        ...mockForm,
        fullName: `${mockForm.fullName} Teste ${minute}${second}`,
      };
      let persistedForm = formWithName;

      if ((persistedForm.photoDataUrl || "").startsWith("data:image/")) {
        const uploadedPhoto = await uploadPhotoToStorage(recordId, persistedForm.photoDataUrl);
        persistedForm = {
          ...persistedForm,
          photoDataUrl: uploadedPhoto.photoDataUrl,
          photoStoragePath: uploadedPhoto.photoStoragePath,
        };
      }

      const record = buildRecordFromForm(persistedForm, {
        id: recordId,
        createdAt: stamp.toISOString(),
      });
      record.updatedAt = new Date().toISOString();
      await saveRecordToFirebase(record);

      setRecords((prev) => [record, ...prev]);
    } catch (error) {
      console.error(error);
      alert("Não foi possível criar o membro fictício no Firebase.");
    }
  }

  function handleBackToPanel() {
    closeCamera();
    setShowForm(false);
    setEditingRecordId(null);
    setDraftRecordId(null);
    setForm(createEmptyForm());
    savedDocumentKeysRef.current = [];
    setPendingDocumentFiles({});
    setPendingDocumentRemovals([]);
    setPreviewMode("filled");
    setPreviewUrl("");
    setPreviewError("");
  }

  // ===========================
  // UI
  // ===========================
  if (!showForm) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">Batismo</CardTitle>
              <CardDescription>Painel com membros batizados e acesso à ficha (PDF preenchível).</CardDescription>
            </div>
            <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <a href={PDF_SOURCE_PATH} target="_blank" rel="noreferrer">
                  <FileText className="mr-2 h-4 w-4" />
                  PDF original
                </a>
              </Button>
              {/* <Button variant="secondary" onClick={createMockMemberRecord}>
                Criar membro fictício
              </Button> */}
              <Button onClick={startNewForm} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nova ficha
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {orderedRecords.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nenhum membro batizado foi salvo ainda.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-3 rounded-lg border bg-slate-50/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Dashboard do batismo</div>
                      <p className="text-xs text-slate-600">
                        Visão rápida dos cadastros exibidos no painel e da situação dos anexos obrigatórios.
                      </p>
                    </div>
                    <div className="text-xs text-slate-500">
                      Último cadastro: {dashboardStats.latestCreatedAt ? formatDateTime(dashboardStats.latestCreatedAt) : "-"}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Cadastros exibidos</div>
                      <div className="mt-2 text-3xl font-semibold text-slate-950">{dashboardStats.filteredTotal}</div>
                      <p className="mt-1 text-xs text-slate-600">
                        {dashboardStats.filteredTotal === dashboardStats.totalRecords
                          ? "Sem recorte adicional pelos filtros."
                          : `de ${dashboardStats.totalRecords} ficha(s) salvas no total.`}
                      </p>
                    </div>

                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Obrigatórios completos</div>
                      <div className="mt-2 text-3xl font-semibold text-emerald-700">{dashboardStats.completeRequiredDocs}</div>
                      <p className="mt-1 text-xs text-slate-600">
                        {dashboardStats.completeRequiredRate}% das fichas filtradas estão com os anexos exigidos em dia.
                      </p>
                    </div>

                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Pendências de anexos</div>
                      <div className="mt-2 text-3xl font-semibold text-amber-600">{dashboardStats.pendingRequiredDocuments}</div>
                      <p className="mt-1 text-xs text-slate-600">
                        Média de {dashboardStats.averageDocumentsPerRecord.toFixed(1)} documento(s) por ficha exibida.
                      </p>
                    </div>

                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Congregações</div>
                      <div className="mt-2 text-3xl font-semibold text-sky-700">{dashboardStats.uniqueCongregations}</div>
                      <p className="mt-1 text-xs text-slate-600">
                        {dashboardStats.topCongregation
                          ? `${dashboardStats.topCongregation.name} lidera com ${dashboardStats.topCongregation.count} ficha(s).`
                          : "Nenhuma congregação encontrada no recorte atual."}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900">Distribuição por mês do batismo</div>
                        <div className="text-xs text-slate-500">Março x Setembro</div>
                      </div>
                      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_170px]">
                        <div className="h-64 rounded-lg border border-slate-100 bg-slate-50/60 p-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart
                              data={monthChartData}
                              margin={{ top: 16, right: 16, left: -8, bottom: 0 }}
                              barCategoryGap={36}
                            >
                              <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#e2e8f0" />
                              <XAxis
                                dataKey="month"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: "#475569", fontSize: 12 }}
                              />
                              <YAxis
                                allowDecimals={false}
                                tickLine={false}
                                axisLine={false}
                                width={28}
                                tick={{ fill: "#64748b", fontSize: 12 }}
                              />
                              <Tooltip
                                cursor={{ fill: "rgba(148, 163, 184, 0.10)" }}
                                formatter={(value, _name, item) => {
                                  const payload = item.payload as { percent?: number };
                                  return [`${value} ficha(s) · ${payload.percent ?? 0}%`, "Cadastros"];
                                }}
                                labelFormatter={(label) => `Mês: ${label}`}
                              />
                              <Bar dataKey="total" radius={[10, 10, 0, 0]} maxBarSize={88}>
                                <LabelList
                                  dataKey="total"
                                  position="top"
                                  offset={8}
                                  className="fill-slate-700 text-xs font-semibold"
                                  formatter={(value: number) => `${value}`}
                                />
                                {monthChartData.map((entry) => (
                                  <Cell key={entry.month} fill={entry.fill} />
                                ))}
                              </Bar>
                            </RechartsBarChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="grid gap-3">
                          {monthChartData.map((item) => (
                            <div key={item.month} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block h-3 w-3 rounded-full"
                                  style={{ backgroundColor: item.fill }}
                                />
                                <span className="text-sm font-medium text-slate-900">{item.month}</span>
                              </div>
                              <div className="mt-2 text-2xl font-semibold text-slate-950">{item.total}</div>
                              <p className="text-xs text-slate-600">
                                {item.percent}% dos cadastros filtrados
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="text-sm font-semibold text-slate-900">Qualidade do cadastro</div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-md bg-amber-50 p-3">
                          <div className="text-xs font-medium uppercase tracking-wide text-amber-700">Sem foto 3x4</div>
                          <div className="mt-1 text-2xl font-semibold text-amber-800">
                            {dashboardStats.recordsMissingPhoto}
                          </div>
                        </div>
                        <div className="rounded-md bg-slate-50 p-3">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-600">Arquivos anexados</div>
                          <div className="mt-1 text-2xl font-semibold text-slate-900">
                            {dashboardStats.totalAttachedDocuments}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                    <input
                      className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 lg:col-span-2"
                      placeholder="Buscar por nome, CPF ou congregação"
                      value={filters.search}
                      onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                    />
                    <select
                      className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                      value={filters.month}
                      onChange={(event) => setFilters((prev) => ({ ...prev, month: event.target.value }))}
                    >
                      <option value="">Todos os meses</option>
                      <option value="Março">Março</option>
                      <option value="Setembro">Setembro</option>
                    </select>
                    <select
                      className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                      value={filters.year}
                      onChange={(event) => setFilters((prev) => ({ ...prev, year: event.target.value }))}
                    >
                      <option value="">Todos os anos</option>
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                      value={filters.congregation}
                      onChange={(event) => setFilters((prev) => ({ ...prev, congregation: event.target.value }))}
                    >
                      <option value="">Todas congregações</option>
                      {congregationOptions.map((congregation) => (
                        <option key={congregation} value={congregation}>
                          {congregation}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setFilters({
                          search: "",
                          month: "",
                          year: "",
                          congregation: "",
                          date: "",
                        })
                      }
                    >
                      Limpar filtros
                    </Button>
                  </div>
                  <div className="mt-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Data do cadastro</label>
                      <input
                        type="date"
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                        value={filters.date}
                        onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Exibindo {filteredRecords.length} de {orderedRecords.length} cadastro(s).
                  </p>
                </div>

                {filteredRecords.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Nenhum cadastro encontrado para os filtros selecionados.
                  </div>
                ) : (
                  <>
                  <div className="space-y-3 md:hidden">
                    {filteredRecords.map((record) => (
                      <div key={`mobile-${record.id}`} className="rounded-lg border bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">{record.fullName}</p>
                            <p className="text-sm text-muted-foreground">{record.cpf || "-"}</p>
                          </div>
                          <Badge variant="outline">
                            {record.baptismMonth ? `${record.baptismMonth}/${record.baptismYear}` : record.baptismYear}
                          </Badge>
                        </div>

                        <div className="mt-3 grid gap-2 rounded-lg border bg-slate-50 p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-600">Congregação</span>
                            <span className="text-right font-medium text-slate-900">{record.congregation || "-"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-600">Documentos</span>
                            <span className="font-medium text-slate-900">
                              {Object.keys(record.formData.documents ?? {}).length}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-600">Salvo em</span>
                            <span className="text-right font-medium text-slate-900">{formatDateTime(record.createdAt)}</span>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEditRecord(record)} className="w-full">
                            <Pencil className="mr-2 h-4 w-4" />
                            Corrigir
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(record)} className="w-full">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block">
                    <table className="w-full min-w-[680px] table-fixed border-collapse text-sm">
                      <thead>
                        <tr className="bg-muted/40">
                          <th className="border p-2 text-left">Nome</th>
                          <th className="border p-2 text-left">CPF</th>
                          <th className="border p-2 text-left">Batismo</th>
                          <th className="border p-2 text-left">Congregação</th>
                          <th className="border p-2 text-left">Docs</th>
                          <th className="border p-2 text-left">Salvo em</th>
                          <th className="border p-2 text-left">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.map((record) => (
                          <tr key={record.id}>
                            <td className="border p-2">{record.fullName}</td>
                            <td className="border p-2">{record.cpf || "-"}</td>
                            <td className="border p-2">
                              {record.baptismMonth ? `${record.baptismMonth}/${record.baptismYear}` : record.baptismYear}
                            </td>
                            <td className="border p-2">{record.congregation || "-"}</td>
                            <td className="border p-2">
                              {Object.keys(record.formData.documents ?? {}).length}
                            </td>
                            <td className="border p-2">{formatDateTime(record.createdAt)}</td>
                            <td className="border p-2">
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleEditRecord(record)}>
                                  <Pencil className="mr-1 h-4 w-4" />
                                  Corrigir
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDelete(record)}>
                                  <Trash2 className="mr-1 h-4 w-4" />
                                  Excluir
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{editingRecordId ? "Corrigir Ficha de Batismo" : "Ficha de Cadastro de Batismo"}</CardTitle>
            <CardDescription>
              Preenche direto no PDF (sem template imagem), garantindo alinhamento nas linhas.
            </CardDescription>
          </div>
          <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Button variant="outline" onClick={handleBackToPanel} className="w-full sm:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao painel
            </Button>

            <Button asChild variant="outline" className="w-full sm:w-auto">
              <a href={PDF_SOURCE_PATH} target="_blank" rel="noreferrer">
                <FileText className="mr-2 h-4 w-4" />
                Abrir PDF original
              </a>
            </Button>

            <Button variant="secondary" onClick={startMockForm} disabled={isSaving} className="w-full sm:w-auto">
              Carregar exemplo
            </Button>

            <Button onClick={() => handleSave("only")} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving ? "Salvando..." : editingRecordId ? "Salvar correção e voltar" : "Salvar e voltar"}
            </Button>

            <Button variant="secondary" onClick={() => handleSave("pdf")} disabled={isSaving} className="w-full sm:w-auto">
              <FileDown className="mr-2 h-4 w-4" />
              {editingRecordId ? "Salvar correção e baixar PDF" : "Salvar e baixar PDF"}
            </Button>

            <Button variant="outline" onClick={() => handleSave("print")} disabled={isSaving} className="w-full sm:w-auto">
              <Printer className="mr-2 h-4 w-4" />
              {editingRecordId ? "Salvar correção e imprimir" : "Salvar e imprimir"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <style jsx>{`
            .batismo-form-panel input {
              color: #111827 !important;
            }
            .batismo-form-panel input::placeholder {
              color: #64748b !important;
              opacity: 1 !important;
            }
            .batismo-form-panel input:-webkit-autofill,
            .batismo-form-panel input:-webkit-autofill:hover,
            .batismo-form-panel input:-webkit-autofill:focus {
              -webkit-text-fill-color: #111827 !important;
              -webkit-box-shadow: 0 0 0px 1000px #ffffff inset !important;
              box-shadow: 0 0 0px 1000px #ffffff inset !important;
            }
          `}</style>
          {/* Form */}
          <div className="batismo-form-panel space-y-3 rounded-lg border bg-white p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">Ano do batismo</label>
                <input
                  className={getInputClass("baptismYear")}
                  inputMode="numeric"
                  maxLength={4}
                  value={form.baptismYear}
                  onChange={(e) => updateField("baptismYear", formatYearField(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Mês</label>
                <div className="mt-1 flex gap-2">
                  <Button
                    type="button"
                    variant={form.baptismMonth === "Março" ? "default" : "outline"}
                    onClick={() => updateField("baptismMonth", toggleChoice(form.baptismMonth, "Março"))}
                  >
                    Março
                  </Button>
                  <Button
                    type="button"
                    variant={form.baptismMonth === "Setembro" ? "default" : "outline"}
                    onClick={() => updateField("baptismMonth", toggleChoice(form.baptismMonth, "Setembro"))}
                  >
                    Setembro
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Nome completo</label>
              <input
                className={getInputClass("fullName")}
                value={form.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">Telefone</label>
                <input
                  className={getInputClass("phone")}
                  inputMode="tel"
                  placeholder="(DDD) 99999-9999"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  onBlur={(e) => updateField("phone", formatPhoneField(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Data de nascimento</label>
                <input
                  className={getInputClass("birthDate")}
                  placeholder="dd/mm/aaaa ou yyyy-mm-dd"
                  value={form.birthDate}
                  onChange={(e) => updateField("birthDate", e.target.value)}
                  onBlur={(e) => updateField("birthDate", formatDateField(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">RG</label>
                <input className={getInputClass("rg")} value={form.rg} onChange={(e) => updateField("rg", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium">CPF</label>
                <input
                  className={getInputClass("cpf")}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={(e) => updateField("cpf", formatCpfField(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Fotografia 3x4 (obrigatória)</label>
              <input
                ref={photoInputRef}
                className="hidden"
                type="file"
                accept="image/*"
                onChange={handlePhotoFileChange}
              />
              <div
                className={`mt-2 rounded-lg border p-2 ${
                  errorFields.has("photoDataUrl") ? "border-red-200 bg-red-50" : "border-transparent"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={openCamera}>
                    <Camera className="mr-2 h-4 w-4" />
                    Abrir câmera (PC/telefone)
                  </Button>
                  <Button type="button" variant="outline" onClick={() => photoInputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    {form.photoDataUrl ? "Trocar por arquivo" : "Enviar arquivo"}
                  </Button>
                  {form.photoDataUrl ? (
                    <Button type="button" variant="ghost" onClick={() => updateField("photoDataUrl", "")}>
                      <X className="mr-2 h-4 w-4" />
                      Remover foto
                    </Button>
                  ) : null}
                </div>

                {cameraStream ? (
                  <div className="mt-3 rounded-lg border bg-slate-50 p-2">
                    <video ref={cameraVideoRef} className="h-48 w-36 rounded border bg-black object-cover" autoPlay muted playsInline />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={capturePhotoFromCamera}>
                        Capturar foto
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={closeCamera}>
                        Fechar câmera
                      </Button>
                    </div>
                  </div>
                ) : null}

                {cameraError ? <p className="mt-2 text-xs text-red-600">{cameraError}</p> : null}

                {form.photoDataUrl ? (
                  <Image
                    src={form.photoDataUrl}
                    alt="Foto 3x4"
                    width={96}
                    height={128}
                    unoptimized
                    className="mt-2 h-32 w-24 rounded border object-cover"
                  />
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Abra a câmera para tirar foto ao vivo, ou envie um arquivo da galeria.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Estado civil</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["Solteiro(a)","Casado(a)","Viúvo(a)","Divorciado/Separado e sozinho"] as const).map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant={form.maritalStatus === v ? "default" : "outline"}
                    onClick={() => updateField("maritalStatus", toggleChoice(form.maritalStatus, v))}
                  >
                    {v === "Divorciado/Separado e sozinho" ? "Divorciado" : v}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Documentos para enviar</div>
                  <p className="text-xs text-slate-600">
                    Anexe PDF, imagem da galeria ou tire uma foto na hora. Os itens marcados como obrigatórios mudam conforme o estado civil.
                  </p>
                </div>
                <div className="text-xs text-slate-600">
                  Anexados: {Object.keys(form.documents ?? {}).length}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {documentChecklist.map((item) => {
                  const meta = form.documents[item.key];
                  const hasPendingFile = Boolean(pendingDocumentFiles[item.key]);
                  const isRemoved = pendingDocumentRemovals.includes(item.key);

                  return (
                    <div key={item.key} className="rounded-md border border-slate-200 bg-white p-3">
                      <input
                        ref={(node) => {
                          documentInputRefs.current[item.key] = node;
                        }}
                        className="hidden"
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(event) => void handleDocumentFileChange(item.key, event)}
                      />
                      <input
                        ref={(node) => {
                          documentCameraInputRefs.current[item.key] = node;
                        }}
                        className="hidden"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event) => void handleDocumentFileChange(item.key, event)}
                      />

                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-medium text-slate-900">{item.label}</div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                item.required ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {item.required ? "Obrigatório" : "Opcional"}
                            </span>
                            {meta && !isRemoved ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                {hasPendingFile ? "Novo arquivo pronto" : "Arquivo salvo"}
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                Pendente
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-600">{item.description}</p>
                          {meta && !isRemoved ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {meta.fileName} · {formatFileSize(meta.size)}
                              {meta.mimeType.startsWith("image/") ? " · Foto" : meta.mimeType === "application/pdf" ? " · PDF" : ""}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => documentCameraInputRefs.current[item.key]?.click()}
                          >
                            <Camera className="mr-2 h-4 w-4" />
                            {meta && !isRemoved ? "Refazer foto" : "Tirar foto"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => documentInputRefs.current[item.key]?.click()}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            {meta && !isRemoved ? "Trocar" : "Enviar"}
                          </Button>

                          {meta && !isRemoved ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void handleOpenDocument(item.key)}
                                disabled={documentActionKey === item.key}
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                Abrir
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveDocument(item.key)}
                              >
                                <X className="mr-2 h-4 w-4" />
                                Remover
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Data do casamento (se houver)</label>
              <input
                className={getInputClass("maritalDate")}
                placeholder="dd/mm/aaaa ou yyyy-mm-dd"
                value={form.maritalDate}
                onChange={(e) => updateField("maritalDate", e.target.value)}
                onBlur={(e) => updateField("maritalDate", formatDateField(e.target.value))}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_90px]">
              <div>
                <label className="text-xs font-medium">Endereço</label>
                <input className={getInputClass("address")} value={form.address} onChange={(e) => updateField("address", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium">Nº</label>
                <input className={getInputClass("addressNumber")} value={form.addressNumber} onChange={(e) => updateField("addressNumber", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">Bairro</label>
                <input className={getInputClass("neighborhood")} value={form.neighborhood} onChange={(e) => updateField("neighborhood", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium">CEP</label>
                <input
                  className={getInputClass("cep")}
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={form.cep}
                  onChange={(e) => updateField("cep", formatCepField(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">Cidade</label>
                <input className={getInputClass("city")} value={form.city} onChange={(e) => updateField("city", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium">UF</label>
                <input
                  className={getInputClass("state")}
                  maxLength={2}
                  value={form.state}
                  onChange={(e) => updateField("state", formatStateField(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Pai/Mãe espiritual (vazio = Não)</label>
              <input
                className={getInputClass("spiritualParentName")}
                value={form.spiritualParentName}
                onChange={(e) => updateField("spiritualParentName", e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium">Como chegou na IPDA</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["Família","Amigo(a)","Visita no lar","Folheto","Rádio","Outro"] as const).map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant={form.howArrived === v ? "default" : "outline"}
                    onClick={() => updateField("howArrived", toggleChoice(form.howArrived, v))}
                  >
                    {v}
                  </Button>
                ))}
              </div>
              <input
                className={getInputClass("howArrivedOther")}
                disabled={form.howArrived !== "Outro"}
                placeholder="Se for 'Outro', descreva"
                value={form.howArrivedOther}
                onChange={(e) => updateField("howArrivedOther", e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium">Situação de chegada</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["Aceitou","Reconciliou","Uniu"] as const).map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant={form.arrivalSituation === v ? "default" : "outline"}
                    onClick={() => updateField("arrivalSituation", toggleChoice(form.arrivalSituation, v))}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Aceitou a Jesus onde?</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={(form.acceptedJesusWhere || "").toLowerCase().includes("ipda") ? "default" : "outline"}
                  onClick={() => updateField("acceptedJesusWhere", ((form.acceptedJesusWhere || "").toLowerCase().includes("ipda")) ? "" : "IPDA")}
                >
                  IPDA
                </Button>
                <Button
                  type="button"
                  variant={(form.acceptedJesusWhere || "").toLowerCase().includes("outro") || form.otherMinistry ? "default" : "outline"}
                  onClick={() => updateField("acceptedJesusWhere", ((form.acceptedJesusWhere || "").toLowerCase().includes("outro")) ? "" : "Outro ministério")}
                >
                  Outro ministério
                </Button>
              </div>
              <input
                className={getInputClass("otherMinistry")}
                disabled={form.acceptedJesusWhere !== "Outro ministério"}
                placeholder="Qual outro ministério?"
                value={form.otherMinistry}
                onChange={(e) => updateField("otherMinistry", e.target.value)}
              />
            </div>

            <hr className="my-3" />

            <div>
              <label className="text-xs font-medium">Congregação — Endereço</label>
              <input
                className={getInputClass("congregationAddress")}
                value={form.congregationAddress}
                onChange={(e) => updateField("congregationAddress", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_90px]">
              <div>
                <label className="text-xs font-medium">Bairro</label>
                <input
                  className={getInputClass("congregationNeighborhood")}
                  value={form.congregationNeighborhood}
                  onChange={(e) => updateField("congregationNeighborhood", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Nº</label>
                <input
                  className={getInputClass("congregationNumber")}
                  value={form.congregationNumber}
                  onChange={(e) => updateField("congregationNumber", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">Cidade</label>
                <input
                  className={getInputClass("congregationCity")}
                  value={form.congregationCity}
                  onChange={(e) => updateField("congregationCity", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium">UF</label>
                <input
                  className={getInputClass("congregationState")}
                  maxLength={2}
                  value={form.congregationState}
                  onChange={(e) => updateField("congregationState", formatStateField(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">Dirigente</label>
                <input
                  className={getInputClass("dirigenteName")}
                  value={form.dirigenteName}
                  onChange={(e) => updateField("dirigenteName", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Tel. dirigente</label>
                <input
                  className={getInputClass("dirigentePhone")}
                  inputMode="tel"
                  placeholder="(DDD) 99999-9999"
                  value={form.dirigentePhone}
                  onChange={(e) => updateField("dirigentePhone", e.target.value)}
                  onBlur={(e) => updateField("dirigentePhone", formatPhoneField(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Sede sucursal</label>
              <input
                className={getInputClass("sucursalName")}
                value={form.sucursalName}
                onChange={(e) => updateField("sucursalName", e.target.value)}
              />
            </div>
          </div>

          {/* Preview PDF */}
          <div className="rounded-lg border bg-white p-2">
            <div className="mb-2 flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-medium">
                Pré-visualização {previewMode === "filled" ? "(PDF preenchido)" : "(PDF original)"}
              </div>
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <Button
                  variant={previewMode === "filled" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewMode("filled")}
                  className="w-full sm:w-auto"
                >
                  Ver preenchido
                </Button>
                <Button
                  variant={previewMode === "original" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewMode("original")}
                  className="w-full sm:w-auto"
                >
                  Ver original
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadFilledPdf(normalizedForm)}
                  disabled={formAnalysis.errors.length > 0}
                  className="w-full sm:w-auto"
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Baixar agora
                </Button>
              </div>
            </div>

            <div className="relative h-[60vh] overflow-hidden rounded border bg-slate-100 sm:h-[78vh]">
              {isPreviewLoading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-slate-700 backdrop-blur-sm">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Atualizando PDF...
                </div>
              ) : null}

              {previewUrl ? (
                <object data={previewUrl} type="application/pdf" className="h-full w-full">
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-700">
                    <p>O navegador não conseguiu incorporar o PDF nesta área.</p>
                    <a className="underline" href={previewUrl} target="_blank" rel="noreferrer">
                      Abrir o PDF em uma nova aba
                    </a>
                  </div>
                </object>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-700">
                  <AlertCircle className="h-5 w-5" />
                  <p>{previewError || "Pré-visualização indisponível no momento."}</p>
                  <a className="underline" href={PDF_SOURCE_PATH} target="_blank" rel="noreferrer">
                    Abrir o PDF original
                  </a>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
