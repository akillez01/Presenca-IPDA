const admin = require('firebase-admin');

// Inicializar Firebase Admin SDK
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function consultaSimples() {
  try {
    console.log('=== CONSULTA SIMPLES DOS DADOS ===');
    
    // Buscar apenas os primeiros documentos sem ordenação complexa
    const snapshot = await db.collection('attendance').limit(10).get();

    if (snapshot.empty) {
      console.log('Nenhum registro encontrado na coleção "attendance"');
      return;
    }

    console.log(`Total de documentos encontrados: ${snapshot.size}`);
    console.log('\n=== REGISTROS ===');

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\nID: ${doc.id}`);
      console.log(`Nome: ${data.fullName || 'N/A'}`);
      console.log(`CPF: ${data.cpf || 'N/A'}`);
      console.log(`Status: ${data.status || 'Presente'}`);
      console.log(`Região: ${data.region || 'N/A'}`);
      if (data.timestamp && data.timestamp.toDate) {
        console.log(`Data: ${data.timestamp.toDate().toLocaleString('pt-BR')}`);
      } else if (data.timestamp) {
        console.log(`Data: ${new Date(data.timestamp).toLocaleString('pt-BR')}`);
      }
      if (data.absentReason) {
        console.log(`Justificativa: ${data.absentReason}`);
      }
      console.log('---');
    });

    // Contar total de documentos
    const totalSnapshot = await db.collection('attendance').get();
    console.log(`\n📊 TOTAL GERAL: ${totalSnapshot.size} registros na base de dados`);

  } catch (error) {
    console.error('Erro na consulta:', error);
  } finally {
    process.exit(0);
  }
}

consultaSimples();
