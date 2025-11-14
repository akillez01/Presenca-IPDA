const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'reuniao-ministerial'
});

const db = admin.firestore();

async function countTodayAttendanceCorrectly() {
  try {
    console.log('📅 Contando presenças de hoje (19 de outubro de 2025) - Versão Corrigida...');
    
    // Buscar todos os registros e filtrar por data
    const attendanceCollection = db.collection('attendance');
    const allSnapshot = await attendanceCollection.get();
    
    const today = new Date('2025-10-19');
    let todayCount = 0;
    let todayRecords = [];
    let statusCount = {
      'Presente': 0,
      'Falta': 0,
      'Justificado': 0,
      'Outros': 0
    };
    
    console.log(`📊 Analisando ${allSnapshot.size} registros totais...`);
    
    allSnapshot.forEach((doc) => {
      const data = doc.data();
      let recordDate = null;
      
      // Verificar timestamp
      if (data.timestamp && data.timestamp.toDate) {
        recordDate = data.timestamp.toDate();
      } else if (data.createdAt && data.createdAt.toDate) {
        recordDate = data.createdAt.toDate();
      }
      
      if (recordDate) {
        // Verificar se é de hoje (19/10/2025)
        const recordDateStr = recordDate.toDateString();
        const todayStr = today.toDateString();
        
        if (recordDateStr === todayStr) {
          todayCount++;
          todayRecords.push({
            id: doc.id,
            name: data.fullName || data.nome || 'N/A',
            status: data.status || 'N/A',
            timestamp: recordDate,
            cpf: data.cpf || 'N/A',
            region: data.region || data.regiao || 'N/A'
          });
          
          // Contar por status
          const status = data.status || 'Outros';
          if (statusCount[status] !== undefined) {
            statusCount[status]++;
          } else {
            statusCount['Outros']++;
          }
        }
      }
    });
    
    console.log(`\n🎯 RESULTADO: ${todayCount} presenças cadastradas hoje!`);
    
    console.log(`\n📊 ESTATÍSTICAS POR STATUS:`);
    console.log(`   ✅ Presente: ${statusCount.Presente}`);
    console.log(`   ❌ Falta: ${statusCount.Falta}`);
    console.log(`   📝 Justificado: ${statusCount.Justificado}`);
    console.log(`   ❓ Outros: ${statusCount.Outros}`);
    
    console.log(`\n📋 REGISTROS DE HOJE (primeiros 10):`);
    todayRecords.slice(0, 10).forEach((record, index) => {
      console.log(`${index + 1}. ${record.name}`);
      console.log(`   Status: ${record.status}`);
      console.log(`   CPF: ${record.cpf}`);
      console.log(`   Região: ${record.region}`);
      console.log(`   Horário: ${record.timestamp.toLocaleString('pt-BR')}`);
      console.log('---');
    });
    
    if (todayRecords.length > 10) {
      console.log(`... e mais ${todayRecords.length - 10} registros.`);
    }
    
    return {
      total: todayCount,
      statusCount: statusCount,
      records: todayRecords
    };
    
  } catch (error) {
    console.error('❌ Erro ao contar presenças:', error);
    throw error;
  }
}

countTodayAttendanceCorrectly()
  .then((result) => {
    console.log(`\n✅ Contagem concluída! Total de presenças hoje: ${result.total}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Contagem falhou:', error);
    process.exit(1);
  });