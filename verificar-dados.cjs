const admin = require('firebase-admin');

// Inicializar Firebase Admin
try {
  if (!admin.apps.length) {
    const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (error) {
  console.error('Erro ao inicializar Firebase:', error.message);
  process.exit(1);
}

async function verificarDados() {
  try {
    const db = admin.firestore();
    console.log("🔍 VERIFICAÇÃO DOS DADOS DO DIA 17/08/2025");
    console.log("=" + "=".repeat(50));
    
    // Buscar todos os registros
    const snapshotTotal = await db.collection('attendance').get();
    console.log(`📊 Total geral na base: ${snapshotTotal.docs.length} registros`);
    
    // Buscar registros do dia 17 especificamente
    const inicio = new Date('2025-08-17T00:00:00-04:00');
    const fim = new Date('2025-08-17T23:59:59-04:00');
    
    const snapshotDia17 = await db.collection('attendance')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(inicio))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(fim))
      .get();
    
    console.log(`📅 Registros do dia 17/08/2025: ${snapshotDia17.docs.length}`);
    
    if (snapshotDia17.docs.length > 0) {
      let presentes = 0, justificados = 0, ausentes = 0;
      let primeiroHorario = null, ultimoHorario = null;
      
      snapshotDia17.docs.forEach(doc => {
        const data = doc.data();
        const status = data.status || 'Presente';
        
        if (status === 'Presente') presentes++;
        else if (status === 'Justificado') justificados++;
        else ausentes++;
        
        if (data.timestamp) {
          const timestamp = data.timestamp.toDate();
          const horario = timestamp.toLocaleTimeString('pt-BR', { timeZone: 'America/Manaus' });
          
          if (!primeiroHorario || timestamp < new Date(primeiroHorario.timestamp)) {
            primeiroHorario = { horario, timestamp };
          }
          if (!ultimoHorario || timestamp > new Date(ultimoHorario.timestamp)) {
            ultimoHorario = { horario, timestamp };
          }
        }
      });
      
      console.log("");
      console.log("📈 ESTATÍSTICAS ENCONTRADAS:");
      console.log(`   ✅ Presentes: ${presentes} (${((presentes/snapshotDia17.docs.length)*100).toFixed(2)}%)`);
      console.log(`   📝 Justificados: ${justificados} (${((justificados/snapshotDia17.docs.length)*100).toFixed(2)}%)`);
      console.log(`   ❌ Ausentes: ${ausentes} (${((ausentes/snapshotDia17.docs.length)*100).toFixed(2)}%)`);
      
      if (primeiroHorario) {
        console.log(`   ⏰ Primeiro registro: ${primeiroHorario.horario}`);
      }
      if (ultimoHorario) {
        console.log(`   ⏰ Último registro: ${ultimoHorario.horario}`);
      }
    } else {
      console.log("❌ Nenhum registro encontrado para o dia 17/08/2025");
    }
    
    console.log("");
    console.log("🤔 COMPARAÇÃO COM OS DADOS MENCIONADOS:");
    console.log("   Dados mencionados: 995 total, 955 presentes, 40 justificados");
    console.log(`   Dados Firebase: ${snapshotDia17.docs.length} total`);
    
    if (snapshotTotal.docs.length >= 995) {
      console.log("💭 Possível explicação: Os 995 podem incluir dados de múltiplos dias ou fontes");
    }
    
    console.log("");
    console.log("✅ Verificação concluída!");
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
  
  process.exit(0);
}

verificarDados();
