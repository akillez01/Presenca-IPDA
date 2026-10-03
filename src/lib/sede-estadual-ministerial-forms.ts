import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { db, storage } from "@/lib/firebase";
import layoutsJson from "./ministerial-form-layouts.json";

export type MinisterialFormKind = "worker" | "transfer";

export type MinisterialTextFieldLayout = {
  key: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

export type MinisterialCheckboxLayout = {
  key: string;
  page: number;
  x: number;
  y: number;
  s: number;
  label: string;
};

type MinisterialFormLayout = {
  textFields: MinisterialTextFieldLayout[];
  checkboxes: MinisterialCheckboxLayout[];
};

export type MinisterialAttachment = {
  id: string;
  label: string;
  fileName: string;
  contentType: string;
  size: number;
  storagePath: string;
  downloadUrl: string;
  updatedAt: string;
};

export type MinisterialFormRecord = {
  id: string;
  kind: MinisterialFormKind;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  values: Record<string, string>;
  checked: string[];
  attachments: MinisterialAttachment[];
};

const FORM_LAYOUTS = layoutsJson as Record<MinisterialFormKind, MinisterialFormLayout>;

export const MINISTERIAL_FORM_DEFINITIONS: Record<
  MinisterialFormKind,
  {
    title: string;
    description: string;
    collection: string;
    basePdfPath: string;
    filePrefix: string;
    pageTitles: string[];
    attachmentLabels: string[];
  }
> = {
  worker: {
    title: "Ficha de cadastro de obreiro",
    description: "Cadastro ministerial, termos e documentos anexos do obreiro.",
    collection: "sede_estadual_worker_forms",
    basePdfPath: "/doc/Ficha%20de%20cadastro%20de%20obreiro%20e%20anexos.pdf",
    filePrefix: "cadastro-obreiro",
    pageTitles: [
      "Dados pessoais e ministeriais",
      "Continuação dos dados ministeriais",
      "Termo de adesão ministerial",
      "Continuação do termo de adesão",
      "Compromisso de cunho religioso e espiritual",
      "Continuação do compromisso e assinaturas",
    ],
    attachmentLabels: [
      "Foto 3x4",
      "RG e CPF",
      "Comprovante de residência",
      "Certidão de nascimento, casamento ou óbito",
      "Atestado de antecedentes criminais",
      "Outros documentos",
    ],
  },
  transfer: {
    title: "Ficha de remanejamento de obreiro",
    description: "Solicitação de remanejamento, dados dos responsáveis e da congregação.",
    collection: "sede_estadual_transfer_forms",
    basePdfPath: "/doc/Ficha%20de%20remanejamento%20de%20obreiro.pdf",
    filePrefix: "remanejamento-obreiro",
    pageTitles: ["Solicitação e dados da congregação"],
    attachmentLabels: [],
  },
};

export const MAX_MINISTERIAL_ATTACHMENT_SIZE = 20 * 1024 * 1024;

export function getMinisterialFormLayout(kind: MinisterialFormKind) {
  return FORM_LAYOUTS[kind];
}

export function createMinisterialFormId() {
  return crypto.randomUUID();
}

export function createEmptyMinisterialRecord(
  kind: MinisterialFormKind,
  id: string = createMinisterialFormId(),
  createdAt: string = new Date().toISOString()
): MinisterialFormRecord {
  return {
    id,
    kind,
    displayName: "",
    createdAt,
    updatedAt: createdAt,
    values: {},
    checked: [],
    attachments: [],
  };
}

function mapMinisterialFormRecord(
  kind: MinisterialFormKind,
  id: string,
  value: Record<string, unknown>
): MinisterialFormRecord {
  const rawValues =
    value.values && typeof value.values === "object"
      ? (value.values as Record<string, unknown>)
      : {};
  const rawAttachments = Array.isArray(value.attachments) ? value.attachments : [];

  return {
    id,
    kind,
    displayName: typeof value.displayName === "string" ? value.displayName : "",
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
    values: Object.fromEntries(
      Object.entries(rawValues).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    ),
    checked: Array.isArray(value.checked)
      ? value.checked.filter((entry): entry is string => typeof entry === "string")
      : [],
    attachments: rawAttachments.filter(
      (entry): entry is MinisterialAttachment =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as MinisterialAttachment).id === "string" &&
        typeof (entry as MinisterialAttachment).storagePath === "string" &&
        typeof (entry as MinisterialAttachment).downloadUrl === "string"
    ),
  };
}

export async function loadMinisterialFormRecords(kind: MinisterialFormKind) {
  const collectionName = MINISTERIAL_FORM_DEFINITIONS[kind].collection;
  const snapshot = await getDocs(query(collection(db, collectionName), orderBy("createdAt", "desc")));
  return snapshot.docs.map((item) =>
    mapMinisterialFormRecord(kind, item.id, item.data() as Record<string, unknown>)
  );
}

export async function saveMinisterialFormRecord(record: MinisterialFormRecord) {
  const collectionName = MINISTERIAL_FORM_DEFINITIONS[record.kind].collection;
  await setDoc(doc(db, collectionName, record.id), {
    ...record,
    updatedAt: new Date().toISOString(),
  });
}

export async function uploadMinisterialAttachment(
  recordId: string,
  file: File,
  label: string
): Promise<MinisterialAttachment> {
  if (file.size > MAX_MINISTERIAL_ATTACHMENT_SIZE) {
    throw new Error("Cada documento anexado deve ter no máximo 20 MB.");
  }

  const contentType = file.type || "application/octet-stream";
  if (
    !contentType.startsWith("image/") &&
    contentType !== "application/pdf"
  ) {
    throw new Error("Anexe somente imagens ou arquivos PDF.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "documento";
  const id = crypto.randomUUID();
  const storagePath = `sede-estadual-form-files/${recordId}/${id}-${safeName}`;
  const fileRef = ref(storage, storagePath);

  await uploadBytes(fileRef, file, {
    contentType,
    customMetadata: {
      recordId,
      category: "sede-estadual-ministerial-form",
      uploadedAt: new Date().toISOString(),
    },
  });

  return {
    id,
    label,
    fileName: file.name,
    contentType,
    size: file.size,
    storagePath,
    downloadUrl: await getDownloadURL(fileRef),
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteMinisterialAttachment(attachment: MinisterialAttachment) {
  await deleteObject(ref(storage, attachment.storagePath));
}

export async function deleteMinisterialFormRecord(record: MinisterialFormRecord) {
  const collectionName = MINISTERIAL_FORM_DEFINITIONS[record.kind].collection;
  await deleteDoc(doc(db, collectionName, record.id));
  const results = await Promise.allSettled(record.attachments.map(deleteMinisterialAttachment));
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Não foi possível remover um anexo do cadastro.", result.reason);
    }
  });
}

export async function buildMinisterialFormPdfBytes(record: MinisterialFormRecord) {
  const definition = MINISTERIAL_FORM_DEFINITIONS[record.kind];
  const response = await fetch(definition.basePdfPath, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Não foi possível carregar o formulário original (${response.status}).`);
  }

  const pdf = await PDFDocument.load(await response.arrayBuffer());
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const layout = getMinisterialFormLayout(record.kind);

  for (const field of layout.textFields) {
    const value = (record.values[field.key] || "").trim();
    if (!value) continue;
    const page = pdf.getPage(field.page - 1);
    const size = Math.min(8, Math.max(6, field.h * 0.82));
    let fitted = value;
    while (fitted.length > 0 && font.widthOfTextAtSize(fitted, size) > field.w - 2 && size > 5) {
      fitted = fitted.slice(0, -1);
    }
    if (fitted !== value) {
      while (fitted.length > 0 && font.widthOfTextAtSize(`${fitted}…`, size) > field.w - 2) {
        fitted = fitted.slice(0, -1);
      }
      fitted = fitted ? `${fitted}…` : "";
    }
    if (fitted) {
      page.drawText(fitted, {
        x: field.x + 1,
        y: field.y + Math.max(0, (field.h - size) / 2),
        size,
        font,
        color: rgb(0.05, 0.05, 0.05),
      });
    }
  }

  for (const checkbox of layout.checkboxes) {
    if (!record.checked.includes(checkbox.key)) continue;
    pdf.getPage(checkbox.page - 1).drawText("X", {
      x: checkbox.x + 1.2,
      y: checkbox.y + 1,
      size: 7,
      font,
      color: rgb(0.05, 0.05, 0.05),
    });
  }

  return pdf.save();
}

export function sanitizeMinisterialFileName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "cadastro"
  );
}
