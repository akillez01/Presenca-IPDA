const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://reuniao-ministerial-default-rtdb.firebaseio.com"
});

async function resetPassword() {
  try {
    console.log('🔐 Resetando senha do usuário presente@ipda.app.br...\n');
    
    const email = 'presente@ipda.app.br';
    const newPassword = 'presente@2025';
    
    // Atualizar a senha do usuário
    await admin.auth().updateUser('h9jGbyblHYXGMy52z6aDoKvWMeA3', {
      password: newPassword
    });
    
    console.log('✅ Senha atualizada com sucesso!');
    console.log('📧 Email:', email);
    console.log('🔑 Nova senha:', newPassword);
    
    console.log('\n🧪 Testando login com as novas credenciais...');
    
    // Testar as credenciais
    const { initializeApp } = require('firebase/app');
    const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
    
    // Configuração Firebase (from .env.local)
    const firebaseConfig = {
      apiKey: "AIzaSyA6_YWMcTzvKzCbZgl88SJvWpAUuE8LilE",
      authDomain: "reuniao-ministerial.firebaseapp.com",
      databaseURL: "https://reuniao-ministerial-default-rtdb.firebaseio.com",
      projectId: "reuniao-ministerial",
      storageBucket: "reuniao-ministerial.firebasestorage.app",
      messagingSenderId: "473014896779",
      appId: "1:473014896779:web:b8f4e5c6f8d93c8f4c8c32",
      measurementId: "G-B54Z76MVDX"
    };
    
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