const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'reuniao-ministerial'
});

async function resetUserPasswords() {
  try {
    console.log('🔑 Redefinindo senhas dos usuários para acesso correto...');
    
    const auth = admin.auth();
    
    // Lista de usuários com suas novas senhas padronizadas
    const users = [
      {
        email: 'presente@ipda.app.br',
        password: 'presente2025IPDA',
        role: 'Controle de Presença'
      },
      {
        email: 'cadastro@ipda.app.br',
        password: 'cadastro2025IPDA',
        role: 'Cadastro'
      },
      {
        email: 'secretaria@ipda.org.br',
        password: 'secretaria2025IPDA',
        role: 'Secretaria'
      },
      {
        email: 'auxiliar@ipda.org.br',
        password: 'auxiliar2025IPDA',
        role: 'Auxiliar'
      },
      {
        email: 'admin@ipda.org.br',
        password: 'IPDA@2025Admin',
        role: 'Administrador Principal'
      }
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
        console.log(`   Nova senha: ${userInfo.password}`);
        console.log(`   UID: ${user.uid}`);
        console.log('---');
        
      } catch (error) {
        console.error(`❌ Erro ao redefinir senha de ${userInfo.email}:`, error.message);
      }
    }
    
    console.log('\n📝 CREDENCIAIS PARA TESTE:');
    users.forEach(user => {
      console.log(`${user.email} : ${user.password}`);
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