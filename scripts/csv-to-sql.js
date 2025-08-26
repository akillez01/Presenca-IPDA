const fs = require('fs');
const path = require('path');

// Caminho do CSV exportado
defaultCsvPath = path.join(__dirname, 'presencas-mysql.csv');
// Caminho do SQL de saída
defaultSqlPath = path.join(__dirname, 'import-presencas.sql');

function csvToSqlInsert(csvPath = defaultCsvPath, sqlPath = defaultSqlPath) {
  const csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(',').map(h => h.replace(/\"/g, '').trim());
  const values = lines.slice(1).map(line => {
    // Remove aspas duplas e separa por vírgula
    const cells = line.match(/("[^"]*"|[^,]+)/g) || [];
    return '(' + cells.map(cell => cell.replace(/^"|"$/g, '').replace(/"/g, '\\"').replace(/'/g, "''").trim() ? `'${cell.replace(/^"|"$/g, '').replace(/"/g, '\\"').replace(/'/g, "''").trim()}'` : 'NULL').join(', ') + ')';
  });
  const sql = `INSERT INTO presencas (${headers.join(', ')})\nVALUES\n${values.join(',\n')};\n`;
  fs.writeFileSync(sqlPath, sql, 'utf8');
  console.log('Arquivo SQL gerado:', sqlPath);
}

csvToSqlInsert();
