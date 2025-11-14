const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'reuniao-ministerial'
});

const db = admin.firestore();

async function backupTodayData() {
  try {
    console.log('🔒 BACKUP DE SEGURANÇA - Dados de hoje (19/10/2025)');
    console.log('📅 Data/hora do backup:', new Date().toLocaleString('pt-BR'));
    
    // Buscar todos os registros
    const attendanceCollection = db.collection('attendance');
    const allSnapshot = await attendanceCollection.get();
    
    const today = new Date();
    const todayString = today.toDateString(); // "Sun Oct 19 2025"
    
    let todayRecords = [];
    let totalRecords = 0;
    
    console.log(`📊 Analisando ${allSnapshot.size} registros totais...`);
    
    allSnapshot.forEach((doc) => {
      totalRecords++;
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
        
        // Se é de hoje, adicionar ao backup
        if (recordDateString === todayString) {
          todayRecords.push({
            id: doc.id,
            data: {
              ...data,
              // Converter timestamps para strings para o backup
              timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
              lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate().toISOString() : data.lastUpdated,
            }
          });
        }
      }
    });
    
    console.log(`🎯 BACKUP COMPLETO:`);
    console.log(`📊 Total de registros no sistema: ${totalRecords}`);
    console.log(`📅 Registros de hoje: ${todayRecords.length}`);
    
    // Salvar backup em arquivo
    const fs = require('fs');
    const backupFilename = `backup-attendance-${new Date().toISOString().split('T')[0]}.json`;
    
    const backupData = {
      backupDate: new Date().toISOString(),
      targetDate: today.toISOString().split('T')[0],
      totalRecordsInSystem: totalRecords,
      todayRecordsCount: todayRecords.length,
      records: todayRecords
    };
    
    fs.writeFileSync(backupFilename, JSON.stringify(backupData, null, 2));
    console.log(`💾 Backup salvo em: ${backupFilename}`);
    
    // Mostrar estatísticas dos dados de hoje
    console.log(`\n📊 ESTATÍSTICAS DOS DADOS DE HOJE:`);
    
    const statusCount = {};
    const regionCount = {};
    
    todayRecords.forEach(record => {
      const status = record.data.status || 'Sem status';
      const region = record.data.region || 'Sem região';
      
      statusCount[status] = (statusCount[status] || 0) + 1;
      regionCount[region] = (regionCount[region] || 0) + 1;
    });
    
    console.log('\n📈 Por Status:');
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    
    console.log('\n🌍 Top 5 Regiões:');
    const topRegions = Object.entries(regionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    topRegions.forEach(([region, count]) => {
      console.log(`   ${region}: ${count}`);
    });
    
    // Verificar integridade dos dados
    console.log(`\n🔍 VERIFICAÇÃO DE INTEGRIDADE:`);
    
    const recordsWithoutName = todayRecords.filter(r => !r.data.fullName || r.data.fullName.trim() === '');
    const recordsWithoutCPF = todayRecords.filter(r => !r.data.cpf || r.data.cpf.trim() === '');
    const recordsWithoutStatus = todayRecords.filter(r => !r.data.status || r.data.status.trim() === '');
    
    console.log(`✅ Registros com nome: ${todayRecords.length - recordsWithoutName.length}/${todayRecords.length}`);
    console.log(`✅ Registros com CPF: ${todayRecords.length - recordsWithoutCPF.length}/${todayRecords.length}`);
    console.log(`✅ Registros com status: ${todayRecords.length - recordsWithoutStatus.length}/${todayRecords.length}`);
    
    if (recordsWithoutName.length > 0) {
      console.log(`⚠️  ${recordsWithoutName.length} registros SEM NOME`);
    }
    if (recordsWithoutCPF.length > 0) {
      console.log(`⚠️  ${recordsWithoutCPF.length} registros SEM CPF`);
    }
    if (recordsWithoutStatus.length > 0) {
      console.log(`⚠️  ${recordsWithoutStatus.length} registros SEM STATUS`);
    }
    
    return {
      success: true,
      backupFile: backupFilename,
      todayRecordsCount: todayRecords.length,
      totalRecords: totalRecords
    };
    
  } catch (error) {
    console.error('❌ Erro ao fazer backup:', error);
    throw error;
  }
}

backupTodayData()
  .then((result) => {
    console.log(`\n✅ BACKUP CONCLUÍDO COM SUCESSO!`);
    console.log(`📁 Arquivo: ${result.backupFile}`);
    console.log(`📊 Registros de hoje: ${result.todayRecordsCount}`);
    console.log(`🗄️  Total no sistema: ${result.totalRecords}`);
    console.log(`\n🔒 SEGURANÇA GARANTIDA: Os dados estão protegidos durante o build!`);
    console.log(`\n📝 NOTA IMPORTANTE:`);
    console.log(`O build do Next.js é apenas uma compilação do código frontend.`);
    console.log(`Os dados do Firebase permanecem seguros no banco de dados na nuvem.`);
    console.log(`O processo de build NÃO afeta os dados registrados.`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Backup falhou:', error);
    process.exit(1);
  });