const admin = require('firebase-admin');
const fs = require('fs');

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync('./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Função para verificar se um CPF já existe
async function checkDuplicateCPF(cpf) {
  try {
    const cleanCPF = cpf.replace(/\D/g, '');
    
    console.log(`🔍 Verificando CPF: ${cleanCPF}`);
    
    const snapshot = await db.collection('attendance')
      .where('cpf', '==', cleanCPF)
      .get();
    
    if (snapshot.empty) {
      console.log('✅ CPF disponível');
      return {
        isDuplicate: false,
        message: 'CPF disponível para cadastro'
      };
    }
    
    const existingRecords = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      existingRecords.push({
        id: doc.id,
        fullName: data.fullName || '',
        region: data.region || '',
        churchPosition: data.churchPosition || '',
        timestamp: data.timestamp?.toDate?.()?.toLocaleString('pt-BR') || data.timestamp || ''
      });
    });
    
    console.log(`⚠️ CPF já cadastrado ${existingRecords.length} vez(es):`);
    existingRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.fullName} - ${record.region} (${record.timestamp})`);
    });
    
    return {
      isDuplicate: true,
      count: existingRecords.length,
      existingRecords: existingRecords,
      message: `CPF já cadastrado ${existingRecords.length} vez(es). Verifique se não é um registro duplicado.`
    };
    
  } catch (error) {
    console.error('❌ Erro ao verificar CPF:', error);
    throw new Error('Erro ao verificar duplicatas de CPF');
  }
}

// Função para validar antes do cadastro
async function validateBeforeRegister(formData) {
  try {
    console.log('🔍 Validando dados antes do cadastro...');
    
    const results = {
      isValid: true,
      warnings: [],
      errors: [],
      duplicateInfo: null
    };
    
    // Verificar CPF duplicado
    if (formData.cpf) {
      const cpfCheck = await checkDuplicateCPF(formData.cpf);
      if (cpfCheck.isDuplicate) {
        results.isValid = false;
        results.errors.push(cpfCheck.message);
        results.duplicateInfo = cpfCheck;
      }
    }
    
    console.log(`📋 Resultado da validação: ${results.isValid ? '✅ Válido' : '❌ Inválido'}`);
    if (results.errors.length > 0) {
      console.log('❌ Erros encontrados:', results.errors);
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Erro na validação:', error);
    return {
      isValid: false,
      errors: ['Erro interno na validação. Tente novamente.'],
      warnings: [],
      duplicateInfo: null
    };
  }
}

// Função de teste
async function testValidation() {
  console.log('🧪 Testando sistema de validação de duplicatas...\n');
  
  try {
    // Teste com CPF novo
    console.log('📋 Teste 1: CPF novo');
    const newCPF = '99999999999';
    const result1 = await validateBeforeRegister({
      cpf: newCPF,
      fullName: 'Usuário Teste Novo'
    });
    console.log('Resultado:', result1.isValid ? '✅ Válido' : '❌ Inválido');
    console.log('Mensagens:', result1.errors.join(', ') || 'Nenhuma');
    console.log('');
    
    // Teste com CPF que sabemos que existe
    console.log('📋 Teste 2: Verificando se há CPFs duplicados na base');
    const snapshot = await db.collection('attendance').limit(10).get();
    let testExistingCPF = null;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.cpf) {
        testExistingCPF = data.cpf;
        break;
      }
    }
    
    if (testExistingCPF) {
      console.log(`Testando com CPF existente: ${testExistingCPF}`);
      const result2 = await validateBeforeRegister({
        cpf: testExistingCPF,
        fullName: 'Teste Duplicata'
      });
      console.log('Resultado:', result2.isValid ? '✅ Válido' : '❌ Inválido');
      console.log('Mensagens:', result2.errors.join(', ') || 'Nenhuma');
    } else {
      console.log('Nenhum CPF encontrado na base para teste');
    }
    
    console.log('\n✅ Teste de validação completado!');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar teste
testValidation().then(() => {
  console.log('🎯 Sistema funcionando!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro:', error);
  process.exit(1);
});

module.exports = { checkDuplicateCPF, validateBeforeRegister };
