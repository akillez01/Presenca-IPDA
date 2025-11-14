const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'reuniao-ministerial'
});

const db = admin.firestore();

async function countTodayAttendanceFinal() {
  try {
    console.log('📅 Contando presenças de HOJE (19 de outubro de 2025)...');
    
    // Data atual do sistema
    const today = new Date();
    const todayString = today.toDateString(); // Exemplo: "Sun Oct 19 2025"
    
    console.log(`📅 Data de hoje: ${todayString}`);
    console.log(`🕐 Horário atual: ${today.toLocaleString('pt-BR')}`);
    
    // Buscar todos os registros
    const attendanceCollection = db.collection('attendance');
    const allSnapshot = await attendanceCollection.get();
    
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
        const recordDateString = recordDate.toDateString();
        
        // Verificar se é de hoje
        if (recordDateString === todayString) {
          todayCount++;
          todayRecords.push({
            id: doc.id,
            name: data.fullName || data.nome || 'N/A',
            status: data.status || 'N/A',
            timestamp: recordDate,
            cpf: data.cpf || 'N/A',
            region: data.region || data.regiao || 'N/A',
            reclassification: data.reclassification || data.reclassificacao || 'N/A'
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
    
    // Ordenar por horário (mais recente primeiro)
    todayRecords.sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`\n🎯 RESULTADO: ${todayCount} presenças cadastradas hoje!`);
    
    console.log(`\n📊 ESTATÍSTICAS POR STATUS:`);
    console.log(`   ✅ Presente: ${statusCount.Presente}`);
    console.log(`   ❌ Falta: ${statusCount.Falta}`);
    console.log(`   📝 Justificado: ${statusCount.Justificado}`);
    console.log(`   ❓ Outros: ${statusCount.Outros}`);
    
    // Calcular percentual de presença
    const totalComStatus = statusCount.Presente + statusCount.Falta + statusCount.Justificado;
    const percentualPresenca = totalComStatus > 0 ? ((statusCount.Presente / totalComStatus) * 100).toFixed(1) : 0;
    
    console.log(`\n📈 PERCENTUAL DE PRESENÇA: ${percentualPresenca}%`);
    
    console.log(`\n📋 ÚLTIMOS 15 REGISTROS DE HOJE:`);
    todayRecords.slice(0, 15).forEach((record, index) => {
      console.log(`${index + 1}. ${record.name}`);
      console.log(`   Status: ${record.status}`);
      console.log(`   CPF: ${record.cpf}`);
      console.log(`   Região: ${record.region}`);
      console.log(`   Reclassificação: ${record.reclassification}`);
      console.log(`   Horário: ${record.timestamp.toLocaleString('pt-BR')}`);
      console.log('---');
    });
    
    if (todayRecords.length > 15) {
      console.log(`... e mais ${todayRecords.length - 15} registros.`);
    }
    
    // Análise por região (top 5)
    const regionCount = {};
    todayRecords.forEach(record => {
      const region = record.region;
      regionCount[region] = (regionCount[region] || 0) + 1;
    });
    
    const topRegions = Object.entries(regionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    console.log(`\n🌍 TOP 5 REGIÕES COM MAIS PRESENÇAS HOJE:`);
    topRegions.forEach((region, index) => {
      console.log(`${index + 1}. ${region[0]}: ${region[1]} pessoas`);
    });
    
    return {
      total: todayCount,
      statusCount: statusCount,
      records: todayRecords,
      percentualPresenca: percentualPresenca
    };
    
  } catch (error) {
    console.error('❌ Erro ao contar presenças:', error);
    throw error;
  }
}

countTodayAttendanceFinal()
  .then((result) => {
    console.log(`\n✅ RESUMO FINAL:`);
    console.log(`📊 Total de presenças hoje: ${result.total}`);
    console.log(`📈 Percentual de presença: ${result.percentualPresenca}%`);
    console.log(`🕐 Consulta realizada em: ${new Date().toLocaleString('pt-BR')}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Contagem falhou:', error);
    process.exit(1);
  });