// Migra membros únicos da coleção "attendance" para a coleção "members".
// Usa CPF como chave do documento (id = cpf). Não apaga nada da coleção de presença.
// Marca needsReview=true quando encontra mais de um nome para o mesmo CPF.

import admin from "firebase-admin";
import { readFileSync } from "fs";

const SERVICE_ACCOUNT_PATH = "./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json";

function ensureServiceAccount(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function toDate(value) {
  if (!value) return null;
  try {
    if (typeof value.toDate === "function") return value.toDate();
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

async function main() {
  const sa = ensureServiceAccount(SERVICE_ACCOUNT_PATH);
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();

  console.log("🔍 Lendo collection attendance...");
  const snap = await db.collection("attendance").get();
  console.log(`   • ${snap.size} documentos`);

  const byCpf = new Map(); // cpf -> {record, names:Set, lastTimestamp}
  const nameOnly = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    const cpf = (d.cpf || "").replace(/\D/g, "");
    const ts = toDate(d.timestamp) || toDate(d.createdAt) || new Date();
    if (!cpf) {
      nameOnly.push(d.fullName || "(sem nome)");
      continue;
    }

    if (!byCpf.has(cpf)) {
      byCpf.set(cpf, {
        record: { ...d, lastPresenceAt: ts },
        names: new Set(),
        lastTimestamp: ts,
      });
    }
    const entry = byCpf.get(cpf);
    if (d.fullName) entry.names.add(d.fullName);
    // Mantém o registro mais recente como base
    if (ts && entry.lastTimestamp && ts > entry.lastTimestamp) {
      entry.record = { ...d, lastPresenceAt: ts };
      entry.lastTimestamp = ts;
    }
  }

  console.log(`   • CPFs únicos encontrados: ${byCpf.size}`);
  console.log(`   • Registros sem CPF: ${nameOnly.length} (ignorados nesta migração)`);

  let inserted = 0;
  let updated = 0;
  let needsReview = 0;
  let skipped = 0;

  const batchSize = 400;
  let batch = db.batch();
  let count = 0;

  for (const [cpf, info] of byCpf.entries()) {
    const base = info.record;
    const names = [...info.names].filter(Boolean);
    const primaryName =
      names.length === 0
        ? base.fullName || ""
        : names.sort((a, b) => b.length - a.length)[0]; // nome mais longo

    const payload = {
      fullName: primaryName,
      cpf,
      birthday: base.birthday || "",
      reclassification: base.reclassification || "",
      pastorName: base.pastorName || "",
      region: base.region || "",
      churchPosition: base.churchPosition || "",
      city: base.city || "",
      shift: base.shift || "",
      status: base.status || "Presente",
      photoUrl: base.photoUrl || null,
      createdAt: base.createdAt ? admin.firestore.Timestamp.fromDate(toDate(base.createdAt)) : admin.firestore.Timestamp.now(),
      lastUpdated: admin.firestore.Timestamp.now(),
      lastPresenceAt: base.lastPresenceAt ? admin.firestore.Timestamp.fromDate(base.lastPresenceAt) : null,
      needsReview: names.length > 1,
      source: "migration-from-attendance",
    };

    if (payload.needsReview) needsReview++;

    const ref = db.collection("members").doc(cpf);
    batch.set(ref, payload, { merge: true });
    count++;
    inserted++;

    if (count === batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) await batch.commit();

  console.log("✅ Migração concluída.");
  console.log(`   • Inseridos/mesclados: ${inserted}`);
  console.log(`   • needsReview (CPF com >1 nome): ${needsReview}`);
  console.log(`   • Ignorados (sem CPF): ${nameOnly.length}`);
  console.log(`   • Coleção de destino: members`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erro na migração:", err);
  process.exit(1);
});
