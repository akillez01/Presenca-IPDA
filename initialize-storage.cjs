#!/usr/bin/env node

/**
 * Script para inicializar Firebase Storage
 * Cria o bucket e aplica configurações CORS
 */

const admin = require('firebase-admin');
const fs = require('fs');

// Inicializar Firebase Admin com credenciais do projeto
admin.initializeApp({
  projectId: 'reuniao-ministerial',
  storageBucket: 'reuniao-ministerial.appspot.com'
});

const bucket = admin.storage().bucket();

async function initializeStorage() {
  console.log('🔧 Inicializando Firebase Storage...');
  
  try {
    // Verificar se o bucket existe
    const [exists] = await bucket.exists();
    console.log(`📦 Bucket exists: ${exists}`);
    
    if (!exists) {
      console.log('❌ Bucket não existe. Crie-o no Firebase Console primeiro.');
      process.exit(1);
    }
    
    // Configurar CORS
    console.log('🌐 Configurando CORS...');
    await bucket.setCorsConfiguration([
      {
        origin: ['http://localhost:9002', 'http://localhost:3000', 'https://reuniao-ministerial.web.app', 'https://reuniao-ministerial.firebaseapp.com'],
        method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
        maxAgeSeconds: 3600,
        responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'X-Requested-With']
      }
    ]);
    
    console.log('✅ CORS configurado com sucesso!');
    
    // Criar arquivo de teste para ativar o bucket
    console.log('📝 Criando arquivo de teste...');
    const testFile = bucket.file('attendance-photos/.init');
    await testFile.save('Storage initialized', {
      metadata: {
        contentType: 'text/plain',
      }
    });
    
    console.log('✅ Arquivo de teste criado!');
    console.log('');
    console.log('✨ Firebase Storage inicializado com sucesso!');
    console.log('');
    console.log('Próximos passos:');
    console.log('1. Teste o upload no sistema');
    console.log('2. Verifique no Firebase Console se o arquivo aparece');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar Storage:', error);
    console.error('');
    console.error('Se o erro for de autenticação, execute:');
    console.error('  firebase login');
    console.error('  firebase use reuniao-ministerial');
    process.exit(1);
  }
}

initializeStorage();
