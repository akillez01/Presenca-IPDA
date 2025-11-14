import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Inicializar Firebase Admin usando variável de ambiente ou novo arquivo padrão
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json';
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(credentialsPath, 'utf8'));
} catch (err) {
  console.error('❌ Não foi possível ler o arquivo de credenciais:', credentialsPath);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Função para configurar permissões dos usuários específicos
async function configureSpecificUsers() {
  console.log('🔧 Configurando permissões para usuários específicos...\n');
  
  try {
    // Usuários que devem ter permissão para editar presenças cadastrados
    const usersToUpdate = [
      {
        uid: 'h9jGbyblHYXGMy52z6aDoKvWMeA3',
        email: 'presente@ipda.app.br',
        displayName: 'Controle de Presença IPDA'
      },
      {
        uid: 'crOr8gf1npgSmpAKYL6DHy71NNt2', 
        email: 'cadastro@ipda.app.br',
        displayName: 'Cadastro IPDA'
      }
    ];

    for (const userInfo of usersToUpdate) {
      try {
        // 1. Configurar custom claims no Firebase Auth
        const customClaims = {
          userType: 'EDITOR_USER', // Novo tipo para editores
          permissions: [
            'dashboard', 
            'register', 
            'attendance', 
            'letters',
            'presencadecadastrados', // Permissão específica para editar presenças
            'edit_attendance' // Permissão para editar registros de presença
          ],
          role: 'editor',
          canEditAttendance: true // Flag específica para edição
        };

        await admin.auth().setCustomUserClaims(userInfo.uid, customClaims);
        console.log(`✅ Custom claims configurados para: ${userInfo.email}`);

        // 2. Criar/atualizar documento do usuário no Firestore
        const userDoc = {
          email: userInfo.email,
          displayName: userInfo.displayName,
          role: 'editor',
          userType: 'EDITOR_USER',
          permissions: customClaims.permissions,
          canEditAttendance: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          isActive: true
        };

        await db.collection('users').doc(userInfo.uid).set(userDoc, { merge: true });
        console.log(`✅ Documento Firestore atualizado para: ${userInfo.email}`);

        // 3. Verificar se o usuário existe no Auth
        try {
          const userRecord = await admin.auth().getUser(userInfo.uid);
          console.log(`📋 Usuário ${userInfo.email} encontrado no Auth:`, {
            uid: userRecord.uid,
            email: userRecord.email,
            emailVerified: userRecord.emailVerified,
            disabled: userRecord.disabled
          });
        } catch (authError) {
          console.log(`⚠️  Usuário ${userInfo.email} não encontrado no Auth`);
        }

      } catch (error) {
        console.error(`❌ Erro ao configurar usuário ${userInfo.email}:`, error);
      }
    }

    console.log('\n🎉 Configuração de permissões concluída!');
    console.log('\n📋 Resumo das permissões concedidas:');
    console.log('   - presente@ipda.app.br: Editor com permissão para editar presenças');
    console.log('   - cadastro@ipda.app.br: Editor com permissão para editar presenças');
    console.log('\n🔧 Próximos passos:');
    console.log('   1. Os usuários podem fazer login normalmente');
    console.log('   2. Terão acesso à página /presencadecadastrados');
    console.log('   3. Poderão editar registros de presença');
    console.log('   4. Terão permissões de usuário básico + edição');

  } catch (error) {
    console.error('❌ Erro geral na configuração:', error);
  }
}

// Executar configuração
configureSpecificUsers()
  .then(() => {
    console.log('\n✅ Script executado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro na execução do script:', error);
    process.exit(1);
  });