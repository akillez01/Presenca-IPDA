"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  buildMinisterialFormPdfBytes,
  createEmptyMinisterialRecord,
  deleteMinisterialAttachment,
  deleteMinisterialFormRecord,
  getMinisterialFormLayout,
  loadMinisterialFormRecords,
  MAX_MINISTERIAL_ATTACHMENT_SIZE,
  MINISTERIAL_FORM_DEFINITIONS,
  saveMinisterialFormRecord,
  sanitizeMinisterialFileName,
  uploadMinisterialAttachment,
  type MinisterialAttachment,
  type MinisterialFormKind,
  type MinisterialFormRecord,
  type MinisterialTextFieldLayout,
} from "@/lib/sede-estadual-ministerial-forms";
import { ArrowLeft, FileDown, FileText, Pencil, Plus, Printer, RefreshCw, Search, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

type Props = { kind: MinisterialFormKind };
type PendingAttachment = { id: string; label: string; file: File };

const WORKER_PAGE_TITLES = MINISTERIAL_FORM_DEFINITIONS.worker.pageTitles;

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR");
}

function getFieldLabel(field: MinisterialTextFieldLayout, index: number) {
  if (field.label.startsWith("Campo adicional")) {
    return `Campo complementar ${index + 1}`;
  }
  if (field.label === "X" || field.label === "1)" || field.label === "2)") {
    return `Informação complementar ${index + 1}`;
  }
  return field.label.replace(/\bN\s*0\b/g, "Número").replace(/^\)\s*/, "") || `Campo complementar ${index + 1}`;
}

function isImageAttachment(attachment: MinisterialAttachment) {
  return attachment.contentType.startsWith("image/");
}

export function SedeEstadualMinisterialFormManager({ kind }: Props) {
  const definition = MINISTERIAL_FORM_DEFINITIONS[kind];
  const layout = getMinisterialFormLayout(kind);
  const [records, setRecords] = useState<MinisterialFormRecord[]>([]);
  const [form, setForm] = useState<MinisterialFormRecord | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      setRecords(await loadMinisterialFormRecords(kind));
    } catch (error) {
      console.error("Não foi possível carregar os cadastros ministeriais.", error);
      alert("Não foi possível carregar os cadastros. Verifique sua conexão e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return records;
    return records.filter((record) => record.displayName.toLocaleLowerCase("pt-BR").includes(term));
  }, [records, search]);

  function startNewRecord() {
    setForm(createEmptyMinisterialRecord(kind));
    setPendingAttachments([]);
    setRemovedAttachmentIds([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEditing(record: MinisterialFormRecord) {
    setForm({
      ...record,
      values: { ...record.values },
      checked: [...record.checked],
      attachments: [...record.attachments],
    });
    setPendingAttachments([]);
    setRemovedAttachmentIds([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setForm(null);
    setPendingAttachments([]);
    setRemovedAttachmentIds([]);
  }

  function updateValue(key: string, value: string) {
    setForm((current) => current && { ...current, values: { ...current.values, [key]: value } });
  }

  function toggleCheckbox(key: string, checked: boolean) {
    setForm((current) => {
      if (!current) return current;
      const next = new Set(current.checked);
      if (checked) next.add(key);
      else next.delete(key);
      return { ...current, checked: Array.from(next) };
    });
  }

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>, label: string) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const invalid = files.find(
      (file) =>
        file.size > MAX_MINISTERIAL_ATTACHMENT_SIZE ||
        (!file.type.startsWith("image/") && file.type !== "application/pdf")
    );
    if (invalid) {
      alert("Anexe somente imagens ou arquivos PDF de até 20 MB.");
      return;
    }
    if (!files.length) return;
    setPendingAttachments((current) => [
      ...current.filter((item) => item.label !== label),
      ...files.map((file) => ({ id: crypto.randomUUID(), label, file })),
    ]);
    setRemovedAttachmentIds((current) => [
      ...current,
      ...(form?.attachments.filter((item) => item.label === label).map((item) => item.id) ?? []),
    ]);
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((current) => current.filter((item) => item.id !== id));
  }

  function removeSavedAttachment(id: string) {
    setRemovedAttachmentIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  async function handleSave() {
    if (!form) return;
    const displayName = form.displayName.trim();
    if (!displayName) {
      alert("Informe o nome do obreiro ou da congregação antes de salvar.");
      return;
    }

    setIsSaving(true);
    const uploadedAttachments: MinisterialAttachment[] = [];
    try {
      const removedIds = new Set(removedAttachmentIds);
      const replacedLabels = new Set(pendingAttachments.map((item) => item.label));
      const retainedAttachments = form.attachments.filter(
        (item) => !removedIds.has(item.id) && !replacedLabels.has(item.label)
      );

      for (const item of pendingAttachments) {
        uploadedAttachments.push(await uploadMinisterialAttachment(form.id, item.file, item.label));
      }

      const record: MinisterialFormRecord = {
        ...form,
        displayName,
        updatedAt: new Date().toISOString(),
        attachments: [...retainedAttachments, ...uploadedAttachments],
      };
      await saveMinisterialFormRecord(record);

      const removed = form.attachments.filter(
        (item) => removedIds.has(item.id) || replacedLabels.has(item.label)
      );
      const cleanup = await Promise.allSettled(removed.map(deleteMinisterialAttachment));
      cleanup.forEach((result) => {
        if (result.status === "rejected") {
          console.error("O cadastro foi salvo, mas não foi possível remover um anexo substituído.", result.reason);
        }
      });

      setRecords((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      closeForm();
    } catch (error) {
      console.error("Não foi possível salvar a ficha ministerial.", error);
      await Promise.allSettled(uploadedAttachments.map(deleteMinisterialAttachment));
      alert("Não foi possível salvar o cadastro ou seus anexos. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(record: MinisterialFormRecord) {
    if (!confirm(`Excluir o cadastro de "${record.displayName}"? Essa ação não pode ser desfeita.`)) return;
    setBusyRecordId(record.id);
    try {
      await deleteMinisterialFormRecord(record);
      setRecords((current) => current.filter((item) => item.id !== record.id));
    } catch (error) {
      console.error("Não foi possível excluir a ficha ministerial.", error);
      alert("Não foi possível excluir o cadastro. Tente novamente.");
    } finally {
      setBusyRecordId(null);
    }
  }

  async function handlePdf(record: MinisterialFormRecord, print: boolean) {
    setBusyRecordId(record.id);
    const printWindow = print ? window.open("about:blank", "_blank") : null;
    try {
      const bytes = await buildMinisterialFormPdfBytes(record);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (print && printWindow) {
        printWindow.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else if (print) {
        URL.revokeObjectURL(url);
        alert("O navegador bloqueou a nova janela. Permita pop-ups para abrir a ficha para impressão.");
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${definition.filePrefix}-${sanitizeMinisterialFileName(record.displayName)}.pdf`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    } catch (error) {
      printWindow?.close();
      console.error("Não foi possível gerar o PDF da ficha ministerial.", error);
      alert("Não foi possível gerar a ficha em PDF. Tente novamente.");
    } finally {
      setBusyRecordId(null);
    }
  }

  const pageNumbers = Array.from(
    new Set(layout.textFields.map((field) => field.page).concat(layout.checkboxes.map((field) => field.page)))
  ).sort((a, b) => a - b);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/sede-estadual" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{definition.title}</h1>
              <p className="text-sm text-muted-foreground">{definition.description}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadRecords()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={startNewRecord} disabled={!!form}>
            <Plus className="mr-2 h-4 w-4" /> Novo cadastro
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Fichas cadastradas</p>
            <p className="mt-1 text-2xl font-semibold">{records.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Cadastradas este mês</p>
            <p className="mt-1 text-2xl font-semibold">
              {records.filter((record) => {
                const created = new Date(record.createdAt);
                const now = new Date();
                return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
              }).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Documentos anexados</p>
            <p className="mt-1 text-2xl font-semibold">
              {records.reduce((total, record) => total + record.attachments.length, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {form && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{records.some((record) => record.id === form.id) ? "Editar cadastro" : "Novo cadastro"}</CardTitle>
                <CardDescription className="mt-1">
                  Preencha a ficha no sistema. Ao salvar, os dados ficam registrados e podem ser impressos em PDF.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={closeForm} aria-label="Fechar formulário">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="max-w-2xl">
              <Label htmlFor="ministerial-display-name">Nome do obreiro ou da congregação *</Label>
              <Input
                id="ministerial-display-name"
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                maxLength={180}
                placeholder="Nome para identificar esta ficha na lista"
              />
            </div>

            {pageNumbers.map((pageNumber) => {
              const pageFields = layout.textFields.filter((field) => field.page === pageNumber);
              const pageCheckboxes = layout.checkboxes.filter((field) => field.page === pageNumber);
              const title =
                kind === "worker"
                  ? WORKER_PAGE_TITLES[pageNumber - 1] || `Página ${pageNumber}`
                  : definition.pageTitles[pageNumber - 1] || `Página ${pageNumber}`;
              return (
                <details key={pageNumber} open={pageNumber === 1} className="rounded-lg border">
                  <summary className="cursor-pointer px-4 py-3 font-medium">
                    {pageNumber}. {title}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {pageFields.length} campo(s)
                    </span>
                  </summary>
                  <div className="border-t p-4">
                    {pageFields.length > 0 && (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {pageFields.map((field, index) => {
                          const label = getFieldLabel(field, index);
                          return (
                            <div key={field.key}>
                              <Label htmlFor={`${kind}-${field.key}`} className="text-xs">
                                {label}
                              </Label>
                              <Input
                                id={`${kind}-${field.key}`}
                                value={form.values[field.key] || ""}
                                onChange={(event) => updateValue(field.key, event.target.value)}
                                aria-label={`${title}: ${label}`}
                                maxLength={240}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {pageCheckboxes.length > 0 && (
                      <div className="mt-5 border-t pt-4">
                        <p className="mb-3 text-sm font-medium">Opções e declarações</p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {pageCheckboxes.map((checkbox) => (
                            <label key={checkbox.key} className="flex items-start gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={form.checked.includes(checkbox.key)}
                                onChange={(event) => toggleCheckbox(checkbox.key, event.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-slate-300"
                              />
                              <span>{checkbox.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}

            {definition.attachmentLabels.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Documentos anexos</CardTitle>
                  <CardDescription>Arquivos PDF ou imagens de até 20 MB cada.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {definition.attachmentLabels.map((label) => {
                    const saved = form.attachments.filter(
                      (attachment) =>
                        attachment.label === label && !removedAttachmentIds.includes(attachment.id)
                    );
                    const pending = pendingAttachments.filter((attachment) => attachment.label === label);
                    return (
                      <div key={label} className="rounded-lg border p-3">
                        <Label htmlFor={`attachment-${sanitizeMinisterialFileName(label)}`}>{label}</Label>
                        <Input
                          id={`attachment-${sanitizeMinisterialFileName(label)}`}
                          type="file"
                          accept="application/pdf,image/*"
                          multiple={label === "Outros documentos"}
                          className="mt-2"
                          onChange={(event) => handleAttachmentChange(event, label)}
                        />
                        <div className="mt-2 space-y-1">
                          {saved.map((attachment) => (
                            <div key={attachment.id} className="flex flex-wrap items-center gap-2 text-sm">
                              <a
                                href={attachment.downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate text-primary underline"
                              >
                                {attachment.fileName}
                              </a>
                              {isImageAttachment(attachment) && <Badge variant="outline">Imagem</Badge>}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removeSavedAttachment(attachment.id)}
                              >
                                <X className="mr-1 h-3 w-3" /> Remover
                              </Button>
                            </div>
                          ))}
                          {pending.map((attachment) => (
                            <div key={attachment.id} className="flex items-center gap-2 text-sm">
                              <span className="truncate">{attachment.file.name} (novo)</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removePendingAttachment(attachment.id)}
                              >
                                <X className="mr-1 h-3 w-3" /> Remover
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={closeForm} disabled={isSaving}>
                Cancelar
              </Button>
              <Button onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {isSaving ? "Salvando..." : "Salvar cadastro"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Fichas cadastradas</CardTitle>
          <CardDescription>Pesquise, edite, exclua ou gere a ficha preenchida para imprimir.</CardDescription>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar por nome"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" /> Carregando cadastros...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              {records.length ? "Nenhum cadastro corresponde à pesquisa." : "Ainda não há fichas cadastradas."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Data do cadastro</TableHead>
                    {kind === "worker" && <TableHead>Anexos</TableHead>}
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.displayName}</TableCell>
                      <TableCell>{formatDateTime(record.createdAt)}</TableCell>
                      {kind === "worker" && <TableCell>{record.attachments.length}</TableCell>}
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handlePdf(record, true)}
                            disabled={busyRecordId === record.id}
                            title="Abrir para imprimir"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handlePdf(record, false)}
                            disabled={busyRecordId === record.id}
                            title="Baixar PDF"
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => startEditing(record)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void handleDelete(record)}
                            disabled={busyRecordId === record.id}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
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
