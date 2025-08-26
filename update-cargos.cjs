#!/usr/bin/env node

// Script para atualizar o Firebase com os novos cargos
// Execute: node update-cargos.js

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Configuração do Firebase (substitua pelos seus dados)
const firebaseConfig = {
  // Suas configurações do Firebase aqui
  // Ou carregue de process.env se estiver usando variáveis de ambiente
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateCargos() {
  try {
    console.log('🔄 Atualizando cargos no Firebase...');
    
    const configRef = doc(db, 'system', 'config');
    
    const updatedConfig = {
      churchPositionOptions: [
        'Conselheiro(a)',
        'Financeiro(a)', 
        'Secretário(a)',
        'Pastor',
        'Presbítero',
        'Diácono',
        'Dirigente 1',
        'Dirigente 2',
        'Dirigente 3',
        'Cooperador(a)',
        'Líder Reação',
        'Líder Simplifique', 
        'Líder Creative',
        'Líder Discipulus',
        'Líder Adore',
        'Auxiliar Adore',
        'Auxiliar Reação',
        'Auxiliar Simplifique',
        'Auxiliar Discipulus',
        'Auxiliar Creative',
        'Auxiliar Expansão (a)',
        'Etda Professor(a)',
        'Coordenador Etda (a)',
        'Líder Galileu (a)',
        'Líder Adote uma alma (a)',
        'Membro',
        'Outro'
      ],
      reclassificationOptions: [
        'Local', 
        'Setorial', 
        'Central', 
        'Casa de oração', 
        'Estadual', 
        'Regional'
      ],
      shiftOptions: [
        'Manhã', 
        'Tarde', 
        'Noite'
      ],
      statusOptions: [
        'Presente', 
        'Ausente', 
        'Justificado'
      ],
      lastUpdated: new Date().toISOString(),
      updatedBy: 'script-update-cargos'
    };

    await setDoc(configRef, updatedConfig, { merge: true });
    
    console.log('✅ Cargos atualizados com sucesso no Firebase!');
    console.log('📋 Novos cargos adicionados:');
    console.log('   - Secretário(a)');
    console.log('   - Dirigente 1');
    console.log('   - Dirigente 2'); 
    console.log('   - Dirigente 3');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao atualizar cargos:', error);
    process.exit(1);
  }
}

updateCargos();
