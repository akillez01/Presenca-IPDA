import fs from 'fs';
import { getAttendanceRecords } from '../src/lib/actions';

async function exportFirebaseToCSV() {
  const records = await getAttendanceRecords();
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
      r.timestamp ? new Date(r.timestamp).toISOString().slice(0, 19).replace('T', ' ') : ''
    ].map(cell => `"${cell || ''}"`).join(','));
  }
  fs.writeFileSync('presencas-firebase.csv', csvRows.join('\n'), 'utf8');
  console.log('Arquivo CSV gerado: presencas-firebase.csv');
}

exportFirebaseToCSV();
