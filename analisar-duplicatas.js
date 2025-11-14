import { readFileSync, writeFileSync } from 'fs';

try {
  console.log('🔍 ANÁLISE DETALHADA DE DUPLICATAS');
  console.log('=' .repeat(60));

  const attendanceBackup = JSON.parse(readFileSync('./backup-attendance-2025-09-21T17-07-13-037Z.json', 'utf8'));
  console.log(`📊 Analisando ${attendanceBackup.totalRecords} registros...`);
  
  // Agrupar por CPF
  const cpfGroups = {};
  attendanceBackup.data.forEach(record => {
    if (record.cpf) {
      if (!cpfGroups[record.cpf]) {
        cpfGroups[record.cpf] = [];
      }
      cpfGroups[record.cpf].push(record);
    }
  });

  // Encontrar duplicatas
  const duplicates = Object.entries(cpfGroups).filter(([cpf, records]) => records.length > 1);
  
  console.log(`\n📋 RESULTADO DA ANÁLISE:`);
  console.log(`   • CPFs únicos: ${Object.keys(cpfGroups).length}`);
  console.log(`   • CPFs com duplicatas: ${duplicates.length}`);
  console.log(`   • Total de registros duplicados: ${duplicates.reduce((sum, [, records]) => sum + records.length, 0)}`);

  if (duplicates.length > 0) {
    console.log('\n🔍 ANÁLISE DETALHADA DAS DUPLICATAS:');
    console.log('-'.repeat(60));
    
    const duplicateReport = [];
    
    duplicates.forEach(([cpf, records]) => {
      console.log(`\n• CPF: ${cpf} (${records.length} registros)`);
      
      const duplicateInfo = {
        cpf: cpf,
        count: records.length,
        records: []
      };
      
      records.forEach((record, index) => {
        const recordInfo = {
          id: record.id,
          fullName: record.fullName,
          timestamp: record.timestamp,
          status: record.status,
          region: record.region,
          churchPosition: record.churchPosition
        };
        
        duplicateInfo.records.push(recordInfo);
        
        console.log(`  ${index + 1}. ${record.fullName}`);
        console.log(`     - ID: ${record.id}`);
        console.log(`     - Timestamp: ${new Date(record.timestamp).toLocaleString('pt-BR')}`);
        console.log(`     - Status: ${record.status}`);
        console.log(`     - Região: ${record.region}`);
        console.log(`     - Cargo: ${record.churchPosition}`);
        console.log(`     - Cidade: ${record.city}`);
      });
      
      duplicateReport.push(duplicateInfo);
      
      // Verificar se são realmente duplicatas ou pessoas diferentes
      const uniqueNames = new Set(records.map(r => r.fullName?.toLowerCase().trim()));
      if (uniqueNames.size === 1) {
        console.log(`   ⚠️ PROVÁVEL DUPLICATA REAL (mesmo nome: ${Array.from(uniqueNames)[0]})`);
      } else {
        console.log(`   ⚠️ POSSÍVEL CPF COMPARTILHADO (nomes diferentes: ${Array.from(uniqueNames).join(', ')})`);
      }
    });

    // Salvar relatório de duplicatas
    const duplicateReportFile = `relatorio-duplicatas-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    writeFileSync(duplicateReportFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalDuplicates: duplicates.length,
      totalDuplicatedRecords: duplicates.reduce((sum, [, records]) => sum + records.length, 0),
      duplicates: duplicateReport
    }, null, 2));
    
    console.log(`\n💾 Relatório detalhado salvo: ${duplicateReportFile}`);
    
    // Análise de padrões
    console.log('\n📊 ANÁLISE DE PADRÕES:');
    console.log('-'.repeat(40));
    
    let realDuplicates = 0;
    let sharedCPFs = 0;
    
    duplicates.forEach(([cpf, records]) => {
      const uniqueNames = new Set(records.map(r => r.fullName?.toLowerCase().trim()));
      if (uniqueNames.size === 1) {
        realDuplicates++;
      } else {
        sharedCPFs++;
      }
    });
    
    console.log(`   • Duplicatas reais (mesmo nome): ${realDuplicates}`);
    console.log(`   • CPFs compartilhados (nomes diferentes): ${sharedCPFs}`);
    
    // Recomendações
    console.log('\n🔧 RECOMENDAÇÕES:');
    console.log('-'.repeat(40));
    
    if (realDuplicates > 0) {
      console.log(`   1. Revisar ${realDuplicates} casos de duplicatas reais`);
      console.log(`   2. Implementar sistema de merge de registros`);
    }
    
    if (sharedCPFs > 0) {
      console.log(`   3. Verificar ${sharedCPFs} casos de CPFs compartilhados`);
      console.log(`   4. Considerar validação adicional (nome + CPF)`);
    }
    
    console.log(`   5. Implementar validação antes de novos cadastros`);
    console.log(`   6. Criar interface para resolução de duplicatas`);
    
  } else {
    console.log('\n✅ Nenhuma duplicata encontrada! Dados íntegros.');
  }

  console.log('\n🎯 RESUMO EXECUTIVO:');
  console.log('=' .repeat(60));
  console.log(`📊 Total de registros: ${attendanceBackup.totalRecords}`);
  console.log(`👤 CPFs únicos: ${Object.keys(cpfGroups).length}`);
  console.log(`⚠️ Casos de duplicata: ${duplicates.length}`);
  console.log(`${duplicates.length === 0 ? '✅' : '⚠️'} Status dos dados: ${duplicates.length === 0 ? 'ÍNTEGROS' : 'NECESSITA REVISÃO'}`);

} catch (error) {
  console.error('❌ Erro ao analisar duplicatas:', error.message);
}
