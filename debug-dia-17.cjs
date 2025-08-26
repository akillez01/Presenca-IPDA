const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function debugDia17() {
  try {
    console.log("🔍 Debug: Consultando registros do dia 17/08/2025...\n");
    
    // Consultar todos os registros
    const snapshot = await db.collection('attendance').get();
    const todos = snapshot.docs.length;
    console.log(`📊 Total de registros na base: ${todos}`);
    
    // Filtrar registros do dia 17 manualmente
    let registrosDia17 = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.timestamp) {
        const timestamp = data.timestamp.toDate();
        const dataManaus = new Date(timestamp.toLocaleString("en-US", { timeZone: "America/Manaus" }));
        
        // Verificar se é do dia 17/08/2025
        if (dataManaus.getDate() === 17 && 
            dataManaus.getMonth() === 7 && // agosto é mês 7 (0-indexed)
            dataManaus.getFullYear() === 2025) {
          
          registrosDia17.push({
            id: doc.id,
            nome: data.fullName,
            status: data.status || 'Presente',
            hora: dataManaus.toLocaleTimeString('pt-BR'),
            timestamp: dataManaus
          });
        }
      }
    });
    
    console.log(`📅 Registros do dia 17/08/2025: ${registrosDia17.length}\n`);
    
    if (registrosDia17.length > 0) {
      // Ordenar por horário
      registrosDia17.sort((a, b) => a.timestamp - b.timestamp);
      
      // Estatísticas
      const presentes = registrosDia17.filter(r => r.status === 'Presente').length;
      const justificados = registrosDia17.filter(r => r.status === 'Justificado').length;
      const ausentes = registrosDia17.filter(r => r.status === 'Ausente').length;
      
      console.log("📊 ESTATÍSTICAS DO DIA 17:");
      console.log(`   ✅ Presentes: ${presentes} (${((presentes/registrosDia17.length)*100).toFixed(1)}%)`);
      console.log(`   📝 Justificados: ${justificados} (${((justificados/registrosDia17.length)*100).toFixed(1)}%)`);
      console.log(`   ❌ Ausentes: ${ausentes} (${((ausentes/registrosDia17.length)*100).toFixed(1)}%)`);
      console.log(`   ⏰ Primeiro: ${registrosDia17[0].hora}`);
      console.log(`   ⏰ Último: ${registrosDia17[registrosDia17.length-1].hora}\n`);
      
      console.log("👥 PRIMEIROS 10 REGISTROS:");
      registrosDia17.slice(0, 10).forEach((r, i) => {
        const emoji = r.status === 'Presente' ? '✅' : r.status === 'Justificado' ? '📝' : '❌';
        const num = (i+1).toString().padStart(2, ' ');
        console.log(`   ${num}. ${emoji} ${r.nome} - ${r.hora}`);
      });
      
      if (registrosDia17.length > 10) {
        console.log(`   ... e mais ${registrosDia17.length - 10} registros`);
      }
    } else {
      console.log("❌ Nenhum registro encontrado para o dia 17/08/2025");
      
      // Debug: Mostrar algumas datas para verificar formato
      console.log("\n🔍 DEBUG: Exemplos de timestamps na base:");
      snapshot.docs.slice(0, 5).forEach(doc => {
        const data = doc.data();
        if (data.timestamp) {
          const timestamp = data.timestamp.toDate();
          const dataManaus = new Date(timestamp.toLocaleString("en-US", { timeZone: "America/Manaus" }));
          console.log("   " + data.fullName + ": " + dataManaus.toLocaleDateString('pt-BR') + " " + dataManaus.toLocaleTimeString('pt-BR'));
        }
      });
    }
    
  } catch (error) {
    console.error("❌ Erro:", error);
  }
}

debugDia17();
