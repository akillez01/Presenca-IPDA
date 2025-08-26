// Script Node.js para exportar a coleção 'presencas' do Firestore para CSV
const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = require('../reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function exportToCSV() {
  const snapshot = await db.collection('presencas').get();
  const headers = [
    'fullName', 'cpf', 'reclassification', 'pastorName', 'region', 'churchPosition', 'city', 'shift', 'status', 'createdAt'
  ];
  const csvRows = [headers.join(',')];

  snapshot.forEach(doc => {
    const d = doc.data();
    csvRows.push([
      d.fullName || '',
      d.cpf || '',
      d.reclassification || '',
      d.pastorName || '',
      d.region || '',
      d.churchPosition || '',
      d.city || '',
      d.shift || '',
      d.status || '',
      d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 19).replace('T', ' ') : ''
    ].map(cell => `"${cell}"`).join(','));
  });

  fs.writeFileSync('presencas-firebase.csv', csvRows.join('\n'), 'utf8');
  console.log('Arquivo CSV gerado: presencas-firebase.csv');
}

exportToCSV().catch(console.error);
