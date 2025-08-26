/**
 * Script para migrar dados existentes no Firestore
 * Adiciona o campo 'birthday' aos registros de presença
 */

import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

export async function migrateAttendanceRecords() {
  console.log('🔄 Iniciando migração do banco de dados...');
  
  try {
    const attendanceRef = collection(db, 'attendance');
    const snapshot = await getDocs(attendanceRef);
    
    console.log(`📊 Encontrados ${snapshot.size} registros para verificar`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      
      // Se já tem o campo birthday, pular
      if (data.birthday !== undefined) {
        skipped++;
        continue;
      }
      
      // Adicionar campo birthday vazio
      await updateDoc(doc(db, 'attendance', docSnap.id), {
        birthday: '' // Campo vazio para preenchimento posterior
      });
      
      updated++;
      console.log(`✅ Atualizado: ${data.fullName || 'Registro ' + docSnap.id}`);
    }
    
    console.log(`\n🎉 Migração concluída!`);
    console.log(`✅ Registros atualizados: ${updated}`);
    console.log(`⏭️  Registros já atualizados: ${skipped}`);
    
    return { updated, skipped, total: snapshot.size };
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    throw error;
  }
}

// Para executar no console do navegador ou em um componente temporário:
// import { migrateAttendanceRecords } from './scripts/migrate-database.ts';
// migrateAttendanceRecords();
