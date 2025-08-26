// Script Node.js independente para exportar direto do MySQL para CSV
const fs = require('fs');
const mysql = require('mysql2/promise');

// Configuração do banco de dados (ajuste conforme necessário)
const dbConfig = {
  host: '74.208.44.241',
  user: 'adminipda',
  password: 'IPDA@2025Admin',
  database: 'admin_ipda',
  port: 3306,
};

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
