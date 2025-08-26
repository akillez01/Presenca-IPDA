const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function testeConexao() {
  try {
    const db = admin.firestore();
    console.log("✅ Conectando ao Firebase...");
    
    const snapshot = await db.collection('attendance').limit(5).get();
    console.log("📊 Total de documentos encontrados:", snapshot.docs.length);
    
    if (snapshot.docs.length > 0) {
      console.log("📋 Exemplo de documento:");
      const primeiroDoc = snapshot.docs[0];
      console.log("   ID:", primeiroDoc.id);
      
      const data = primeiroDoc.data();
      console.log("   Nome:", data.fullName);
      console.log("   Status:", data.status);
      console.log("   Timestamp:", data.timestamp ? data.timestamp.toDate().toISOString() : 'N/A');
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error.message);
    process.exit(1);
  }
}

testeConexao();
