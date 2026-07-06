// Script Node.js independente para exportar direto do MySQL para CSV
const fs = require('fs');
const mysql = require('mysql2/promise');
const { loadCredentials, getMysqlConfig } = require('../credentials-loader.cjs');

const credentials = loadCredentials();
// Configuração do banco de dados centralizada em credentials.local.json
const dbConfig = getMysqlConfig(credentials);

async function exportMysqlToCSV() {
  const connection = await mysql.createConnection(dbConfig);
  const [records] = await connection.execute('SELECT * FROM presencas ORDER BY createdAt DESC');
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
  await connection.end();
}

exportMysqlToCSV();
