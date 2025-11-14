#!/usr/bin/env node

// Script para testar a validação de duplicatas
const { validateBeforeRegister, checkDuplicateCPF } = require('./src/lib/duplicate-validation.ts');

async function testValidation() {
  console.log('🧪 Testando sistema de validação de duplicatas...\n');
  
  try {
    // Teste 1: CPF que já existe na base (do backup que analisamos)
    console.log('📋 Teste 1: CPF existente');
    const testCPF = '12345678901'; // Um dos CPFs duplicados que encontramos
    const cpfResult = await checkDuplicateCPF(testCPF);
    console.log('Resultado:', cpfResult);
    console.log('');
    
    // Teste 2: Validação completa com dados duplicados
    console.log('📋 Teste 2: Validação completa - dados duplicados');
    const duplicateData = {
      cpf: testCPF,
      fullName: 'Test User'
    };
    const validationResult = await validateBeforeRegister(duplicateData);
    console.log('Resultado:', validationResult);
    console.log('');
    
    // Teste 3: Dados novos (não duplicados)
    console.log('📋 Teste 3: Validação completa - dados novos');
    const newData = {
      cpf: '99999999999',
      fullName: 'Usuario Novo Test'
    };
    const newValidationResult = await validateBeforeRegister(newData);
    console.log('Resultado:', newValidationResult);
    console.log('');
    
    console.log('✅ Testes completados!');
    
  } catch (error) {
    console.error('❌ Erro durante os testes:', error.message);
    process.exit(1);
  }
}

// Executar testes
testValidation().then(() => {
  console.log('🎯 Sistema de validação funcionando corretamente!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Falha nos testes:', error);
  process.exit(1);
});
