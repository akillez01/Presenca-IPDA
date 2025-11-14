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

async function quickCheck() {
  try {
    console.log('🚀 Verificação rápida dos dados...\n');

    // Apenas contar registros totais
    console.log('📊 Contando registros totais...');
    const snapshot = await db.collection('attendance').limit(10).get();
    console.log(`✅ Primeiros 10 registros encontrados: ${snapshot.size}`);
    
    // Mostrar alguns exemplos
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`   ${index + 1}. ${data.fullName} - ${data.status || 'sem status'} - ${data.timestamp?.toDate?.()?.toLocaleDateString('pt-BR') || 'sem data'}`);
    });

    // Contar total (estimativa)
    console.log('\n📈 Obtendo contagem total...');
    const totalSnapshot = await db.collection('attendance').count().get();
    console.log(`📊 Total de registros: ${totalSnapshot.data().count}`);

    console.log('\n✅ Verificação concluída!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    process.exit(0);
  }
}

quickCheck();
