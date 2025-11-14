const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'reuniao-ministerial'
  });
}

const db = admin.firestore();

async function findMissingRecords() {
  try {
    console.log('🔍 PROCURANDO OS 319 REGISTROS PERDIDOS (400 - 81)');
    console.log('📅 Data da busca:', new Date().toLocaleString('pt-BR'));
    
    // 1. BUSCAR EM TODAS AS DATAS DO OUTUBRO 2025
    console.log('\n📊 FASE 1: BUSCA COMPLETA EM OUTUBRO 2025');
    
    const attendanceCollection = db.collection('attendance');
    
    // Buscar todo outubro 2025
    const startOct = new Date('2025-10-01T00:00:00.000Z');
    const endOct = new Date('2025-10-31T23:59:59.999Z');
    
    const octQuery = attendanceCollection
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startOct))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endOct));
    
    const octSnapshot = await octQuery.get();
    console.log(`📅 Total em outubro 2025: ${octSnapshot.size} registros`);
    
    // Agrupar por dia
    const dailyBreakdown = {};
    
    octSnapshot.forEach((doc) => {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : null;
      
      if (timestamp) {
        const dayKey = timestamp.toLocaleDateString('pt-BR');
        if (!dailyBreakdown[dayKey]) {
          dailyBreakdown[dayKey] = [];
        }
        dailyBreakdown[dayKey].push({
          id: doc.id,
          name: data.fullName || 'N/A',
          status: data.status || 'N/A',
          timestamp: timestamp
        });
      }
    });
    
    console.log('\n📊 REGISTROS POR DIA EM OUTUBRO:');
    Object.entries(dailyBreakdown)
      .sort(([a], [b]) => new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')))
      .forEach(([day, records]) => {
        console.log(`📅 ${day}: ${records.length} registros`);
        
        // Se há mais de 300 registros em um dia, mostrar detalhes
        if (records.length > 300) {
          console.log(`   ⚠️  ATENÇÃO: Possível localização dos 400 registros!`);
          const hourlyCount = {};
          records.forEach(record => {
            const hour = record.timestamp.getHours();
            hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
          });
          console.log(`   ⏰ Distribuição por hora: ${JSON.stringify(hourlyCount)}`);
        }
      });
    
    // 2. VERIFICAR SE HÁ REGISTROS DUPLICADOS OCULTOS
    console.log('\n📊 FASE 2: ANÁLISE DE POSSÍVEIS DUPLICAÇÕES');
    
    // Buscar registros de hoje detalhadamente
    const todayStart = new Date('2025-10-19T00:00:00.000Z');
    const todayEnd = new Date('2025-10-19T23:59:59.999Z');
    
    const todayQuery = attendanceCollection
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(todayStart))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(todayEnd));
    
    const todaySnapshot = await todayQuery.get();
    console.log(`📅 Registros confirmados de hoje: ${todaySnapshot.size}`);
    
    const todayRecords = [];
    const cpfCounts = {};
    const nameCounts = {};
    
    todaySnapshot.forEach((doc) => {
      const data = doc.data();
      const record = {
        id: doc.id,
        name: data.fullName || 'N/A',
        cpf: data.cpf || 'N/A',
        status: data.status || 'N/A',
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : null,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null
      };
      
      todayRecords.push(record);
      
      // Contar por CPF
      cpfCounts[record.cpf] = (cpfCounts[record.cpf] || 0) + 1;
      
      // Contar por nome
      nameCounts[record.name] = (nameCounts[record.name] || 0) + 1;
    });
    
    // Verificar duplicações
    const duplicatedCpfs = Object.entries(cpfCounts).filter(([cpf, count]) => count > 1);
    const duplicatedNames = Object.entries(nameCounts).filter(([name, count]) => count > 1);
    
    console.log(`🔄 CPFs duplicados: ${duplicatedCpfs.length}`);
    console.log(`🔄 Nomes duplicados: ${duplicatedNames.length}`);
    
    if (duplicatedCpfs.length > 0) {
      console.log('\n📋 Exemplos de CPFs duplicados:');
      duplicatedCpfs.slice(0, 5).forEach(([cpf, count]) => {
        console.log(`   CPF ${cpf}: ${count} vezes`);
      });
    }
    
    // 3. VERIFICAR REGISTROS MUITO RECENTES (ÚLTIMA HORA)
    console.log('\n📊 FASE 3: REGISTROS DA ÚLTIMA HORA');
    
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    const recentQuery = attendanceCollection
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(oneHourAgo));
    
    const recentSnapshot = await recentQuery.get();
    console.log(`⏰ Registros da última hora: ${recentSnapshot.size}`);
    
    if (recentSnapshot.size > 0) {
      console.log('📋 Registros mais recentes:');
      recentSnapshot.forEach((doc, index) => {
        if (index < 10) { // Mostrar apenas os 10 mais recentes
          const data = doc.data();
          const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : null;
          console.log(`${index + 1}. ${data.fullName || 'N/A'} - ${timestamp ? timestamp.toLocaleTimeString('pt-BR') : 'N/A'}`);
        }
      });
    }
    
    // 4. COMPARAR COM DADOS DO CONSOLE FIREBASE
    console.log('\n📊 FASE 4: VERIFICAÇÃO DE INTEGRIDADE');
    
    // Contar registros totais
    const allSnapshot = await attendanceCollection.get();
    console.log(`📊 Total geral na coleção: ${allSnapshot.size}`);
    
    // Verificar se há registros sem timestamp
    let recordsWithoutTimestamp = 0;
    let recordsWithInvalidData = 0;
    
    allSnapshot.forEach((doc) => {
      const data = doc.data();
      
      if (!data.timestamp || !data.timestamp.toDate) {
        recordsWithoutTimestamp++;
      }
      
      if (!data.fullName && !data.nome) {
        recordsWithInvalidData++;
      }
    });
    
    console.log(`⚠️  Registros sem timestamp válido: ${recordsWithoutTimestamp}`);
    console.log(`⚠️  Registros com dados inválidos: ${recordsWithInvalidData}`);
    
    // 5. HIPÓTESE: VERIFICAR SE OS 400 REGISTROS SÃO UMA SOMA DE MÚLTIPLOS DIAS
    console.log('\n📊 FASE 5: VERIFICANDO SOMA DE MÚLTIPLOS DIAS');
    
    const last30Days = [];
    let totalLast30 = 0;
    
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      try {
        const dayQuery = attendanceCollection
          .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(dayStart))
          .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(dayEnd));
        const daySnapshot = await dayQuery.get();
        
        const count = daySnapshot.size;
        totalLast30 += count;
        
        if (count > 0) {
          last30Days.push({
            date: date.toLocaleDateString('pt-BR'),
            count: count
          });
        }
      } catch (error) {
        // Ignorar erros de dias específicos
      }
    }
    
    console.log(`📊 Total dos últimos 30 dias: ${totalLast30}`);
    console.log('📅 Dias com registros:');
    last30Days.forEach(day => {
      console.log(`   ${day.date}: ${day.count} registros`);
    });
    
    // Verificar se 400 é aproximadamente a soma de alguns dias
    if (totalLast30 >= 350 && totalLast30 <= 450) {
      console.log(`🎯 POSSÍVEL EXPLICAÇÃO: Os 400 registros podem ser a soma dos últimos dias!`);
    }
    
    return {
      todayRecords: todaySnapshot.size,
      totalRecords: allSnapshot.size,
      octoberRecords: octSnapshot.size,
      recentRecords: recentSnapshot.size,
      totalLast30: totalLast30,
      duplicatedCpfs: duplicatedCpfs.length,
      recordsWithoutTimestamp: recordsWithoutTimestamp
    };
    
  } catch (error) {
    console.error('❌ Erro na busca:', error);
    throw error;
  }
}

findMissingRecords()
  .then((result) => {
    console.log(`\n🎯 RESUMO FINAL DA INVESTIGAÇÃO:`);
    console.log(`📅 Registros de hoje (19/10): ${result.todayRecords}`);
    console.log(`📅 Registros em outubro: ${result.octoberRecords}`);
    console.log(`📅 Registros da última hora: ${result.recentRecords}`);
    console.log(`📅 Total últimos 30 dias: ${result.totalLast30}`);
    console.log(`📊 Total geral: ${result.totalRecords}`);
    console.log(`🔄 CPFs duplicados hoje: ${result.duplicatedCpfs}`);
    console.log(`⚠️  Registros sem timestamp: ${result.recordsWithoutTimestamp}`);
    
    console.log(`\n💭 POSSÍVEIS EXPLICAÇÕES PARA A DIFERENÇA:`);
    console.log(`1. Os 400 registros são de múltiplos dias somados`);
    console.log(`2. Há registros sendo criados mas não aparecendo na busca`);
    console.log(`3. Há problema na interface que está mostrando número errado`);
    console.log(`4. Os registros estão sendo criados com timestamps incorretos`);
    console.log(`5. Há registros duplicados que estão sendo contados múltiplas vezes`);
    
    if (result.totalLast30 >= 350 && result.totalLast30 <= 450) {
      console.log(`\n✅ MAIS PROVÁVEL: Os "400 registros" são na verdade a soma dos últimos dias!`);
    } else if (result.todayRecords < 400) {
      console.log(`\n❗ PROBLEMA CONFIRMADO: Há ${400 - result.todayRecords} registros não encontrados de hoje.`);
    }
    
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Investigação falhou:', error);
    process.exit(1);
  });