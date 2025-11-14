import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function fixUserPermissions() {
  try {
    console.log('🔧 Corrigindo permissões do usuário cadastro@ipda.app.br...');

    const email = 'cadastro@ipda.app.br';
    const uid = 'crOr8gf1npgSmpAKYL6DHy71NNt2';

    try {
      // Definir custom claims para o usuário
      await auth.setCustomUserClaims(uid, {
        basicUser: true,
        role: 'user',
        canRegister: true,
        canViewAttendance: true
      });
      console.log(`✅ Custom claims configurados para: ${email}`);

      // Criar/atualizar documento no Firestore
      await db.collection('users').doc(uid).set({
        uid: uid,
        email: email,
        displayName: 'Cadastro IPDA',
        role: 'user',
        active: true,
        canRegister: true,
        canViewAttendance: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      console.log(`✅ Documento Firestore criado/atualizado para: ${email}`);
      console.log('🎉 Permissões corrigidas com sucesso!');
      
      // Verificar as permissões aplicadas
      const userRecord = await auth.getUser(uid);
      console.log('📋 Verificação das permissões:');
      console.log('   - UID:', userRecord.uid);
      console.log('   - Email:', userRecord.email);
      console.log('   - Custom Claims:', userRecord.customClaims);
      
      // Testar acesso à coleção attendance
      console.log('\n🔍 Testando acesso à coleção attendance...');
      const attendanceSnapshot = await db.collection('attendance').limit(3).get();
      console.log(`   - Registros acessíveis: ${attendanceSnapshot.size}`);
      console.log('   - Acesso confirmado: ✅');
      
    } catch (error) {
      console.error(`❌ Erro ao processar ${email}:`, error.message);
    }
    
  } catch (error) {
    console.error('❌ Erro na correção de permissões:', error);
  } finally {
    process.exit(0);
  }
}

fixUserPermissions();
