"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { auth, db, storage } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from "firebase/auth";
import { collection, doc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Camera, CheckCircle2, Landmark, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

export const dynamic = "force-dynamic";

const SEDE_ESTADUAL_COLLECTION = "sede_estadual_members";
const SEDE_ESTADUAL_STORAGE_ROOT = "sede-estadual-files";
const PHOTO_ASPECT_RATIO = 3 / 4;
const PHOTO_MAX_WIDTH = 900;
const PHOTO_MAX_HEIGHT = 1200;

const CHURCH_POSITIONS = [
  "Membro",
  "Cooperador(a)",
  "Obreiro(a)",
  "Diácono",
  "Presbítero",
  "Pastor",
] as const;
type ChurchPosition = (typeof CHURCH_POSITIONS)[number];

const MARITAL_STATUS_OPTIONS = ["Solteiro(a)", "Casado(a)", "Viúvo(a)", "Divorciado(a)/Separado(a)"] as const;
type MaritalStatus = "" | (typeof MARITAL_STATUS_OPTIONS)[number];

type SedeEstadualFormData = {
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

type IssueField = keyof SedeEstadualFormData | "general";
type FormIssue = { field: IssueField; message: string };
type FormAnalysis = { errors: FormIssue[]; warnings: FormIssue[] };

function createEmptyForm(): SedeEstadualFormData {
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

function createRecordId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}`;
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

function digitsOnly(value?: string) {
  return (value || "").replace(/\D/g, "");
}

function collapseWhitespace(value?: string) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function formatCpfField(value?: string) {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function isValidCpfField(value?: string) {
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

function formatPhoneField(value?: string) {
  let digits = digitsOnly(value);
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value || "";
}

function isValidPhoneField(value?: string) {
  let digits = digitsOnly(value);
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11;
}

function formatStateField(value?: string) {
  return (value || "").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
}

function toFourDigitYear(yearRaw: string) {
  if (yearRaw.length === 4) return yearRaw;
  if (yearRaw.length !== 2) return yearRaw;
  const y = Number(yearRaw);
  if (Number.isNaN(y)) return yearRaw;
  return String(y <= 30 ? 2000 + y : 1900 + y);
}

function parseDateParts(value: string) {
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

function isValidDateParts(day: string, month: string, year: string) {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (Number.isNaN(d) || Number.isNaN(m) || Number.isNaN(y)) return false;
  if (year.length !== 4 || m < 1 || m > 12 || d < 1 || d > 31) return false;

  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function formatDateField(value?: string) {
  const v = (value || "").trim();
  if (!v) return "";
  const parts = parseDateParts(v);
  if (!parts) return v;
  if (!isValidDateParts(parts.day, parts.month, parts.year)) return v;
  return `${parts.day}/${parts.month}/${parts.year}`;
}

function makeIssue(field: IssueField, message: string): FormIssue {
  return { field, message };
}

function normalizeFormForRecord(data: SedeEstadualFormData): SedeEstadualFormData {
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

function analyzeForm(data: SedeEstadualFormData): FormAnalysis {
  const errors: FormIssue[] = [];
  const warnings: FormIssue[] = [];

  if (!data.fullName) errors.push(makeIssue("fullName", "Preencha o nome completo."));
  if (!data.photoDataUrl) errors.push(makeIssue("photoDataUrl", "Adicione a fotografia 3x4."));
  if (!data.churchPosition) errors.push(makeIssue("churchPosition", "Selecione o cargo."));

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

  return { errors, warnings };
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
  return { bytes: new Uint8Array(await res.arrayBuffer()), mimeType: res.headers.get("content-type") || "" };
}

async function uploadPhotoToStorage(recordId: string, photoSource: string) {
  const { bytes, mimeType } = await sourceToBytes(photoSource);
  const extension = mimeType.includes("png") ? "png" : "jpg";
  const storagePath = `${SEDE_ESTADUAL_STORAGE_ROOT}/${recordId}/photo-${Date.now()}.${extension}`;
  const uploadRef = ref(storage, storagePath);

  await uploadBytes(uploadRef, bytes, {
    contentType: mimeType || `image/${extension}`,
    customMetadata: { recordId, category: "sede-estadual-photo", uploadedAt: new Date().toISOString(), source: "formulario-publico" },
  });

  const downloadUrl = await getDownloadURL(uploadRef);
  return { photoDataUrl: downloadUrl, photoStoragePath: storagePath };
}

function stopMediaStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

function makeBlobUrl(bytes: Uint8Array | ArrayBuffer) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

const MONTH_NAMES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

async function buildSedeEstadualPdfBytes(data: SedeEstadualFormData): Promise<Uint8Array> {
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

  drawField(40, 500, 415, "Cargo", data.churchPosition);

  drawField(40, 460, 300, "Nacionalidade", data.nationality);
  drawField(360, 460, 195, "Batismo", formatDateField(data.baptismDate));

  drawField(40, 425, 300, "Natural de", data.birthplaceCity);
  drawField(360, 425, 195, "Est", data.birthplaceState);

  const today = new Date();
  const dateline = `${data.city || "____________"}, ${today.getDate()} de ${MONTH_NAMES_PT[today.getMonth()]} de ${today.getFullYear()}`;
  page.drawText(dateline, { x: 40, y: 385, size: 10, font, color: textColor });

  return pdfDoc.save();
}

type SubmitState = "idle" | "authenticating" | "auth-error" | "saving" | "done" | "save-error";

export default function SedeEstadualPublicPage() {
  const [form, setForm] = useState<SedeEstadualFormData>(createEmptyForm);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("authenticating");
  const [submitErrorMessage, setSubmitErrorMessage] = useState("");

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");

  const normalizedForm = useMemo(() => normalizeFormForRecord(form), [form]);
  const formAnalysis = useMemo(() => analyzeForm(normalizedForm), [normalizedForm]);
  const errorFields = useMemo(() => new Set(formAnalysis.errors.map((i) => i.field)), [formAnalysis.errors]);
  const warningFields = useMemo(
    () => new Set(formAnalysis.warnings.filter((i) => !errorFields.has(i.field)).map((i) => i.field)),
    [errorFields, formAnalysis.warnings]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setAuthUser(user);
        setSubmitState((prev) => (prev === "authenticating" ? "idle" : prev));
        return;
      }

      try {
        const credential = await signInAnonymously(auth);
        setAuthUser(credential.user);
        setSubmitState((prev) => (prev === "authenticating" ? "idle" : prev));
      } catch (error) {
        console.error("Não foi possível iniciar sessão anônima para o formulário público.", error);
        setSubmitState("auth-error");
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    return () => {
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
    if (playPromise) playPromise.catch(() => {});
  }, [cameraStream]);

  function updateField<K extends keyof SedeEstadualFormData>(field: K, value: SedeEstadualFormData[K]) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "photoDataUrl" && typeof value === "string") {
        if (!value || value.startsWith("data:image/")) next.photoStoragePath = "";
      }
      return next;
    });
  }

  function getInputClass(field: IssueField) {
    if (errorFields.has(field)) return "border-red-400 bg-red-50";
    if (warningFields.has(field)) return "border-amber-300 bg-amber-50";
    return "";
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

    updateField("photoDataUrl", canvas.toDataURL("image/jpeg", 0.86));
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

  async function handleSubmit() {
    const normalized = normalizeFormForRecord(form);
    setForm(normalized);
    const analysis = analyzeForm(normalized);

    if (analysis.errors.length > 0) {
      const preview = analysis.errors.slice(0, 6).map((issue) => `- ${issue.message}`);
      alert(["Corrija os campos obrigatórios antes de enviar:", ...preview].join("\n"));
      return;
    }

    if (!authUser) {
      setSubmitErrorMessage("Ainda estamos preparando o formulário. Aguarde alguns segundos e tente novamente.");
      setSubmitState("save-error");
      return;
    }

    setSubmitState("saving");
    setSubmitErrorMessage("");

    try {
      const recordId = createRecordId();
      let photoDataUrl = normalized.photoDataUrl;
      let photoStoragePath = "";

      if (photoDataUrl.startsWith("data:image/")) {
        const uploaded = await uploadPhotoToStorage(recordId, photoDataUrl);
        photoDataUrl = uploaded.photoDataUrl;
        photoStoragePath = uploaded.photoStoragePath;
      }

      const finalFormData: SedeEstadualFormData = { ...normalized, photoDataUrl, photoStoragePath };
      const payload = stripUndefinedDeep({
        id: recordId,
        fullName: finalFormData.fullName,
        cpf: finalFormData.cpf,
        churchPosition: finalFormData.churchPosition,
        city: finalFormData.city,
        createdAt: new Date().toISOString(),
        formData: finalFormData,
      });

      await setDoc(doc(collection(db, SEDE_ESTADUAL_COLLECTION), recordId), payload);

      setForm(finalFormData);
      setSubmitState("done");
    } catch (error) {
      console.error(error);
      setSubmitErrorMessage("Não foi possível enviar seu cadastro. Verifique sua conexão e tente novamente.");
      setSubmitState("save-error");
    }
  }

  async function handleDownloadReceipt() {
    try {
      const bytes = await buildSedeEstadualPdfBytes(form);
      const url = makeBlobUrl(bytes);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error(error);
      alert("Não foi possível gerar o PDF do comprovante.");
    }
  }

  function handleNewRegistration() {
    setForm(createEmptyForm());
    setSubmitState("idle");
    setSubmitErrorMessage("");
    closeCamera();
  }

  if (submitState === "done") {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <CheckCircle2 className="h-14 w-14 text-green-600" />
        <h1 className="text-2xl font-bold">Cadastro enviado com sucesso!</h1>
        <p className="text-muted-foreground">
          Obrigado, {form.fullName.split(" ")[0] || "irmão(ã)"}! Seu cadastro na Sede Estadual foi recebido. A
          secretaria poderá entrar em contato caso alguma informação precise ser corrigida.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={handleDownloadReceipt} variant="outline">
            Baixar comprovante em PDF
          </Button>
          <Button onClick={handleNewRegistration}>
            <Plus className="mr-2 h-4 w-4" /> Cadastrar outra pessoa
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Landmark className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Cadastro de Membro — Sede Estadual</h1>
          <p className="text-sm text-muted-foreground">
            Preencha seus dados abaixo. Não é necessário fazer login.
          </p>
        </div>
      </div>

      {submitState === "auth-error" ? (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Não foi possível preparar o formulário agora. Recarregue a página ou tente novamente em instantes. Se o
          problema continuar, procure a secretaria.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Dados do cadastro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {formAnalysis.warnings.length > 0 ? (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              {formAnalysis.warnings.map((issue) => (
                <p key={`${issue.field}-${issue.message}`}>- {issue.message}</p>
              ))}
            </div>
          ) : null}

          {submitState === "save-error" && submitErrorMessage ? (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {submitErrorMessage}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Nome</Label>
              <Input
                className={getInputClass("fullName")}
                value={form.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                className={getInputClass("phone")}
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
              />
            </div>

            <div>
              <Label>Rua</Label>
              <Input value={form.street} onChange={(e) => updateField("street", e.target.value)} />
            </div>
            <div>
              <Label>Nº</Label>
              <Input value={form.streetNumber} onChange={(e) => updateField("streetNumber", e.target.value)} />
            </div>

            <div>
              <Label>Bairro</Label>
              <Input value={form.neighborhood} onChange={(e) => updateField("neighborhood", e.target.value)} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input
                className={getInputClass("city")}
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
              />
            </div>
            <div>
              <Label>Estado (UF)</Label>
              <Input
                className={getInputClass("state")}
                value={form.state}
                maxLength={2}
                onChange={(e) => updateField("state", e.target.value.toUpperCase())}
              />
            </div>

            <div>
              <Label>Pai</Label>
              <Input value={form.fatherName} onChange={(e) => updateField("fatherName", e.target.value)} />
            </div>
            <div>
              <Label>Mãe</Label>
              <Input value={form.motherName} onChange={(e) => updateField("motherName", e.target.value)} />
            </div>

            <div>
              <Label>Estado Civil</Label>
              <Select
                value={form.maritalStatus || undefined}
                onValueChange={(v) => updateField("maritalStatus", v as MaritalStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {MARITAL_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nascimento</Label>
              <Input
                className={getInputClass("birthDate")}
                placeholder="dd/mm/aaaa"
                value={form.birthDate}
                onChange={(e) => updateField("birthDate", e.target.value)}
              />
            </div>

            <div>
              <Label>RG</Label>
              <Input value={form.rg} onChange={(e) => updateField("rg", e.target.value)} />
            </div>
            <div>
              <Label>CPF</Label>
              <Input
                className={getInputClass("cpf")}
                value={form.cpf}
                onChange={(e) => updateField("cpf", e.target.value)}
              />
            </div>

            <div>
              <Label>Nacionalidade</Label>
              <Input value={form.nationality} onChange={(e) => updateField("nationality", e.target.value)} />
            </div>
            <div>
              <Label>Batismo</Label>
              <Input
                className={getInputClass("baptismDate")}
                placeholder="dd/mm/aaaa"
                value={form.baptismDate}
                onChange={(e) => updateField("baptismDate", e.target.value)}
              />
            </div>

            <div>
              <Label>Natural de</Label>
              <Input value={form.birthplaceCity} onChange={(e) => updateField("birthplaceCity", e.target.value)} />
            </div>
            <div>
              <Label>Est</Label>
              <Input
                className={getInputClass("birthplaceState")}
                maxLength={2}
                value={form.birthplaceState}
                onChange={(e) => updateField("birthplaceState", e.target.value.toUpperCase())}
              />
            </div>

            <div className="sm:col-span-2">
              <Label>Cargo</Label>
              <Select
                value={form.churchPosition || undefined}
                onValueChange={(v) => updateField("churchPosition", v as ChurchPosition)}
              >
                <SelectTrigger className={getInputClass("churchPosition")}>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  {CHURCH_POSITIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Foto 3x4</Label>
            <div className="mt-1 flex flex-col items-start gap-2 rounded-lg border bg-slate-50 p-3">
              {form.photoDataUrl ? (
                <Image
                  src={form.photoDataUrl}
                  alt="Foto 3x4"
                  width={96}
                  height={128}
                  unoptimized
                  className="h-32 w-24 rounded border object-cover"
                />
              ) : (
                <p className={`text-xs text-muted-foreground ${errorFields.has("photoDataUrl") ? "text-red-600" : ""}`}>
                  Tire uma foto ao vivo ou envie um arquivo da galeria.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={openCamera}>
                  <Camera className="mr-1 h-4 w-4" /> Câmera
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => photoInputRef.current?.click()}>
                  <Upload className="mr-1 h-4 w-4" /> Enviar
                </Button>
                {form.photoDataUrl ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => updateField("photoDataUrl", "")}>
                    <Trash2 className="mr-1 h-4 w-4" /> Remover
                  </Button>
                ) : null}
              </div>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoFileChange}
              />

              {cameraStream ? (
                <div className="w-full rounded-lg border bg-black/5 p-2">
                  <video
                    ref={cameraVideoRef}
                    className="h-48 w-36 rounded border bg-black object-cover"
                    autoPlay
                    muted
                    playsInline
                  />
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

              {cameraError ? <p className="text-xs text-red-600">{cameraError}</p> : null}
            </div>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitState === "saving" || submitState === "authenticating"}
            >
              {submitState === "saving" || submitState === "authenticating" ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Enviar cadastro
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
