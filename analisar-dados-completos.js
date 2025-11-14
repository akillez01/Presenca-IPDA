import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function analisarDadosCompletos() {
  try {
    console.log('🔍 ANÁLISE COMPLETA DOS DADOS - PRESERVAÇÃO DE INFORMAÇÕES');
    console.log('=' .repeat(80));

    // 1. ANÁLISE DA COLEÇÃO ATTENDANCE
    console.log('\n📊 ANÁLISE DA COLEÇÃO ATTENDANCE:');
    console.log('-'.repeat(50));
    
    const attendanceSnapshot = await db.collection('attendance').get();
    const attendanceData = attendanceSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📈 Total de registros: ${attendanceData.length}`);
    
    if (attendanceData.length > 0) {
      console.log('\n🔍 ESTRUTURA DOS DADOS:');
      
      // Analisa todos os campos únicos
      const allFields = new Set();
      const fieldTypes = {};
      const fieldExamples = {};
      
      attendanceData.forEach(record => {
        Object.keys(record).forEach(field => {
          allFields.add(field);
          
          if (!fieldTypes[field]) {
            fieldTypes[field] = new Set();
            fieldExamples[field] = [];
          }
          
          const value = record[field];
          fieldTypes[field].add(typeof value);
          
          // Adiciona exemplo se ainda não temos 3
          if (fieldExamples[field].length < 3 && value !== null && value !== undefined && value !== '') {
            fieldExamples[field].push(value);
          }
        });
      });

      console.log('\n📋 CAMPOS ENCONTRADOS:');
      Array.from(allFields).sort().forEach(field => {
        const types = Array.from(fieldTypes[field]).join(', ');
        const examples = fieldExamples[field].slice(0, 2).map(ex => {
          if (typeof ex === 'object' && ex.toDate) {
            return ex.toDate().toLocaleString('pt-BR');
          }
          return String(ex).substring(0, 30);
        });
        
        console.log(`   • ${field}: [${types}] - Ex: ${examples.join(', ')}`);
      });

      // Estatísticas por campo
      console.log('\n📊 ESTATÍSTICAS DOS CAMPOS:');
      const stats = {};
      Array.from(allFields).forEach(field => {
        stats[field] = {
          filled: 0,
          empty: 0,
          null: 0,
          undefined: 0
        };
      });

      attendanceData.forEach(record => {
        Array.from(allFields).forEach(field => {
          const value = record[field];
          if (value === null) stats[field].null++;
          else if (value === undefined) stats[field].undefined++;
          else if (value === '') stats[field].empty++;
          else stats[field].filled++;
        });
      });

      Object.keys(stats).sort().forEach(field => {
        const s = stats[field];
        const fillRate = ((s.filled / attendanceData.length) * 100).toFixed(1);
        console.log(`   • ${field}: ${s.filled} preenchidos (${fillRate}%), ${s.empty} vazios, ${s.null} null`);
      });

      // Análise de duplicatas por CPF
      console.log('\n🔍 ANÁLISE DE DUPLICATAS:');
      const cpfMap = {};
      attendanceData.forEach(record => {
        if (record.cpf) {
          if (!cpfMap[record.cpf]) {
            cpfMap[record.cpf] = [];
          }
          cpfMap[record.cpf].push({
            id: record.id,
            fullName: record.fullName,
            timestamp: record.timestamp?.toDate?.()?.toLocaleString('pt-BR') || record.timestamp
          });
        }
      });

      const duplicateCPFs = Object.keys(cpfMap).filter(cpf => cpfMap[cpf].length > 1);
      console.log(`   • CPFs únicos: ${Object.keys(cpfMap).length}`);
      console.log(`   • CPFs duplicados: ${duplicateCPFs.length}`);
      
      if (duplicateCPFs.length > 0) {
        console.log('\n⚠️ DUPLICATAS ENCONTRADAS:');
        duplicateCPFs.slice(0, 5).forEach(cpf => {
          console.log(`   • CPF ${cpf}:`);
          cpfMap[cpf].forEach(entry => {
            console.log(`     - ${entry.fullName} (ID: ${entry.id}) - ${entry.timestamp}`);
          });
        });
        if (duplicateCPFs.length > 5) {
          console.log(`   ... e mais ${duplicateCPFs.length - 5} CPFs duplicados`);
        }
      }

      // Análise temporal
      console.log('\n📅 ANÁLISE TEMPORAL:');
      const timeRecords = attendanceData.filter(r => r.timestamp);
      if (timeRecords.length > 0) {
        const dates = timeRecords.map(r => {
          if (r.timestamp?.toDate) return r.timestamp.toDate();
          return new Date(r.timestamp);
        }).sort();
        
        console.log(`   • Registros com timestamp: ${timeRecords.length} de ${attendanceData.length}`);
        console.log(`   • Data mais antiga: ${dates[0]?.toLocaleString('pt-BR')}`);
        console.log(`   • Data mais recente: ${dates[dates.length-1]?.toLocaleString('pt-BR')}`);
        
        // Registros por dia
        const dailyCount = {};
        dates.forEach(date => {
          const day = date.toDateString();
          dailyCount[day] = (dailyCount[day] || 0) + 1;
        });
        
        const sortedDays = Object.keys(dailyCount).sort((a, b) => new Date(a) - new Date(b));
        console.log(`   • Dias únicos: ${sortedDays.length}`);
        console.log(`   • Últimos 5 dias com registros:`);
        sortedDays.slice(-5).forEach(day => {
          console.log(`     - ${new Date(day).toLocaleDateString('pt-BR')}: ${dailyCount[day]} registros`);
        });
      }
    }

    // 2. ANÁLISE DA COLEÇÃO USERS
    console.log('\n👥 ANÁLISE DA COLEÇÃO USERS:');
    console.log('-'.repeat(50));
    
    const usersSnapshot = await db.collection('users').get();
    const usersData = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`👤 Total de usuários: ${usersData.length}`);
    
    if (usersData.length > 0) {
      console.log('\n📋 USUÁRIOS CADASTRADOS:');
      usersData.forEach(user => {
        console.log(`   • ${user.email || 'Email não definido'} (${user.displayName || 'Nome não definido'})`);
        console.log(`     - Role: ${user.role || 'não definido'}`);
        console.log(`     - Ativo: ${user.active ? 'Sim' : 'Não'}`);
        console.log(`     - Pode registrar: ${user.canRegister ? 'Sim' : 'Não'}`);
        console.log(`     - Pode ver presença: ${user.canViewAttendance ? 'Sim' : 'Não'}`);
        console.log('');
      });
    }

    // 3. BACKUP DOS DADOS
    console.log('\n💾 CRIANDO BACKUP DOS DADOS:');
    console.log('-'.repeat(50));
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Backup attendance
    const attendanceBackup = {
      timestamp: new Date().toISOString(),
      collection: 'attendance',
      totalRecords: attendanceData.length,
      data: attendanceData.map(record => {
        // Converte Firestore Timestamps para ISO strings
        const converted = { ...record };
        Object.keys(converted).forEach(key => {
          if (converted[key] && typeof converted[key] === 'object' && converted[key].toDate) {
            converted[key] = converted[key].toDate().toISOString();
          }
        });
        return converted;
      })
    };
    
    const attendanceBackupFile = `backup-attendance-${timestamp}.json`;
    writeFileSync(attendanceBackupFile, JSON.stringify(attendanceBackup, null, 2));
    console.log(`✅ Backup attendance salvo: ${attendanceBackupFile}`);

    // Backup users
    const usersBackup = {
      timestamp: new Date().toISOString(),
      collection: 'users',
      totalRecords: usersData.length,
      data: usersData
    };
    
    const usersBackupFile = `backup-users-${timestamp}.json`;
    writeFileSync(usersBackupFile, JSON.stringify(usersBackup, null, 2));
    console.log(`✅ Backup users salvo: ${usersBackupFile}`);

    // 4. RELATÓRIO DE INTEGRIDADE
    console.log('\n🔍 RELATÓRIO DE INTEGRIDADE:');
    console.log('-'.repeat(50));
    
    const integrityReport = {
      timestamp: new Date().toISOString(),
      attendance: {
        totalRecords: attendanceData.length,
        fieldsFound: Array.from(allFields),
        duplicateCPFs: duplicateCPFs.length,
        recordsWithTimestamp: timeRecords.length,
        fillRates: stats
      },
      users: {
        totalUsers: usersData.length,
        activeUsers: usersData.filter(u => u.active).length,
        usersCanRegister: usersData.filter(u => u.canRegister).length
      },
      recommendations: []
    };

    // Recomendações
    if (duplicateCPFs.length > 0) {
      integrityReport.recommendations.push(`Verificar ${duplicateCPFs.length} CPFs duplicados antes de melhorias`);
    }
    
    if (timeRecords.length < attendanceData.length) {
      integrityReport.recommendations.push(`${attendanceData.length - timeRecords.length} registros sem timestamp precisam de atenção`);
    }

    const reportFile = `relatorio-integridade-${timestamp}.json`;
    writeFileSync(reportFile, JSON.stringify(integrityReport, null, 2));
    console.log(`✅ Relatório de integridade salvo: ${reportFile}`);

    console.log('\n🎯 RESUMO EXECUTIVO:');
    console.log('=' .repeat(80));
    console.log(`📊 Total de registros de presença: ${attendanceData.length}`);
    console.log(`👥 Total de usuários: ${usersData.length}`);
    console.log(`⚠️ CPFs duplicados: ${duplicateCPFs.length}`);
    console.log(`📅 Registros com timestamp: ${timeRecords.length}/${attendanceData.length}`);
    console.log(`💾 Backups criados: ${attendanceBackupFile}, ${usersBackupFile}`);
    console.log(`📋 Relatório: ${reportFile}`);
    
    if (duplicateCPFs.length > 0) {
      console.log('\n⚠️ ATENÇÃO: Duplicatas encontradas! Revisar antes de aplicar melhorias.');
    } else {
      console.log('\n✅ Dados íntegros! Seguro para aplicar melhorias.');
    }

  } catch (error) {
    console.error('❌ Erro na análise:', error);
  } finally {
    process.exit(0);
  }
}

analisarDadosCompletos();
