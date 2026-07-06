const admin = require('firebase-admin');
const {
  loadCredentials,
  getFirebaseAdminConfig,
  getUserByKey,
} = require('./credentials-loader.cjs');

const credentials = loadCredentials();
const firebaseAdminConfig = getFirebaseAdminConfig(credentials);
const userByKey = (key) => getUserByKey(credentials, key);

// Inicializar Firebase Admin
const serviceAccount = require(firebaseAdminConfig.serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  ...(firebaseAdminConfig.projectId ? { projectId: firebaseAdminConfig.projectId } : {}),
  ...(firebaseAdminConfig.databaseURL ? { databaseURL: firebaseAdminConfig.databaseURL } : {}),
});

// Usuários com problemas identificados
const USERS_TO_FIX = [
  // Admins que precisam de userType
  {
    email: userByKey('admin').email,
    action: 'update_claims',
    userType: 'SUPER_USER',
    role: 'admin'
  },
  {
    email: userByKey('marciodesk').email,
    action: 'update_claims',
    userType: 'SUPER_USER',
    role: 'admin'
  },
  // Usuários com credenciais inválidas - resetar senhas
  {
    email: userByKey('cadastro').email,
    action: 'reset_password',
    password: userByKey('cadastro').password,
    userType: 'EDITOR_USER',
    role: 'editor'
  },
  {
    email: userByKey('registro1').email,
    action: 'reset_password',
    password: userByKey('registro1').password,
    userType: 'EDITOR_USER',
    role: 'editor'
  },
  {
    email: userByKey('registro2').email,
    action: 'reset_password',
    password: userByKey('registro2').password,
    userType: 'EDITOR_USER',
    role: 'editor'
  },
  {
    email: userByKey('registro3').email,
    action: 'reset_password',
    password: userByKey('registro3').password,
    userType: 'EDITOR_USER',
    role: 'editor'
  },
  {
    email: userByKey('registro4').email,
    action: 'reset_password',
    password: userByKey('registro4').password,
    userType: 'EDITOR_USER',
    role: 'editor'
  },
  {
    email: userByKey('secretaria').email,
    action: 'reset_password',
    password: userByKey('secretaria').password,
    userType: 'EDITOR_USER',
    role: 'editor'
  },
  {
    email: userByKey('auxiliar').email,
    action: 'reset_password',
    password: userByKey('auxiliar').password,
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
        console.log(`   ✅ Senha resetada (valor ocultado)`);
        
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
        'dashboard', 'scanner', 'register', 'attendance', 'letters',
        'baptism', 'presencadecadastrados', 'edit_attendance', 'reports',
        'admin_users', 'config'
      ];
    case 'EDITOR_USER':
      return [
        'dashboard', 'scanner', 'register', 'attendance', 'letters',
        'baptism', 'presencadecadastrados', 'edit_attendance', 'reports'
      ];
    case 'BASIC_USER':
      return [
        'dashboard', 'scanner', 'register', 'attendance', 'letters',
        'baptism', 'presencadecadastrados'
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
