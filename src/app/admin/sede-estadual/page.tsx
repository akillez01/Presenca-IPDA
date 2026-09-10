"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SedeEstadualBirthdays } from "@/components/admin/sede-estadual-birthdays";
import {
  analyzeForm,
  buildRecordFromForm,
  buildSedeEstadualPdfBytes,
  CHURCH_POSITIONS,
  type ChurchPosition,
  collapseWhitespace,
  createEmptyForm,
  deleteRecordFromFirebase,
  fileToCompressedJpegDataUrl,
  getCenteredCropRect,
  type IssueField,
  loadRecordsFromFirebase,
  makeBlobUrl,
  MARITAL_STATUS_OPTIONS,
  type MaritalStatus,
  normalizeFormData,
  normalizeFormForRecord,
  PHOTO_ASPECT_RATIO,
  PHOTO_MAX_HEIGHT,
  PHOTO_MAX_WIDTH,
  removeStorageFile,
  saveRecordToFirebase,
  type SedeEstadualFormData,
  type SedeEstadualRecord,
  stopMediaStream,
  uploadPhotoToStorage,
} from "@/lib/sede-estadual-form";
import {
  ArrowLeft,
  Camera,
  Download,
  Landmark,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

export const dynamic = "force-dynamic";

function csvCell(value?: string) {
  return `"${(value || "").replace(/"/g, '""')}"`;
}

function exportSedeEstadualToCSV(records: SedeEstadualRecord[]) {
  const headers = [
    "Nome",
    "CPF",
    "Função ministerial",
    "Telefone",
    "Cidade",
    "Estado",
    "Pai",
    "Mãe",
    "Estado Civil",
    "Nascimento",
    "RG",
    "Nacionalidade",
    "Batismo",
    "Natural de",
    "Estado Natural",
    "Cadastrado em",
  ];

  const rows = records.map((record) => {
    const d = record.formData;
    return [
      record.fullName,
      record.cpf,
      record.churchPosition,
      d.phone,
      d.city,
      d.state,
      d.fatherName,
      d.motherName,
      d.maritalStatus,
      d.birthDate,
      d.rg,
      d.nationality,
      d.baptismDate,
      d.birthplaceCity,
      d.birthplaceState,
      formatDateTime(record.createdAt),
    ]
      .map(csvCell)
      .join(",");
  });

  const csvContent = [headers.map(csvCell).join(","), ...rows].join("\n");
  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `sede-estadual-${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}
const LIST_PAGE_WIDTH = 841.89; // A4 landscape
const LIST_PAGE_HEIGHT = 595.28;
const LIST_ROWS_PER_PAGE = 20;
const LIST_COLUMNS: { label: string; width: number; get: (r: SedeEstadualRecord) => string }[] = [
  { label: "Nome", width: 190, get: (r) => r.fullName },
  { label: "Função ministerial", width: 100, get: (r) => r.churchPosition },
  { label: "Telefone", width: 110, get: (r) => r.formData.phone },
  { label: "Cidade/UF", width: 140, get: (r) => [r.city, r.formData.state].filter(Boolean).join("/") },
  { label: "CPF", width: 110, get: (r) => r.cpf },
  { label: "Cadastrado em", width: 130, get: (r) => formatDateTime(r.createdAt) },
];

async function buildSedeEstadualListPdfBytes(records: SedeEstadualRecord[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const textColor = rgb(0.05, 0.05, 0.05);
  const lineColor = rgb(0.55, 0.55, 0.55);
  const headerColor = rgb(0.25, 0.25, 0.25);

  const marginX = 30;
  const tableTop = 505;
  const rowHeight = 20;
  const today = new Date().toLocaleDateString("pt-BR");

  const chunks: SedeEstadualRecord[][] = [];
  for (let i = 0; i < records.length; i += LIST_ROWS_PER_PAGE) {
    chunks.push(records.slice(i, i + LIST_ROWS_PER_PAGE));
  }
  if (chunks.length === 0) chunks.push([]);

  chunks.forEach((chunk, pageIndex) => {
    const page = pdfDoc.addPage([LIST_PAGE_WIDTH, LIST_PAGE_HEIGHT]);

    page.drawText("IPDA - Cadastros da Sede Estadual", {
      x: marginX, y: 555, size: 14, font: boldFont, color: textColor,
    });
    page.drawText(`Gerado em ${today} - ${records.length} cadastro(s) - pagina ${pageIndex + 1} de ${chunks.length}`, {
      x: marginX, y: 538, size: 9, font, color: headerColor,
    });
    page.drawLine({ start: { x: marginX, y: 528 }, end: { x: LIST_PAGE_WIDTH - marginX, y: 528 }, thickness: 1, color: lineColor });

    let x = marginX;
    LIST_COLUMNS.forEach((col) => {
      page.drawText(col.label, { x, y: tableTop, size: 9, font: boldFont, color: headerColor });
      x += col.width;
    });
    page.drawLine({ start: { x: marginX, y: tableTop - 6 }, end: { x: LIST_PAGE_WIDTH - marginX, y: tableTop - 6 }, thickness: 0.75, color: lineColor });

    chunk.forEach((record, rowIndex) => {
      const y = tableTop - 6 - (rowIndex + 1) * rowHeight;
      let cellX = marginX;
      LIST_COLUMNS.forEach((col) => {
        let text = col.get(record) || "-";
        while (text.length > 0 && font.widthOfTextAtSize(text, 9) > col.width - 6) {
          text = text.slice(0, -1);
        }
        page.drawText(text, { x: cellX, y, size: 9, font, color: textColor });
        cellX += col.width;
      });
    });

    if (chunk.length === 0) {
      page.drawText("Nenhum cadastro para exibir.", { x: marginX, y: tableTop - 30, size: 10, font, color: headerColor });
    }
  });

  return pdfDoc.save();
}

export default function SedeEstadualPage() {
  const [records, setRecords] = useState<SedeEstadualRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SedeEstadualFormData>(createEmptyForm);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isExportingListPdf, setIsExportingListPdf] = useState(false);

  const normalizedForm = useMemo(() => normalizeFormForRecord(form), [form]);
  const formAnalysis = useMemo(() => analyzeForm(normalizedForm), [normalizedForm]);
  const errorFields = useMemo(() => new Set(formAnalysis.errors.map((i) => i.field)), [formAnalysis.errors]);
  const warningFields = useMemo(
    () => new Set(formAnalysis.warnings.filter((i) => !errorFields.has(i.field)).map((i) => i.field)),
    [errorFields, formAnalysis.warnings]
  );

  const orderedRecords = useMemo(
    () => [...records].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [records]
  );

  const cityOptions = useMemo(() => {
    const values = Array.from(new Set(records.map((r) => collapseWhitespace(r.city)).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [records]);

  const filteredRecords = useMemo(() => {
    const term = collapseWhitespace(search).toLowerCase();

    return orderedRecords.filter((record) => {
      if (term) {
        const haystack = [record.fullName, record.cpf, record.city, record.churchPosition]
          .map((v) => String(v || "").toLowerCase())
          .join(" ");
        if (!haystack.includes(term)) return false;
      }
      if (positionFilter !== "all" && record.churchPosition !== positionFilter) return false;
      if (cityFilter !== "all" && collapseWhitespace(record.city) !== cityFilter) return false;
      return true;
    });
  }, [orderedRecords, search, positionFilter, cityFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = records.filter((r) => {
      const d = new Date(r.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const missingPhoto = records.filter((r) => !r.formData.photoDataUrl).length;
    const cities = new Set(records.map((r) => collapseWhitespace(r.city)).filter(Boolean));

    const byPosition = CHURCH_POSITIONS.map((position) => ({
      position,
      count: records.filter((r) => r.churchPosition === position).length,
    }));

    return { total: records.length, thisMonth, missingPhoto, cityCount: cities.size, byPosition };
  }, [records]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const firebaseRecords = await loadRecordsFromFirebase();
        if (active) setRecords(firebaseRecords);
      } catch (error) {
        console.error(error);
        if (active) alert("Não foi possível carregar os cadastros da Sede Estadual.");
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
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
    if (playPromise) playPromise.catch(() => { });
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

  function resetForm() {
    setForm(createEmptyForm());
    setEditingRecordId(null);
    closeCamera();
  }

  function openNewForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(record: SedeEstadualRecord) {
    setForm(normalizeFormData(record.formData));
    setEditingRecordId(record.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    resetForm();
  }

  async function handleSave() {
    const normalized = normalizeFormForRecord(form);
    setForm(normalized);
    const analysis = analyzeForm(normalized);

    if (analysis.errors.length > 0) {
      const preview = analysis.errors.slice(0, 6).map((issue) => `- ${issue.message}`);
      alert(["Corrija os campos obrigatórios antes de salvar:", ...preview].join("\n"));
      return;
    }

    setIsSaving(true);
    try {
      const existingRecord = editingRecordId ? records.find((r) => r.id === editingRecordId) ?? null : null;
      const record = buildRecordFromForm(normalized, {
        id: editingRecordId ?? undefined,
        createdAt: existingRecord?.createdAt,
      });

      if (record.formData.photoDataUrl.startsWith("data:image/")) {
        const uploaded = await uploadPhotoToStorage(
          record.id,
          record.formData.photoDataUrl,
          existingRecord?.formData.photoStoragePath
        );
        record.formData.photoDataUrl = uploaded.photoDataUrl;
        record.formData.photoStoragePath = uploaded.photoStoragePath;
      }

      await saveRecordToFirebase(record);

      setRecords((prev) => {
        const withoutCurrent = prev.filter((r) => r.id !== record.id);
        return [record, ...withoutCurrent];
      });

      closeForm();
    } catch (error) {
      console.error(error);
      alert("Não foi possível salvar o cadastro. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(record: SedeEstadualRecord) {
    if (!confirm(`Excluir o cadastro de "${record.fullName}"? Essa ação não pode ser desfeita.`)) return;

    try {
      await deleteRecordFromFirebase(record.id);
      await removeStorageFile(record.formData.photoStoragePath);
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
    } catch (error) {
      console.error(error);
      alert("Não foi possível excluir o cadastro.");
    }
  }

  async function handleDownloadPdf(record: SedeEstadualRecord) {
    setDownloadingId(record.id);
    try {
      const bytes = await buildSedeEstadualPdfBytes(record);
      const url = makeBlobUrl(bytes);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error(error);
      alert("Não foi possível gerar o PDF do cadastro.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleExportListPdf() {
    setIsExportingListPdf(true);
    try {
      const bytes = await buildSedeEstadualListPdfBytes(filteredRecords);
      const url = makeBlobUrl(bytes);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error(error);
      alert("Não foi possível gerar o PDF da lista de cadastros.");
    } finally {
      setIsExportingListPdf(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Sede Estadual</h1>
              <p className="text-sm text-muted-foreground">
                Gestão dos cadastros de membros da Sede Estadual
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => exportSedeEstadualToCSV(filteredRecords)}
            disabled={filteredRecords.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleExportListPdf}
            disabled={filteredRecords.length === 0 || isExportingListPdf}
          >
            {isExportingListPdf ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Exportar PDF
          </Button>
          <Button onClick={showForm ? closeForm : openNewForm}>
            {showForm ? (
              <>
                <X className="mr-2 h-4 w-4" /> Fechar formulário
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" /> Novo Cadastro
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="mb-6 border-blue-200 bg-blue-50/40">
        <CardHeader>
          <CardTitle className="text-lg">Link público de cadastro</CardTitle>
          <CardDescription>
            Compartilhe este link com os membros para que eles preencham o próprio cadastro da Sede
            Estadual pelo celular. O link fica aberto até 2026-12-01 (cerca de 90 dias); depois disso
            o cadastro volta a ser só pelo painel.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-white px-3 py-2 text-sm text-slate-800 shadow-sm">
            {typeof window !== "undefined" ? `${window.location.origin}/cadastro-sede-estadual` : "/cadastro-sede-estadual"}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const url = `${window.location.origin}/cadastro-sede-estadual`;
              navigator.clipboard?.writeText(url);
              alert("Link copiado!");
            }}
          >
            Copiar link
          </Button>
        </CardContent>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-lg border bg-blue-50 p-3 text-center sm:p-4">
          <p className="text-xl font-bold text-blue-700 sm:text-2xl">{stats.total}</p>
          <p className="text-xs text-muted-foreground sm:text-sm">Total de cadastros</p>
        </div>
        <div className="rounded-lg border bg-green-50 p-3 text-center sm:p-4">
          <p className="text-xl font-bold text-green-700 sm:text-2xl">{stats.thisMonth}</p>
          <p className="text-xs text-muted-foreground sm:text-sm">Cadastrados este mês</p>
        </div>
        <div className="rounded-lg border bg-amber-50 p-3 text-center sm:p-4">
          <p className="text-xl font-bold text-amber-700 sm:text-2xl">{stats.missingPhoto}</p>
          <p className="text-xs text-muted-foreground sm:text-sm">Sem foto</p>
        </div>
        <div className="rounded-lg border bg-purple-50 p-3 text-center sm:p-4">
          <p className="text-xl font-bold text-purple-700 sm:text-2xl">{stats.cityCount}</p>
          <p className="text-xs text-muted-foreground sm:text-sm">Cidades atendidas</p>
        </div>
      </div>

      <div className="mb-6">
        <SedeEstadualBirthdays records={records} />
      </div>

      <div className="mb-6 rounded-lg border p-3 sm:p-4">
        <p className="mb-3 text-sm font-medium text-muted-foreground">Cadastros por função ministerial</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {stats.byPosition.map(({ position, count }) => (
            <div key={position} className="rounded border bg-slate-50 px-2 py-2 text-center">
              <p className="text-lg font-bold">{count}</p>
              <p className="truncate text-[11px] text-muted-foreground" title={position}>
                {position}
              </p>
            </div>
          ))}
        </div>
      </div>

      {showForm ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editingRecordId ? "Editar cadastro" : "Novo cadastro"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {formAnalysis.warnings.length > 0 ? (
              <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                {formAnalysis.warnings.slice(0, 4).map((issue) => (
                  <p key={`${issue.field}-${issue.message}`}>- {issue.message}</p>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <Input
                    className={getInputClass("rg")}
                    value={form.rg}
                    onChange={(e) => updateField("rg", e.target.value)}
                  />
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
                  <Label>Estado</Label>
                  <Input
                    className={getInputClass("birthplaceState")}
                    maxLength={2}
                    value={form.birthplaceState}
                    onChange={(e) => updateField("birthplaceState", e.target.value.toUpperCase())}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label>Função ministerial</Label>
                  <Select
                    value={form.churchPosition || undefined}
                    onValueChange={(v) => updateField("churchPosition", v as ChurchPosition)}
                  >
                    <SelectTrigger className={getInputClass("churchPosition")}>
                      <SelectValue placeholder="Selecione a função ministerial" />
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Imagem de até 10 MB (redimensionada automaticamente antes do envio).
                </p>
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
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={closeForm} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar cadastro
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Membros cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por nome, CPF, cidade ou função ministerial"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Função ministerial" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as funções ministeriais</SelectItem>
                {CHURCH_POSITIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Cidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as cidades</SelectItem>
                {cityOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando cadastros...</p>
          ) : filteredRecords.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum cadastro encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Foto</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Função ministerial</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cadastrado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {record.formData.photoDataUrl ? (
                          <Image
                            src={record.formData.photoDataUrl}
                            alt={record.fullName}
                            width={32}
                            height={42}
                            unoptimized
                            className="h-[42px] w-8 rounded border object-cover"
                          />
                        ) : (
                          <div className="h-[42px] w-8 rounded border bg-slate-100" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{record.fullName || "-"}</TableCell>
                      <TableCell>
                        {record.churchPosition ? <Badge variant="secondary">{record.churchPosition}</Badge> : "-"}
                      </TableCell>
                      <TableCell>{record.city || "-"}</TableCell>
                      <TableCell>{record.cpf || "-"}</TableCell>
                      <TableCell>{record.formData.phone || "-"}</TableCell>
                      <TableCell>{formatDateTime(record.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownloadPdf(record)}
                            disabled={downloadingId === record.id}
                            title="Baixar PDF"
                          >
                            {downloadingId === record.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditForm(record)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(record)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
