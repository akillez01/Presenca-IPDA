const admin = require('firebase-admin');
const fs = require('fs');

// Inicializar Firebase Admin SDK
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listarColecoes() {
  try {
    console.log('=== COLEÇÕES DISPONÍVEIS ===');
    const collections = await db.listCollections();
    collections.forEach(collection => {
      console.log(`- ${collection.id}`);
    });
    console.log('\n');
  } catch (error) {
    console.error('Erro ao listar coleções:', error);
  }
}

async function consultarPresencas(limite = 10) {
  try {
    console.log(`=== ÚLTIMOS ${limite} REGISTROS DE PRESENÇA ===`);
    const snapshot = await db.collection('attendance')
      .orderBy('timestamp', 'desc')
      .limit(limite)
      .get();

    if (snapshot.empty) {
      console.log('Nenhum registro encontrado na coleção "attendance"');
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\nID: ${doc.id}`);
      console.log(`Nome: ${data.fullName || 'N/A'}`);
      console.log(`CPF: ${data.cpf || 'N/A'}`);
      console.log(`Status: ${data.status || 'N/A'}`);
      console.log(`Região: ${data.region || 'N/A'}`);
      console.log(`Data: ${data.timestamp ? new Date(data.timestamp.toDate()).toLocaleString('pt-BR') : 'N/A'}`);
      console.log('---');
    });
  } catch (error) {
    console.error('Erro ao consultar presenças:', error);
  }
}

async function contarRegistros() {
  try {
    console.log('=== ESTATÍSTICAS ===');
    const snapshot = await db.collection('attendance').get();
    console.log(`Total de registros: ${snapshot.size}`);

    // Contar por status
    const stats = {};
    snapshot.forEach(doc => {
      const status = doc.data().status || 'Presente';
      stats[status] = (stats[status] || 0) + 1;
    });

    console.log('Distribuição por status:');
    Object.entries(stats).forEach(([status, count]) => {
      console.log(`- ${status}: ${count}`);
    });

    // Contar por região
    const regionStats = {};
    snapshot.forEach(doc => {
      const region = doc.data().region || 'Sem região';
      regionStats[region] = (regionStats[region] || 0) + 1;
    });

    console.log('\nDistribuição por região:');
    Object.entries(regionStats).forEach(([region, count]) => {
      console.log(`- ${region}: ${count}`);
    });

  } catch (error) {
    console.error('Erro ao contar registros:', error);
  }
}

async function consultarPorStatus(status = 'Presente') {
  try {
    console.log(`=== REGISTROS COM STATUS: ${status} ===`);
    const snapshot = await db.collection('attendance')
      .where('status', '==', status)
      .orderBy('timestamp', 'desc')
      .get();

    if (snapshot.empty) {
      console.log(`Nenhum registro encontrado com status "${status}"`);
      return;
    }

    console.log(`Encontrados ${snapshot.size} registros:`);
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- ${data.fullName || 'N/A'} (${data.region || 'N/A'}) - ${data.timestamp ? new Date(data.timestamp.toDate()).toLocaleDateString('pt-BR') : 'N/A'}`);
    });
  } catch (error) {
    console.error('Erro ao consultar por status:', error);
  }
}

async function consultarPorData(dataInicio, dataFim) {
  try {
    console.log(`=== REGISTROS ENTRE ${dataInicio} E ${dataFim} ===`);
    
    const inicio = new Date(dataInicio + 'T00:00:00');
    const fim = new Date(dataFim + 'T23:59:59');
    
    const snapshot = await db.collection('attendance')
      .where('timestamp', '>=', inicio)
      .where('timestamp', '<=', fim)
      .orderBy('timestamp', 'desc')
      .get();

    if (snapshot.empty) {
      console.log(`Nenhum registro encontrado entre ${dataInicio} e ${dataFim}`);
      return;
    }

    console.log(`Encontrados ${snapshot.size} registros:`);
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- ${data.fullName || 'N/A'} - ${data.status || 'N/A'} - ${data.timestamp ? new Date(data.timestamp.toDate()).toLocaleString('pt-BR') : 'N/A'}`);
    });
  } catch (error) {
    console.error('Erro ao consultar por data:', error);
  }
}

async function exportarCSV() {
  try {
    console.log('=== EXPORTANDO PARA CSV ===');
    const snapshot = await db.collection('attendance')
      .orderBy('timestamp', 'desc')
      .get();

    if (snapshot.empty) {
      console.log('Nenhum registro encontrado para exportar');
      return;
    }

    const headers = ['Nome,CPF,Status,Região,Cargo,Pastor,Data,Justificativa'];
    const rows = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const row = [
        `"${data.fullName || ''}"`,
        `"${data.cpf || ''}"`,
        `"${data.status || 'Presente'}"`,
        `"${data.region || ''}"`,
        `"${data.churchPosition || ''}"`,
        `"${data.pastorName || ''}"`,
        data.timestamp ? `"${new Date(data.timestamp.toDate()).toLocaleString('pt-BR')}"` : '""',
        `"${data.absentReason || ''}"`
      ].join(',');
      rows.push(row);
    });

    const csvContent = headers.concat(rows).join('\n');
    const filename = `firebase-export-${new Date().toISOString().split('T')[0]}.csv`;
    
    fs.writeFileSync(filename, csvContent, 'utf8');
    console.log(`Dados exportados para: ${filename}`);
    console.log(`Total de registros: ${rows.length}`);
  } catch (error) {
    console.error('Erro ao exportar CSV:', error);
  }
}

// Função principal
async function main() {
  const args = process.argv.slice(2);
  const comando = args[0] || 'help';

  try {
    switch (comando) {
      case 'collections':
      case 'colecoes':
        await listarColecoes();
        break;
      
      case 'list':
      case 'listar':
        const limite = parseInt(args[1]) || 10;
        await consultarPresencas(limite);
        break;
      
      case 'stats':
      case 'estatisticas':
        await contarRegistros();
        break;
      
      case 'status':
        const status = args[1] || 'Presente';
        await consultarPorStatus(status);
        break;
      
      case 'date':
      case 'data':
        if (!args[1] || !args[2]) {
          console.log('Uso: node consultar-firebase.js data YYYY-MM-DD YYYY-MM-DD');
          return;
        }
        await consultarPorData(args[1], args[2]);
        break;
      
      case 'export':
      case 'exportar':
        await exportarCSV();
        break;
      
      case 'all':
      case 'tudo':
        await listarColecoes();
        await contarRegistros();
        await consultarPresencas(5);
        break;
      
      default:
        console.log(`
=== CONSULTA FIREBASE - SISTEMA DE PRESENÇA ===

Comandos disponíveis:

node consultar-firebase.js collections     - Lista todas as coleções
node consultar-firebase.js list [N]        - Lista últimos N registros (padrão: 10)
node consultar-firebase.js stats           - Mostra estatísticas gerais
node consultar-firebase.js status [STATUS] - Filtra por status (Presente, Justificado, Ausente)
node consultar-firebase.js data INICIO FIM - Filtra por período (YYYY-MM-DD)
node consultar-firebase.js export          - Exporta todos os dados para CSV
node consultar-firebase.js all             - Executa todos os comandos básicos

Exemplos:
node consultar-firebase.js list 20
node consultar-firebase.js status Justificado
node consultar-firebase.js data 2025-08-01 2025-08-18
        `);
    }
  } catch (error) {
    console.error('Erro geral:', error);
  } finally {
    process.exit(0);
  }
}

main();
