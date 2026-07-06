#!/usr/bin/env node

/**
 * Script para criar usuário admin no Firebase
 * Para ser executado apenas uma vez no setup inicial
 */

const admin = require('firebase-admin');
const {
  loadCredentials,
  getFirebaseAdminConfig,
  getUserByKey,
} = require('./credentials-loader.cjs');

const credentials = loadCredentials();
const firebaseAdminConfig = getFirebaseAdminConfig(credentials);
const adminUser = getUserByKey(credentials, 'admin');

// Inicializar Firebase Admin
const serviceAccount = require(firebaseAdminConfig.serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  ...(firebaseAdminConfig.projectId ? { projectId: firebaseAdminConfig.projectId } : {}),
  ...(firebaseAdminConfig.databaseURL ? { databaseURL: firebaseAdminConfig.databaseURL } : {}),
});

const auth = admin.auth();
const db = admin.firestore();

async function createAdminUser() {
  try {
    console.log('🔥 Criando usuário admin...');
    
    // Criar usuário de autenticação
    const userRecord = await auth.createUser({
      email: adminUser.email,
      password: adminUser.password,
      displayName: adminUser.displayName || 'Admin IPDA',
      emailVerified: true
    });

    console.log('✅ Usuário de autenticação criado:', userRecord.uid);

    // Criar documento do usuário no Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email: adminUser.email,
      displayName: adminUser.displayName || 'Admin IPDA',
      role: 'admin',
      cargo: 'SUPER_USER',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: null,
      active: true
    });

    console.log('✅ Documento do usuário criado no Firestore');

    // Criar claims customizados
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      cargo: 'SUPER_USER'
    });

    console.log('✅ Claims customizados definidos');

    console.log(`
🎉 USUÁRIO ADMIN CRIADO COM SUCESSO!

📧 Email: ${adminUser.email}
🔑 Senha: definida em credentials.local.json
👤 Role: admin
🏢 Cargo: SUPER_USER

⚠️  IMPORTANTE: 
1. Mude a senha após o primeiro login
2. Este script deve ser executado apenas uma vez
3. Mantenha as credenciais seguras
    `);

  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.log('⚠️  Usuário admin já existe. Apenas atualizando dados...');
      
      // Buscar usuário existente
      const existingUser = await auth.getUserByEmail(adminUser.email);
      
      // Atualizar claims
      await auth.setCustomUserClaims(existingUser.uid, {
        role: 'admin',
        cargo: 'SUPER_USER'
      });

      // Atualizar documento no Firestore
      await db.collection('users').doc(existingUser.uid).set({
        email: adminUser.email,
        displayName: adminUser.displayName || 'Admin IPDA',
        role: 'admin',
        cargo: 'SUPER_USER',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        active: true
      }, { merge: true });

      console.log('✅ Usuário admin atualizado com sucesso!');
    } else {
      console.error('❌ Erro ao criar usuário admin:', error);
    }
  } finally {
    process.exit(0);
  }
}

// Executar se for chamado diretamente
if (require.main === module) {
  createAdminUser();
}

module.exports = { createAdminUser };
