// Script para definir o custom claim 'role: superadmin' para um usuário no Firebase
// Uso: node scripts/set-superadmin.js <USER_UID>

const admin = require('firebase-admin');
const path = require('path');

// Caminho para o arquivo de credenciais do Firebase
const serviceAccount = require(path.resolve(__dirname, '../serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const uid = process.argv[2];
if (!uid) {
  console.error('Erro: informe o UID do usuário como argumento.');
  process.exit(1);
}

admin.auth().setCustomUserClaims(uid, { role: 'superadmin' })
  .then(() => {
    console.log(`Custom claim 'role: superadmin' definido para o usuário ${uid}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erro ao definir custom claim:', error);
    process.exit(1);
  });
