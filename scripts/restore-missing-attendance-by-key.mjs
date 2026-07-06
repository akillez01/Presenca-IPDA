// Restaura registros ausentes usando a chave (cpf + timestamp ISO) para evitar sobrescrever documentos existentes.
// Útil quando o mesmo documento foi reutilizado e perdeu o histórico.

import fs from "fs";
import admin from "firebase-admin";

const SERVICE_ACCOUNT_PATH = "./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json";
const BACKUP_FILES = [
  "backup-attendance-2025-09-21T17-07-13-037Z.json",
  "backup-attendance-2025-10-19.json",
];

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Arquivo não encontrado: ${filePath}`);
}

function toDateSafe(value) {
  if (!value) return null;
  try {
    if (typeof value.toDate === "function") return value.toDate();
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function extractRecords(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (raw.data && Array.isArray(raw.data)) return raw.data;
  if (raw.attendance && Array.isArray(raw.attendance)) return raw.attendance;
  const firstValue = Object.values(raw)[0];
  if (firstValue && Array.isArray(firstValue.attendance)) return firstValue.attendance;
  return [];
}

function buildKey(rec) {
  const cpf = (rec.cpf || "").replace(/\D/g, "");
  const ts = toDateSafe(rec.timestamp) || toDateSafe(rec.createdAt);
  if (!cpf || !ts) return null;
  return `${cpf}-${ts.toISOString()}`;
}

async function main() {
  ensureFile(SERVICE_ACCOUNT_PATH);
  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  console.log("🔍 Carregando registros atuais para montar chaves cpf+timestamp...");
  const currentSnap = await db.collection("attendance").get();
  const currentKeys = new Set(
    currentSnap.docs
      .map((d) => d.data())
      .map((rec) => buildKey(rec))
      .filter(Boolean)
  );
  console.log(`   • Registros atuais: ${currentKeys.size} chaves únicas`);

  let inserted = 0;
  let skipped = 0;

  for (const file of BACKUP_FILES) {
    ensureFile(file);
    console.log(`\n📦 Processando backup: ${file}`);
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const records = extractRecords(raw);
    console.log(`   • ${records.length} registros no arquivo`);

    for (const rec of records) {
      const key = buildKey(rec);
      if (!key) {
        skipped++;
        continue;
      }
      if (currentKeys.has(key)) {
        skipped++;
        continue;
      }

      const ts = toDateSafe(rec.timestamp) || toDateSafe(rec.createdAt) || new Date();
      const created = toDateSafe(rec.createdAt) || ts;
      const updated = toDateSafe(rec.lastUpdated) || ts;

      const { id: _, ...rest } = rec; // ignorar id para gerar novo doc
      const payload = {
        ...rest,
        timestamp: admin.firestore.Timestamp.fromDate(ts),
        createdAt: admin.firestore.Timestamp.fromDate(created),
        lastUpdated: admin.firestore.Timestamp.fromDate(updated),
      };

      await db.collection("attendance").add(payload);
      currentKeys.add(key);
      inserted++;
    }
  }

  console.log("\n✅ Restauração por chave concluída.");
  console.log(`   • Inseridos: ${inserted}`);
  console.log(`   • Ignorados (já existiam/sem chave válida): ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erro na restauração:", err);
  process.exit(1);
});
