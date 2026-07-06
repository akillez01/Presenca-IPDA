const admin = require('firebase-admin');
const {
  loadCredentials,
  getFirebaseAdminConfig,
  getUsersByKeys,
} = require('./credentials-loader.cjs');

const credentials = loadCredentials();
const firebaseAdminConfig = getFirebaseAdminConfig(credentials);

// Inicializar Firebase Admin
const serviceAccount = require(firebaseAdminConfig.serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  ...(firebaseAdminConfig.projectId ? { projectId: firebaseAdminConfig.projectId } : {}),
  ...(firebaseAdminConfig.databaseURL ? { databaseURL: firebaseAdminConfig.databaseURL } : {}),
});

async function resetUserPasswords() {
  try {
    console.log('🔑 Redefinindo senhas dos usuários para acesso correto...');
    
    const auth = admin.auth();
    
    // Lista de usuários com suas novas senhas padronizadas
    const [presente, cadastro, secretaria, auxiliar, adminUser] = getUsersByKeys(
      credentials,
      ['presente', 'cadastro', 'secretaria', 'auxiliar', 'admin']
    );

    const users = [
      { email: presente.email, password: presente.password, role: 'Controle de Presenca' },
      { email: cadastro.email, password: cadastro.password, role: 'Cadastro' },
      { email: secretaria.email, password: secretaria.password, role: 'Secretaria' },
      { email: auxiliar.email, password: auxiliar.password, role: 'Auxiliar' },
      { email: adminUser.email, password: adminUser.password, role: 'Administrador Principal' },
    ];
    
    console.log(`📋 Redefinindo senhas para ${users.length} usuários...\n`);
    
    for (const userInfo of users) {
      try {
        // Buscar usuário por email
        const user = await auth.getUserByEmail(userInfo.email);
        
        // Redefinir senha
        await auth.updateUser(user.uid, {
          password: userInfo.password,
          disabled: false // garantir que está ativo
        });
        
        console.log(`✅ ${userInfo.email} - SENHA REDEFINIDA`);
        console.log(`   Função: ${userInfo.role}`);
        console.log(`   Nova senha: valor ocultado (veja credentials.local.json)`);
        console.log(`   UID: ${user.uid}`);
        console.log('---');
        
      } catch (error) {
        console.error(`❌ Erro ao redefinir senha de ${userInfo.email}:`, error.message);
      }
    }
    
    console.log('\n📝 CREDENCIAIS PARA TESTE:');
    users.forEach(user => {
      console.log(`${user.email} : senha definida em credentials.local.json`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao redefinir senhas:', error);
    throw error;
  }
}

resetUserPasswords()
  .then(() => {
    console.log('\n✅ Redefinição de senhas concluída!');
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('1. Testar login com as novas credenciais');
    console.log('2. Verificar acesso aos dados de presença');
    console.log('3. Confirmar funcionamento dos filtros');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Processo falhou:', error);
    process.exit(1);
  });
