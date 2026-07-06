const admin = require('firebase-admin');
const {
  loadCredentials,
  getFirebaseAdminConfig,
  getFirebaseClientConfig,
  getUserByKey,
} = require('./credentials-loader.cjs');

const credentials = loadCredentials();
const firebaseAdminConfig = getFirebaseAdminConfig(credentials);
const firebaseClientConfig = getFirebaseClientConfig(credentials);
const presenteUser = getUserByKey(credentials, 'presente');

// Inicializar Firebase Admin
const serviceAccount = require(firebaseAdminConfig.serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  ...(firebaseAdminConfig.projectId ? { projectId: firebaseAdminConfig.projectId } : {}),
  ...(firebaseAdminConfig.databaseURL ? { databaseURL: firebaseAdminConfig.databaseURL } : {}),
});

async function resetPassword() {
  try {
    console.log(`🔐 Resetando senha do usuário ${presenteUser.email}...\n`);
    
    const email = presenteUser.email;
    const newPassword = presenteUser.password;
    
    // Atualizar a senha do usuário
    const targetUid = presenteUser.uid || (await admin.auth().getUserByEmail(email)).uid;
    await admin.auth().updateUser(targetUid, {
      password: newPassword
    });
    
    console.log('✅ Senha atualizada com sucesso!');
    console.log('📧 Email:', email);
    console.log('🔑 Nova senha: valor ocultado (veja credentials.local.json)');
    
    console.log('\n🧪 Testando login com as novas credenciais...');
    
    // Testar as credenciais
    const { initializeApp } = require('firebase/app');
    const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
    
    // Configuração Firebase (from .env.local)
    const firebaseConfig = firebaseClientConfig;
    
    const app = initializeApp(firebaseConfig, 'test-app-' + Date.now());
    const auth = getAuth(app);
    
    const userCredential = await signInWithEmailAndPassword(auth, email, newPassword);
    const user = userCredential.user;
    
    console.log('✅ Login testado com sucesso!');
    console.log('🆔 UID:', user.uid);
    console.log('📧 Email:', user.email);
    console.log('✅ Email verificado:', user.emailVerified);
    
    // Verificar token personalizado
    const idToken = await user.getIdToken();
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    console.log('\n🏷️  Custom Claims:');
    console.log(JSON.stringify(decodedToken, null, 2));
    
  } catch (error) {
    console.error('❌ Erro:', error.code, error.message);
  }
}

resetPassword().then(() => {
  console.log('\n✨ Reset de senha concluído!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
