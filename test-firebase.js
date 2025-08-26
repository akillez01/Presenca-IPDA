#!/usr/bin/env node

// Script de teste para verificar se os dados do Firebase estão sendo carregados
const admin = require('firebase-admin');

try {
  // Inicializar Firebase Admin
  const serviceAccountPath = './reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json';
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });

  const db = admin.firestore();

  async function testFirebaseConnection() {
    console.log('🔥 Testando conexão com Firebase...');
    
    try {
      // Buscar registros de presença
      const attendanceRef = db.collection('attendance');
      const snapshot = await attendanceRef.limit(10).get();
      
      console.log(`📊 Total de registros encontrados: ${snapshot.size}`);
      
      if (snapshot.size > 0) {
        console.log('\n📋 Primeiros registros:');
        snapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`${index + 1}. ${data.fullName} - ${data.churchPosition} - ${data.status}`);
        });
      }

      // Verificar se há registros de hoje
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      
      const todaySnapshot = await attendanceRef
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
        .get();
      
      console.log(`\n📅 Registros de hoje: ${todaySnapshot.size}`);
      
      // Verificar registros dos últimos 7 dias
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekSnapshot = await attendanceRef
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(weekAgo))
        .get();
      
      console.log(`📈 Registros dos últimos 7 dias: ${weekSnapshot.size}`);
      
      console.log('\n✅ Teste concluído com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro ao acessar Firebase:', error);
    }
  }

  testFirebaseConnection().then(() => {
    process.exit(0);
  });

} catch (error) {
  console.error('❌ Erro na inicialização:', error);
  process.exit(1);
}
