import { getAttendanceRecords } from '../src/lib/actions';
import { addPresenca } from '../src/lib/presenca-mysql';

async function migrateFirebaseToMysql() {
  const firebaseRecords = await getAttendanceRecords();
  let count = 0;
  for (const rec of firebaseRecords) {
    try {
      await addPresenca({
        fullName: rec.fullName,
        cpf: rec.cpf,
        reclassification: rec.reclassification,
        pastorName: rec.pastorName,
        region: rec.region,
        churchPosition: rec.churchPosition,
        city: rec.city,
        shift: rec.shift,
        status: rec.status,
        createdAt: rec.timestamp,
      });
      count++;
    } catch (err) {
      console.error(`Erro ao migrar CPF ${rec.cpf}:`, err);
    }
  }
  console.log(`Migração concluída: ${count} registros importados para o MySQL.`);
}

migrateFirebaseToMysql();
