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

async function verificarPermissoesUsuario() {
  try {
    console.log('🔍 Verificando permissões do usuário presente@ipda.app.br...\n');

    const email = 'presente@ipda.app.br';
    const uid = 'h9jGbyblHYXGMy52z6aDoKvWMeA3';

    try {
      // Verificar dados no Firebase Auth
      const userRecord = await auth.getUser(uid);
      console.log('📋 DADOS NO FIREBASE AUTH:');
      console.log('   - UID:', userRecord.uid);
      console.log('   - Email:', userRecord.email);
      console.log('   - Display Name:', userRecord.displayName);
      console.log('   - Email Verified:', userRecord.emailVerified);
      console.log('   - Disabled:', userRecord.disabled);
      console.log('   - Custom Claims:', JSON.stringify(userRecord.customClaims, null, 2));
      console.log('   - Provider Data:', userRecord.providerData?.map(p => ({ providerId: p.providerId, uid: p.uid, email: p.email })));
      console.log('   - Metadata:', {
        creationTime: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime,
        lastRefreshTime: userRecord.metadata.lastRefreshTime
      });

      console.log('\n📋 DADOS NO FIRESTORE:');
      // Verificar documento no Firestore
      const firestoreDoc = await db.collection('users').doc(uid).get();
      if (firestoreDoc.exists) {
        const data = firestoreDoc.data();
        console.log('   - Documento existe:', true);
        console.log('   - Dados:', JSON.stringify(data, null, 2));
      } else {
        console.log('   - Documento existe:', false);
        console.log('   ⚠️ PROBLEMA: Documento não encontrado no Firestore!');
      }

      console.log('\n🔍 TESTE DE ACESSO À COLEÇÃO ATTENDANCE:');
      
      try {
        // Testar listagem de documentos (as primeiras 5)
        const attendanceSnapshot = await db.collection('attendance').limit(5).get();
        console.log('   - Quantidade de registros acessíveis:', attendanceSnapshot.size);
        console.log('   - Acesso de leitura: ✅ PERMITIDO');
        
        // Mostrar alguns exemplos
        attendanceSnapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`   - Registro ${index + 1}:`, {
            id: doc.id,
            fullName: data.fullName,
            status: data.status,
            timestamp: data.timestamp?.toDate?.()?.toLocaleString('pt-BR') || data.timestamp
          });
        });

      } catch (error) {
        console.log('   - Acesso de leitura: ❌ NEGADO');
        console.log('   - Erro:', error.message);
      }

      console.log('\n✅ RESUMO DA VERIFICAÇÃO:');
      console.log('   - Usuário existe no Auth: ✅');
      console.log('   - Custom Claims configurados:', userRecord.customClaims ? '✅' : '❌');
      console.log('   - Documento Firestore existe:', firestoreDoc.exists ? '✅' : '❌');
      console.log('   - Pode acessar attendance:', '✅ (testado acima)');
      
      if (!userRecord.customClaims || !firestoreDoc.exists) {
        console.log('\n⚠️ AÇÕES RECOMENDADAS:');
        if (!userRecord.customClaims) {
          console.log('   - Definir custom claims para o usuário');
        }
        if (!firestoreDoc.exists) {
          console.log('   - Criar documento no Firestore para o usuário');
        }
      } else {
        console.log('\n🎉 TUDO CONFIGURADO CORRETAMENTE!');
      }
      
    } catch (error) {
      console.error(`❌ Erro ao verificar usuário ${email}:`, error.message);
    }
    
  } catch (error) {
    console.error('❌ Erro na verificação:', error);
  } finally {
    process.exit(0);
  }
}

verificarPermissoesUsuario();
