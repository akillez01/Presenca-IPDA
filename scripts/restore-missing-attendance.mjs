// Restaura registros de presença ausentes a partir dos arquivos de backup
// Usa o mesmo ID do documento para não duplicar dados existentes.
// Compatível com Node ESM (o projeto está com "type": "module").

import fs from "fs";
import path from "path";
import admin from "firebase-admin";

// ===== CONFIGURAÇÕES =====
// Ajuste o caminho se usar outro service account.
const SERVICE_ACCOUNT_PATH = "./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json";
// Inclua aqui os arquivos de backup que deseja restaurar (ordem importa para logs apenas).
const BACKUP_FILES = [
  "backup-attendance-2025-09-21T17-07-13-037Z.json",
  "firebase-backup-2025-09-22.json",
];

// ===== FUNÇÕES AUXILIARES =====
function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }
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
  // Alguns backups podem ter o objeto raíz com uma chave que contém { attendance: [...] }
  const firstValue = Object.values(raw)[0];
  if (firstValue && Array.isArray(firstValue.attendance)) return firstValue.attendance;
  return [];
}

// ===== MAIN =====
async function main() {
  ensureFile(SERVICE_ACCOUNT_PATH);

  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  const db = admin.firestore();

  console.log("🔍 Carregando IDs atuais do Firestore...");
  const existingSnap = await db.collection("attendance").select().get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));
  console.log(`   • Registros existentes: ${existingIds.size}`);

  let restored = 0;
  let skipped = 0;

  for (const file of BACKUP_FILES) {
    ensureFile(file);
    console.log(`\n📦 Processando backup: ${file}`);
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const records = extractRecords(raw);
    console.log(`   • Registros encontrados no arquivo: ${records.length}`);

    for (const rec of records) {
      const id = rec.id;
      if (!id) {
        skipped++;
        continue;
      }
      if (existingIds.has(id)) {
        skipped++;
        continue;
      }

      const ts = toDateSafe(rec.timestamp) || toDateSafe(rec.createdAt) || new Date();
      const created = toDateSafe(rec.createdAt) || ts;
      const updated = toDateSafe(rec.lastUpdated) || ts;

      // Remove campos nulos/indesejados para não sobrescrever com null
      const { id: _, ...rest } = rec;
      const payload = {
        ...rest,
        timestamp: admin.firestore.Timestamp.fromDate(ts),
        createdAt: admin.firestore.Timestamp.fromDate(created),
        lastUpdated: admin.firestore.Timestamp.fromDate(updated),
      };

      await db.collection("attendance").doc(id).set(payload, { merge: false });
      existingIds.add(id);
      restored++;
    }
  }

  console.log("\n✅ Restauração concluída.");
  console.log(`   • Inseridos: ${restored}`);
  console.log(`   • Ignorados (já existiam/sem id): ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erro na restauração:", err);
  process.exit(1);
});
