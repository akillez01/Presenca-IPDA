// Teste para verificar se getAttendanceRecords do frontend está funcionando
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA6_YWMcTzvKzCbZgl88SJvWpAUuE8LilE",
  authDomain: "reuniao-ministerial.firebaseapp.com",
  projectId: "reuniao-ministerial",
  storageBucket: "reuniao-ministerial.appspot.com",
  messagingSenderId: "23562502277",
  appId: "1:23562502277:web:ad150c66054fe08241e9ec"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Função identica ao api-actions.ts
async function getAttendanceRecords() {
  try {
    const attendanceCollection = collection(db, 'attendance');
    const snapshot = await getDocs(attendanceCollection);
    
    const records = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      records.push({
        id: doc.id,
        ...data,
        // Converte Timestamp do Firestore para Date se necessário
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate() : data.lastUpdated,
      });
    });
    
    return records;
  } catch (error) {
    console.error('Erro ao buscar registros de presença:', error);
    throw error;
  }
}

async function testFrontendFunction() {
  try {
    console.log('🧪 Testando função getAttendanceRecords do frontend...');
    const records = await getAttendanceRecords();
    
    console.log(`📊 Total de registros retornados: ${records.length}`);
    
    if (records.length > 0) {
      console.log('✅ Função está funcionando!');
      
      console.log('\n📋 Primeira registro:');
      const first = records[0];
      console.log(`ID: ${first.id}`);
      console.log(`Nome: ${first.fullName || first.nome || 'N/A'}`);
      console.log(`CPF: ${first.cpf || 'N/A'}`);
      console.log(`Status: ${first.status || 'N/A'}`);
      console.log(`Timestamp: ${first.timestamp || 'N/A'}`);
      
      // Verificar se há registros de hoje
      const today = new Date();
      const todayString = today.toDateString();
      
      let todayCount = 0;
      records.forEach(record => {
        if (record.timestamp && record.timestamp.toDateString() === todayString) {
          todayCount++;
        }
      });
      
      console.log(`\n📅 Registros de hoje: ${todayCount}`);
      
    } else {
      console.log('❌ Função não retornou dados!');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testFrontendFunction();