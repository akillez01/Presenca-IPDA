import dotenv from 'dotenv';
import express from 'express';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

import { getBackupSchedulerStatus, startBackupScheduler } from './server-backup-scheduler.js';

if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
let stopBackupScheduler = null;

function isLocalRequest(req) {
  const remoteAddress = req.socket?.remoteAddress || '';
  return (
    remoteAddress === '127.0.0.1' ||
    remoteAddress === '::1' ||
    remoteAddress === '::ffff:127.0.0.1'
  );
}

// Inicializar Firebase Admin
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(credentialsPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase Admin inicializado!');

  stopBackupScheduler = startBackupScheduler(admin.firestore(), { logger: console });
} catch (err) {
  console.error('❌ Não foi possível inicializar o Firebase Admin:', err);
}

app.get('/', (req, res) => {
  res.send('Servidor Express rodando!');
});

// Exemplo de rota protegida que retorna lista de usuários do Firebase
app.get('/usuarios', async (req, res) => {
  try {
    const listUsersResult = await admin.auth().listUsers();
    const emails = listUsersResult.users.map(u => u.email);
    res.json({ success: true, emails });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/backup-status', (req, res) => {
  if (!isLocalRequest(req)) {
    return res.status(403).json({ success: false, error: 'Acesso restrito.' });
  }

  res.json({
    success: true,
    scheduler: getBackupSchedulerStatus(),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

function shutdown(signal) {
  console.log(`🛑 Recebido ${signal}. Encerrando servidor...`);
  if (typeof stopBackupScheduler === 'function') {
    stopBackupScheduler();
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
