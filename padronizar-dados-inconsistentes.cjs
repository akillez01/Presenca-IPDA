#!/usr/bin/env node

/**
 * 🔧 SCRIPT PARA PADRONIZAR DADOS INCONSISTENTES
 * 
 * Objetivo: Corrigir inconsistências nos dados como:
 * - Nomes de pastores com variações (Marcio Cruz vs MArcio cruz)
 * - Regiões com grafias diferentes (Monte das Oliveiras vs Montes da Oliveura)
 * - Formatação de texto inconsistente
 * 
 * Data: 22 de setembro de 2025
 */

const admin = require('firebase-admin');
const fs = require('fs');

// Configuração do Firebase Admin
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🎯 MAPEAMENTO DE PADRONIZAÇÕES
const PADRONIZACOES = {
  // Pastores - Corrigir variações de nomes
  pastores: {
    'marcio cruz': 'Marcio Cruz',
    'MArcio cruz': 'Marcio Cruz', 
    'márcio cruz': 'Marcio Cruz',
    'MARCIO CRUZ': 'Marcio Cruz',
    'paulo santana': 'Paulo Santana',
    'PAULO SANTANA': 'Paulo Santana',
    'jose ronaldo': 'Jose Ronaldo',
    'JOSE RONALDO': 'Jose Ronaldo'
  },
  
  // Regiões - Corrigir variações geográficas
  regioes: {
    'montes das oliveiras': 'Monte das Oliveiras',
    'montes da oliveura': 'Monte das Oliveiras',
    'monte das oliveiras': 'Monte das Oliveiras',
    'MONTE DAS OLIVEIRAS': 'Monte das Oliveiras',
    'jorge teixeira': 'Jorge Teixeira',
    'JORGE TEIXEIRA': 'Jorge Teixeira',
    'novo israel 1': 'Novo Israel 1',
    'NOVO ISRAEL 1': 'Novo Israel 1'
  },
  
  // Cidades - Padronizar nomes de cidades
  cidades: {
    'manaus': 'Manaus',
    'MANAUS': 'Manaus',
    'manaus ': 'Manaus', // Remove espaços
    ' manaus': 'Manaus'
  },
  
  // Cargos - Padronizar cargos na igreja
  cargos: {
    'cooperador(a)': 'Cooperador(a)',
    'COOPERADOR(A)': 'Cooperador(a)',
    'cooperador': 'Cooperador(a)',
    'pastor': 'Pastor',
    'PASTOR': 'Pastor',
    'diácono': 'Diácono',
    'DIÁCONO': 'Diácono'
  },
  
  // Reclassificações - Padronizar tipos
  reclassificacoes: {
    'local': 'Local',
    'LOCAL': 'Local',
    'regional': 'Regional',
    'REGIONAL': 'Regional',
    'setorial': 'Setorial',
    'SETORIAL': 'Setorial',
    'casa de oração': 'Casa de Oração',
    'CASA DE ORAÇÃO': 'Casa de Oração'
  }
};

// 🛠️ FUNÇÃO PARA NORMALIZAR TEXTO
function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return texto;
  
  // Remove espaços extras e normaliza
  return texto.trim()
    .replace(/\s+/g, ' ') // Remove espaços múltiplos
    .toLowerCase(); // Para comparação
}

// 🔄 FUNÇÃO PARA APLICAR PADRONIZAÇÃO
function aplicarPadronizacao(valor, mapaPadronizacao) {
  if (!valor || typeof valor !== 'string') return valor;
  
  const valorNormalizado = normalizarTexto(valor);
  
  // Busca correspondência exata
  if (mapaPadronizacao[valorNormalizado]) {
    return mapaPadronizacao[valorNormalizado];
  }
  
  // Se não encontrou, mantém o original mas capitalizado
  return valor.trim().replace(/\s+/g, ' ');
}

// 📊 FUNÇÃO PRINCIPAL DE PADRONIZAÇÃO
async function padronizarDados() {
  console.log('🚀 Iniciando padronização de dados inconsistentes...\n');
  
  try {
    // Busca todos os registros de presença
    const snapshot = await db.collection('attendance').get();
    const registros = [];
    
    snapshot.forEach(doc => {
      registros.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`📊 Encontrados ${registros.length} registros para análise\n`);
    
    // Analisa e corrige inconsistências
    const correcoes = [];
    let totalCorrecoes = 0;
    
    for (const registro of registros) {
      const correcoesRegistro = {
        id: registro.id,
        original: {},
        corrigido: {},
        alteracoes: []
      };
      
      let temCorrecoes = false;
      
      // ✅ CORRIGE PASTOR
      if (registro.pastorName) {
        const pastorOriginal = registro.pastorName;
        const pastorCorrigido = aplicarPadronizacao(pastorOriginal, PADRONIZACOES.pastores);
        
        if (pastorOriginal !== pastorCorrigido) {
          correcoesRegistro.original.pastorName = pastorOriginal;
          correcoesRegistro.corrigido.pastorName = pastorCorrigido;
          correcoesRegistro.alteracoes.push(`Pastor: "${pastorOriginal}" → "${pastorCorrigido}"`);
          temCorrecoes = true;
        }
      }
      
      // ✅ CORRIGE REGIÃO
      if (registro.region) {
        const regiaoOriginal = registro.region;
        const regiaoCorrigida = aplicarPadronizacao(regiaoOriginal, PADRONIZACOES.regioes);
        
        if (regiaoOriginal !== regiaoCorrigida) {
          correcoesRegistro.original.region = regiaoOriginal;
          correcoesRegistro.corrigido.region = regiaoCorrigida;
          correcoesRegistro.alteracoes.push(`Região: "${regiaoOriginal}" → "${regiaoCorrigida}"`);
          temCorrecoes = true;
        }
      }
      
      // ✅ CORRIGE CIDADE
      if (registro.city) {
        const cidadeOriginal = registro.city;
        const cidadeCorrigida = aplicarPadronizacao(cidadeOriginal, PADRONIZACOES.cidades);
        
        if (cidadeOriginal !== cidadeCorrigida) {
          correcoesRegistro.original.city = cidadeOriginal;
          correcoesRegistro.corrigido.city = cidadeCorrigida;
          correcoesRegistro.alteracoes.push(`Cidade: "${cidadeOriginal}" → "${cidadeCorrigida}"`);
          temCorrecoes = true;
        }
      }
      
      // ✅ CORRIGE CARGO
      if (registro.churchPosition) {
        const cargoOriginal = registro.churchPosition;
        const cargoCorrigido = aplicarPadronizacao(cargoOriginal, PADRONIZACOES.cargos);
        
        if (cargoOriginal !== cargoCorrigido) {
          correcoesRegistro.original.churchPosition = cargoOriginal;
          correcoesRegistro.corrigido.churchPosition = cargoCorrigido;
          correcoesRegistro.alteracoes.push(`Cargo: "${cargoOriginal}" → "${cargoCorrigido}"`);
          temCorrecoes = true;
        }
      }
      
      // ✅ CORRIGE RECLASSIFICAÇÃO
      if (registro.reclassification) {
        const reclassOriginal = registro.reclassification;
        const reclassCorrigida = aplicarPadronizacao(reclassOriginal, PADRONIZACOES.reclassificacoes);
        
        if (reclassOriginal !== reclassCorrigida) {
          correcoesRegistro.original.reclassification = reclassOriginal;
          correcoesRegistro.corrigido.reclassification = reclassCorrigida;
          correcoesRegistro.alteracoes.push(`Reclassificação: "${reclassOriginal}" → "${reclassCorrigida}"`);
          temCorrecoes = true;
        }
      }
      
      if (temCorrecoes) {
        correcoes.push(correcoesRegistro);
        totalCorrecoes++;
      }
    }
    
    // 📋 RELATÓRIO DE ANÁLISE
    console.log('📋 RELATÓRIO DE ANÁLISE DE INCONSISTÊNCIAS');
    console.log('='.repeat(50));
    console.log(`📊 Total de registros analisados: ${registros.length}`);
    console.log(`⚠️  Registros com inconsistências: ${totalCorrecoes}`);
    console.log(`✅ Registros já padronizados: ${registros.length - totalCorrecoes}\n`);
    
    if (totalCorrecoes === 0) {
      console.log('🎉 Todos os dados já estão padronizados! Nenhuma correção necessária.');
      return;
    }
    
    // 📝 DETALHAMENTO DAS CORREÇÕES
    console.log('📝 DETALHAMENTO DAS CORREÇÕES NECESSÁRIAS:');
    console.log('-'.repeat(50));
    
    correcoes.forEach((correcao, index) => {
      console.log(`\n${index + 1}. Registro: ${registros.find(r => r.id === correcao.id)?.fullName || correcao.id}`);
      correcao.alteracoes.forEach(alteracao => {
        console.log(`   • ${alteracao}`);
      });
    });
    
    // ❓ CONFIRMAÇÃO PARA APLICAR CORREÇÕES
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const resposta = await new Promise(resolve => {
      rl.question(`\n❓ Deseja aplicar essas ${totalCorrecoes} correções? (s/N): `, resolve);
    });
    
    rl.close();
    
    if (resposta.toLowerCase() !== 's' && resposta.toLowerCase() !== 'sim') {
      console.log('❌ Operação cancelada pelo usuário.');
      return;
    }
    
    // 🔄 APLICANDO CORREÇÕES
    console.log('\n🔄 Aplicando correções no Firebase...\n');
    
    let sucessos = 0;
    let erros = 0;
    
    for (const correcao of correcoes) {
      try {
        const dadosAtualizados = {
          ...correcao.corrigido,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: 'Sistema de Padronização'
        };
        
        await db.collection('attendance').doc(correcao.id).update(dadosAtualizados);
        
        console.log(`✅ Corrigido: ${registros.find(r => r.id === correcao.id)?.fullName || correcao.id}`);
        sucessos++;
        
      } catch (error) {
        console.error(`❌ Erro ao corrigir ${correcao.id}:`, error.message);
        erros++;
      }
    }
    
    // 📊 RELATÓRIO FINAL
    console.log('\n📊 RELATÓRIO FINAL DE PADRONIZAÇÃO');
    console.log('='.repeat(40));
    console.log(`✅ Correções aplicadas com sucesso: ${sucessos}`);
    console.log(`❌ Correções que falharam: ${erros}`);
    console.log(`📊 Taxa de sucesso: ${((sucessos / totalCorrecoes) * 100).toFixed(1)}%`);
    
    if (sucessos > 0) {
      console.log('\n🎉 Padronização concluída com sucesso!');
      console.log('💡 Recomendação: Execute novamente o sistema para verificar as mudanças.');
    }
    
    // 💾 SALVA RELATÓRIO
    const relatorio = {
      timestamp: new Date().toISOString(),
      totalRegistros: registros.length,
      totalCorrecoes: totalCorrecoes,
      sucessos: sucessos,
      erros: erros,
      detalhes: correcoes
    };
    
    const nomeRelatorio = `relatorio-padronizacao-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(nomeRelatorio, JSON.stringify(relatorio, null, 2));
    console.log(`\n💾 Relatório salvo em: ${nomeRelatorio}`);
    
  } catch (error) {
    console.error('❌ Erro durante a padronização:', error);
  } finally {
    process.exit(0);
  }
}

// 🚀 EXECUÇÃO
if (require.main === module) {
  padronizarDados();
}

module.exports = { padronizarDados };
