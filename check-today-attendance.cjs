const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'reuniao-ministerial'
});

const db = admin.firestore();

async function checkTodayAttendance() {
  try {
    console.log('📅 Verificando presenças cadastradas hoje (19 de outubro de 2025)...');
    
    // Data de hoje
    const today = new Date('2025-10-19');
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log(`🕐 Buscando registros entre: ${startOfDay.toISOString()} e ${endOfDay.toISOString()}`);
    
    const attendanceCollection = db.collection('attendance');
    
    // Buscar por timestamp
    const timestampQuery = attendanceCollection
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endOfDay));
    
    const timestampSnapshot = await timestampQuery.get();
    
    // Buscar por createdAt também
    const createdAtQuery = attendanceCollection
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endOfDay));
    
    const createdAtSnapshot = await createdAtQuery.get();
    
    console.log(`📊 Registros encontrados por timestamp: ${timestampSnapshot.size}`);
    console.log(`📊 Registros encontrados por createdAt: ${createdAtSnapshot.size}`);
    
    // Verificar também os registros mais recentes
    const recentQuery = attendanceCollection
      .orderBy('timestamp', 'desc')
      .limit(10);
    
    const recentSnapshot = await recentQuery.get();
    
    console.log('\n📋 Últimos 10 registros por timestamp:');
    recentSnapshot.forEach((doc, index) => {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate();
      const createdAt = data.createdAt?.toDate();
      
      console.log(`${index + 1}. ID: ${doc.id}`);
      console.log(`   Nome: ${data.fullName || data.nome || 'N/A'}`);
      console.log(`   Timestamp: ${timestamp || 'N/A'}`);
      console.log(`   CreatedAt: ${createdAt || 'N/A'}`);
      console.log(`   Status: ${data.status || 'N/A'}`);
      console.log('---');
    });
    
    // Buscar por data string também (se existir campo de data)
    console.log('\n🔍 Verificando registros por data string...');
    const todayString = '2025-10-19';
    const dateStringQuery = attendanceCollection.where('date', '==', todayString);
    const dateStringSnapshot = await dateStringQuery.get();
    console.log(`📊 Registros com data string '${todayString}': ${dateStringSnapshot.size}`);
    
    // Estatísticas gerais
    const totalSnapshot = await attendanceCollection.get();
    console.log(`\n📈 RESUMO GERAL:`);
    console.log(`   Total de registros no sistema: ${totalSnapshot.size}`);
    console.log(`   Registros de hoje (timestamp): ${timestampSnapshot.size}`);
    console.log(`   Registros de hoje (createdAt): ${createdAtSnapshot.size}`);
    console.log(`   Registros de hoje (data string): ${dateStringSnapshot.size}`);
    
  } catch (error) {
    console.error('❌ Erro ao verificar presenças:', error);
    throw error;
  }
}

checkTodayAttendance()
  .then(() => {
    console.log('\n✅ Verificação concluída!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Verificação falhou:', error);
    process.exit(1);
  });