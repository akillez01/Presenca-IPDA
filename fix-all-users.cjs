const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://reuniao-ministerial-default-rtdb.firebaseio.com"
});

// Usuários com problemas identificados
const USERS_TO_FIX = [
  // Admins que precisam de userType
  {
    email: 'admin@ipda.org.br',
    action: 'update_claims',
    userType: 'SUPER_USER',
    role: 'admin'
  },
  {
    email: 'marciodesk@ipda.app.br',
    action: 'update_claims',
    userType: 'SUPER_USER',
    role: 'admin'
  },
  // Usuários com credenciais inválidas - resetar senhas
  {
    email: 'cadastro@ipda.app.br',
    action: 'reset_password',
    password: 'ipda@2025',
    userType: 'EDITOR_USER',
    role: 'editor'
  },
  {
    email: 'registro1@ipda.app.br',
    action: 'reset_password',
    password: 'registro@2025',
    userType: 'EDITOR_USER',
    role: 'editor'
  },
  {
    email: 'registro2@ipda.app.br',
    action: 'reset_password',
    password: 'registro@2025',
    userType: 'EDITOR_USER',
    role: 'editor'
  },
  {
    email: 'registro3@ipda.app.br',
    action: 'reset_password',
    password: 'registro@2025',
    userType: 'EDITOR_USER',
    role: 'editor'
  },
  {
    email: 'registro4@ipda.app.br',
    action: 'reset_password',
    password: 'registro@2025',
    userType: 'EDITOR_USER',
    role: 'editor'
  },
  {
    email: 'secretaria@ipda.org.br',
    action: 'reset_password',
    password: 'SecretariaIPDA@2025',
    userType: 'EDITOR_USER',
    role: 'editor'
  },
  {
    email: 'auxiliar@ipda.org.br',
    action: 'reset_password',
    password: 'AuxiliarIPDA@2025',
    userType: 'EDITOR_USER',
    role: 'editor'
  },
];

async function fixAllUsers() {
  console.log('🔧 CORREÇÃO DE TODOS OS USUÁRIOS COM PROBLEMAS');
  console.log('=' .repeat(60));
  console.log('');

  const results = {
    fixed: [],
    failed: [],
    total: USERS_TO_FIX.length
  };

  for (let i = 0; i < USERS_TO_FIX.length; i++) {
    const userFix = USERS_TO_FIX[i];
    
    try {
      console.log(`\n${i + 1}. 🔧 Corrigindo: ${userFix.email}`);
      console.log(`   🎯 Ação: ${userFix.action}`);
      
      // Buscar usuário pelo email
      const userRecord = await admin.auth().getUserByEmail(userFix.email);
      console.log(`   ✅ Usuário encontrado: ${userRecord.uid}`);
      
      if (userFix.action === 'update_claims') {
        // Atualizar custom claims
        const customClaims = {
          userType: userFix.userType,
          role: userFix.role,
          permissions: getPermissionsByType(userFix.userType)
        };
        
        await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);
        console.log(`   ✅ Custom claims atualizados:`, customClaims);
        
      } else if (userFix.action === 'reset_password') {
        // Resetar senha
        await admin.auth().updateUser(userRecord.uid, {
          password: userFix.password
        });
        console.log(`   ✅ Senha resetada para: ${userFix.password}`);
        
        // Definir custom claims
        const customClaims = {
          userType: userFix.userType,
          role: userFix.role,
          permissions: getPermissionsByType(userFix.userType)
        };
        
        await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);
        console.log(`   ✅ Custom claims definidos:`, customClaims);
      }
      
      results.fixed.push({
        email: userFix.email,
        action: userFix.action,
        userType: userFix.userType,
        role: userFix.role
      });
      
    } catch (error) {
      console.log(`   ❌ Erro: ${error.code}`);
      console.log(`   💬 Mensagem: ${error.message}`);
      
      results.failed.push({
        email: userFix.email,
        error: error.code,
        message: error.message
      });
    }
    
    // Pausa pequena entre correções
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Relatório final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RELATÓRIO DE CORREÇÕES');
  console.log('='.repeat(60));
  console.log(`\n📈 ESTATÍSTICAS:`);
  console.log(`   • Total de usuários corrigidos: ${results.total}`);
  console.log(`   • Sucessos: ${results.fixed.length} ✅`);
  console.log(`   • Falhas: ${results.failed.length} ❌`);
  console.log(`   • Taxa de sucesso: ${((results.fixed.length / results.total) * 100).toFixed(1)}%`);
  
  if (results.fixed.length > 0) {
    console.log(`\n✅ USUÁRIOS CORRIGIDOS:`);
    results.fixed.forEach(user => {
      console.log(`   ✅ ${user.email} - ${user.action} (${user.userType} | ${user.role})`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log(`\n❌ USUÁRIOS COM PROBLEMAS:`);
    results.failed.forEach(user => {
      console.log(`   🚫 ${user.email} - ${user.error}`);
    });
  }
  
  console.log('\n🚀 Agora execute o teste novamente: node test-all-users-final.cjs');
}

function getPermissionsByType(userType) {
  switch (userType) {
    case 'SUPER_USER':
      return [
        'dashboard', 'register', 'attendance', 'letters', 
        'presencadecadastrados', 'edit_attendance', 'reports', 
        'admin_users', 'config'
      ];
    case 'EDITOR_USER':
      return [
        'dashboard', 'register', 'attendance', 'letters',
        'presencadecadastrados', 'edit_attendance', 'reports'
      ];
    case 'BASIC_USER':
      return [
        'dashboard', 'register', 'attendance', 'letters',
        'presencadecadastrados'
      ];
    default:
      return ['dashboard'];
  }
}

fixAllUsers().then(() => {
  console.log('\n✨ Correções concluídas!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro fatal nas correções:', error);
  process.exit(1);
});