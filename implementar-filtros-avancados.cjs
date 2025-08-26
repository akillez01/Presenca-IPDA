const admin = require('firebase-admin');

// Configuração do Firebase
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://reuniao-ministerial-default-rtdb.firebaseio.com"
});

const db = admin.firestore();

async function implementarFiltrosAvancados() {
  try {
    console.log('🚀 IMPLEMENTANDO FILTROS AVANÇADOS BASEADOS NA INVESTIGAÇÃO');
    console.log('═'.repeat(70));
    
    // 1. Buscar dados da coleção attendance
    const attendanceRef = db.collection('attendance');
    const snapshot = await attendanceRef.get();
    
    console.log(`📊 Total de registros na coleção attendance: ${snapshot.size}`);
    console.log('');
    
    const dados = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      dados.push({
        id: doc.id,
        ...data
      });
    });
    
    // 2. Analisar campos únicos disponíveis para filtros
    console.log('📋 ANÁLISE DE CAMPOS DISPONÍVEIS PARA FILTROS:');
    console.log('─'.repeat(50));
    
    const camposUnicos = {
      pastores: new Set(),
      cargos: new Set(),
      regioes: new Set(),
      cidades: new Set(),
      turnos: new Set(),
      cursos: new Set(),
      reclassificacoes: new Set(),
      status: new Set()
    };
    
    dados.forEach(registro => {
      if (registro.pastorName) camposUnicos.pastores.add(registro.pastorName);
      if (registro.churchPosition) camposUnicos.cargos.add(registro.churchPosition);
      if (registro.region) camposUnicos.regioes.add(registro.region);
      if (registro.cidade) camposUnicos.cidades.add(registro.cidade);
      if (registro.turno) camposUnicos.turnos.add(registro.turno);
      if (registro.curso) camposUnicos.cursos.add(registro.curso);
      if (registro.reclassificacao) camposUnicos.reclassificacoes.add(registro.reclassificacao);
      if (registro.status) camposUnicos.status.add(registro.status);
    });
    
    console.log(`👨‍🎓 Pastores únicos encontrados: ${camposUnicos.pastores.size}`);
    [...camposUnicos.pastores].slice(0, 5).forEach(pastor => console.log(`   • ${pastor}`));
    if (camposUnicos.pastores.size > 5) console.log(`   • ... e mais ${camposUnicos.pastores.size - 5} pastores\n`);
    
    console.log(`💼 Cargos únicos encontrados: ${camposUnicos.cargos.size}`);
    [...camposUnicos.cargos].slice(0, 10).forEach(cargo => console.log(`   • ${cargo}`));
    if (camposUnicos.cargos.size > 10) console.log(`   • ... e mais ${camposUnicos.cargos.size - 10} cargos\n`);
    
    console.log(`🌍 Regiões únicas encontradas: ${camposUnicos.regioes.size}`);
    [...camposUnicos.regioes].forEach(regiao => console.log(`   • ${regiao}`));
    console.log('');
    
    console.log(`🏘️ Cidades únicas encontradas: ${camposUnicos.cidades.size}`);
    [...camposUnicos.cidades].slice(0, 10).forEach(cidade => console.log(`   • ${cidade}`));
    if (camposUnicos.cidades.size > 10) console.log(`   • ... e mais ${camposUnicos.cidades.size - 10} cidades\n`);
    
    console.log(`🌅 Turnos únicos encontrados: ${camposUnicos.turnos.size}`);
    [...camposUnicos.turnos].forEach(turno => console.log(`   • ${turno}`));
    console.log('');
    
    // 3. Estatísticas por cargo
    console.log('📈 ESTATÍSTICAS POR CARGO:');
    console.log('─'.repeat(30));
    
    const estatisticasCargos = {};
    dados.forEach(registro => {
      const cargo = registro.churchPosition || 'Não informado';
      const cargoLower = cargo.toLowerCase();
      
      // Categorizar cargos
      let categoria = 'Outros';
      if (cargoLower.includes('pastor')) categoria = 'Pastor';
      else if (cargoLower.includes('cooperador')) categoria = 'Cooperador';
      else if (cargoLower.includes('presbítero')) categoria = 'Presbítero';
      else if (cargoLower.includes('financeiro')) categoria = 'Financeiro';
      else if (cargoLower.includes('diácono')) categoria = 'Diácono';
      else if (cargoLower.includes('obreiro')) categoria = 'Obreiro';
      else if (cargoLower.includes('membro')) categoria = 'Membro';
      
      estatisticasCargos[categoria] = (estatisticasCargos[categoria] || 0) + 1;
    });
    
    Object.entries(estatisticasCargos)
      .sort(([,a], [,b]) => b - a)
      .forEach(([cargo, count]) => {
        const percentual = ((count / dados.length) * 100).toFixed(1);
        console.log(`   ${cargo}: ${count} (${percentual}%)`);
      });
    
    // 4. Demonstrar exemplos de filtros
    console.log('\n🔍 EXEMPLOS DE FILTROS IMPLEMENTÁVEIS:');
    console.log('─'.repeat(40));
    
    // Exemplo 1: Filtrar apenas pastores
    const pastores = dados.filter(r => 
      r.churchPosition && r.churchPosition.toLowerCase().includes('pastor')
    );
    console.log(`📊 Filtro "Apenas Pastores": ${pastores.length} registros`);
    
    // Exemplo 2: Filtrar por região específica (primeira região disponível)
    const primeiraRegiao = [...camposUnicos.regioes][0];
    if (primeiraRegiao) {
      const porRegiao = dados.filter(r => r.region === primeiraRegiao);
      console.log(`🌍 Filtro "Região ${primeiraRegiao}": ${porRegiao.length} registros`);
    }
    
    // Exemplo 3: Filtro combinado (pastor + data específica)
    const dia17 = dados.filter(r => {
      if (!r.timestamp) return false;
      const data = new Date(r.timestamp.toDate ? r.timestamp.toDate() : r.timestamp);
      return data.getDate() === 17 && 
             data.getMonth() === 7 && // Agosto (0-indexed)
             data.getFullYear() === 2025 &&
             r.churchPosition && r.churchPosition.toLowerCase().includes('pastor');
    });
    console.log(`👨‍🎓 Filtro "Pastores no dia 17/08/2025": ${dia17.length} registros`);
    
    // 5. Criar arquivo JSON com dados estruturados para os filtros
    const dadosEstruturados = {
      totalRegistros: dados.length,
      opcoesFiltro: {
        pastores: [...camposUnicos.pastores].sort(),
        cargos: [...camposUnicos.cargos].sort(),
        regioes: [...camposUnicos.regioes].sort(),
        cidades: [...camposUnicos.cidades].sort(),
        turnos: [...camposUnicos.turnos].sort(),
        cursos: [...camposUnicos.cursos].sort(),
        reclassificacoes: [...camposUnicos.reclassificacoes].sort(),
        status: [...camposUnicos.status].sort()
      },
      estatisticasCargos,
      ultimaAtualizacao: new Date().toISOString()
    };
    
    // Salvar dados estruturados
    const fs = require('fs');
    fs.writeFileSync('./dados-filtros-estruturados.json', JSON.stringify(dadosEstruturados, null, 2));
    console.log('\n✅ Dados estruturados salvos em: dados-filtros-estruturados.json');
    
    console.log('\n🎯 RESUMO DA IMPLEMENTAÇÃO:');
    console.log('═'.repeat(30));
    console.log(`📊 Total de registros analisados: ${dados.length}`);
    console.log(`👨‍🎓 Pastores únicos: ${camposUnicos.pastores.size}`);
    console.log(`💼 Cargos únicos: ${camposUnicos.cargos.size}`);
    console.log(`🌍 Regiões únicas: ${camposUnicos.regioes.size}`);
    console.log(`🏘️ Cidades únicas: ${camposUnicos.cidades.size}`);
    console.log(`🌅 Turnos únicos: ${camposUnicos.turnos.size}`);
    console.log(`📚 Cursos únicos: ${camposUnicos.cursos.size}`);
    console.log(`🔄 Reclassificações únicas: ${camposUnicos.reclassificacoes.size}`);
    console.log(`📈 Status únicos: ${camposUnicos.status.size}`);
    
    console.log('\n✅ IMPLEMENTAÇÃO CONCLUÍDA!');
    console.log('📱 Os dados estão prontos para serem integrados no dashboard.');
    
  } catch (error) {
    console.error('❌ Erro na implementação:', error);
  } finally {
    process.exit(0);
  }
}

// Executar
implementarFiltrosAvancados();
