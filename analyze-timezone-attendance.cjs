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

async function analyzeTimezoneIssues() {
  try {
    console.log('🕵️ ANÁLISE DE FUSO HORÁRIO E TIMESTAMPS');
    console.log('📅 Data da análise:', new Date().toLocaleString('pt-BR'));
    
    // 1. BUSCAR REGISTROS DE HOJE COM DIFERENTES CRITÉRIOS
    console.log('\n📊 FASE 1: REGISTROS DE HOJE COM DIFERENTES CRITÉRIOS');
    
    const attendanceCollection = db.collection('attendance');
    
    // Busca todos os registros de hoje - diferentes abordagens
    const now = new Date();
    const todayBR = new Date('2025-10-19'); // Data brasileira
    
    // Diferentes formatos de "hoje"
    const startOfDayUTC = new Date('2025-10-19T00:00:00.000Z'); // UTC
    const endOfDayUTC = new Date('2025-10-19T23:59:59.999Z');   // UTC
    
    const startOfDayBR = new Date('2025-10-19T03:00:00.000Z');  // BR = UTC-3
    const endOfDayBR = new Date('2025-10-20T02:59:59.999Z');    // BR = UTC-3
    
    console.log('🌍 Tentando diferentes fusos horários:');
    console.log(`UTC: ${startOfDayUTC.toISOString()} até ${endOfDayUTC.toISOString()}`);
    console.log(`BR:  ${startOfDayBR.toISOString()} até ${endOfDayBR.toISOString()}`);
    
    // Teste 1: Range UTC
    try {
      const utcQuery = attendanceCollection
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startOfDayUTC))
        .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endOfDayUTC));
      const utcSnapshot = await utcQuery.get();
      console.log(`🔍 Range UTC: ${utcSnapshot.size} registros`);
    } catch (error) {
      console.log(`❌ Erro UTC: ${error.message}`);
    }
    
    // Teste 2: Range Brasil
    try {
      const brQuery = attendanceCollection
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startOfDayBR))
        .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endOfDayBR));
      const brSnapshot = await brQuery.get();
      console.log(`🔍 Range Brasil: ${brSnapshot.size} registros`);
    } catch (error) {
      console.log(`❌ Erro Brasil: ${error.message}`);
    }
    
    // 2. ANALISAR OS ÚLTIMOS 100 REGISTROS PARA VER PADRÕES
    console.log('\n📊 FASE 2: ANÁLISE DOS ÚLTIMOS 100 REGISTROS');
    
    const recentQuery = attendanceCollection
      .orderBy('timestamp', 'desc')
      .limit(100);
    
    const recentSnapshot = await recentQuery.get();
    console.log(`📋 Analisando ${recentSnapshot.size} registros mais recentes`);
    
    const todayRecords = [];
    const otherRecords = [];
    
    recentSnapshot.forEach((doc, index) => {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : null;
      
      if (timestamp) {
        const timestampStr = timestamp.toISOString();
        const localTimeStr = timestamp.toLocaleString('pt-BR');
        const dateStr = timestamp.toDateString();
        
        const record = {
          id: doc.id,
          name: data.fullName || 'N/A',
          status: data.status || 'N/A',
          timestamp: timestamp,
          timestampISO: timestampStr,
          timestampLocal: localTimeStr,
          dateString: dateStr,
          isToday: timestampStr.startsWith('2025-10-19')
        };
        
        if (record.isToday) {
          todayRecords.push(record);
        } else {
          otherRecords.push(record);
        }
        
        // Mostrar os primeiros 10 registros detalhadamente
        if (index < 10) {
          console.log(`${index + 1}. ${record.name}`);
          console.log(`   ISO: ${record.timestampISO}`);
          console.log(`   Local: ${record.timestampLocal}`);
          console.log(`   É hoje? ${record.isToday ? '✅' : '❌'}`);
          console.log('---');
        }
      }
    });
    
    console.log(`\n📊 RESULTADOS DA ANÁLISE:`);
    console.log(`✅ Registros de hoje (19/10/2025): ${todayRecords.length}`);
    console.log(`📅 Registros de outras datas: ${otherRecords.length}`);
    
    // 3. VERIFICAR SE HÁ REGISTROS EM OUTRAS COLEÇÕES
    console.log('\n📊 FASE 3: VERIFICANDO OUTRAS COLEÇÕES');
    
    try {
      const collections = await db.listCollections();
      console.log('📋 Coleções encontradas:');
      
      for (const collection of collections) {
        const snapshot = await collection.limit(1).get();
        console.log(`   ${collection.id}: ${snapshot.size > 0 ? 'tem dados' : 'vazia'}`);
        
        // Se há outras coleções com "attendance" ou "presenca" no nome
        if (collection.id.includes('attendance') || 
            collection.id.includes('presenca') || 
            collection.id.includes('registro')) {
          const fullSnapshot = await collection.get();
          console.log(`   ⚠️  ${collection.id}: ${fullSnapshot.size} documentos`);
        }
      }
    } catch (error) {
      console.log(`❌ Erro ao listar coleções: ${error.message}`);
    }
    
    // 4. VERIFICAR ESTRUTURA DOS REGISTROS DE HOJE
    console.log('\n📊 FASE 4: ESTRUTURA DOS REGISTROS DE HOJE');
    
    if (todayRecords.length > 0) {
      console.log(`📋 Primeiros 5 registros de hoje:`);
      todayRecords.slice(0, 5).forEach((record, index) => {
        console.log(`${index + 1}. ${record.name}`);
        console.log(`   Timestamp: ${record.timestampLocal}`);
        console.log(`   Status: ${record.status}`);
        console.log('---');
      });
      
      // Verificar se há gaps de horário (pode indicar registros perdidos)
      const hours = todayRecords.map(r => r.timestamp.getHours()).sort((a, b) => a - b);
      const uniqueHours = [...new Set(hours)];
      console.log(`⏰ Horários com registros: ${uniqueHours.join(', ')}`);
      
      if (todayRecords.length === 81 && uniqueHours.length < 8) {
        console.log(`⚠️  SUSPEITA: Apenas ${uniqueHours.length} horas diferentes para 81 registros`);
        console.log(`   Isso pode indicar que há registros em lote ou automatizados`);
      }
    }
    
    // 5. BUSCAR EXATAMENTE PELOS 400 REGISTROS MENCIONADOS
    console.log('\n📊 FASE 5: BUSCANDO 400 REGISTROS ESPECÍFICOS');
    
    // Verificar se há aproximadamente 400 registros em qualquer data recente
    const last7Days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startDay = new Date(date);
      startDay.setHours(0, 0, 0, 0);
      const endDay = new Date(date);
      endDay.setHours(23, 59, 59, 999);
      
      try {
        const dayQuery = attendanceCollection
          .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDay))
          .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endDay));
        const daySnapshot = await dayQuery.get();
        
        const dateStr = date.toLocaleDateString('pt-BR');
        last7Days.push({
          date: dateStr,
          count: daySnapshot.size
        });
        
        console.log(`📅 ${dateStr}: ${daySnapshot.size} registros`);
      } catch (error) {
        console.log(`❌ Erro para ${date.toLocaleDateString('pt-BR')}: ${error.message}`);
      }
    }
    
    // Verificar se há cerca de 400 em algum dia
    const dayWith400 = last7Days.find(day => day.count >= 350);
    if (dayWith400) {
      console.log(`🎯 ENCONTRADO: ${dayWith400.date} tem ${dayWith400.count} registros`);
      console.log(`   Isso pode ser onde estão os 400 registros mencionados!`);
    }
    
    return {
      todayCount: todayRecords.length,
      totalRecent: recentSnapshot.size,
      possibleTarget: dayWith400
    };
    
  } catch (error) {
    console.error('❌ Erro na análise:', error);
    throw error;
  }
}

analyzeTimezoneIssues()
  .then((result) => {
    console.log(`\n🎯 CONCLUSÃO DA ANÁLISE:`);
    console.log(`📅 Registros de hoje encontrados: ${result.todayCount}`);
    console.log(`📊 Total de registros recentes analisados: ${result.totalRecent}`);
    
    if (result.possibleTarget) {
      console.log(`🔍 POSSÍVEL LOCALIZAÇÃO DOS 400 REGISTROS:`);
      console.log(`   Data: ${result.possibleTarget.date}`);
      console.log(`   Quantidade: ${result.possibleTarget.count}`);
    }
    
    if (result.todayCount < 400) {
      console.log(`\n💡 RECOMENDAÇÕES:`);
      console.log(`1. Os 400 registros podem estar em outra data`);
      console.log(`2. Verificar se há problema no fuso horário da aplicação`);
      console.log(`3. Verificar se os registros estão sendo salvos corretamente`);
      console.log(`4. Analisar os logs da interface para ver se há erros de gravação`);
    }
    
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Análise falhou:', error);
    process.exit(1);
  });