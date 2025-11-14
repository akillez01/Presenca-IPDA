const admin = require('firebase-admin');
const path = require('path');

// Inicialização do Firebase Admin reaproveitando o mesmo service account
const serviceAccountPath = path.resolve(__dirname, '../reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://reuniao-ministerial-default-rtdb.firebaseio.com'
  });
}

const db = admin.firestore();

const STATUS_ALLOWED = ['Presente', 'Ausente', 'Justificado'];
const SHIFT_ALLOWED = ['Manhã', 'Tarde', 'Noite'];

function startOfManausDay(date = new Date()) {
  const manausDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Manaus' }));
  return new Date(Date.UTC(manausDate.getFullYear(), manausDate.getMonth(), manausDate.getDate(), 0, 0, 0));
}

function endOfManausDay(date = new Date()) {
  const manausDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Manaus' }));
  return new Date(Date.UTC(manausDate.getFullYear(), manausDate.getMonth(), manausDate.getDate(), 23, 59, 59, 999));
}

function formatManaus(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Manaus' }));
}

function formatDateLabel(date) {
  const manaus = formatManaus(date);
  return manaus.toISOString().slice(0, 10);
}

async function fetchAttendanceRange(start, end) {
  const snapshot = await db
    .collection('attendance')
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(start))
    .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(end))
    .get();

  return snapshot.docs.map(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt || new Date();
    const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp || createdAt;

    return {
      id: doc.id,
      fullName: data.fullName || '',
      cpf: (data.cpf || '').replace(/\D/g, ''),
      reclassification: data.reclassification || '',
      pastorName: data.pastorName || '',
      region: data.region || '',
      churchPosition: data.churchPosition || '',
      city: data.city || '',
      shift: data.shift || '',
      status: data.status || '',
      createdAt,
      timestamp
    };
  });
}

function analyzeRecords(records) {
  const totals = {
    count: records.length,
    byStatus: {},
    byShift: {},
    byRegion: {},
    byPosition: {},
    byReclassification: {},
  };

  const duplicates = [];
  const missingFields = [];
  const customIssues = [];
  const seenCpfToday = new Map();

  records.forEach(record => {
    const dateLabel = formatDateLabel(record.createdAt);
    const cpfKey = `${record.cpf || 'SEM_CPF'}-${dateLabel}`;

    totals.byStatus[record.status] = (totals.byStatus[record.status] || 0) + 1;
    totals.byShift[record.shift] = (totals.byShift[record.shift] || 0) + 1;
    totals.byRegion[record.region] = (totals.byRegion[record.region] || 0) + 1;
    totals.byPosition[record.churchPosition] = (totals.byPosition[record.churchPosition] || 0) + 1;
    totals.byReclassification[record.reclassification] = (totals.byReclassification[record.reclassification] || 0) + 1;

    if (seenCpfToday.has(cpfKey)) {
      duplicates.push({
        cpf: record.cpf,
        existingId: seenCpfToday.get(cpfKey),
        duplicateId: record.id,
        dateLabel,
        fullName: record.fullName
      });
    } else {
      seenCpfToday.set(cpfKey, record.id);
    }

    const requiredFields = ['fullName', 'cpf', 'region', 'churchPosition', 'shift', 'status'];
    const missing = requiredFields.filter(field => !record[field]);
    if (missing.length > 0) {
      missingFields.push({ id: record.id, missing, record });
    }

    if (record.status && !STATUS_ALLOWED.includes(record.status)) {
      customIssues.push({ id: record.id, issue: 'STATUS_INVALIDO', value: record.status });
    }
    if (record.shift && !SHIFT_ALLOWED.includes(record.shift)) {
      customIssues.push({ id: record.id, issue: 'TURNO_INVALIDO', value: record.shift });
    }
    if (!record.cpf || record.cpf.length !== 11) {
      customIssues.push({ id: record.id, issue: 'CPF_INCOMPLETO', value: record.cpf });
    }
  });

  return {
    totals,
    duplicates,
    missingFields,
    customIssues
  };
}

function summarizeTotals(totals) {
  const present = totals.byStatus['Presente'] || 0;
  const justified = totals.byStatus['Justificado'] || 0;
  const absent = totals.byStatus['Ausente'] || 0;
  const attendanceRate = totals.count > 0 ? Math.round((present / totals.count) * 1000) / 10 : 0;

  return {
    count: totals.count,
    present,
    justified,
    absent,
    attendanceRate
  };
}

async function monitorAttendance() {
  const todayStart = startOfManausDay();
  const todayEnd = endOfManausDay();
  const yesterdayStart = startOfManausDay(new Date(Date.now() - 86400000));
  const yesterdayEnd = endOfManausDay(new Date(Date.now() - 86400000));

  console.log('📊 Monitoramento de Presenças');
  console.log('='.repeat(60));

  const [todayRecords, yesterdayRecords] = await Promise.all([
    fetchAttendanceRange(todayStart, todayEnd),
    fetchAttendanceRange(yesterdayStart, yesterdayEnd)
  ]);

  const todayAnalysis = analyzeRecords(todayRecords);
  const yesterdayAnalysis = analyzeRecords(yesterdayRecords);

  const todaySummary = summarizeTotals(todayAnalysis.totals);
  const yesterdaySummary = summarizeTotals(yesterdayAnalysis.totals);

  console.log('\n✅ Hoje (Manaus):');
  console.log(`   • Total de registros: ${todaySummary.count}`);
  console.log(`   • Presentes: ${todaySummary.present}`);
  console.log(`   • Justificados: ${todaySummary.justified}`);
  console.log(`   • Ausentes: ${todaySummary.absent}`);
  console.log(`   • Taxa de presença: ${todaySummary.attendanceRate}%`);

  console.log('\n📈 Ontem (comparativo):');
  console.log(`   • Total de registros: ${yesterdaySummary.count}`);
  console.log(`   • Presentes: ${yesterdaySummary.present}`);
  console.log(`   • Taxa de presença: ${yesterdaySummary.attendanceRate}%`);

  if (todayAnalysis.duplicates.length > 0) {
    console.log('\n⚠️ Conflitos de duplicidade detectados hoje:');
    todayAnalysis.duplicates.forEach(dup => {
      console.log(`   • CPF ${dup.cpf} (${dup.fullName}) duplicado em ${dup.dateLabel} (IDs ${dup.existingId} / ${dup.duplicateId})`);
    });
  } else {
    console.log('\n✅ Nenhuma duplicidade de CPF detectada hoje.');
  }

  if (todayAnalysis.missingFields.length > 0) {
    console.log('\n⚠️ Registros com campos ausentes:');
    todayAnalysis.missingFields.slice(0, 5).forEach(item => {
      console.log(`   • Documento ${item.id} sem: ${item.missing.join(', ')}`);
    });
    if (todayAnalysis.missingFields.length > 5) {
      console.log(`   • +${todayAnalysis.missingFields.length - 5} registros adicionais...`);
    }
  } else {
    console.log('\n✅ Todos os registros de hoje contêm os campos essenciais.');
  }

  if (todayAnalysis.customIssues.length > 0) {
    console.log('\n⚠️ Problemas específicos detectados:');
    todayAnalysis.customIssues.forEach(issue => {
      console.log(`   • Documento ${issue.id}: ${issue.issue} (${issue.value || 'sem valor'})`);
    });
  } else {
    console.log('\n✅ Nenhum problema de status/turno/CPF encontrado hoje.');
  }

  console.log('\n🔁 Sugestão: execute este script antes dos testes de campo para validar os dados do dia.');
  console.log('    Comando: node scripts/monitor-attendance.cjs');
}

monitorAttendance()
  .then(() => {
    console.log('\n✨ Monitoramento concluído');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro no monitoramento:', error);
    process.exit(1);
  });
