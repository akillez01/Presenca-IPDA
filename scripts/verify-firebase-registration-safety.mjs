import admin from "firebase-admin";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const MANAUS_TIME_ZONE = "America/Manaus";

function loadServiceAccount() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    resolve(process.cwd(), "reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json"),
    resolve(process.cwd(), "reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    return JSON.parse(readFileSync(candidate, "utf8"));
  }

  throw new Error("Credencial do Firebase Admin nao encontrada.");
}

function getManausDateKey(referenceDate = new Date()) {
  const manausDate = new Date(referenceDate.toLocaleString("en-US", { timeZone: MANAUS_TIME_ZONE }));

  return `${manausDate.getFullYear()}-${String(manausDate.getMonth() + 1).padStart(2, "0")}-${String(
    manausDate.getDate()
  ).padStart(2, "0")}`;
}

function normalizeShift(value) {
  return (value || "").trim() || "Manha";
}

function slugifyShift(value) {
  return normalizeShift(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildAttendanceSessionKey(cpf, referenceDate, shift) {
  return `${getManausDateKey(referenceDate)}__${slugifyShift(shift)}__${cpf}`;
}

function buildTestCpf() {
  const digits = String(Date.now()).slice(-9);
  return `99${digits}`.padEnd(11, "0").slice(0, 11);
}

function assertCondition(condition, successMessage, errorMessage, failures) {
  if (!condition) {
    failures.push(errorMessage);
    console.error(`FAIL: ${errorMessage}`);
    return;
  }

  console.log(`PASS: ${successMessage}`);
}

const serviceAccount = loadServiceAccount();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = admin.firestore();
const now = new Date();
const cpf = buildTestCpf();
const runId = `safety-${Date.now()}`;
const memberRef = db.collection("members").doc(cpf);
const morningKey = buildAttendanceSessionKey(cpf, now, "Manha");
const nightKey = buildAttendanceSessionKey(cpf, now, "Noite");
const concurrentKey = buildAttendanceSessionKey(cpf, now, "Teste Concorrencia");
const morningRef = db.collection("attendance").doc(morningKey);
const nightRef = db.collection("attendance").doc(nightKey);
const concurrentRef = db.collection("attendance").doc(concurrentKey);
const cleanupRefs = [memberRef, morningRef, nightRef, concurrentRef];
const failures = [];

async function cleanup() {
  await Promise.all(
    cleanupRefs.map(async (ref) => {
      try {
        await ref.delete();
      } catch {
        // Ignora limpeza parcial.
      }
    })
  );
}

try {
  console.log(`Iniciando verificacao de seguranca no Firebase. RunId=${runId} CPF=${cpf}`);
  await cleanup();

  await memberRef.create({
    cpf,
    fullName: `Teste Seguranca ${runId}`,
    shift: "Manha",
    photoUrl: "member-photo-inicial",
    sourceCollection: "members",
    runId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastPresenceAt: null,
  });

  let duplicateBlocked = false;
  try {
    await memberRef.create({
      cpf,
      fullName: `Teste Duplicado ${runId}`,
      sourceCollection: "members",
      runId,
    });
  } catch (error) {
    duplicateBlocked = true;
  }

  assertCondition(
    duplicateBlocked,
    "Cadastro duplicado de membro foi bloqueado no documento master.",
    "Cadastro duplicado de membro nao foi bloqueado.",
    failures
  );

  await morningRef.create({
    cpf,
    fullName: `Teste Seguranca ${runId}`,
    shift: "Manha",
    status: "Presente",
    photoUrl: "attendance-photo-manha",
    attendanceKey: morningKey,
    attendanceDateKey: getManausDateKey(now),
    sourceCollection: "attendance",
    runId,
    timestamp: admin.firestore.Timestamp.fromDate(now),
    createdAt: admin.firestore.Timestamp.fromDate(now),
    lastUpdated: admin.firestore.Timestamp.fromDate(now),
  });

  await nightRef.create({
    cpf,
    fullName: `Teste Seguranca ${runId}`,
    shift: "Noite",
    status: "Ausente",
    photoUrl: "attendance-photo-noite",
    attendanceKey: nightKey,
    attendanceDateKey: getManausDateKey(now),
    sourceCollection: "attendance",
    runId,
    timestamp: admin.firestore.Timestamp.fromDate(now),
    createdAt: admin.firestore.Timestamp.fromDate(now),
    lastUpdated: admin.firestore.Timestamp.fromDate(now),
  });

  const sameCpfAttendance = await db.collection("attendance").where("cpf", "==", cpf).where("runId", "==", runId).get();
  assertCondition(
    sameCpfAttendance.size === 2,
    "Mesmo CPF conseguiu manter dois registros de presenca separados por sessao.",
    `Esperava 2 registros separados de presenca, mas encontrei ${sameCpfAttendance.size}.`,
    failures
  );

  await Promise.all(
    Array.from({ length: 10 }, async (_, index) => {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(concurrentRef);

        if (!snap.exists) {
          transaction.set(concurrentRef, {
            cpf,
            fullName: `Teste Seguranca ${runId}`,
            shift: "Teste Concorrencia",
            status: "Presente",
            photoUrl: null,
            attendanceKey: concurrentKey,
            attendanceDateKey: getManausDateKey(now),
            sourceCollection: "attendance",
            runId,
            updateCount: 1,
            lastWriter: `worker-${index}`,
            timestamp: admin.firestore.Timestamp.fromDate(now),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          });
          return;
        }

        transaction.update(concurrentRef, {
          updateCount: admin.firestore.FieldValue.increment(1),
          lastWriter: `worker-${index}`,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    })
  );

  const concurrentSnap = await concurrentRef.get();
  const concurrentData = concurrentSnap.data() || {};
  assertCondition(
    concurrentSnap.exists,
    "Documento de concorrencia foi criado uma unica vez.",
    "Documento de concorrencia nao foi criado.",
    failures
  );
  assertCondition(
    concurrentData.updateCount === 10,
    "Atualizacoes concorrentes convergiram para um unico documento sem duplicacao.",
    `Esperava updateCount=10 no teste concorrente, mas encontrei ${concurrentData.updateCount}.`,
    failures
  );

  await memberRef.update({
    photoUrl: "member-photo-atualizada",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const morningAfterMemberUpdate = await morningRef.get();
  const nightAfterMemberUpdate = await nightRef.get();
  assertCondition(
    morningAfterMemberUpdate.data()?.photoUrl === "attendance-photo-manha" &&
      nightAfterMemberUpdate.data()?.photoUrl === "attendance-photo-noite",
    "Atualizacao do cadastro master nao sobrescreveu fotos/registros de presenca.",
    "Atualizacao do cadastro master alterou indevidamente registros de presenca.",
    failures
  );

  await morningRef.update({
    photoUrl: "attendance-photo-manha-editada",
    status: "Justificado",
    absentReason: "teste-de-edicao",
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  });

  const memberAfterAttendanceUpdate = await memberRef.get();
  const nightAfterAttendanceUpdate = await nightRef.get();
  assertCondition(
    memberAfterAttendanceUpdate.data()?.photoUrl === "member-photo-atualizada",
    "Edicao de presenca nao sobrescreveu a foto do cadastro master.",
    "Edicao de presenca sobrescreveu a foto do cadastro master.",
    failures
  );
  assertCondition(
    nightAfterAttendanceUpdate.data()?.photoUrl === "attendance-photo-noite" &&
      nightAfterAttendanceUpdate.data()?.status === "Ausente",
    "Edicao de uma sessao nao sobrescreveu outra sessao do mesmo CPF.",
    "Edicao de uma sessao sobrescreveu outra sessao do mesmo CPF.",
    failures
  );

  const summary = {
    runId,
    cpf,
    membersDocument: memberRef.path,
    attendanceDocuments: [morningRef.path, nightRef.path, concurrentRef.path],
    passed: failures.length === 0,
    failureCount: failures.length,
  };

  console.log("Resumo final:");
  console.log(JSON.stringify(summary, null, 2));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error("Erro durante a verificacao:", error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
