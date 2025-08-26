// Script para listar usuários e mostrar se são superadmin (role: 'superadmin')
// Uso: node scripts/list-users-with-claims.js

const admin = require('firebase-admin');
const path = require('path');

// Caminho para o arquivo de credenciais do Firebase
const serviceAccount = require(path.resolve(__dirname, '../serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function listUsers() {
  const list = await admin.auth().listUsers(1000);
  list.users.forEach(user => {
    const role = user.customClaims && user.customClaims.role;
    console.log(`UID: ${user.uid} | Email: ${user.email} | Role: ${role || 'nenhum'}`);
  });
}

listUsers().catch(console.error);
