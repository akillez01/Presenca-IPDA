const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'reuniao-ministerial'
});

const db = admin.firestore();

async function investigateAttendanceDiscrepancy() {
  try {
    console.log('🕵️ INVESTIGAÇÃO: Discrepância nos registros de presença');
    console.log('📅 Data da investigação:', new Date().toLocaleString('pt-BR'));
    console.log('🎯 Problema: 400 registros feitos, mas só 80 aparecem');
    
    // 1. ANÁLISE COMPLETA POR DATA
    console.log('\n📊 FASE 1: ANÁLISE COMPLETA POR DATA');
    
    const attendanceCollection = db.collection('attendance');
    const allSnapshot = await attendanceCollection.get();
    
    console.log(`📋 Total de documentos na coleção: ${allSnapshot.size}`);
    
    // Agrupar por data
    const recordsByDate = {};
    const recordsToday = [];
    const recordsWithoutDate = [];
    
    const today = new Date('2025-10-19');
    const todayString = today.toDateString(); // "Sat Oct 19 2025"
    
    allSnapshot.forEach((doc) => {
      const data = doc.data();
      let recordDate = null;
      
      // Verificar diferentes campos de data
      if (data.timestamp && data.timestamp.toDate) {
        recordDate = data.timestamp.toDate();
      } else if (data.createdAt && data.createdAt.toDate) {
        recordDate = data.createdAt.toDate();
      } else if (data.date) {
        // Verificar se há campo 'date' como string
        recordDate = new Date(data.date);
      } else if (data.timestamp && typeof data.timestamp === 'string') {
        recordDate = new Date(data.timestamp);
      }
      
      if (recordDate && !isNaN(recordDate.getTime())) {
        const dateString = recordDate.toDateString();
        
        if (!recordsByDate[dateString]) {
          recordsByDate[dateString] = [];
        }
        recordsByDate[dateString].push({
          id: doc.id,
          data: data,
          recordDate: recordDate
        });
        
        // Se é de hoje
        if (dateString === todayString) {
          recordsToday.push({
            id: doc.id,
            name: data.fullName || data.nome || 'N/A',
            status: data.status || 'N/A',
            cpf: data.cpf || 'N/A',
            timestamp: recordDate,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
            hasTimestamp: !!data.timestamp,
            hasCreatedAt: !!data.createdAt,
            hasDateField: !!data.date
          });
        }
      } else {
        recordsWithoutDate.push({
          id: doc.id,
          data: data
        });
      }
    });
    
    console.log(`📅 Registros de hoje encontrados: ${recordsToday.length}`);
    console.log(`⚠️  Registros sem data válida: ${recordsWithoutDate.length}`);
    
    // 2. ANÁLISE POR PERÍODOS DE HOJE
    console.log('\n📊 FASE 2: ANÁLISE DETALHADA DE HOJE (19/10/2025)');
    
    // Agrupar por hora
    const hourlyBreakdown = {};
    recordsToday.forEach(record => {
      const hour = record.timestamp.getHours();
      if (!hourlyBreakdown[hour]) {
        hourlyBreakdown[hour] = [];
      }
      hourlyBreakdown[hour].push(record);
    });
    
    console.log('⏰ Distribuição por hora:');
    Object.keys(hourlyBreakdown).sort((a, b) => parseInt(a) - parseInt(b)).forEach(hour => {
      const count = hourlyBreakdown[hour].length;
      console.log(`   ${hour.padStart(2, '0')}:xx - ${count} registros`);
    });
    
    // 3. VERIFICAR DIFERENTES CRITÉRIOS DE BUSCA
    console.log('\n📊 FASE 3: TESTANDO DIFERENTES CRITÉRIOS DE BUSCA');
    
    // Busca por timestamp >= hoje 00:00
    const startOfDay = new Date('2025-10-19T00:00:00.000Z');
    const endOfDay = new Date('2025-10-19T23:59:59.999Z');
    
    const timestampQuery = attendanceCollection
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endOfDay));
    
    try {
      const timestampSnapshot = await timestampQuery.get();
      console.log(`🔍 Busca por timestamp (range): ${timestampSnapshot.size} registros`);
    } catch (error) {
      console.log(`❌ Erro na busca por timestamp: ${error.message}`);
    }
    
    // Busca por createdAt >= hoje 00:00
    try {
      const createdAtQuery = attendanceCollection
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endOfDay));
      
      const createdAtSnapshot = await createdAtQuery.get();
      console.log(`🔍 Busca por createdAt (range): ${createdAtSnapshot.size} registros`);
    } catch (error) {
      console.log(`❌ Erro na busca por createdAt: ${error.message}`);
    }
    
    // Busca por campo date como string
    try {
      const dateStringQuery = attendanceCollection.where('date', '==', '2025-10-19');
      const dateStringSnapshot = await dateStringQuery.get();
      console.log(`🔍 Busca por campo 'date' string: ${dateStringSnapshot.size} registros`);
    } catch (error) {
      console.log(`❌ Erro na busca por campo date: ${error.message}`);
    }
    
    // 4. ANÁLISE DOS REGISTROS MAIS RECENTES
    console.log('\n📊 FASE 4: ÚLTIMOS REGISTROS CRIADOS');
    
    try {
      const recentQuery = attendanceCollection
        .orderBy('timestamp', 'desc')
        .limit(20);
      
      const recentSnapshot = await recentQuery.get();
      console.log(`📋 Últimos 20 registros por timestamp:`);
      
      recentSnapshot.forEach((doc, index) => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : null;
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
        
        console.log(`${index + 1}. ${data.fullName || 'N/A'}`);
        console.log(`   Timestamp: ${timestamp ? timestamp.toLocaleString('pt-BR') : 'N/A'}`);
        console.log(`   CreatedAt: ${createdAt ? createdAt.toLocaleString('pt-BR') : 'N/A'}`);
        console.log(`   Status: ${data.status || 'N/A'}`);
        console.log('---');
      });
    } catch (error) {
      console.log(`❌ Erro ao buscar registros recentes: ${error.message}`);
    }
    
    // 5. ANÁLISE POR OUTRAS DATAS RECENTES
    console.log('\n📊 FASE 5: REGISTROS DE OUTROS DIAS RECENTES');
    
    const sortedDates = Object.keys(recordsByDate).sort((a, b) => {
      return new Date(b) - new Date(a);
    });
    
    console.log('📅 Top 10 datas com mais registros:');
    sortedDates.slice(0, 10).forEach((dateStr, index) => {
      const count = recordsByDate[dateStr].length;
      console.log(`${index + 1}. ${dateStr}: ${count} registros`);
    });
    
    // 6. VERIFICAR SE HÁ REGISTROS DUPLICADOS
    console.log('\n📊 FASE 6: VERIFICAÇÃO DE DUPLICAÇÃO');
    
    const cpfMap = {};
    let duplicates = 0;
    
    recordsToday.forEach(record => {
      const cpf = record.cpf;
      if (cpfMap[cpf]) {
        cpfMap[cpf].push(record);
        duplicates++;
      } else {
        cpfMap[cpf] = [record];
      }
    });
    
    console.log(`🔍 CPFs únicos hoje: ${Object.keys(cpfMap).length}`);
    console.log(`🔍 Registros duplicados: ${duplicates}`);
    
    if (duplicates > 0) {
      console.log('📋 Exemplos de CPFs duplicados:');
      Object.entries(cpfMap)
        .filter(([cpf, records]) => records.length > 1)
        .slice(0, 5)
        .forEach(([cpf, records]) => {
          console.log(`   CPF ${cpf}: ${records.length} registros`);
        });
    }
    
    // 7. VERIFICAR REGISTROS SEM TIMESTAMP
    console.log('\n📊 FASE 7: REGISTROS PROBLEMÁTICOS');
    
    if (recordsWithoutDate.length > 0) {
      console.log(`⚠️  ${recordsWithoutDate.length} registros sem data válida:`);
      recordsWithoutDate.slice(0, 5).forEach((record, index) => {
        console.log(`${index + 1}. ID: ${record.id}`);
        console.log(`   Nome: ${record.data.fullName || record.data.nome || 'N/A'}`);
        console.log(`   Timestamp raw: ${JSON.stringify(record.data.timestamp)}`);
        console.log(`   CreatedAt raw: ${JSON.stringify(record.data.createdAt)}`);
        console.log(`   Date field: ${record.data.date || 'N/A'}`);
        console.log('---');
      });
    }
    
    return {
      totalRecords: allSnapshot.size,
      todayRecords: recordsToday.length,
      recordsWithoutDate: recordsWithoutDate.length,
      duplicates: duplicates,
      dateBreakdown: Object.keys(recordsByDate).length
    };
    
  } catch (error) {
    console.error('❌ Erro na investigação:', error);
    throw error;
  }
}

investigateAttendanceDiscrepancy()
  .then((result) => {
    console.log(`\n🎯 RESUMO DA INVESTIGAÇÃO:`);
    console.log(`📊 Total de registros: ${result.totalRecords}`);
    console.log(`📅 Registros de hoje: ${result.todayRecords}`);
    console.log(`⚠️  Registros sem data: ${result.recordsWithoutDate}`);
    console.log(`🔄 Duplicados: ${result.duplicates}`);
    console.log(`📅 Datas diferentes: ${result.dateBreakdown}`);
    
    console.log(`\n🔍 POSSÍVEIS CAUSAS DA DISCREPÂNCIA:`);
    console.log(`1. Os 400 registros podem estar em datas diferentes`);
    console.log(`2. Pode haver registros sem timestamp válido`);
    console.log(`3. Os registros podem estar em coleções diferentes`);
    console.log(`4. Pode haver filtros na interface que estão escondendo dados`);
    console.log(`5. Os registros podem ter sido feitos em fusos horários diferentes`);
    
    if (result.todayRecords < 400) {
      console.log(`\n❗ AÇÃO NECESSÁRIA:`);
      console.log(`Foram encontrados apenas ${result.todayRecords} registros de hoje,`);
      console.log(`mas você mencionou 400 registros. Verifique:`);
      console.log(`- Se os registros foram feitos em outras datas`);
      console.log(`- Se há registros em outras coleções`);
      console.log(`- Se os timestamps estão corretos`);
    }
    
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Investigação falhou:', error);
    process.exit(1);
  });