"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { CheckCircle2, Church, FileDown, Loader2, Upload } from "lucide-react";
import Image from "next/image";
import { useState, type ChangeEvent, type FormEvent } from "react";

import {
  analyzeFormForDocument,
  BAPTISM_COLLECTION,
  type BaptismDocumentKey,
  type BaptismFormData,
  buildFilledPdfBytes,
  buildRecordFromForm,
  createEmptyForm,
  createRecordId,
  DOCUMENT_DEFINITIONS,
  fileToCompressedJpegDataUrl,
  formatCepField,
  formatStateField,
  getDocumentChecklist,
  type IssueField,
  inferDocumentMimeType,
  normalizeFormForDocument,
  RECLASSIFICATION_OPTIONS,
  sanitizeFileName,
  stripUndefinedDeep,
  toggleChoice,
  uploadDocumentToStorage,
  uploadPhotoToStorage,
} from "@/lib/batismo-form";

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

export default function CadastroBatismoPublicoPage() {
  const [form, setForm] = useState<BaptismFormData>(createEmptyForm);
  const [pendingDocumentFiles, setPendingDocumentFiles] = useState<Partial<Record<BaptismDocumentKey, File>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string[]>([]);
  const [submittedForm, setSubmittedForm] = useState<BaptismFormData | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  function updateField<K extends keyof BaptismFormData>(field: K, value: BaptismFormData[K]) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "howArrived" && value !== "Outro") {
        next.howArrivedOther = "";
      }
      if (field === "acceptedJesusWhere" && value !== "Outro ministério") {
        next.otherMinistry = "";
      }
      return next;
    });
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

  function handleDocumentFileChange(documentKey: BaptismDocumentKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const accepted = file.type.startsWith("image/") || file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!accepted) {
      alert("Envie um PDF ou imagem para este documento.");
      return;
    }

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
    setPendingDocumentFiles((prev) => ({ ...prev, [documentKey]: file }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const normalized = normalizeFormForDocument(form);
    const analysis = analyzeFormForDocument(normalized);

    if (analysis.errors.length > 0) {
      setSubmitError(analysis.errors.map((issue) => issue.message));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitError([]);
    setSubmitting(true);

    try {
      const recordId = createRecordId();
      let normalizedToPersist: BaptismFormData = { ...normalized };

      if ((normalizedToPersist.photoDataUrl || "").startsWith("data:image/")) {
        const uploadedPhoto = await uploadPhotoToStorage(recordId, normalizedToPersist.photoDataUrl);
        normalizedToPersist = {
          ...normalizedToPersist,
          photoDataUrl: uploadedPhoto.photoDataUrl,
          photoStoragePath: uploadedPhoto.photoStoragePath,
        };
      }

      const nextDocuments = { ...normalizedToPersist.documents };
      for (const [key, file] of Object.entries(pendingDocumentFiles) as Array<[BaptismDocumentKey, File | undefined]>) {
        if (!file) continue;
        const uploaded = await uploadDocumentToStorage(recordId, key, file);
        nextDocuments[key] = {
          key,
          label: DOCUMENT_DEFINITIONS[key].label,
          fileName: file.name,
          mimeType: inferDocumentMimeType(file),
          size: file.size,
          updatedAt: new Date().toISOString(),
          storagePath: uploaded.storagePath,
          downloadUrl: uploaded.downloadUrl,
        };
      }
      normalizedToPersist = { ...normalizedToPersist, documents: nextDocuments };

      const record = buildRecordFromForm(normalizedToPersist, { id: recordId });
      const payload = stripUndefinedDeep(record);

      await setDoc(doc(db, BAPTISM_COLLECTION, recordId), payload);

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
      const bytes = await buildFilledPdfBytes(submittedForm);
      downloadBlob(bytes, "application/pdf", `ficha-batismo-${sanitizeFileName(submittedForm.fullName || "membro")}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Não foi possível gerar o PDF da sua ficha agora. Tente novamente em instantes.");
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  function handleNewSubmission() {
    setForm(createEmptyForm());
    setPendingDocumentFiles({});
    setSubmittedForm(null);
    setSubmitError([]);
  }

  const documentChecklist = getDocumentChecklist(form.maritalStatus, form.birthDate);

  if (submittedForm) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-10">
        <Card className="w-full shadow-sm">
          <CardHeader className="items-center text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-600" />
            <CardTitle className="text-2xl">Cadastro enviado!</CardTitle>
            <CardDescription>
              Obrigado, {submittedForm.fullName}. Seu cadastro de batismo foi enviado e já está registrado.
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
          <Church className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Cadastro de Batismo</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Preencha seus dados para o batismo nas águas. Depois de enviado, seu cadastro já entra
          automaticamente na lista de batizados da secretaria.
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
            <CardTitle className="text-lg">Batismo</CardTitle>
            <CardDescription>Ano e mês em que o batismo vai acontecer.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium">Ano</label>
              <input
                className={getInputClass("baptismYear")}
                inputMode="numeric"
                maxLength={4}
                value={form.baptismYear}
                onChange={(e) => updateField("baptismYear", e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Mês</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["Março", "Setembro"] as const).map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant={form.baptismMonth === v ? "default" : "outline"}
                    onClick={() => updateField("baptismMonth", toggleChoice(form.baptismMonth, v))}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Seus dados</CardTitle>
            <CardDescription>Dados pessoais do novo convertido a ser batizado.</CardDescription>
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
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Data de nascimento</label>
                <input
                  type="date"
                  className={getInputClass("birthDate")}
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
                <input className={getInputClass("cpf")} value={form.cpf} onChange={(e) => updateField("cpf", e.target.value)} />
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
                {(["Solteiro(a)", "Casado(a)", "Viúvo(a)", "Divorciado/Separado e sozinho"] as const).map((v) => (
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

            {form.maritalStatus === "Casado(a)" && (
              <div>
                <label className="text-xs font-medium">Data do casamento</label>
                <input
                  type="date"
                  className={getInputClass("maritalDate")}
                  value={form.maritalDate}
                  onChange={(e) => updateField("maritalDate", e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium">Fotografia 3x4</label>
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
                    id="public-photo-input"
                    className="hidden"
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handlePhotoFileChange}
                  />
                  <label htmlFor="public-photo-input">
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
              <label className="text-xs font-medium">Endereço</label>
              <input className={getInputClass("address")} value={form.address} onChange={(e) => updateField("address", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Número</label>
              <input
                className={getInputClass("addressNumber")}
                value={form.addressNumber}
                onChange={(e) => updateField("addressNumber", e.target.value)}
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
            <div>
              <label className="text-xs font-medium">CEP</label>
              <input
                className={getInputClass("cep")}
                value={form.cep}
                onChange={(e) => updateField("cep", formatCepField(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Sua chegada na IPDA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium">Teve pai/mãe espiritual? Se sim, qual o nome?</label>
              <input
                className={getInputClass("spiritualParentName")}
                placeholder="Deixe em branco se a resposta for Não"
                value={form.spiritualParentName}
                onChange={(e) => updateField("spiritualParentName", e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium">Como chegou até a IPDA?</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["Família", "Amigo(a)", "Visita no lar", "Folheto", "Rádio", "Outro"] as const).map((v) => (
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
              {form.howArrived === "Outro" && (
                <input
                  className={`${getInputClass("howArrivedOther")} mt-2`}
                  placeholder="Descreva como chegou"
                  value={form.howArrivedOther}
                  onChange={(e) => updateField("howArrivedOther", e.target.value)}
                />
              )}
            </div>

            <div>
              <label className="text-xs font-medium">Qual a situação de chegada na IPDA?</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["Aceitou", "Reconciliou", "Uniu"] as const).map((v) => (
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
              <label className="text-xs font-medium">Aonde aceitou a Jesus?</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={(form.acceptedJesusWhere || "").toLowerCase().includes("ipda") ? "default" : "outline"}
                  onClick={() =>
                    updateField(
                      "acceptedJesusWhere",
                      (form.acceptedJesusWhere || "").toLowerCase().includes("ipda") ? "" : "IPDA"
                    )
                  }
                >
                  IPDA
                </Button>
                <Button
                  type="button"
                  variant={
                    (form.acceptedJesusWhere || "").toLowerCase().includes("outro") ? "default" : "outline"
                  }
                  onClick={() =>
                    updateField(
                      "acceptedJesusWhere",
                      (form.acceptedJesusWhere || "").toLowerCase().includes("outro") ? "" : "Outro ministério"
                    )
                  }
                >
                  Outro ministério
                </Button>
              </div>
              {form.acceptedJesusWhere === "Outro ministério" && (
                <input
                  className={`${getInputClass("otherMinistry")} mt-2`}
                  placeholder="Qual ministério?"
                  value={form.otherMinistry}
                  onChange={(e) => updateField("otherMinistry", e.target.value)}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Congregação que você frequenta</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium">Endereço da congregação</label>
              <input
                className={getInputClass("congregationAddress")}
                value={form.congregationAddress}
                onChange={(e) => updateField("congregationAddress", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Número</label>
              <input
                className={getInputClass("congregationNumber")}
                value={form.congregationNumber}
                onChange={(e) => updateField("congregationNumber", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Bairro</label>
              <input
                className={getInputClass("congregationNeighborhood")}
                value={form.congregationNeighborhood}
                onChange={(e) => updateField("congregationNeighborhood", e.target.value)}
              />
            </div>
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
            <div>
              <label className="text-xs font-medium">Dirigente</label>
              <input
                className={getInputClass("dirigenteName")}
                value={form.dirigenteName}
                onChange={(e) => updateField("dirigenteName", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Telefone do dirigente</label>
              <input
                className={getInputClass("dirigentePhone")}
                inputMode="tel"
                placeholder="(DDD) 99999-9999"
                value={form.dirigentePhone}
                onChange={(e) => updateField("dirigentePhone", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
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
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Documentos</CardTitle>
            <CardDescription>
              Anexe os documentos abaixo. Os marcados como obrigatórios mudam conforme o estado civil.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {documentChecklist.map((item) => {
              const meta = form.documents[item.key];
              return (
                <div key={item.key} className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{item.label}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            item.required ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.required ? "Obrigatório" : "Opcional"}
                        </span>
                        {meta && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            Arquivo pronto
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{item.description}</p>
                      {meta && <p className="mt-1 text-xs text-slate-500">{meta.fileName}</p>}
                    </div>
                    <div>
                      <input
                        id={`public-doc-${item.key}`}
                        className="hidden"
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(event) => handleDocumentFileChange(item.key, event)}
                      />
                      <label htmlFor={`public-doc-${item.key}`}>
                        <Button type="button" size="sm" variant="outline" asChild>
                          <span>
                            <Upload className="mr-2 h-4 w-4" />
                            {meta ? "Trocar" : "Enviar"}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Button type="submit" disabled={submitting} className="w-full" size="lg">
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando cadastro...
            </>
          ) : (
            "Enviar cadastro de batismo"
          )}
        </Button>
      </form>
    </div>
  );
}
