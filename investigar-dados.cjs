const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function investigarDados() {
  console.log("🔍 " + "=".repeat(70));
  console.log("🔍 INVESTIGAÇÃO COMPLETA DOS DADOS - DIA 17 DE AGOSTO DE 2025");
  console.log("🔍 " + "=".repeat(70));
  console.log();
  
  try {
    // 1. Verificar todas as coleções
    console.log("📋 1. VERIFICANDO TODAS AS COLEÇÕES:");
    console.log("─".repeat(50));
    
    const collections = await db.listCollections();
    console.log(`   📁 Total de coleções: ${collections.length}`);
    
    for (const collection of collections) {
      const snapshot = await collection.limit(1).get();
      console.log(`   📂 ${collection.id}: ${snapshot.docs.length > 0 ? 'Tem dados' : 'Vazia'}`);
    }
    console.log();
    
    // 2. Verificar coleção 'attendance' especificamente
    console.log("📋 2. ANALISANDO COLEÇÃO 'attendance':");
    console.log("─".repeat(50));
    
    const attendanceSnapshot = await db.collection('attendance').get();
    console.log(`   📊 Total de documentos: ${attendanceSnapshot.docs.length}`);
    
    if (attendanceSnapshot.docs.length > 0) {
      console.log(`   📋 Primeiros 3 documentos:`);
      attendanceSnapshot.docs.slice(0, 3).forEach((doc, i) => {
        const data = doc.data();
        const timestamp = data.timestamp || data.createdAt;
        const dataFormatada = timestamp ? 
          (timestamp.toDate ? timestamp.toDate().toLocaleDateString('pt-BR') : new Date(timestamp).toLocaleDateString('pt-BR')) 
          : 'Sem data';
        
        console.log(`      ${i+1}. ID: ${doc.id}`);
        console.log(`         Nome: ${data.fullName || 'N/A'}`);
        console.log(`         Status: ${data.status || 'N/A'}`);
        console.log(`         Data: ${dataFormatada}`);
        console.log();
      });
    }
    
    // 3. Filtrar especificamente por dia 17/08/2025
    console.log("📋 3. FILTRO ESPECÍFICO PARA 17/08/2025:");
    console.log("─".repeat(50));
    
    // Tentar diferentes formatos de data
    const formatosDatas = [
      // Formato 1: Timestamp completo
      {
        nome: "Timestamp UTC",
        inicio: new Date('2025-08-17T00:00:00.000Z'),
        fim: new Date('2025-08-17T23:59:59.999Z')
      },
      // Formato 2: Timezone Manaus
      {
        nome: "Timestamp Manaus",
        inicio: new Date('2025-08-17T04:00:00.000Z'), // 00:00 Manaus = 04:00 UTC
        fim: new Date('2025-08-18T03:59:59.999Z')    // 23:59 Manaus = 03:59 UTC (dia seguinte)
      }
    ];
    
    for (const formato of formatosDatas) {
      console.log(`   🔍 Testando: ${formato.nome}`);
      console.log(`      Início: ${formato.inicio.toISOString()}`);
      console.log(`      Fim: ${formato.fim.toISOString()}`);
      
      try {
        const snapshot = await db.collection('attendance')
          .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(formato.inicio))
          .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(formato.fim))
          .get();
        
        console.log(`      📊 Registros encontrados: ${snapshot.docs.length}`);
        
        if (snapshot.docs.length > 0) {
          const presentes = snapshot.docs.filter(doc => doc.data().status === 'Presente').length;
          const justificados = snapshot.docs.filter(doc => doc.data().status === 'Justificado').length;
          const ausentes = snapshot.docs.filter(doc => doc.data().status === 'Ausente').length;
          
          console.log(`      ✅ Presentes: ${presentes}`);
          console.log(`      📝 Justificados: ${justificados}`);
          console.log(`      ❌ Ausentes: ${ausentes}`);
          
          // Mostrar horários
          if (snapshot.docs.length > 0) {
            const primeiroDoc = snapshot.docs[0];
            const ultimoDoc = snapshot.docs[snapshot.docs.length - 1];
            
            const primeiroTimestamp = primeiroDoc.data().timestamp;
            const ultimoTimestamp = ultimoDoc.data().timestamp;
            
            if (primeiroTimestamp && ultimoTimestamp) {
              const primeiroHorario = primeiroTimestamp.toDate().toLocaleTimeString('pt-BR', { timeZone: 'America/Manaus' });
              const ultimoHorario = ultimoTimestamp.toDate().toLocaleTimeString('pt-BR', { timeZone: 'America/Manaus' });
              
              console.log(`      ⏰ Primeiro: ${primeiroHorario}`);
              console.log(`      ⏰ Último: ${ultimoHorario}`);
            }
          }
        }
      } catch (error) {
        console.log(`      ❌ Erro: ${error.message}`);
      }
      console.log();
    }
    
    // 4. Verificar outras possíveis coleções
    console.log("📋 4. VERIFICANDO OUTRAS POSSÍVEIS COLEÇÕES:");
    console.log("─".repeat(50));
    
    const possiveisColecoes = ['presencas', 'registros', 'participantes', 'eventos', 'reunioes'];
    
    for (const nomeColecao of possiveisColecoes) {
      try {
        const snapshot = await db.collection(nomeColecao).limit(1).get();
        if (snapshot.docs.length > 0) {
          const total = await db.collection(nomeColecao).get();
          console.log(`   📂 ${nomeColecao}: ${total.docs.length} documentos`);
        }
      } catch (error) {
        // Coleção não existe
      }
    }
    
    console.log();
    console.log("🎯 CONCLUSÃO DA INVESTIGAÇÃO:");
    console.log("═".repeat(70));
    console.log("   Esta análise mostra exatamente onde estão os dados e");
    console.log("   qual fonte está sendo usada para gerar os números diferentes.");
    console.log("═".repeat(70));
    
  } catch (error) {
    console.error("❌ Erro na investigação:", error);
  }
}

investigarDados();
