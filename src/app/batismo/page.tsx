"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from "firebase/firestore";
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

import {
  analyzeFormForDocument,
  BAPTISM_COLLECTION,
  BAPTISM_PENDING_COLLECTION,
  BAPTISM_PENDING_STORAGE_ROOT,
  BAPTISM_STORAGE_ROOT,
  type BaptismDocumentKey,
  type BaptismDocumentMeta,
  type BaptismFormData,
  type BaptismRecord,
  buildFilledPdfBytes,
  buildRecordFromForm,
  collapseWhitespace,
  createEmptyForm,
  createRecordId,
  digitsOnly,
  DOCUMENT_DEFINITIONS,
  fetchPdfBytes,
  fileToCompressedJpegDataUrl,
  type FormIssue,
  formatCepField,
  formatCpfField,
  formatDateField,
  formatFileSize,
  formatPhoneField,
  formatStateField,
  formatYearField,
  getCenteredCropRect,
  getDocumentChecklist,
  inferDocumentMimeType,
  isBaptismDocumentKey,
  type IssueField,
  isValidCepField,
  isValidCpfField,
  isValidDateParts,
  isValidPhoneField,
  makeBlobUrl,
  mapFirestoreRecord,
  normalizeFormData,
  normalizeFormForDocument,
  parseDateParts,
  PDF_SOURCE_PATH,
  PDF_TEXT_RULES,
  PHOTO_ASPECT_RATIO,
  PHOTO_MAX_HEIGHT,
  PHOTO_MAX_WIDTH,
  readFileAsDataUrl,
  RECLASSIFICATION_OPTIONS,
  type ReclassificationOption,
  removeStorageFile,
  sanitizeFileName,
  sanitizeStorageFileName,
  sourceToBytes,
  stopMediaStream,
  stripUndefinedDeep,
  toggleChoice,
  toIsoString,
  uploadDocumentToStorage,
  uploadPhotoToStorage,
} from "@/lib/batismo-form";

export const dynamic = "force-dynamic";
// Ordem das linhas no relatório agregado (segue o modelo oficial da planilha de batismo).
const REPORT_PORTE_ORDER: ReclassificationOption[] = [
  "Local",
  "Setorial",
  "Estadual",
  "Regional",
  "Casa de Oração",
  "Central",
];

type PreviewMode = "filled" | "original";

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

    gender: "Masculino",

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
    sucursalName: "Local",
    documents: {},
  });
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

async function loadPendingSubmissions() {
  // Todo documento em BAPTISM_PENDING_COLLECTION é, por definição, um cadastro
  // aguardando revisão: aprovar ou rejeitar sempre remove o documento da coleção.
  const pendingRef = collection(db, BAPTISM_PENDING_COLLECTION);
  const snapshot = await getDocs(query(pendingRef, orderBy("createdAt", "desc")));
  return snapshot.docs.map((snap) => mapFirestoreRecord(snap.id, snap.data() as Record<string, unknown>));
}

async function deletePendingSubmission(pending: BaptismRecord) {
  await deleteDoc(doc(db, BAPTISM_PENDING_COLLECTION, pending.id));

  const documentPaths = Object.values(pending.formData.documents ?? {})
    .map((meta) => meta?.storagePath)
    .filter((path): path is string => Boolean(path));

  await Promise.all([
    removeStorageFile(pending.formData.photoStoragePath),
    ...documentPaths.map((path) => removeStorageFile(path)),
  ]);
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

function triggerBlobDownload(bytes: BlobPart, mimeType: string, fileName: string) {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ===========================
// Relatório agregado de batismo (por Reclassificação)
// ===========================

type PorteAggregate = {
  porte: ReclassificationOption;
  total: number;
  masculino: number;
  feminino: number;
  casados: number;
  solteiros: number;
  divorciados: number;
  viuvos: number;
  idade16a18: number;
  idade19a30: number;
  idade31a99: number;
};

type ReportHeaderInfo = {
  estado: string;
  uf: string;
  dataBatismo: string;
  endereco: string;
  numero: string;
  bairro: string;
  responsavel: string;
  telefoneResponsavel: string;
  cep: string;
  telefoneIpda: string;
  cidade: string;
};

function calculateAgeFromBrDate(value: string): number | null {
  const parts = parseDateParts(value);
  if (!parts || !isValidDateParts(parts.day, parts.month, parts.year)) return null;

  const birth = new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function buildPorteAggregates(records: BaptismRecord[]): PorteAggregate[] {
  const buckets = new Map<ReclassificationOption, PorteAggregate>(
    REPORT_PORTE_ORDER.map((porte) => [
      porte,
      {
        porte,
        total: 0,
        masculino: 0,
        feminino: 0,
        casados: 0,
        solteiros: 0,
        divorciados: 0,
        viuvos: 0,
        idade16a18: 0,
        idade19a30: 0,
        idade31a99: 0,
      },
    ])
  );

  records.forEach((record) => {
    const data = record.formData;
    const porte = data.sucursalName;
    const bucket = porte ? buckets.get(porte) : undefined;
    if (!bucket) return; // registros sem reclassificação selecionada não entram no relatório agregado

    bucket.total += 1;
    if (data.gender === "Masculino") bucket.masculino += 1;
    if (data.gender === "Feminino") bucket.feminino += 1;

    if (data.maritalStatus === "Casado(a)") bucket.casados += 1;
    else if (data.maritalStatus === "Solteiro(a)") bucket.solteiros += 1;
    else if (data.maritalStatus === "Divorciado/Separado e sozinho") bucket.divorciados += 1;
    else if (data.maritalStatus === "Viúvo(a)") bucket.viuvos += 1;

    const age = calculateAgeFromBrDate(data.birthDate);
    if (age !== null) {
      if (age >= 16 && age <= 18) bucket.idade16a18 += 1;
      else if (age >= 19 && age <= 30) bucket.idade19a30 += 1;
      else if (age >= 31) bucket.idade31a99 += 1;
    }
  });

  return REPORT_PORTE_ORDER.map((porte) => buckets.get(porte)!);
}

function wrapTextLines(text: string, maxWidth: number, measure: (t: string) => number): string[] {
  const words = text.split(" ").filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measure(candidate) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });

  if (current) lines.push(current);
  return lines;
}

async function buildAggregateReportPdfBytes(aggregates: PorteAggregate[], header: ReportHeaderInfo) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([841.89, 595.28]); // A4 paisagem
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const color = rgb(0.05, 0.05, 0.05);
  const lineColor = rgb(0.35, 0.35, 0.35);
  const { width } = page.getSize();
  const margin = 30;

  const text = (value: string, x: number, y: number, opts: { size?: number; bold?: boolean } = {}) => {
    if (!value) return;
    page.drawText(value, {
      x,
      y,
      size: opts.size ?? 9.5,
      font: opts.bold ? fontBold : fontRegular,
      color,
    });
  };

  let cursorY = page.getHeight() - margin;

  text("RELATÓRIO DE BATISMO", margin, cursorY, { size: 17, bold: true });
  cursorY -= 26;

  text(`Estado: ${header.estado || "-"}`, margin, cursorY, { size: 10 });
  text(`UF: ${header.uf || "-"}`, margin + 300, cursorY, { size: 10 });
  text(`Data do Batismo: ${header.dataBatismo || "-"}`, margin + 460, cursorY, { size: 10 });
  cursorY -= 18;

  text(`Endereço: ${header.endereco || "-"}`, margin, cursorY, { size: 10 });
  text(`N° ${header.numero || "-"}`, margin + 460, cursorY, { size: 10 });
  text(`Bairro: ${header.bairro || "-"}`, margin + 540, cursorY, { size: 10 });
  cursorY -= 18;

  text(`Responsável: ${header.responsavel || "-"}`, margin, cursorY, { size: 10 });
  text(`Tel.: ${header.telefoneResponsavel || "-"}`, margin + 340, cursorY, { size: 10 });
  text(`Cep: ${header.cep || "-"}`, margin + 540, cursorY, { size: 10 });
  cursorY -= 18;

  text(`Telefone IPDA: ${header.telefoneIpda || "-"}`, margin, cursorY, { size: 10 });
  text(`Cidade: ${header.cidade || "-"}`, margin + 340, cursorY, { size: 10 });
  cursorY -= 28;

  const columns: Array<{ key: keyof PorteAggregate | "nomeIpda" | "dirigente" | "telefoneDirigente"; label: string; width: number }> = [
    { key: "porte", label: "Porte", width: 66 },
    { key: "nomeIpda", label: "Nome da IPDA", width: 118 },
    { key: "total", label: "Qtd. de Batizados", width: 60 },
    { key: "masculino", label: "Qtd. Masculino", width: 55 },
    { key: "feminino", label: "Qtd. Feminino", width: 55 },
    { key: "casados", label: "Casados", width: 48 },
    { key: "solteiros", label: "Solteiros", width: 48 },
    { key: "divorciados", label: "Divorciados", width: 52 },
    { key: "viuvos", label: "Viúvos", width: 44 },
    { key: "idade16a18", label: "De 16 a 18 anos", width: 58 },
    { key: "idade19a30", label: "De 19 a 30 anos", width: 58 },
    { key: "idade31a99", label: "De 31 a 99 anos", width: 58 },
    { key: "dirigente", label: "Nome do Dirigente", width: 92 },
    { key: "telefoneDirigente", label: "Telefone do dirigente", width: 82 },
  ];

  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const tableX = (width - tableWidth) / 2;
  const headerHeight = 30;
  const rowHeight = 22;

  let colX = tableX;
  columns.forEach((col) => {
    page.drawRectangle({
      x: colX,
      y: cursorY - headerHeight,
      width: col.width,
      height: headerHeight,
      borderColor: lineColor,
      borderWidth: 0.75,
    });

    const lines = wrapTextLines(col.label, col.width - 6, (t) => fontBold.widthOfTextAtSize(t, 7));
    const startY = cursorY - headerHeight / 2 + ((lines.length - 1) * 8) / 2 + 2;
    lines.forEach((line, index) => {
      text(line, colX + 3, startY - index * 8, { size: 7, bold: true });
    });

    colX += col.width;
  });

  cursorY -= headerHeight;

  aggregates.forEach((row) => {
    colX = tableX;
    columns.forEach((col) => {
      page.drawRectangle({
        x: colX,
        y: cursorY - rowHeight,
        width: col.width,
        height: rowHeight,
        borderColor: lineColor,
        borderWidth: 0.75,
      });

      const isBlankColumn = col.key === "nomeIpda" || col.key === "dirigente" || col.key === "telefoneDirigente";
      const value = isBlankColumn ? "" : String(row[col.key as keyof PorteAggregate]);
      text(value, colX + 4, cursorY - rowHeight + 7, { size: 8.5 });

      colX += col.width;
    });
    cursorY -= rowHeight;
  });

  return await pdfDoc.save();
}

async function buildAggregateReportXlsxBuffer(aggregates: PorteAggregate[], header: ReportHeaderInfo) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Relatório de Batismo", {
    pageSetup: { orientation: "landscape", fitToPage: true },
  });

  sheet.columns = [
    { width: 14 }, // A Porte
    { width: 26 }, // B Nome da IPDA
    { width: 15 }, // C Qtd. de Batizados
    { width: 13 }, // D Qtd. Masculino
    { width: 12 }, // E Qtd. Feminino
    { width: 10 }, // F Casados
    { width: 10 }, // G Solteiros
    { width: 11 }, // H Divorciados
    { width: 9 }, // I Viúvos
    { width: 12 }, // J De 16 a 18
    { width: 12 }, // K De 19 a 30
    { width: 12 }, // L De 31 a 99
    { width: 20 }, // M Nome do dirigente
    { width: 8 }, // N (merge M:O)
    { width: 8 }, // O
    { width: 18 }, // P Telefone do dirigente
  ];

  const thinBorder = {
    top: { style: "thin" as const },
    left: { style: "thin" as const },
    bottom: { style: "thin" as const },
    right: { style: "thin" as const },
  };
  const yellowFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFFFFF00" },
  };
  const centerMiddle = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };

  const setCell = (
    coordinate: string,
    value: string | number,
    opts: { bold?: boolean; size?: number; color?: string; fill?: boolean; align?: boolean } = {}
  ) => {
    const cell = sheet.getCell(coordinate);
    cell.value = value;
    cell.font = { bold: opts.bold ?? true, size: opts.size ?? 11, color: opts.color ? { argb: opts.color } : undefined };
    if (opts.align !== false) cell.alignment = centerMiddle;
    cell.border = thinBorder;
    if (opts.fill) cell.fill = yellowFill;
    return cell;
  };

  // Título
  sheet.mergeCells("A1:P1");
  setCell("A1", "RELATÓRIO DE BATISMO", { size: 20, fill: true });
  sheet.getRow(1).height = 28;

  // Identificação
  sheet.mergeCells("A2:F2");
  setCell("A2", `Estado: ${header.estado || ""}`, { size: 14, align: false });
  sheet.mergeCells("H2:L2");
  setCell("H2", `UF: ${header.uf || ""}`, { size: 14, align: false });
  sheet.mergeCells("M2:P2");
  setCell("M2", `Data do Batismo: ${header.dataBatismo || ""}`, { size: 14, align: false });

  sheet.mergeCells("A3:P3");
  setCell(
    "A3",
    "ASSINALE AQUI O PORTE DE SUA IGREJA: Local (  )  Setorial (  )  Estadual (  )  Regional (  )  Casa de Oração (  )  Central (  )",
    { size: 14, color: "FFFF0000", align: false }
  );
  sheet.getRow(3).height = 20;

  sheet.mergeCells("A4:L4");
  setCell("A4", `Endereço: ${header.endereco || ""}`, { size: 11, align: false });
  setCell("M4", `N° ${header.numero || ""}`, { size: 11, align: false });
  sheet.mergeCells("N4:P4");
  setCell("N4", `Bairro: ${header.bairro || ""}`, { size: 11, align: false });

  sheet.mergeCells("A5:H5");
  setCell("A5", `Responsável: ${header.responsavel || ""}`, { size: 11, align: false });
  sheet.mergeCells("I5:J5");
  setCell("I5", `Tel.: ${header.telefoneResponsavel || ""}`, { size: 11, align: false });
  sheet.mergeCells("N5:P5");
  setCell("N5", `Cep: ${header.cep || ""}`, { size: 11, align: false });

  sheet.mergeCells("A6:M6");
  setCell("A6", `Telefone IPDA: ${header.telefoneIpda || ""}`, { size: 11, align: false });
  sheet.mergeCells("N6:P6");
  setCell("N6", `Cidade: ${header.cidade || ""}`, { size: 11, align: false });

  // Cabeçalho da tabela
  sheet.mergeCells("A7:C7");
  setCell("A7", "", { fill: true, size: 12 });
  sheet.mergeCells("D7:E7");
  setCell("D7", "SEXO", { fill: true, size: 13 });
  sheet.mergeCells("F7:I7");
  setCell("F7", "ESTADO CIVIL", { fill: true, size: 13 });
  sheet.mergeCells("J7:L7");
  setCell("J7", "IDADE DOS BATIZADOS", { fill: true, size: 13 });
  sheet.mergeCells("M7:P7");
  setCell("M7", "", { fill: true, size: 12 });
  sheet.getRow(7).height = 20;

  const headerCells: Array<[string, string]> = [
    ["A8", "Porte"],
    ["B8", "Nome da IPDA"],
    ["C8", "Qtd. de Batizados"],
    ["D8", "Qtd. Masculino"],
    ["E8", "Qtd. Feminino"],
    ["F8", "Casados"],
    ["G8", "Solteiros"],
    ["H8", "Divorciados"],
    ["I8", "Viúvos"],
    ["J8", "De 16 a 18 anos"],
    ["K8", "De 19 a 30 anos"],
    ["L8", "De 31 a 99 anos"],
  ];
  headerCells.forEach(([coord, label]) => setCell(coord, label, { size: 11 }));
  sheet.mergeCells("M8:O8");
  setCell("M8", "Nome do Dirigente que levou os candidatos", { size: 11 });
  setCell("P8", "Telefone do dirigente", { size: 11 });
  sheet.getRow(8).height = 32;

  // Linhas de dados por Reclassificação
  let rowIndex = 9;
  const totals = { total: 0, masculino: 0, feminino: 0, casados: 0, solteiros: 0, divorciados: 0, viuvos: 0, idade16a18: 0, idade19a30: 0, idade31a99: 0 };

  aggregates.forEach((row) => {
    setCell(`A${rowIndex}`, row.porte, { bold: false });
    setCell(`B${rowIndex}`, "", { bold: false });
    setCell(`C${rowIndex}`, row.total, { bold: false });
    setCell(`D${rowIndex}`, row.masculino, { bold: false });
    setCell(`E${rowIndex}`, row.feminino, { bold: false });
    setCell(`F${rowIndex}`, row.casados, { bold: false });
    setCell(`G${rowIndex}`, row.solteiros, { bold: false });
    setCell(`H${rowIndex}`, row.divorciados, { bold: false });
    setCell(`I${rowIndex}`, row.viuvos, { bold: false });
    setCell(`J${rowIndex}`, row.idade16a18, { bold: false });
    setCell(`K${rowIndex}`, row.idade19a30, { bold: false });
    setCell(`L${rowIndex}`, row.idade31a99, { bold: false });
    sheet.mergeCells(`M${rowIndex}:O${rowIndex}`);
    setCell(`M${rowIndex}`, "", { bold: false });
    setCell(`P${rowIndex}`, "", { bold: false });

    totals.total += row.total;
    totals.masculino += row.masculino;
    totals.feminino += row.feminino;
    totals.casados += row.casados;
    totals.solteiros += row.solteiros;
    totals.divorciados += row.divorciados;
    totals.viuvos += row.viuvos;
    totals.idade16a18 += row.idade16a18;
    totals.idade19a30 += row.idade19a30;
    totals.idade31a99 += row.idade31a99;

    rowIndex += 1;
  });

  // Linha de totais
  sheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
  setCell(`A${rowIndex}`, "TOTAL DE BATIZADOS", { size: 11 });
  setCell(`C${rowIndex}`, totals.total, { size: 11 });
  setCell(`D${rowIndex}`, totals.masculino, { size: 11 });
  setCell(`E${rowIndex}`, totals.feminino, { size: 11 });
  setCell(`F${rowIndex}`, totals.casados, { size: 11 });
  setCell(`G${rowIndex}`, totals.solteiros, { size: 11 });
  setCell(`H${rowIndex}`, totals.divorciados, { size: 11 });
  setCell(`I${rowIndex}`, totals.viuvos, { size: 11 });
  setCell(`J${rowIndex}`, totals.idade16a18, { size: 11 });
  setCell(`K${rowIndex}`, totals.idade19a30, { size: 11 });
  setCell(`L${rowIndex}`, totals.idade31a99, { size: 11 });
  sheet.mergeCells(`M${rowIndex}:O${rowIndex}`);
  setCell(`M${rowIndex}`, "", { size: 11 });
  setCell(`P${rowIndex}`, "", { size: 11 });
  rowIndex += 2;

  sheet.mergeCells(`A${rowIndex}:P${rowIndex}`);
  setCell(`A${rowIndex}`, totals.total, { size: 20, color: "FFFF0000" });
  rowIndex += 2;

  sheet.mergeCells(`A${rowIndex}:P${rowIndex + 2}`);
  setCell(
    `A${rowIndex}`,
    "Por favor, a planilha deverá ser preenchida e enviada no 1º dia ÚTIL APÓS O BATISMO para ser apresentada à Diretoria neste mesmo dia.",
    { size: 14, color: "FFFF0000" }
  );

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

function downloadBatismoRecordsCsv(records: BaptismRecord[]) {
  const headers = [
    "Nome completo",
    "CPF",
    "Sexo",
    "Data de nascimento",
    "Estado civil",
    "Reclassificação",
    "Congregação",
    "Cidade da congregação",
    "Dirigente",
    "Telefone do dirigente",
    "Mês do batismo",
    "Ano do batismo",
    "Data de cadastro",
  ];

  const rows = records.map((record) => {
    const data = record.formData;
    return [
      record.fullName,
      record.cpf,
      data.gender || "",
      data.birthDate || "",
      data.maritalStatus || "",
      data.sucursalName || "",
      record.congregation || "",
      data.congregationCity || "",
      data.dirigenteName || "",
      data.dirigentePhone || "",
      record.baptismMonth || "",
      record.baptismYear || "",
      formatDateTime(record.createdAt),
    ];
  });

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  triggerBlobDownload(
    "﻿" + csvContent,
    "text/csv;charset=utf-8;",
    `batismo-cadastros-${new Date().toISOString().split("T")[0]}.csv`
  );
}

function mostCommonValue(values: Array<string | undefined>): string {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    const normalized = collapseWhitespace(value);
    if (!normalized) return;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });

  let best = "";
  let bestCount = 0;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  });

  return best;
}

export default function BatismoPage() {
  const [records, setRecords] = useState<BaptismRecord[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<BaptismRecord[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
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
  const [reportPanelOpen, setReportPanelOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isGeneratingXlsx, setIsGeneratingXlsx] = useState(false);
  const [reportHeader, setReportHeader] = useState<ReportHeaderInfo>({
    estado: "Amazonas",
    uf: "",
    dataBatismo: "",
    endereco: "",
    numero: "",
    bairro: "",
    responsavel: "",
    telefoneResponsavel: "",
    cep: "",
    telefoneIpda: "",
    cidade: "",
  });

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
    let active = true;

    const run = async () => {
      try {
        const pending = await loadPendingSubmissions();
        if (!active) return;
        setPendingSubmissions(pending);
      } catch (error) {
        console.error(error);
        if (active) {
          alert("Não foi possível carregar os cadastros pendentes do link público.");
        }
      } finally {
        if (active) setLoadingPending(false);
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

  async function handleApprovePending(pending: BaptismRecord) {
    if (approvingId || rejectingId) return;
    if (!confirm(`Aprovar o cadastro público de ${pending.fullName} e adicioná-lo à lista de batizados?`)) return;

    setApprovingId(pending.id);
    try {
      // Os arquivos enviados pelo link público permanecem em BAPTISM_PENDING_STORAGE_ROOT;
      // não é necessário copiá-los, o registro aprovado só passa a referenciar o mesmo caminho.
      const approvedRecord = buildRecordFromForm(pending.formData, {
        id: createRecordId(),
        createdAt: pending.createdAt,
      });

      await saveRecordToFirebase(approvedRecord);
      await deleteDoc(doc(db, BAPTISM_PENDING_COLLECTION, pending.id));

      setRecords((prev) => [approvedRecord, ...prev]);
      setPendingSubmissions((prev) => prev.filter((item) => item.id !== pending.id));
    } catch (err) {
      console.error(err);
      alert("Não foi possível aprovar este cadastro. Tente novamente.");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleRejectPending(pending: BaptismRecord) {
    if (approvingId || rejectingId) return;
    if (!confirm(`Rejeitar e excluir o cadastro público de ${pending.fullName}? Essa ação não pode ser desfeita.`)) return;

    setRejectingId(pending.id);
    try {
      await deletePendingSubmission(pending);
      setPendingSubmissions((prev) => prev.filter((item) => item.id !== pending.id));
    } catch (err) {
      console.error(err);
      alert("Não foi possível rejeitar este cadastro. Tente novamente.");
    } finally {
      setRejectingId(null);
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

  function handleDownloadCsv() {
    downloadBatismoRecordsCsv(filteredRecords);
  }

  function openReportPanel() {
    setReportHeader((prev) => ({
      ...prev,
      dataBatismo: prev.dataBatismo || (filters.month && filters.year ? `${filters.month}/${filters.year}` : ""),
      endereco: prev.endereco || mostCommonValue(filteredRecords.map((r) => r.formData.congregationAddress)),
      numero: prev.numero || mostCommonValue(filteredRecords.map((r) => r.formData.congregationNumber)),
      bairro: prev.bairro || mostCommonValue(filteredRecords.map((r) => r.formData.congregationNeighborhood)),
      cidade: prev.cidade || mostCommonValue(filteredRecords.map((r) => r.formData.congregationCity)),
      uf: prev.uf || mostCommonValue(filteredRecords.map((r) => r.formData.congregationState)),
      responsavel: prev.responsavel || mostCommonValue(filteredRecords.map((r) => r.formData.dirigenteName)),
      telefoneResponsavel:
        prev.telefoneResponsavel || mostCommonValue(filteredRecords.map((r) => r.formData.dirigentePhone)),
    }));
    setReportPanelOpen(true);
  }

  async function handleDownloadAggregateReport() {
    setIsGeneratingReport(true);
    try {
      const aggregates = buildPorteAggregates(filteredRecords);
      const bytes = await buildAggregateReportPdfBytes(aggregates, reportHeader);
      triggerBlobDownload(
        bytes,
        "application/pdf",
        `relatorio-batismo-${new Date().toISOString().split("T")[0]}.pdf`
      );
      setReportPanelOpen(false);
    } catch (error) {
      console.error(error);
      alert("Não foi possível gerar o relatório em PDF.");
    } finally {
      setIsGeneratingReport(false);
    }
  }

  async function handleDownloadAggregateXlsx() {
    setIsGeneratingXlsx(true);
    try {
      const aggregates = buildPorteAggregates(filteredRecords);
      const buffer = await buildAggregateReportXlsxBuffer(aggregates, reportHeader);
      triggerBlobDownload(
        buffer,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        `relatorio-batismo-${new Date().toISOString().split("T")[0]}.xlsx`
      );
      setReportPanelOpen(false);
    } catch (error) {
      console.error(error);
      alert("Não foi possível gerar o relatório em Excel.");
    } finally {
      setIsGeneratingXlsx(false);
    }
  }

  // ===========================
  // UI
  // ===========================
  if (!showForm) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader>
            <CardTitle className="text-lg">Link público de cadastro</CardTitle>
            <CardDescription>
              Compartilhe este link com os membros para que eles preencham o cadastro de batismo pelo celular.
              Cada envio fica pendente aqui até você aprovar ou rejeitar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-white px-3 py-2 text-sm text-slate-800 shadow-sm">
              {typeof window !== "undefined" ? `${window.location.origin}/cadastro-batismo` : "/cadastro-batismo"}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/cadastro-batismo`;
                navigator.clipboard?.writeText(url);
                alert("Link copiado!");
              }}
            >
              Copiar link
            </Button>
          </CardContent>
        </Card>

        <Card className={pendingSubmissions.length > 0 ? "border-amber-300 bg-amber-50/50" : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              Cadastros pendentes do link público
              {pendingSubmissions.length > 0 && (
                <Badge className="bg-amber-500 text-white hover:bg-amber-500">{pendingSubmissions.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Cadastros enviados pelos membros pelo link público, aguardando revisão antes de entrar na lista
              oficial de batizados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPending ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Carregando cadastros pendentes...
              </div>
            ) : pendingSubmissions.length === 0 ? (
              <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                Nenhum cadastro pendente no momento.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingSubmissions.map((pending) => (
                  <div
                    key={pending.id}
                    className="flex flex-col gap-3 rounded-lg border bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{pending.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {pending.congregation} · Enviado em {formatDateTime(pending.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={approvingId === pending.id || rejectingId === pending.id}
                        onClick={() => handleRejectPending(pending)}
                        className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      >
                        {rejectingId === pending.id ? (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Rejeitar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={approvingId === pending.id || rejectingId === pending.id}
                        onClick={() => handleApprovePending(pending)}
                      >
                        {approvingId === pending.id ? (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        Aprovar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                    <span className="text-xs font-medium text-slate-700">Exportação:</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={filteredRecords.length === 0}
                      onClick={handleDownloadCsv}
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      Baixar CSV
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={filteredRecords.length === 0}
                      onClick={() => (reportPanelOpen ? setReportPanelOpen(false) : openReportPanel())}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Relatório (PDF/Excel)
                    </Button>
                  </div>

                  {reportPanelOpen && (
                    <div className="mt-3 space-y-3 rounded-lg border border-slate-300 bg-white p-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Relatório de Batismo agrupado por Reclassificação
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Confira os dados abaixo antes de gerar o arquivo. Os {filteredRecords.length} cadastro(s)
                          exibido(s) pelos filtros serão somados por Reclassificação (Local, Setorial, Estadual,
                          Regional, Casa de Oração e Central), no mesmo padrão do relatório oficial de batismo.
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <label className="text-xs font-medium">Estado</label>
                          <input
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                            value={reportHeader.estado}
                            onChange={(e) => setReportHeader((prev) => ({ ...prev, estado: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">UF</label>
                          <input
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                            maxLength={2}
                            value={reportHeader.uf}
                            onChange={(e) =>
                              setReportHeader((prev) => ({ ...prev, uf: formatStateField(e.target.value) }))
                            }
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Data do Batismo</label>
                          <input
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                            placeholder="dd/mm/aaaa"
                            value={reportHeader.dataBatismo}
                            onChange={(e) => setReportHeader((prev) => ({ ...prev, dataBatismo: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Endereço</label>
                          <input
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                            value={reportHeader.endereco}
                            onChange={(e) => setReportHeader((prev) => ({ ...prev, endereco: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Número</label>
                          <input
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                            value={reportHeader.numero}
                            onChange={(e) => setReportHeader((prev) => ({ ...prev, numero: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Bairro</label>
                          <input
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                            value={reportHeader.bairro}
                            onChange={(e) => setReportHeader((prev) => ({ ...prev, bairro: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Cidade</label>
                          <input
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                            value={reportHeader.cidade}
                            onChange={(e) => setReportHeader((prev) => ({ ...prev, cidade: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">CEP</label>
                          <input
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                            value={reportHeader.cep}
                            onChange={(e) => setReportHeader((prev) => ({ ...prev, cep: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Responsável</label>
                          <input
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                            value={reportHeader.responsavel}
                            onChange={(e) => setReportHeader((prev) => ({ ...prev, responsavel: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Telefone do responsável</label>
                          <input
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                            value={reportHeader.telefoneResponsavel}
                            onChange={(e) =>
                              setReportHeader((prev) => ({ ...prev, telefoneResponsavel: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Telefone IPDA</label>
                          <input
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                            value={reportHeader.telefoneIpda}
                            onChange={(e) => setReportHeader((prev) => ({ ...prev, telefoneIpda: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setReportPanelOpen(false)}>
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isGeneratingXlsx}
                          onClick={handleDownloadAggregateXlsx}
                        >
                          {isGeneratingXlsx ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Gerando...
                            </>
                          ) : (
                            <>
                              <FileDown className="mr-2 h-4 w-4" />
                              Gerar e baixar Excel
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isGeneratingReport}
                          onClick={handleDownloadAggregateReport}
                        >
                          {isGeneratingReport ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Gerando...
                            </>
                          ) : (
                            <>
                              <FileText className="mr-2 h-4 w-4" />
                              Gerar e baixar PDF
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
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
              <label className="text-xs font-medium">Sexo</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["Masculino", "Feminino"] as const).map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant={form.gender === v ? "default" : "outline"}
                    onClick={() => updateField("gender", toggleChoice(form.gender, v))}
                  >
                    {v}
                  </Button>
                ))}
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
              <label className="text-xs font-medium">Reclassificação</label>
              <select
                className={getInputClass("sucursalName")}
                value={form.sucursalName}
                onChange={(e) => updateField("sucursalName", e.target.value as BaptismFormData["sucursalName"])}
              >
                <option value="">Selecione...</option>
                {RECLASSIFICATION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
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
