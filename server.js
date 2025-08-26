import 'dotenv/config';
import express from 'express';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const app = express();
const PORT = process.env.PORT || 3001;

// Inicializar Firebase Admin
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(credentialsPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase Admin inicializado!');
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

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
