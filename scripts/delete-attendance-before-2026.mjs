// Remove registros de presença com data anterior a 2026-01-01
// Cuidado: operação destrutiva. Usa o service account local.

import admin from "firebase-admin";
import { readFileSync } from "fs";

const SERVICE_ACCOUNT_PATH = "./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json";
const CUTOFF = new Date(Date.UTC(2026, 0, 1)); // 2026-01-01T00:00:00Z
const BATCH_SIZE = 400; // seguro dentro do limite de 500 writes por batch

function ensureServiceAccount(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function safeDate(data) {
  if (!data) return null;
  if (data.timestamp?.toDate) return data.timestamp.toDate();
  if (data.timestamp) return new Date(data.timestamp);
  if (data.createdAt?.toDate) return data.createdAt.toDate();
  if (data.createdAt) return new Date(data.createdAt);
  return null;
}

async function main() {
  const sa = ensureServiceAccount(SERVICE_ACCOUNT_PATH);
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();

  console.log("🔍 Buscando registros anteriores a 2026-01-01...");
  const snap = await db.collection("attendance").get();
  const toDelete = [];

  snap.forEach((doc) => {
    const data = doc.data();
    const dt = safeDate(data);
    if (!dt || isNaN(dt)) return;
    if (dt < CUTOFF) toDelete.push(doc.ref);
  });

  console.log(`Encontrados ${toDelete.length} registros para remover.`);
  let deleted = 0;

  while (toDelete.length) {
    const batch = db.batch();
    const chunk = toDelete.splice(0, BATCH_SIZE);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += chunk.length;
    console.log(`✅ Removidos ${deleted} / ${deleted + toDelete.length}`);
  }

  console.log("🎯 Concluído. Registros anteriores a 2026 removidos.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erro ao deletar:", err);
  process.exit(1);
});
