// Gera um resumo por membro (CPF) e identifica buracos no histórico
// para os meses alvo (por padrão: Jan, Fev, Mar 2026).
// Usa o service account local para ler o Firestore.

import admin from "firebase-admin";
import { readFileSync, writeFileSync } from "fs";

// ==== CONFIGURAÇÃO ====
const SERVICE_ACCOUNT_PATH = "./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json";
const TARGET_MONTHS = ["2026-01", "2026-02", "2026-03"];
const TIMEZONE = "America/Manaus";
const OUTPUT_JSON = "./attendance-missing-summary.json";

// ==== HELPERS ====
function ensureServiceAccount(path) {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
}

function toMonthKey(date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const parts = Object.fromEntries(fmt.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}`;
}

function safeDate(v) {
  if (!v) return null;
  try {
    if (typeof v.toDate === "function") return v.toDate();
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

// ==== MAIN ====
async function main() {
  const sa = ensureServiceAccount(SERVICE_ACCOUNT_PATH);
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();

  console.log("🔍 Lendo coleção attendance...");
  const snap = await db.collection("attendance").get();
  console.log(`   • ${snap.size} registros carregados`);

  // Map por membro
  const members = new Map(); // key: cpf||fullName, value: { cpf, name, counts: {month: n} }

  for (const doc of snap.docs) {
    const data = doc.data();
    const ts = safeDate(data.timestamp) || safeDate(data.createdAt);
    if (!ts) continue;
    const month = toMonthKey(ts);

    const cpf = (data.cpf || "").replace(/\D/g, "") || null;
    const name = data.fullName || "Sem nome";
    const key = cpf || `name:${name.toLowerCase()}`;

    if (!members.has(key)) {
      members.set(key, {
        cpf,
        name,
        counts: {},
      });
    }
    const m = members.get(key);
    m.counts[month] = (m.counts[month] || 0) + 1;
  }

  // Agrega faltantes
  const missingList = [];
  for (const [, member] of members) {
    const missing = TARGET_MONTHS.filter((m) => !member.counts[m]);
    if (missing.length > 0) {
      missingList.push({
        cpf: member.cpf,
        name: member.name,
        missing,
        counts: TARGET_MONTHS.reduce((acc, m) => ({ ...acc, [m]: member.counts[m] || 0 }), {}),
      });
    }
  }

  // Ordena: mais faltas primeiro
  missingList.sort((a, b) => b.missing.length - a.missing.length || (b.name > a.name ? -1 : 1));

  // Totais por mês
  const totals = {};
  for (const m of TARGET_MONTHS) totals[m] = 0;
  for (const [, member] of members) {
    for (const m of TARGET_MONTHS) totals[m] += member.counts[m] || 0;
  }

  // Grava JSON para consulta completa
  writeFileSync(
    OUTPUT_JSON,
    JSON.stringify(
      {
        targetMonths: TARGET_MONTHS,
        totals,
        missingCount: missingList.length,
        missingList,
      },
      null,
      2
    ),
    "utf8"
  );

  // Saída resumida no console
  console.log("\n📊 Totais por mês (alvo):");
  Object.entries(totals).forEach(([m, v]) => console.log(`   • ${m}: ${v}`));
  console.log(`\nMembros com buracos nos meses alvo: ${missingList.length}`);
  console.log("Top 30 com faltas (cpf, nome, faltando -> contagens):");
  missingList.slice(0, 30).forEach((item, idx) => {
    const countsStr = TARGET_MONTHS.map((m) => `${m}:${item.counts[m]}`).join(" | ");
    console.log(
      `${idx + 1}. ${item.cpf || "sem CPF"} - ${item.name} | faltando: ${item.missing.join(", ")} | ${countsStr}`
    );
  });

  console.log(`\nDetalhe completo salvo em ${OUTPUT_JSON}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});
