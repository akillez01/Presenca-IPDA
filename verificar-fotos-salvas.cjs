#!/usr/bin/env node

/**
 * Script para verificar se as fotos estão sendo salvas nos registros de presença
 */

const admin = require('firebase-admin');

// Inicializa o Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: 'reuniao-ministerial',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

async function verificarFotosSalvas() {
  console.log('🔍 Verificando fotos salvas nos registros...\n');

  try {
    // Busca os últimos 10 registros
    const snapshot = await db.collection('attendance')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    if (snapshot.empty) {
      console.log('❌ Nenhum registro encontrado');
      return;
    }

    console.log(`📊 Encontrados ${snapshot.size} registros recentes\n`);

    let comFoto = 0;
    let semFoto = 0;
    let fotoBase64 = 0;
    let fotoStorage = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const nome = data.fullName || 'Sem nome';
      const cpf = data.cpf || 'Sem CPF';
      const timestamp = data.timestamp?.toDate() || new Date();
      const photoUrl = data.photoUrl;

      console.log(`\n📝 Registro: ${nome} (CPF: ${cpf})`);
      console.log(`   Data: ${timestamp.toLocaleString('pt-BR')}`);
      
      if (photoUrl) {
        comFoto++;
        
        if (photoUrl.startsWith('data:image/')) {
          fotoBase64++;
          const sizeKB = Math.round(photoUrl.length / 1024);
          console.log(`   ✅ Foto: BASE64 (${sizeKB} KB)`);
        } else if (photoUrl.startsWith('https://firebasestorage')) {
          fotoStorage++;
          console.log(`   ✅ Foto: Firebase Storage`);
          console.log(`   URL: ${photoUrl.substring(0, 80)}...`);
        } else {
          console.log(`   ⚠️  Foto: Formato desconhecido`);
          console.log(`   URL: ${photoUrl.substring(0, 80)}...`);
        }
      } else {
        semFoto++;
        console.log(`   ❌ Sem foto`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO:');
    console.log('='.repeat(60));
    console.log(`Total de registros analisados: ${snapshot.size}`);
    console.log(`✅ Com foto: ${comFoto} (${Math.round(comFoto/snapshot.size*100)}%)`);
    console.log(`   - Base64 (local): ${fotoBase64}`);
    console.log(`   - Firebase Storage: ${fotoStorage}`);
    console.log(`❌ Sem foto: ${semFoto} (${Math.round(semFoto/snapshot.size*100)}%)`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Erro ao verificar fotos:', error);
    process.exit(1);
  }
}

// Executa a verificação
verificarFotosSalvas()
  .then(() => {
    console.log('\n✅ Verificação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
