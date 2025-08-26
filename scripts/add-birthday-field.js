#!/usr/bin/env node

/**
 * Script para adicionar o campo 'birthday' aos registros existentes de presença
 * Execute: node scripts/add-birthday-field.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

// Configuração do Firebase (usando as variáveis do .env)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addBirthdayFieldToExistingRecords() {
  try {
    console.log('🔄 Iniciando migração para adicionar campo birthday...');
    
    // Buscar todos os documentos da coleção attendance
    const attendanceCollection = collection(db, 'attendance');
    const snapshot = await getDocs(attendanceCollection);
    
    console.log(`📊 Encontrados ${snapshot.size} registros para atualizar`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    // Processar cada documento
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const docId = docSnap.id;
      
      // Verificar se o campo birthday já existe
      if (data.birthday !== undefined) {
        console.log(`⏭️  Registro ${docId} já possui campo birthday: ${data.birthday}`);
        skippedCount++;
        continue;
      }
      
      // Adicionar campo birthday vazio (opcional)
      const updateData = {
        birthday: '' // Campo vazio que pode ser preenchido posteriormente
      };
      
      try {
        await updateDoc(doc(db, 'attendance', docId), updateData);
        console.log(`✅ Registro ${docId} (${data.fullName || 'Nome não disponível'}) atualizado com campo birthday`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Erro ao atualizar registro ${docId}:`, error);
      }
      
      // Pequena pausa para não sobrecarregar o banco
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n🎉 Migração concluída!');
    console.log(`✅ Registros atualizados: ${updatedCount}`);
    console.log(`⏭️  Registros pulados (já tinham o campo): ${skippedCount}`);
    console.log(`📊 Total processado: ${snapshot.size}`);
    
    if (updatedCount > 0) {
      console.log('\n📝 Próximos passos:');
      console.log('1. Os registros agora possuem o campo birthday (vazio)');
      console.log('2. Os usuários podem editar os registros para adicionar as datas de aniversário');
      console.log('3. Formato recomendado: dd/mm/aaaa (ex: 15/03/1980)');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  // Carregar variáveis de ambiente
  require('dotenv').config({ path: '.env.local' });
  
  addBirthdayFieldToExistingRecords()
    .then(() => {
      console.log('✅ Script finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Script falhou:', error);
      process.exit(1);
    });
}

module.exports = { addBirthdayFieldToExistingRecords };
