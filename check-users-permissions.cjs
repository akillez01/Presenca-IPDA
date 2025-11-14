const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'reuniao-ministerial'
});

async function checkUsersAndPermissions() {
  try {
    console.log('👥 Verificando usuários e permissões...');
    
    // Listar usuários do Firebase Auth
    const auth = admin.auth();
    const listUsersResult = await auth.listUsers();
    
    console.log(`📊 Total de usuários no sistema: ${listUsersResult.users.length}`);
    console.log('\n👤 USUÁRIOS REGISTRADOS:');
    
    listUsersResult.users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   UID: ${user.uid}`);
      console.log(`   Verificado: ${user.emailVerified ? '✅' : '❌'}`);
      console.log(`   Desabilitado: ${user.disabled ? '❌' : '✅'}`);
      console.log(`   Criado em: ${user.metadata.creationTime}`);
      console.log(`   Último login: ${user.metadata.lastSignInTime || 'Nunca'}`);
      
      // Verificar custom claims se existirem
      if (user.customClaims) {
        console.log(`   Claims customizados: ${JSON.stringify(user.customClaims)}`);
      }
      console.log('---');
    });
    
    // Verificar a coleção users no Firestore
    const db = admin.firestore();
    const usersCollection = db.collection('users');
    const usersSnapshot = await usersCollection.get();
    
    console.log(`\n🗄️ Documentos na coleção 'users': ${usersSnapshot.size}`);
    
    if (usersSnapshot.size > 0) {
      console.log('\n📋 DOCUMENTOS DE USUÁRIOS NO FIRESTORE:');
      usersSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`${index + 1}. ID do documento: ${doc.id}`);
        console.log(`   Email: ${data.email || 'N/A'}`);
        console.log(`   Nome: ${data.name || data.displayName || 'N/A'}`);
        console.log(`   Tipo: ${data.role || data.userType || 'N/A'}`);
        console.log(`   Ativo: ${data.active !== false ? '✅' : '❌'}`);
        console.log('---');
      });
    }
    
    // Testar acesso à coleção attendance
    console.log('\n🔒 TESTANDO ACESSO À COLEÇÃO ATTENDANCE...');
    const attendanceCollection = db.collection('attendance');
    const testQuery = attendanceCollection.limit(1);
    const testSnapshot = await testQuery.get();
    
    console.log(`✅ Acesso à coleção attendance: OK (${testSnapshot.size} documento(s) retornado(s))`);
    
    // Verificar se há problemas de conexão ou autenticação
    console.log('\n🌐 VERIFICANDO CONECTIVIDADE...');
    const now = new Date();
    console.log(`Timestamp atual: ${now.toISOString()}`);
    console.log(`Projeto ID: ${admin.app().options.projectId}`);
    
  } catch (error) {
    console.error('❌ Erro ao verificar usuários e permissões:', error);
    
    if (error.code === 'permission-denied') {
      console.error('🚫 Erro de permissão detectado!');
    } else if (error.code === 'unauthenticated') {
      console.error('🔑 Erro de autenticação detectado!');
    }
    
    throw error;
  }
}

checkUsersAndPermissions()
  .then(() => {
    console.log('\n✅ Verificação concluída!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Verificação falhou:', error);
    process.exit(1);
  });