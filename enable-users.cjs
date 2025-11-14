const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'reuniao-ministerial'
});

async function enableUsers() {
  try {
    console.log('🔧 Reativando usuários desabilitados...');
    
    const auth = admin.auth();
    
    // Lista de usuários que devem estar ativos
    const usersToEnable = [
      {
        email: 'admin@ipda.org.br',
        reason: 'Administrador principal'
      },
      {
        email: 'presente@ipda.app.br',
        reason: 'Usuário para controle de presença'
      },
      {
        email: 'cadastro@ipda.app.br',
        reason: 'Usuário para cadastros'
      },
      {
        email: 'secretaria@ipda.org.br',
        reason: 'Usuário da secretaria'
      },
      {
        email: 'marciodesk@ipda.app.br',
        reason: 'Admin técnico'
      }
    ];
    
    console.log(`📋 Reativando ${usersToEnable.length} usuários...\n`);
    
    for (const userInfo of usersToEnable) {
      try {
        // Buscar usuário por email
        const user = await auth.getUserByEmail(userInfo.email);
        
        if (user.disabled) {
          // Reativar usuário
          await auth.updateUser(user.uid, {
            disabled: false
          });
          
          console.log(`✅ ${userInfo.email} - REATIVADO`);
          console.log(`   Motivo: ${userInfo.reason}`);
          console.log(`   UID: ${user.uid}`);
        } else {
          console.log(`✅ ${userInfo.email} - JÁ ESTAVA ATIVO`);
        }
        
        console.log('---');
        
      } catch (error) {
        console.error(`❌ Erro ao reativar ${userInfo.email}:`, error.message);
      }
    }
    
    // Verificar status final
    console.log('\n📊 VERIFICANDO STATUS FINAL...');
    for (const userInfo of usersToEnable) {
      try {
        const user = await auth.getUserByEmail(userInfo.email);
        const status = user.disabled ? '❌ DESABILITADO' : '✅ ATIVO';
        console.log(`${userInfo.email}: ${status}`);
      } catch (error) {
        console.log(`${userInfo.email}: ❌ ERRO - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao reativar usuários:', error);
    throw error;
  }
}

enableUsers()
  .then(() => {
    console.log('\n✅ Processo de reativação concluído!');
    console.log('\n📝 PRÓXIMOS PASSOS:');
    console.log('1. Verificar se os usuários conseguem fazer login');
    console.log('2. Testar se os dados aparecem na página de presença');
    console.log('3. Verificar se os filtros funcionam corretamente');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Processo falhou:', error);
    process.exit(1);
  });