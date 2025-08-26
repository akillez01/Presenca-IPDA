const fs = require('fs');
const { getPresencas } = require('../src/lib/presenca-mysql');

async function exportMysqlToCSV() {
  const rawRecords = await getPresencas();
  const records = rawRecords ?? [];
  const headers = [
    'fullName', 'cpf', 'reclassification', 'pastorName', 'region', 'churchPosition', 'city', 'shift', 'status', 'createdAt'
  ];
  const csvRows = [headers.join(',')];
  for (const r of records) {
    csvRows.push([
      r.fullName,
      r.cpf,
      r.reclassification,
      r.pastorName,
      r.region,
      r.churchPosition,
      r.city,
      r.shift,
      r.status,
      r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ') : ''
    ].map(cell => `"${cell || ''}"`).join(','));
  }
  fs.writeFileSync('presencas-mysql.csv', csvRows.join('\n'), 'utf8');
  console.log('Arquivo CSV gerado: presencas-mysql.csv');
}

exportMysqlToCSV();
