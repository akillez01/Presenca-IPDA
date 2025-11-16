#!/usr/bin/env node

/**
 * Script simples para verificar fotos no Firestore
 * Usa a API REST do Firestore (não precisa de credenciais Admin)
 */

const https = require('https');

const PROJECT_ID = 'reuniao-ministerial';

function getFirestoreData() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/attendance?pageSize=5`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Status: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function testPhotos() {
  console.log('🧪 VERIFICAÇÃO DE FOTOS NO FIRESTORE\n');
  console.log('=' .repeat(60));
  
  try {
    console.log('📡 Conectando ao Firestore...\n');
    
    const data = await getFirestoreData();
    
    if (!data.documents || data.documents.length === 0) {
      console.log('❌ Nenhum registro encontrado');
      console.log('\n📝 AÇÃO:');
      console.log('   1. Acesse: http://localhost:9002/register');
      console.log('   2. Faça um cadastro com foto');
      console.log('   3. Execute este script novamente');
      return;
    }
    
    console.log(`✅ Encontrados ${data.documents.length} registros recentes\n`);
    
    let storageCount = 0;
    let base64Count = 0;
    let noPhotoCount = 0;
    
    data.documents.forEach((doc, index) => {
      const fields = doc.fields || {};
      const nome = fields.fullName?.stringValue || 'Sem nome';
      const photoUrl = fields.photoUrl?.stringValue;
      const docId = doc.name.split('/').pop();
      
      console.log(`\n${index + 1}. ${nome} (${docId})`);
      
      if (!photoUrl) {
        console.log('   ❌ Sem foto');
        noPhotoCount++;
      } else if (photoUrl.startsWith('https://firebasestorage')) {
        console.log('   ✅ Foto no Firebase Storage');
        console.log(`   📍 URL: ${photoUrl.substring(0, 60)}...`);
        storageCount++;
      } else if (photoUrl.startsWith('data:image/')) {
        const sizeKB = Math.round(photoUrl.length / 1024);
        console.log('   ⚠️  Foto em base64 (fallback)');
        console.log(`   💾 Tamanho: ${sizeKB} KB`);
        base64Count++;
      } else {
        console.log('   ❓ Formato desconhecido');
        noPhotoCount++;
      }
    });
    
    // Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO:');
    console.log('='.repeat(60));
    console.log(`Total de registros: ${data.documents.length}`);
    console.log(`☁️  No Firebase Storage: ${storageCount}`);
    console.log(`💾 Em base64 (fallback): ${base64Count}`);
    console.log(`❌ Sem foto: ${noPhotoCount}`);
    console.log('='.repeat(60));
    
    // Conclusão
    console.log('\n📝 ANÁLISE:\n');
    
    if (storageCount > 0) {
      console.log('✅ EXCELENTE! Fotos no Firebase Storage');
      console.log('   → Implementação otimizada funcionando');
      console.log('   → URLs curtas no Firestore');
      console.log('   → Performance máxima');
    } else if (base64Count > 0) {
      console.log('⚠️  ATENÇÃO! Usando fallback base64');
      console.log('   → Firebase Storage pode não estar configurado');
      console.log('   → Ou regras de segurança bloqueando');
      console.log('\n🔧 PRÓXIMO PASSO:');
      console.log('   Execute: firebase deploy --only storage');
    } else {
      console.log('📝 Nenhuma foto encontrada nos registros recentes');
      console.log('   Faça um novo cadastro com foto');
    }
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    
    if (error.message.includes('403')) {
      console.log('\n⚠️  Erro de permissão - Firestore Rules podem estar bloqueando');
    } else if (error.message.includes('404')) {
      console.log('\n⚠️  Collection não encontrada - faça um cadastro primeiro');
    }
  }
}

// Executa
testPhotos()
  .then(() => {
    console.log('\n✅ Verificação concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  });
