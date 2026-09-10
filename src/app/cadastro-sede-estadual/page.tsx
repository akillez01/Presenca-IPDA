"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  analyzeForm,
  buildRecordFromForm,
  buildSedeEstadualPdfBytes,
  CHURCH_POSITIONS,
  createEmptyForm,
  createRecordId,
  formatCpfField,
  formatPhoneField,
  formatStateField,
  type IssueField,
  MARITAL_STATUS_OPTIONS,
  normalizeFormForRecord,
  saveRecordToFirebase,
  type SedeEstadualFormData,
  uploadPhotoToStorage,
  fileToCompressedJpegDataUrl,
} from "@/lib/sede-estadual-form";
import { CheckCircle2, FileDown, Landmark, Loader2, Upload } from "lucide-react";
import Image from "next/image";
import { useState, type ChangeEvent, type FormEvent } from "react";

export const dynamic = "force-dynamic";

function downloadBlob(bytes: Uint8Array, mimeType: string, fileName: string) {
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

function sanitizeFileName(value: string) {
  return (value || "membro")
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CadastroSedeEstadualPublicoPage() {
  const [form, setForm] = useState<SedeEstadualFormData>(createEmptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string[]>([]);
  const [submittedForm, setSubmittedForm] = useState<SedeEstadualFormData | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  function updateField<K extends keyof SedeEstadualFormData>(field: K, value: SedeEstadualFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const errorFields = new Set<IssueField>();
  function getInputClass(field: IssueField) {
    const base = "mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900";
    return errorFields.has(field) ? `${base} border-red-400 bg-red-50` : base;
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
    } catch (err) {
      console.error(err);
      alert("Não foi possível processar a foto. Tente outra imagem.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const normalized = normalizeFormForRecord(form);
    setForm(normalized);
    const analysis = analyzeForm(normalized);

    if (analysis.errors.length > 0) {
      setSubmitError(analysis.errors.map((issue) => issue.message));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitError([]);
    setSubmitting(true);

    try {
      const recordId = createRecordId();
      let normalizedToPersist: SedeEstadualFormData = { ...normalized };

      if ((normalizedToPersist.photoDataUrl || "").startsWith("data:image/")) {
        const uploadedPhoto = await uploadPhotoToStorage(recordId, normalizedToPersist.photoDataUrl);
        normalizedToPersist = {
          ...normalizedToPersist,
          photoDataUrl: uploadedPhoto.photoDataUrl,
          photoStoragePath: uploadedPhoto.photoStoragePath,
        };
      }

      const record = buildRecordFromForm(normalizedToPersist, { id: recordId });
      await saveRecordToFirebase(record);

      setSubmittedForm(normalizedToPersist);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setSubmitError(["Não foi possível enviar seu cadastro. Verifique sua conexão e tente novamente."]);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadOwnPdf() {
    if (!submittedForm) return;
    setIsDownloadingPdf(true);
    try {
      const record = buildRecordFromForm(submittedForm, { id: createRecordId() });
      const bytes = await buildSedeEstadualPdfBytes(record);
      downloadBlob(bytes, "application/pdf", `ficha-sede-estadual-${sanitizeFileName(submittedForm.fullName)}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Não foi possível gerar o PDF da sua ficha agora. Tente novamente em instantes.");
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  function handleNewSubmission() {
    setForm(createEmptyForm());
    setSubmittedForm(null);
    setSubmitError([]);
  }

  if (submittedForm) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-10">
        <Card className="w-full shadow-sm">
          <CardHeader className="items-center text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-600" />
            <CardTitle className="text-2xl">Cadastro enviado!</CardTitle>
            <CardDescription>
              Obrigado, {submittedForm.fullName}. Seu cadastro na Sede Estadual foi enviado e já está registrado.
              Você pode baixar uma cópia da sua ficha preenchida abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <Button onClick={handleDownloadOwnPdf} disabled={isDownloadingPdf} className="w-full sm:w-auto">
              {isDownloadingPdf ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando PDF...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Baixar minha ficha em PDF
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleNewSubmission} className="w-full sm:w-auto">
              Enviar outro cadastro
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-600">
          <Landmark className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Cadastro Sede Estadual</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Preencha seus dados para o cadastro de membro da Sede Estadual. Depois de enviado, seu
          cadastro já entra automaticamente na lista da secretaria.
        </p>
      </div>

      {submitError.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <p className="mb-1 font-medium">Corrija os campos abaixo antes de enviar:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {submitError.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Seus dados</CardTitle>
            <CardDescription>Dados pessoais do membro a ser cadastrado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">Nome completo</label>
                <input
                  className={getInputClass("fullName")}
                  value={form.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Telefone</label>
                <input
                  className={getInputClass("phone")}
                  inputMode="tel"
                  placeholder="(DDD) 99999-9999"
                  value={form.phone}
                  onChange={(e) => updateField("phone", formatPhoneField(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Data de nascimento</label>
                <input
                  className={getInputClass("birthDate")}
                  placeholder="DD/MM/AAAA"
                  value={form.birthDate}
                  onChange={(e) => updateField("birthDate", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium">RG</label>
                <input className={getInputClass("rg")} value={form.rg} onChange={(e) => updateField("rg", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium">CPF</label>
                <input
                  className={getInputClass("cpf")}
                  value={form.cpf}
                  onChange={(e) => updateField("cpf", formatCpfField(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Nacionalidade</label>
                <input
                  className={getInputClass("nationality")}
                  value={form.nationality}
                  onChange={(e) => updateField("nationality", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Estado civil</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {MARITAL_STATUS_OPTIONS.map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant={form.maritalStatus === v ? "default" : "outline"}
                    onClick={() => updateField("maritalStatus", form.maritalStatus === v ? "" : v)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">Nome do pai</label>
                <input
                  className={getInputClass("fatherName")}
                  value={form.fatherName}
                  onChange={(e) => updateField("fatherName", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Nome da mãe</label>
                <input
                  className={getInputClass("motherName")}
                  value={form.motherName}
                  onChange={(e) => updateField("motherName", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Fotografia 3x4</label>
              <p className="mt-1 text-xs text-muted-foreground">
                Envie uma imagem de até 10 MB. A foto é redimensionada automaticamente antes do envio.
              </p>
              <div className="mt-2 flex items-center gap-4">
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
                  <div className="flex h-32 w-24 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                    Sem foto
                  </div>
                )}
                <div>
                  <input
                    id="public-sede-photo-input"
                    className="hidden"
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handlePhotoFileChange}
                  />
                  <label htmlFor="public-sede-photo-input">
                    <Button type="button" variant="outline" asChild>
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        {form.photoDataUrl ? "Trocar foto" : "Tirar/enviar foto"}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Endereço residencial</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium">Rua</label>
              <input className={getInputClass("street")} value={form.street} onChange={(e) => updateField("street", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Número</label>
              <input
                className={getInputClass("streetNumber")}
                value={form.streetNumber}
                onChange={(e) => updateField("streetNumber", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Bairro</label>
              <input
                className={getInputClass("neighborhood")}
                value={form.neighborhood}
                onChange={(e) => updateField("neighborhood", e.target.value)}
              />
            </div>
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
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Naturalidade e vida na igreja</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium">Cidade natal</label>
              <input
                className={getInputClass("birthplaceCity")}
                value={form.birthplaceCity}
                onChange={(e) => updateField("birthplaceCity", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Estado natal (UF)</label>
              <input
                className={getInputClass("birthplaceState")}
                maxLength={2}
                value={form.birthplaceState}
                onChange={(e) => updateField("birthplaceState", formatStateField(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Data do batismo</label>
              <input
                className={getInputClass("baptismDate")}
                placeholder="DD/MM/AAAA"
                value={form.baptismDate}
                onChange={(e) => updateField("baptismDate", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Função ministerial</label>
              <select
                className={getInputClass("churchPosition")}
                value={form.churchPosition}
                onChange={(e) => updateField("churchPosition", e.target.value as SedeEstadualFormData["churchPosition"])}
              >
                <option value="">Selecione...</option>
                {CHURCH_POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={submitting} className="w-full" size="lg">
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando cadastro...
            </>
          ) : (
            "Enviar cadastro"
          )}
        </Button>
      </form>
    </div>
  );
}
