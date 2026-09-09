import { db, storage } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const SEDE_ESTADUAL_COLLECTION = "sede_estadual_members";
export const SEDE_ESTADUAL_STORAGE_ROOT = "sede-estadual-files";
export const PHOTO_ASPECT_RATIO = 3 / 4;
export const PHOTO_MAX_WIDTH = 900;
export const PHOTO_MAX_HEIGHT = 1200;

export const CHURCH_POSITIONS = [
  "Membro",
  "Cooperador(a)",
  "Obreiro(a)",
  "Diácono",
  "Presbítero",
  "Pastor",
  "2º Pastor",
  "3º Pastor",
  "Conselheiro(a) Financeiro(a)",
  "Conselheiro(a) de Expansão",
  "Conselheiro(a) Patrimonial",
  "Líder Galileu (a)",
  "Auxiliar Galileu (a)",
  "Líder Adote uma Alma (a)",
  "Auxiliar Adote uma Alma (a)",
  "Coordenador(a) ETDA",
  "Professor(a) ETDA",
  "Atendente de Livraria",
  "Técnico(a) de Som",
  "Controlador(a) de Entrada",
] as const;
export type ChurchPosition = (typeof CHURCH_POSITIONS)[number];

export const MARITAL_STATUS_OPTIONS = ["Solteiro(a)", "Casado(a)", "Viúvo(a)", "Divorciado(a)/Separado(a)"] as const;
export type MaritalStatus = "" | (typeof MARITAL_STATUS_OPTIONS)[number];

export type SedeEstadualFormData = {
  fullName: string;
  phone: string;
  street: string;
  streetNumber: string;
  neighborhood: string;
  city: string;
  state: string;

  fatherName: string;
  motherName: string;
  maritalStatus: MaritalStatus;
  birthDate: string;

  rg: string;
  cpf: string;
  nationality: string;
  baptismDate: string;

  birthplaceCity: string;
  birthplaceState: string;

  churchPosition: "" | ChurchPosition;

  photoDataUrl: string;
  photoStoragePath?: string;
};

export type SedeEstadualRecord = {
  id: string;
  fullName: string;
  cpf: string;
  churchPosition: string;
  city: string;
  createdAt: string;
  updatedAt?: string;
  formData: SedeEstadualFormData;
};

export type IssueField = keyof SedeEstadualFormData | "general";
export type FormIssue = { field: IssueField; message: string };
export type FormAnalysis = { errors: FormIssue[]; warnings: FormIssue[] };

export function createEmptyForm(): SedeEstadualFormData {
  return {
    fullName: "",
    phone: "",
    street: "",
    streetNumber: "",
    neighborhood: "",
    city: "",
    state: "",

    fatherName: "",
    motherName: "",
    maritalStatus: "",
    birthDate: "",

    rg: "",
    cpf: "",
    nationality: "Brasileira",
    baptismDate: "",

    birthplaceCity: "",
    birthplaceState: "",

    churchPosition: "",

    photoDataUrl: "",
    photoStoragePath: "",
  };
}

export function normalizeFormData(data?: Partial<SedeEstadualFormData> | null): SedeEstadualFormData {
  return { ...createEmptyForm(), ...(data ?? {}) };
}

export function createRecordId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}`;
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

export function digitsOnly(value?: string) {
  return (value || "").replace(/\D/g, "");
}

export function collapseWhitespace(value?: string) {
  return (value || "").replace(/\s+/g, " ").trim();
}

export function formatCpfField(value?: string) {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function isValidCpfField(value?: string) {
  const digits = digitsOnly(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(digits[i]) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(digits[i]) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === Number(digits[10]);
}

export function formatPhoneField(value?: string) {
  let digits = digitsOnly(value);
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value || "";
}

export function isValidPhoneField(value?: string) {
  let digits = digitsOnly(value);
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11;
}

export function formatStateField(value?: string) {
  return (value || "").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
}

function toFourDigitYear(yearRaw: string) {
  if (yearRaw.length === 4) return yearRaw;
  if (yearRaw.length !== 2) return yearRaw;
  const y = Number(yearRaw);
  if (Number.isNaN(y)) return yearRaw;
  return String(y <= 30 ? 2000 + y : 1900 + y);
}

export function parseDateParts(value: string) {
  const v = (value || "").trim();
  if (!v) return null;

  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { day: iso[3], month: iso[2], year: iso[1] };

  const br = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (br) return { day: br[1].padStart(2, "0"), month: br[2].padStart(2, "0"), year: toFourDigitYear(br[3]) };

  const digits = v.replace(/\D/g, "");
  if (digits.length === 8) {
    const first4 = Number(digits.slice(0, 4));
    if (first4 >= 1900 && first4 <= 2100) {
      return { day: digits.slice(6, 8), month: digits.slice(4, 6), year: digits.slice(0, 4) };
    }
    return { day: digits.slice(0, 2), month: digits.slice(2, 4), year: digits.slice(4, 8) };
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

export function formatDateField(value?: string) {
  const v = (value || "").trim();
  if (!v) return "";
  const parts = parseDateParts(v);
  if (!parts) return v;
  if (!isValidDateParts(parts.day, parts.month, parts.year)) return v;
  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function makeIssue(field: IssueField, message: string): FormIssue {
  return { field, message };
}

export function normalizeFormForRecord(data: SedeEstadualFormData): SedeEstadualFormData {
  const normalized: SedeEstadualFormData = {
    ...data,
    fullName: collapseWhitespace(data.fullName),
    phone: formatPhoneField(data.phone),
    street: collapseWhitespace(data.street),
    streetNumber: collapseWhitespace(data.streetNumber),
    neighborhood: collapseWhitespace(data.neighborhood),
    city: collapseWhitespace(data.city),
    state: formatStateField(data.state),
    fatherName: collapseWhitespace(data.fatherName),
    motherName: collapseWhitespace(data.motherName),
    birthDate: formatDateField(data.birthDate),
    rg: collapseWhitespace(data.rg),
    cpf: formatCpfField(data.cpf),
    nationality: collapseWhitespace(data.nationality),
    baptismDate: formatDateField(data.baptismDate),
    birthplaceCity: collapseWhitespace(data.birthplaceCity),
    birthplaceState: formatStateField(data.birthplaceState),
  };

  if ((normalized.photoDataUrl || "").startsWith("data:image/")) {
    normalized.photoStoragePath = "";
  }

  return normalized;
}

export function analyzeForm(data: SedeEstadualFormData): FormAnalysis {
  const errors: FormIssue[] = [];
  const warnings: FormIssue[] = [];

  if (!data.fullName) errors.push(makeIssue("fullName", "Preencha o nome completo."));
  if (!data.photoDataUrl) errors.push(makeIssue("photoDataUrl", "Adicione a fotografia 3x4."));
  if (!data.churchPosition) errors.push(makeIssue("churchPosition", "Selecione a função ministerial."));

  if (data.cpf && !isValidCpfField(data.cpf)) errors.push(makeIssue("cpf", "O CPF informado é inválido."));
  if (data.phone && !isValidPhoneField(data.phone)) errors.push(makeIssue("phone", "Revise o telefone (DDD + número)."));
  if (data.state && data.state.length !== 2) errors.push(makeIssue("state", "O estado deve ter 2 letras (UF)."));
  if (data.birthplaceState && data.birthplaceState.length !== 2) {
    errors.push(makeIssue("birthplaceState", "O 'Est' da naturalidade deve ter 2 letras (UF)."));
  }

  const birthParts = parseDateParts(data.birthDate);
  if (data.birthDate && (!birthParts || !isValidDateParts(birthParts.day, birthParts.month, birthParts.year))) {
    errors.push(makeIssue("birthDate", "Use uma data de nascimento válida."));
  }
  const baptismParts = parseDateParts(data.baptismDate);
  if (data.baptismDate && (!baptismParts || !isValidDateParts(baptismParts.day, baptismParts.month, baptismParts.year))) {
    errors.push(makeIssue("baptismDate", "Use uma data de batismo válida."));
  }

  if (!data.phone) warnings.push(makeIssue("phone", "Telefone vazio."));
  if (!data.cpf) warnings.push(makeIssue("cpf", "CPF vazio."));
  if (!data.rg) warnings.push(makeIssue("rg", "RG vazio."));
  if (!data.city) warnings.push(makeIssue("city", "Cidade vazia."));
  if (!data.birthDate) warnings.push(makeIssue("birthDate", "Data de nascimento vazia."));

  return { errors, warnings };
}

export function mapFirestoreRecord(id: string, payload: Record<string, unknown>): SedeEstadualRecord {
  const createdAt = toIsoString(payload.createdAt, new Date().toISOString());
  const updatedAt = payload.updatedAt ? toIsoString(payload.updatedAt, createdAt) : undefined;
  const formData = normalizeFormData((payload.formData as Partial<SedeEstadualFormData> | undefined) ?? {});

  return {
    id,
    fullName: typeof payload.fullName === "string" ? payload.fullName : formData.fullName,
    cpf: typeof payload.cpf === "string" ? payload.cpf : formData.cpf,
    churchPosition: typeof payload.churchPosition === "string" ? payload.churchPosition : formData.churchPosition,
    city: typeof payload.city === "string" ? payload.city : formData.city,
    createdAt,
    updatedAt,
    formData,
  };
}

export async function loadRecordsFromFirebase() {
  const recordsRef = collection(db, SEDE_ESTADUAL_COLLECTION);
  const snapshot = await getDocs(query(recordsRef, orderBy("createdAt", "desc")));
  return snapshot.docs.map((snap) => mapFirestoreRecord(snap.id, snap.data() as Record<string, unknown>));
}

export async function saveRecordToFirebase(record: SedeEstadualRecord) {
  const docRef = doc(db, SEDE_ESTADUAL_COLLECTION, record.id);
  const payload = stripUndefinedDeep({ ...record, updatedAt: new Date().toISOString() });
  await setDoc(docRef, payload);
}

export async function deleteRecordFromFirebase(recordId: string) {
  await deleteDoc(doc(db, SEDE_ESTADUAL_COLLECTION, recordId));
}

export async function removeStorageFile(storagePath?: string) {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    console.warn("Falha ao remover arquivo do Storage:", error);
  }
}

export function buildRecordFromForm(
  formData: SedeEstadualFormData,
  options?: { id?: string; createdAt?: string }
): SedeEstadualRecord {
  const normalized = normalizeFormForRecord(formData);

  return {
    id: options?.id ?? createRecordId(),
    fullName: normalized.fullName,
    cpf: normalized.cpf,
    churchPosition: normalized.churchPosition,
    city: normalized.city,
    createdAt: options?.createdAt ?? new Date().toISOString(),
    formData: normalized,
  };
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
  return { bytes: new Uint8Array(await res.arrayBuffer()), mimeType: res.headers.get("content-type") || "" };
}

export async function uploadPhotoToStorage(recordId: string, photoSource: string, previousStoragePath?: string) {
  const { bytes, mimeType } = await sourceToBytes(photoSource);
  const extension = mimeType.includes("png") ? "png" : "jpg";
  const storagePath = `${SEDE_ESTADUAL_STORAGE_ROOT}/${recordId}/photo-${Date.now()}.${extension}`;
  const uploadRef = ref(storage, storagePath);

  await uploadBytes(uploadRef, bytes, {
    contentType: mimeType || `image/${extension}`,
    customMetadata: { recordId, category: "sede-estadual-photo", uploadedAt: new Date().toISOString() },
  });

  const downloadUrl = await getDownloadURL(uploadRef);

  if (previousStoragePath && previousStoragePath !== storagePath) {
    await removeStorageFile(previousStoragePath);
  }

  return { photoDataUrl: downloadUrl, photoStoragePath: storagePath };
}

export function stopMediaStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

export function makeBlobUrl(bytes: Uint8Array | ArrayBuffer) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

const MONTH_NAMES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export async function buildSedeEstadualPdfBytes(record: SedeEstadualRecord): Promise<Uint8Array> {
  const data = record.formData;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const textColor = rgb(0.05, 0.05, 0.05);
  const lineColor = rgb(0.55, 0.55, 0.55);
  const labelColor = rgb(0.25, 0.25, 0.25);

  page.drawText("IPDA - Cadastro de Membro | Sede Estadual", {
    x: 40, y: 790, size: 14, font: boldFont, color: textColor,
  });
  page.drawLine({ start: { x: 40, y: 780 }, end: { x: 555, y: 780 }, thickness: 1, color: lineColor });

  const drawField = (x: number, y: number, width: number, label: string, value: string) => {
    page.drawText(label, { x, y: y + 12, size: 8, font: boldFont, color: labelColor });
    page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.75, color: lineColor });
    const v = (value || "").trim();
    if (v) {
      let text = v;
      while (text.length > 0 && font.widthOfTextAtSize(text, 10) > width - 4) {
        text = text.slice(0, -1);
      }
      page.drawText(text, { x: x + 2, y: y + 2, size: 10, font, color: textColor });
    }
  };

  drawField(40, 745, 320, "Nome", data.fullName);
  drawField(375, 745, 180, "Tel", data.phone);

  drawField(40, 710, 400, "Rua", data.street);
  drawField(455, 710, 100, "Nº", data.streetNumber);

  drawField(40, 675, 180, "Bairro", data.neighborhood);
  drawField(235, 675, 180, "Cidade", data.city);
  drawField(430, 675, 125, "Estado", data.state);

  // Caixa "Foto 3x4" no canto superior direito, alinhada às linhas seguintes
  const photoBox = { x: 465, y: 555, width: 90, height: 120 };
  page.drawRectangle({
    x: photoBox.x, y: photoBox.y, width: photoBox.width, height: photoBox.height,
    borderColor: lineColor, borderWidth: 1,
  });

  const photoSource = (data.photoDataUrl || "").trim();
  if (photoSource) {
    try {
      const { bytes, mimeType } = await sourceToBytes(photoSource);
      const lower = `${photoSource} ${mimeType}`.toLowerCase();
      const photoImage = lower.includes("png") ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      page.drawImage(photoImage, { x: photoBox.x, y: photoBox.y, width: photoBox.width, height: photoBox.height });
    } catch (err) {
      console.error("Não foi possível inserir a foto no PDF.", err);
    }
  } else {
    page.drawText("Foto 3x4", {
      x: photoBox.x + 16, y: photoBox.y + photoBox.height / 2, size: 9, font: boldFont, color: labelColor,
    });
  }

  drawField(40, 640, 400, "Pai", data.fatherName);
  drawField(40, 605, 400, "Mãe", data.motherName);

  drawField(40, 570, 180, "Estado Civil", data.maritalStatus);
  drawField(230, 570, 190, "Nascimento", formatDateField(data.birthDate));

  drawField(40, 535, 180, "RG", data.rg);
  drawField(230, 535, 190, "CPF", data.cpf);

  drawField(40, 500, 415, "Função ministerial", data.churchPosition);

  drawField(40, 460, 300, "Nacionalidade", data.nationality);
  drawField(360, 460, 195, "Batismo", formatDateField(data.baptismDate));

  drawField(40, 425, 300, "Natural de", data.birthplaceCity);
  drawField(360, 425, 195, "Est", data.birthplaceState);

  const today = new Date();
  const dateline = `${data.city || "____________"}, ${today.getDate()} de ${MONTH_NAMES_PT[today.getMonth()]} de ${today.getFullYear()}`;
  page.drawText(dateline, { x: 40, y: 385, size: 10, font, color: textColor });

  return pdfDoc.save();
}
