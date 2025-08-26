#!/usr/bin/env node

// Script para adicionar o usuário Achilles no Firestore
// Execute: node update-achilles-user.js

import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { doc, getFirestore, setDoc } from 'firebase/firestore';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addAchillesToFirestore() {
  try {
    console.log('🔄 Adicionando usuário Achilles no Firestore...');
    
    const achillesData = {
      uid: 'r3ZqNdkjc2YueZfK3QWB1ATmT9I3',
      email: 'achilles.oliveira.souza@gmail.com',
      displayName: 'Achilles Oliveira',
      role: 'user',
      active: true,
      createdAt: new Date('2025-08-08').toISOString(),
      lastLoginAt: new Date('2025-08-08').toISOString(),
      emailVerified: true,
      userType: 'BASIC_USER',
      permissions: {
        canViewReports: true,
        canEditReports: false,
        canManageUsers: false,
        canAccessAdmin: false
      },
      metadata: {
        addedBy: 'system',
        addedAt: new Date().toISOString(),
        source: 'manual_sync'
      }
    };

    // Adicionar usuário na coleção 'users'
    const userRef = doc(db, 'users', achillesData.uid);
    await setDoc(userRef, achillesData);
    
    console.log('✅ Usuário Achilles adicionado com sucesso!');
    console.log('📧 Email:', achillesData.email);
    console.log('👤 Nome:', achillesData.displayName);
    console.log('🔑 UID:', achillesData.uid);
    console.log('👥 Tipo:', achillesData.userType);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao adicionar usuário:', error);
    process.exit(1);
  }
}

// Executar a função
addAchillesToFirestore();
