import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const SUPER_USERS = new Set([
  'admin@ipda.org.br',
  'marciodesk@ipda.app.br'
]);

const EDITOR_USERS = new Set([
  'presente@ipda.app.br',
  'cadastro@ipda.app.br',
  'registro1@ipda.app.br',
  'registro2@ipda.app.br',
  'registro3@ipda.app.br',
  'registro4@ipda.app.br',
  'secretaria@ipda.org.br',
  'auxiliar@ipda.org.br'
]);

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

// Função para configurar claims de um usuário por email
export async function setUserClaims(email, userType) {
  try {
    // Buscar usuário por email
    const userRecord = await admin.auth().getUserByEmail(email);
    
    // Definir custom claims baseado no tipo
    const customClaims = {
      userType: userType,
      permissions: userType === 'SUPER_USER' 
        ? ['dashboard', 'register', 'attendance', 'letters', 'presencadecadastrados', 'edit_attendance', 'reports', 'admin_users', 'config']
        : userType === 'EDITOR_USER'
        ? ['dashboard', 'register', 'attendance', 'letters', 'presencadecadastrados', 'edit_attendance', 'reports']
        : ['dashboard', 'register', 'attendance', 'letters', 'presencadecadastrados'],
      role: userType === 'SUPER_USER' ? 'admin' : userType === 'EDITOR_USER' ? 'editor' : 'basic_user',
      canEditAttendance: userType !== 'BASIC_USER',
      canAccessReports: userType !== 'BASIC_USER'
    };

    await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);
    
    console.log(`✅ Claims configurados para ${email}: ${userType}`);
    return { success: true, uid: userRecord.uid };
    
  } catch (error) {
    console.error(`❌ Erro ao configurar claims para ${email}:`, error);
    return { success: false, error: error.message };
  }
}

// Função para configurar automaticamente usuários básicos criados via interface
export async function configureBasicUsersFromInterface() {
  console.log('🔧 Configurando claims para usuários cadastrados...\n');
  
  try {
    // Listar todos os usuários
    const listUsersResult = await admin.auth().listUsers();
    
    for (const user of listUsersResult.users) {
      if (!user.email) continue;
      
      // Pular super usuários
      if (SUPER_USERS.has(user.email)) {
        console.log(`⚪ ${user.email} - Super usuário (não alterado)`);
        continue;
      }
      
      const expectedType = EDITOR_USERS.has(user.email) ? 'EDITOR_USER' : 'BASIC_USER';
      const currentClaims = user.customClaims || {};
      const hasDifferentType = currentClaims.userType !== expectedType;

      if (!currentClaims.userType || currentClaims.userType === 'USER' || hasDifferentType) {
        await setUserClaims(user.email, expectedType);
      } else {
        console.log(`⚪ ${user.email} - Já configurado como ${currentClaims.userType}`);
      }
    }
    
    console.log('\n🎉 Configuração de claims concluída!');
    
  } catch (error) {
    console.error('❌ Erro durante configuração:', error);
  }
}

// Se executado diretamente
if (require.main === module) {
  configureBasicUsersFromInterface()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
