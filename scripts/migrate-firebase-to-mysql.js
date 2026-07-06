// Script Node.js para migrar dados do Firebase Firestore para MariaDB (Plesk)
const admin = require('firebase-admin');
const mysql = require('mysql2/promise');
const {
  loadCredentials,
  getFirebaseAdminConfig,
  getMysqlConfig,
} = require('../credentials-loader.cjs');

const credentials = loadCredentials();
const firebaseAdminConfig = getFirebaseAdminConfig(credentials);
const serviceAccount = require(firebaseAdminConfig.serviceAccountPath);

// Inicializa Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  ...(firebaseAdminConfig.projectId ? { projectId: firebaseAdminConfig.projectId } : {}),
  ...(firebaseAdminConfig.databaseURL ? { databaseURL: firebaseAdminConfig.databaseURL } : {}),
});

const db = admin.firestore();

// Configuração do banco MariaDB (Plesk) centralizada em credentials.local.json
const dbConfig = getMysqlConfig(credentials);

async function migrateFirebaseToMysql() {
  const connection = await mysql.createConnection(dbConfig);
  const snapshot = await db.collection('presencas').get();
  const values = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    values.push([
      d.fullName || '',
      d.cpf || '',
      d.reclassification || '',
      d.pastorName || '',
      d.region || '',
      d.churchPosition || '',
      d.city || '',
      d.shift || '',
      d.status || '',
      d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 19).replace('T', ' ') : null
    ]);
  });
  if (values.length === 0) {
    console.log('Nenhum dado encontrado no Firebase.');
    await connection.end();
    return;
  }
  const sql = `INSERT INTO presencas (fullName, cpf, reclassification, pastorName, region, churchPosition, city, shift, status, createdAt) VALUES ?`;
  await connection.query(sql, [values]);
  console.log(`Migrados ${values.length} registros do Firebase para o MariaDB!`);
  await connection.end();
}

migrateFirebaseToMysql().catch(err => {
  console.error('Erro na migração:', err);
});
