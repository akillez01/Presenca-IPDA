// Lógica pura (sem estado React) do formulário de batismo, compartilhada entre o
// painel administrativo (src/app/batismo/page.tsx) e o cadastro público
// (src/app/cadastro-batismo/page.tsx). Qualquer mudança aqui afeta os dois fluxos.

import { Timestamp } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { storage } from "@/lib/firebase";

export const PDF_SOURCE_PATH = "/doc/Cadastro%20de%20batismo.pdf";
export const PHOTO_ASPECT_RATIO = 3 / 4; // 3x4 (largura/altura)
export const PHOTO_MAX_WIDTH = 900;
export const PHOTO_MAX_HEIGHT = 1200;

export const BAPTISM_COLLECTION = "baptism_records";
export const BAPTISM_STORAGE_ROOT = "batismo-files";

// Cadastros enviados pelo link público (sem login) ficam em uma coleção/pasta separadas
// até serem aprovados por um administrador — ver seção "Aprovação de cadastros públicos"
// em src/app/batismo/page.tsx.
export const BAPTISM_PENDING_COLLECTION = "baptism_public_submissions";
export const BAPTISM_PENDING_STORAGE_ROOT = "batismo-pending-files";

// Opções fixas do campo "Reclassificação" (porte da igreja para o relatório de batismo).
export const RECLASSIFICATION_OPTIONS = [
  "Local",
  "Setorial",
  "Estadual",
  "Central",
  "Regional",
  "Casa de Oração",
] as const;
export type ReclassificationOption = (typeof RECLASSIFICATION_OPTIONS)[number];

export type BaptismDocumentKey =
  | "rgCpfCopy"
  | "residenceProof"
  | "birthCertificate"
  | "marriageCertificate"
  | "deathCertificate"
  | "militaryCertificate";

export type BaptismDocumentMeta = {
  key: BaptismDocumentKey;
  label: string;
  fileName: string;
  mimeType: string;
  size: number;
  updatedAt: string;
  storagePath?: string;
  downloadUrl?: string;
};

export type BaptismDocumentChecklistItem = {
  key: BaptismDocumentKey;
  label: string;
  description: string;
  required: boolean;
};

export const DOCUMENT_DEFINITIONS: Record<
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

export function isBaptismDocumentKey(value: string): value is BaptismDocumentKey {
  return value in DOCUMENT_DEFINITIONS;
}

export type BaptismFormData = {
  baptismYear: string;
  baptismMonth: "" | "Março" | "Setembro";

  fullName: string;
  phone: string;
  birthDate: string; // yyyy-mm-dd ou dd/mm/aaaa
  rg: string;
  cpf: string;
  photoDataUrl: string; // base64 local ou URL pública no Storage
  photoStoragePath?: string;

  gender: "" | "Masculino" | "Feminino";

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
  sucursalName: "" | ReclassificationOption;
  documents: Partial<Record<BaptismDocumentKey, BaptismDocumentMeta>>;
};

export type BaptismRecord = {
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

export type IssueField = keyof BaptismFormData | "photoDataUrl" | "general";

export type FormIssue = {
  field: IssueField;
  message: string;
};

export type FormAnalysis = {
  errors: FormIssue[];
  warnings: FormIssue[];
};

export function createEmptyForm(): BaptismFormData {
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

    gender: "",

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

export function createRecordId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}`;
}

export function sanitizeStorageFileName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "arquivo";
}

export function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function toIsoString(value: unknown, fallback: string) {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return fallback;
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return fallback;
}

export function stripUndefinedDeep<T>(value: T): T {
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

export function normalizeFormData(data?: Partial<BaptismFormData> | null): BaptismFormData {
  const base = createEmptyForm();
  const merged = { ...base, ...(data ?? {}) };
  return {
    ...merged,
    documents: { ...base.documents, ...(data?.documents ?? {}) },
  };
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getDocumentChecklist(
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

function toFourDigitYear(yearRaw: string) {
  if (yearRaw.length === 4) return yearRaw;
  if (yearRaw.length !== 2) return yearRaw;
  const y = Number(yearRaw);
  if (Number.isNaN(y)) return yearRaw;
  return String(y <= 30 ? 2000 + y : 1900 + y);
}

export function parseDateParts(value: string) {
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

export function isValidDateParts(day: string, month: string, year: string) {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (Number.isNaN(d) || Number.isNaN(m) || Number.isNaN(y)) return false;
  if (year.length !== 4 || m < 1 || m > 12 || d < 1 || d > 31) return false;

  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function formatDateParts(day: string, month: string, year: string) {
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

export function formatDateField(value?: string) {
  if (!value) return "";
  const v = value.trim();
  if (!v) return "";

  const parts = parseDateParts(v);
  if (!parts) return v;
  if (!isValidDateParts(parts.day, parts.month, parts.year)) return v;
  return formatDateParts(parts.day, parts.month, parts.year);
}

export function formatPhoneField(value?: string) {
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

export function digitsOnly(value?: string) {
  return (value || "").replace(/\D/g, "");
}

export function collapseWhitespace(value?: string) {
  return (value || "").replace(/\s+/g, " ").trim();
}

export function formatCpfField(value?: string) {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function formatCepField(value?: string) {
  const digits = digitsOnly(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatStateField(value?: string) {
  return (value || "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

export function formatYearField(value?: string) {
  return digitsOnly(value).slice(0, 4);
}

export function isValidPhoneField(value?: string) {
  let digits = digitsOnly(value);
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  return digits.length === 10 || digits.length === 11;
}

export function isValidCepField(value?: string) {
  return digitsOnly(value).length === 8;
}

export function isValidCpfField(value?: string) {
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

export function toggleChoice<T extends string>(current: T | "", value: T) {
  return current === value ? "" : value;
}

function makeIssue(field: IssueField, message: string): FormIssue {
  return { field, message };
}

export function normalizeFormForDocument(data: BaptismFormData): BaptismFormData {
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

export function buildRecordFromForm(
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
    congregation: normalized.congregationCity || normalized.sucursalName || "-",
    createdAt: options?.createdAt ?? new Date().toISOString(),
    formData: normalized,
  };
}

export function mapFirestoreRecord(id: string, payload: Record<string, unknown>): BaptismRecord {
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
        : formData.congregationCity || formData.sucursalName || "-",
    createdAt,
    updatedAt,
    formData,
  };
}

export async function removeStorageFile(storagePath?: string) {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    console.warn("Falha ao remover arquivo do Storage:", error);
  }
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

export function loadImageFromDataUrl(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = dataUrl;
  });
}

export function getCenteredCropRect(srcWidth: number, srcHeight: number, targetRatio: number) {
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

export async function fileToCompressedJpegDataUrl(file: File) {
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

export async function sourceToBytes(source: string) {
  const res = await fetch(source);
  if (!res.ok) throw new Error("Não foi possível carregar a imagem.");
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    mimeType: res.headers.get("content-type") || "",
  };
}

export async function uploadPhotoToStorage(
  recordId: string,
  photoSource: string,
  previousStoragePath?: string,
  storageRoot: string = BAPTISM_STORAGE_ROOT
): Promise<{ photoDataUrl: string; photoStoragePath: string }> {
  const { bytes, mimeType } = await sourceToBytes(photoSource);
  const extension = mimeType.includes("png") ? "png" : "jpg";
  const storagePath = `${storageRoot}/${recordId}/photo-${Date.now()}.${extension}`;
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

export function inferDocumentMimeType(file: File) {
  if (file.type) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function uploadDocumentToStorage(
  recordId: string,
  documentKey: BaptismDocumentKey,
  file: File,
  storageRoot: string = BAPTISM_STORAGE_ROOT
) {
  const safeName = sanitizeStorageFileName(file.name);
  const storagePath = `${storageRoot}/${recordId}/documents/${documentKey}-${Date.now()}-${safeName}`;
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

export function stopMediaStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

export function analyzeFormForDocument(data: BaptismFormData): FormAnalysis {
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
  if (!data.sucursalName) warnings.push(makeIssue("sucursalName", "Reclassificação não selecionada."));
  if (!data.gender) warnings.push(makeIssue("gender", "Sexo não selecionado."));

  for (const rule of PDF_TEXT_RULES) {
    const value = data[rule.field];
    if (!value || typeof value !== "string") continue;
    if (measureTextWidth(value) > rule.maxWidth) {
      warnings.push(makeIssue(rule.field, `${rule.label} está maior que a linha do PDF e pode sair abreviado.`));
    }
  }

  return { errors, warnings };
}

export const POS = {
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
  // x=286.07 ficava em cima do texto impresso "qual?" (que vai até ~310.5),
  // por isso o nome do ministério saía ilegível, misturado com o rótulo.
  otherMinistry: { x: 316, y: 427 },

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

export const PDF_TEXT_RULES: Array<{ field: keyof BaptismFormData; label: string; maxWidth: number }> = [
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
  { field: "sucursalName", label: "Reclassificação", maxWidth: 320 },
];

let cachedBasePdfBytes: Uint8Array | null = null;
let textMeasureContext: CanvasRenderingContext2D | null = null;

export async function fetchPdfBytes(path: string) {
  if (cachedBasePdfBytes) {
    return new Uint8Array(cachedBasePdfBytes);
  }
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Não foi possível carregar o PDF base (${res.status}).`);
  cachedBasePdfBytes = new Uint8Array(await res.arrayBuffer());
  return new Uint8Array(cachedBasePdfBytes);
}

export function fitText(text: string, maxWidth: number, measure: (t: string) => number) {
  const v = (text || "").trim();
  if (!v) return "";
  if (measure(v) <= maxWidth) return v;

  let out = v;
  while (out.length > 0 && measure(out + "…") > maxWidth) {
    out = out.slice(0, -1);
  }
  return out.length ? out + "…" : "";
}

export function measureTextWidth(text: string) {
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

export async function buildFilledPdfBytes(data: BaptismFormData) {
  const normalizedData = normalizeFormForDocument(data);
  const pdfBytes = await fetchPdfBytes(PDF_SOURCE_PATH);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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
  if (normalizedData.gender) {
    // Sem campo "Sexo" na ficha oficial impressa: desenha um "chip" com borda
    // encostado na margem direita da barra do título da seção 1, para não
    // parecer que o texto está solto/colado no título.
    const label = `Sexo: ${normalizedData.gender}`;
    const badgeSize = 9;
    const paddingX = 6;
    const textWidth = boldFont.widthOfTextAtSize(label, badgeSize);
    const badgeRight = 567;
    const badgeWidth = textWidth + paddingX * 2;
    const badgeX = badgeRight - badgeWidth;
    const badgeY = 639;
    const badgeHeight = 14;

    page.drawRectangle({
      x: badgeX,
      y: badgeY,
      width: badgeWidth,
      height: badgeHeight,
      borderColor: color,
      borderWidth: 0.75,
      color: rgb(1, 1, 1),
    });
    page.drawText(label, {
      x: badgeX + paddingX,
      y: badgeY + 4,
      size: badgeSize,
      font: boldFont,
      color,
    });
  }

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

export function makeBlobUrl(bytes: Uint8Array | ArrayBuffer) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}
