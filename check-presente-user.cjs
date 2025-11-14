const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://reuniao-ministerial-default-rtdb.firebaseio.com"
});

async function checkUser() {
  try {
    console.log('🔍 Verificando usuário presente@ipda.app.br...\n');
    
    // Verificar se o usuário existe
    const userRecord = await admin.auth().getUserByEmail('presente@ipda.app.br');
    
    console.log('✅ Usuário encontrado!');
    console.log('📧 Email:', userRecord.email);
    console.log('🆔 UID:', userRecord.uid);
    console.log('📅 Criado em:', new Date(userRecord.metadata.creationTime).toLocaleString('pt-BR'));
    console.log('🔐 Provider:', userRecord.providerData.map(p => p.providerId).join(', '));
    console.log('✅ Email verificado:', userRecord.emailVerified);
    
    // Verificar se há custom claims
    if (userRecord.customClaims) {
      console.log('🏷️  Custom Claims:', userRecord.customClaims);
    }
    
    console.log('\n💡 Informação: O Firebase Admin SDK não pode mostrar a senha, mas pode resetá-la.');
    console.log('💡 Para testar login, vou tentar criar um link de reset de senha...\n');
    
    // Gerar link de reset de senha
    const resetLink = await admin.auth().generatePasswordResetLink('presente@ipda.app.br');
    console.log('🔗 Link de reset de senha gerado:', resetLink);
    
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log('❌ Usuário presente@ipda.app.br NÃO EXISTE!');
      console.log('💡 Vou listar todos os usuários para ver quais existem...\n');
      
      const listUsers = await admin.auth().listUsers();
      console.log('👥 Usuários encontrados:');
      listUsers.users.forEach(user => {
        console.log(`📧 ${user.email} (UID: ${user.uid})`);
      });
    } else {
      console.error('❌ Erro ao verificar usuário:', error.code, error.message);
    }
  }
}

checkUser().then(() => {
  console.log('\n✨ Verificação concluída!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});