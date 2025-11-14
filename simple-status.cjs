const admin = require('firebase-admin');
const fs = require('fs');

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync('./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function simpleStatus() {
  try {
    console.log('⚡ Análise rápida...\n');

    // Pegar uma amostra pequena e analisar
    const sample = await db.collection('attendance').limit(50).get();
    
    let presentes = 0;
    let ausentes = 0;
    let justificados = 0;
    let outros = 0;
    
    sample.docs.forEach(doc => {
      const data = doc.data();
      switch(data.status) {
        case 'Presente': presentes++; break;
        case 'Ausente': ausentes++; break;
        case 'Justificado': justificados++; break;
        default: outros++; break;
      }
    });

    console.log(`📊 Amostra de ${sample.size} registros:`);
    console.log(`   ✅ Presentes: ${presentes}`);
    console.log(`   ❌ Ausentes: ${ausentes}`);
    console.log(`   📝 Justificados: ${justificados}`);
    console.log(`   ❓ Outros: ${outros}`);
    
    const taxaAmostra = sample.size > 0 ? Math.round((presentes / sample.size) * 100) : 0;
    console.log(`   📈 Taxa na amostra: ${taxaAmostra}%`);

    // Se extrapolamos para 1803 registros
    const estimativaPresentes = Math.round((presentes / sample.size) * 1803);
    const estimativaTaxa = Math.round((estimativaPresentes / 1803) * 100);
    
    console.log(`\n🔮 Estimativa para todos os 1803 registros:`);
    console.log(`   ✅ Presentes estimados: ${estimativaPresentes}`);
    console.log(`   📈 Taxa estimada: ${estimativaTaxa}%`);

    console.log(`\n🎯 COMPARAÇÃO COM FRONTEND:`);
    console.log(`   Frontend diz: 1800 registros hoje, 97% presença`);
    console.log(`   Realidade: 1803 registros, ~${estimativaTaxa}% presença`);
    
    if (estimativaTaxa !== 97) {
      console.log(`\n❗ DISCREPÂNCIA: Frontend mostra 97% mas calculamos ~${estimativaTaxa}%`);
      
      // Vamos ver se 97% de 1800 = 1746 presentes
      const presentesFrontend = Math.round(1800 * 0.97);
      console.log(`   📊 Se frontend está certo: ${presentesFrontend} presentes de 1800`);
      console.log(`   📊 Nossa estimativa: ${estimativaPresentes} presentes de 1803`);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    process.exit(0);
  }
}

simpleStatus();
