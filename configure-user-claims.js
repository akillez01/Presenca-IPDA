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

// Função para configurar claims de um usuário por email
export async function setUserClaims(email, userType) {
  try {
    // Buscar usuário por email
    const userRecord = await admin.auth().getUserByEmail(email);
    
    // Definir custom claims baseado no tipo
    const customClaims = {
      userType: userType,
      permissions: userType === 'SUPER_USER' 
        ? ['dashboard', 'register', 'attendance', 'letters', 'reports', 'admin', 'config']
        : ['dashboard', 'register', 'attendance', 'letters'],
      role: userType === 'SUPER_USER' ? 'admin' : 'basic_user'
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
  console.log('🔧 Configurando claims para usuários básicos...\n');
  
  try {
    // Listar todos os usuários
    const listUsersResult = await admin.auth().listUsers();
    
    // Emails de super usuários (não alterar)
    const superUsers = ['admin@ipda.org.br', 'marciodesk@ipda.app.br'];
    
    for (const user of listUsersResult.users) {
      if (!user.email) continue;
      
      // Pular super usuários
      if (superUsers.includes(user.email)) {
        console.log(`⚪ ${user.email} - Super usuário (não alterado)`);
        continue;
      }
      
      // Configurar como usuário básico se não tiver claims ou se for usuário normal
      const currentClaims = user.customClaims || {};
      
      if (!currentClaims.userType || currentClaims.userType === 'USER') {
        await setUserClaims(user.email, 'BASIC_USER');
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
