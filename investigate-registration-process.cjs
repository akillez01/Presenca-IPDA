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

async function investigateRegistrationProcess() {
  try {
    console.log('🔍 INVESTIGAÇÃO DO PROCESSO DE REGISTRO');
    console.log('📅 Data:', new Date().toLocaleString('pt-BR'));
    
    // 1. VERIFICAR REGISTROS RECENTES E PADRÕES
    console.log('\n📊 FASE 1: ANÁLISE DE REGISTROS RECENTES');
    
    const attendanceCollection = db.collection('attendance');
    
    // Buscar últimos 20 registros
    const recentQuery = attendanceCollection
      .orderBy('timestamp', 'desc')
      .limit(20);
    
    const recentSnapshot = await recentQuery.get();
    console.log(`📋 Últimos ${recentSnapshot.size} registros:`);
    
    const last4Hours = new Date();
    last4Hours.setHours(last4Hours.getHours() - 4);
    
    let recentCount = 0;
    const recentRegistrations = [];
    
    recentSnapshot.forEach((doc, index) => {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : null;
      
      if (timestamp && timestamp > last4Hours) {
        recentCount++;
        recentRegistrations.push({
          id: doc.id,
          name: data.fullName,
          cpf: data.cpf,
          timestamp: timestamp,
          method: data.registrationMethod || 'manual'
        });
      }
      
      if (index < 10) {
        console.log(`${index + 1}. ${data.fullName} - ${timestamp ? timestamp.toLocaleString('pt-BR') : 'N/A'}`);
      }
    });
    
    console.log(`\n⏰ Registros das últimas 4 horas: ${recentCount}`);
    
    // 2. VERIFICAR SE HÁ TENTATIVAS DE DUPLICAÇÃO FALHANDO
    console.log('\n📊 FASE 2: ANÁLISE DE DUPLICAÇÃO DE CPF');
    
    // Mapear todos os CPFs
    const allSnapshot = await attendanceCollection.get();
    const cpfMap = {};
    const duplicatedCpfs = [];
    
    allSnapshot.forEach((doc) => {
      const data = doc.data();
      const cpf = data.cpf?.replace(/\D/g, '');
      
      if (cpf) {
        if (cpfMap[cpf]) {
          cpfMap[cpf].push({
            id: doc.id,
            name: data.fullName,
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : null
          });
        } else {
          cpfMap[cpf] = [{
            id: doc.id,
            name: data.fullName,
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : null
          }];
        }
      }
    });
    
    // Encontrar CPFs duplicados
    Object.entries(cpfMap).forEach(([cpf, records]) => {
      if (records.length > 1) {
        duplicatedCpfs.push({ cpf, records });
      }
    });
    
    console.log(`🔄 CPFs duplicados encontrados: ${duplicatedCpfs.length}`);
    
    if (duplicatedCpfs.length > 0) {
      console.log('\n📋 Primeiros 5 casos de duplicação:');
      duplicatedCpfs.slice(0, 5).forEach((dup, index) => {
        console.log(`${index + 1}. CPF ${dup.cpf}: ${dup.records.length} registros`);
        dup.records.forEach((record, i) => {
          console.log(`   ${i + 1}. ${record.name} - ${record.timestamp ? record.timestamp.toLocaleString('pt-BR') : 'N/A'}`);
        });
      });
    }
    
    // 3. TESTAR A VALIDAÇÃO DE DUPLICAÇÃO DA APLICAÇÃO
    console.log('\n📊 FASE 3: TESTANDO VALIDAÇÃO DE DUPLICAÇÃO');
    
    // Função simulada de verificação (baseada no código do actions.ts)
    async function testDuplicateCheck(cpf) {
      const cleanCpf = cpf.replace(/\D/g, '');
      const existingQuery = attendanceCollection.where('cpf', '==', cleanCpf);
      const existingSnapshot = await existingQuery.get();
      return existingSnapshot.size > 0;
    }
    
    // Testar com alguns CPFs existentes
    if (duplicatedCpfs.length > 0) {
      const testCpf = duplicatedCpfs[0].cpf;
      const isDuplicate = await testDuplicateCheck(testCpf);
      console.log(`🔍 Teste de duplicação para CPF ${testCpf}: ${isDuplicate ? 'BLOQUEADO' : 'PERMITIDO'}`);
    }
    
    // 4. VERIFICAR FALHAS DE VALIDAÇÃO
    console.log('\n📊 FASE 4: ANÁLISE DE REGISTROS COM DADOS INCOMPLETOS');
    
    let invalidRecords = 0;
    const invalidExamples = [];
    
    allSnapshot.forEach((doc) => {
      const data = doc.data();
      const issues = [];
      
      if (!data.fullName || data.fullName.trim() === '') {
        issues.push('Nome vazio');
      }
      if (!data.cpf || data.cpf.trim() === '') {
        issues.push('CPF vazio');
      }
      if (!data.status) {
        issues.push('Status vazio');
      }
      if (!data.timestamp && !data.createdAt) {
        issues.push('Sem timestamp');
      }
      
      if (issues.length > 0) {
        invalidRecords++;
        if (invalidExamples.length < 5) {
          invalidExamples.push({
            id: doc.id,
            issues: issues,
            data: {
              name: data.fullName || 'N/A',
              cpf: data.cpf || 'N/A',
              status: data.status || 'N/A'
            }
          });
        }
      }
    });
    
    console.log(`⚠️  Registros com dados incompletos: ${invalidRecords}`);
    
    if (invalidExamples.length > 0) {
      console.log('\n📋 Exemplos de registros problemáticos:');
      invalidExamples.forEach((example, index) => {
        console.log(`${index + 1}. ID: ${example.id}`);
        console.log(`   Nome: ${example.data.name}`);
        console.log(`   CPF: ${example.data.cpf}`);
        console.log(`   Status: ${example.data.status}`);
        console.log(`   Problemas: ${example.issues.join(', ')}`);
      });
    }
    
    // 5. VERIFICAR PADRÕES DE HORÁRIO
    console.log('\n📊 FASE 5: ANÁLISE DE PADRÕES DE HORÁRIO');
    
    const todayRegistrations = [];
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    
    allSnapshot.forEach((doc) => {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : null;
      
      if (timestamp && timestamp >= startOfDay) {
        todayRegistrations.push({
          id: doc.id,
          name: data.fullName,
          hour: timestamp.getHours(),
          minute: timestamp.getMinutes(),
          timestamp: timestamp
        });
      }
    });
    
    // Agrupar por hora
    const hourlyBreakdown = {};
    todayRegistrations.forEach(reg => {
      const hour = reg.hour;
      if (!hourlyBreakdown[hour]) {
        hourlyBreakdown[hour] = [];
      }
      hourlyBreakdown[hour].push(reg);
    });
    
    console.log('⏰ Registros de hoje por hora:');
    Object.keys(hourlyBreakdown)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach(hour => {
        const count = hourlyBreakdown[hour].length;
        console.log(`   ${hour.padStart(2, '0')}:xx - ${count} registros`);
      });
    
    // 6. VERIFICAR SE HÁ PROBLEMA COM TIMESTAMPS FUTUROS
    console.log('\n📊 FASE 6: VERIFICANDO TIMESTAMPS ANÔMALOS');
    
    const now = new Date();
    const futureRecords = [];
    const veryOldRecords = [];
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    allSnapshot.forEach((doc) => {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : null;
      
      if (timestamp) {
        if (timestamp > now) {
          futureRecords.push({
            id: doc.id,
            name: data.fullName,
            timestamp: timestamp
          });
        }
        if (timestamp < oneYearAgo) {
          veryOldRecords.push({
            id: doc.id,
            name: data.fullName,
            timestamp: timestamp
          });
        }
      }
    });
    
    console.log(`🔮 Registros com timestamps no futuro: ${futureRecords.length}`);
    console.log(`📅 Registros muito antigos (>1 ano): ${veryOldRecords.length}`);
    
    if (futureRecords.length > 0) {
      console.log('   Exemplos de timestamps futuros:');
      futureRecords.slice(0, 3).forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.name} - ${record.timestamp.toLocaleString('pt-BR')}`);
      });
    }
    
    return {
      totalRecords: allSnapshot.size,
      todayRecords: todayRegistrations.length,
      recentRecords: recentCount,
      duplicatedCpfs: duplicatedCpfs.length,
      invalidRecords: invalidRecords,
      futureRecords: futureRecords.length,
      veryOldRecords: veryOldRecords.length
    };
    
  } catch (error) {
    console.error('❌ Erro na investigação:', error);
    throw error;
  }
}

investigateRegistrationProcess()
  .then((result) => {
    console.log(`\n🎯 RESUMO DA INVESTIGAÇÃO:`);
    console.log(`📊 Total de registros: ${result.totalRecords}`);
    console.log(`📅 Registros de hoje: ${result.todayRecords}`);
    console.log(`⏰ Registros recentes (4h): ${result.recentRecords}`);
    console.log(`🔄 CPFs duplicados: ${result.duplicatedCpfs}`);
    console.log(`⚠️  Registros inválidos: ${result.invalidRecords}`);
    console.log(`🔮 Timestamps futuros: ${result.futureRecords}`);
    console.log(`📅 Registros muito antigos: ${result.veryOldRecords}`);
    
    console.log(`\n💡 POSSÍVEIS CAUSAS DE REGISTROS NÃO SALVOS:`);
    
    if (result.duplicatedCpfs > 0) {
      console.log(`1. ❗ ${result.duplicatedCpfs} CPFs duplicados podem estar bloqueando novos registros`);
    }
    
    if (result.invalidRecords > 0) {
      console.log(`2. ❗ ${result.invalidRecords} registros com dados incompletos podem indicar falhas na validação`);
    }
    
    if (result.recentRecords === 0) {
      console.log(`3. ❗ Nenhum registro nas últimas 4 horas - possível problema na interface`);
    } else {
      console.log(`3. ✅ ${result.recentRecords} registros nas últimas 4 horas - sistema funcionando`);
    }
    
    console.log(`\n🔧 RECOMENDAÇÕES:`);
    console.log(`1. Verificar console do navegador para erros JavaScript`);
    console.log(`2. Verificar se a validação de CPF está muito restritiva`);
    console.log(`3. Implementar logs detalhados na interface de registro`);
    console.log(`4. Verificar conectividade de rede dos usuários`);
    console.log(`5. Verificar se as regras de segurança não estão bloqueando`);
    
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Investigação falhou:', error);
    process.exit(1);
  });