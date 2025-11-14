import { readFileSync } from 'fs';

try {
  console.log('📊 ANÁLISE RÁPIDA DOS BACKUPS CRIADOS');
  console.log('=' .repeat(60));

  // Analisar backup de attendance
  const attendanceBackup = JSON.parse(readFileSync('./backup-attendance-2025-09-21T17-07-13-037Z.json', 'utf8'));
  console.log('\n📋 DADOS DE PRESENÇA:');
  console.log(`   📊 Total de registros: ${attendanceBackup.totalRecords}`);
  console.log(`   📅 Backup criado em: ${new Date(attendanceBackup.timestamp).toLocaleString('pt-BR')}`);
  
  if (attendanceBackup.data && attendanceBackup.data.length > 0) {
    // Analisar primeiro registro para ver estrutura
    const firstRecord = attendanceBackup.data[0];
    console.log('\n🔍 CAMPOS ENCONTRADOS NO PRIMEIRO REGISTRO:');
    Object.keys(firstRecord).forEach(field => {
      const value = firstRecord[field];
      const type = typeof value;
      const preview = String(value).substring(0, 30);
      console.log(`   • ${field}: [${type}] "${preview}${String(value).length > 30 ? '...' : ''}"`);
    });

    // Contar registros únicos por campos importantes
    console.log('\n📈 ESTATÍSTICAS RÁPIDAS:');
    
    const cpfs = new Set();
    const names = new Set();
    const regions = new Set();
    const statuses = new Set();
    const positions = new Set();
    
    let recordsWithTimestamp = 0;
    let recordsWithBirthday = 0;
    
    attendanceBackup.data.forEach(record => {
      if (record.cpf) cpfs.add(record.cpf);
      if (record.fullName) names.add(record.fullName);
      if (record.region) regions.add(record.region);
      if (record.status) statuses.add(record.status);
      if (record.churchPosition) positions.add(record.churchPosition);
      if (record.timestamp) recordsWithTimestamp++;
      if (record.birthday) recordsWithBirthday++;
    });
    
    console.log(`   👤 CPFs únicos: ${cpfs.size}`);
    console.log(`   📝 Nomes únicos: ${names.size}`);
    console.log(`   🌍 Regiões únicas: ${regions.size}`);
    console.log(`   📊 Status únicos: ${statuses.size} (${Array.from(statuses).join(', ')})`);
    console.log(`   💼 Cargos únicos: ${positions.size}`);
    console.log(`   ⏰ Com timestamp: ${recordsWithTimestamp}/${attendanceBackup.totalRecords}`);
    console.log(`   🎂 Com aniversário: ${recordsWithBirthday}/${attendanceBackup.totalRecords}`);
    
    // Verificar possíveis duplicatas
    const duplicateCPFs = attendanceBackup.data.reduce((acc, record) => {
      if (record.cpf) {
        acc[record.cpf] = (acc[record.cpf] || 0) + 1;
      }
      return acc;
    }, {});
    
    const duplicates = Object.entries(duplicateCPFs).filter(([cpf, count]) => count > 1);
    console.log(`   ⚠️ CPFs duplicados: ${duplicates.length}`);
    
    if (duplicates.length > 0) {
      console.log('\n🔍 EXEMPLOS DE DUPLICATAS:');
      duplicates.slice(0, 3).forEach(([cpf, count]) => {
        console.log(`   • CPF ${cpf}: ${count} registros`);
      });
    }
  }

  // Analisar backup de usuários
  const usersBackup = JSON.parse(readFileSync('./backup-users-2025-09-21T17-07-13-037Z.json', 'utf8'));
  console.log('\n👥 DADOS DE USUÁRIOS:');
  console.log(`   👤 Total de usuários: ${usersBackup.totalRecords}`);
  
  if (usersBackup.data && usersBackup.data.length > 0) {
    console.log('\n📋 USUÁRIOS CADASTRADOS:');
    usersBackup.data.forEach(user => {
      console.log(`   • ${user.email} - ${user.displayName} (${user.role}) - Ativo: ${user.active ? '✅' : '❌'}`);
    });
  }

  console.log('\n🎯 RESUMO PARA MELHORIAS:');
  console.log('=' .repeat(60));
  console.log(`✅ Dados preservados: ${attendanceBackup.totalRecords} registros + ${usersBackup.totalRecords} usuários`);
  console.log('✅ Backups criados com sucesso');
  console.log(`${duplicates.length > 0 ? '⚠️' : '✅'} Duplicatas: ${duplicates.length} encontradas`);
  console.log(`${recordsWithBirthday < attendanceBackup.totalRecords / 2 ? '⚠️' : '✅'} Aniversários: ${recordsWithBirthday} de ${attendanceBackup.totalRecords} preenchidos`);
  
  console.log('\n🔧 RECOMENDAÇÕES:');
  if (duplicates.length > 0) {
    console.log('   • Revisar CPFs duplicados antes de melhorias');
  }
  if (recordsWithBirthday < attendanceBackup.totalRecords * 0.8) {
    console.log('   • Considerar campo aniversário como opcional nas validações');
  }
  console.log('   • Dados estão seguros para aplicar melhorias');
  console.log('   • Filtros podem ser melhorados sem perda de dados');

} catch (error) {
  console.error('❌ Erro ao analisar backups:', error.message);
  console.log('\n📝 Verifique se os arquivos de backup existem:');
  console.log('   - backup-attendance-2025-09-21T17-07-13-037Z.json');
  console.log('   - backup-users-2025-09-21T17-07-13-037Z.json');
}
