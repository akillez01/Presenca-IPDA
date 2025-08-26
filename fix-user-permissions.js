import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function fixUserPermissions() {
  try {
    console.log('🔧 Iniciando correção de permissões...');

    // Configurar custom claims para super usuários
    const superUsers = [
      'admin@ipda.org.br',
      'marciodesk@ipda.app.br'
    ];

    for (const email of superUsers) {
      try {
        const userRecord = await auth.getUserByEmail(email);
        await auth.setCustomUserClaims(userRecord.uid, {
          superUser: true,
          role: 'admin'
        });
        console.log(`✅ Custom claims configurados para: ${email}`);
      } catch (error) {
        console.log(`⚠️  Usuário ${email} não encontrado no Auth`);
      }
    }

    // Usuários básicos conhecidos
    const basicUsers = [
      'presente@ipda.app.br',
      'secretaria@ipda.org.br',
      'auxiliar@ipda.org.br',
      'cadastro@ipda.app.br'
    ];

    for (const email of basicUsers) {
      try {
        const userRecord = await auth.getUserByEmail(email);
        await auth.setCustomUserClaims(userRecord.uid, {
          basicUser: true,
          role: 'user'
        });
        console.log(`✅ Custom claims configurados para: ${email}`);
      } catch (error) {
        console.log(`⚠️  Usuário ${email} não encontrado no Auth`);
      }
    }

    // Criar documentos no Firestore para todos os usuários conhecidos
    const allUsers = [
      { email: 'admin@ipda.org.br', displayName: 'Administrador IPDA', role: 'admin' },
      { email: 'marciodesk@ipda.app.br', displayName: 'Márcio - Admin Técnico', role: 'admin' },
      { email: 'presente@ipda.app.br', displayName: 'Controle de Presença IPDA', role: 'user' },
      { email: 'secretaria@ipda.org.br', displayName: 'Secretaria IPDA', role: 'user' },
      { email: 'auxiliar@ipda.org.br', displayName: 'Auxiliar IPDA', role: 'user' },
      { email: 'cadastro@ipda.app.br', displayName: 'Cadastro IPDA', role: 'user' }
    ];

    for (const user of allUsers) {
      try {
        const userRecord = await auth.getUserByEmail(user.email);
        
        // Criar/atualizar documento no Firestore
        await db.collection('users').doc(userRecord.uid).set({
          uid: userRecord.uid,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          active: true,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        }, { merge: true });

        console.log(`✅ Documento Firestore criado/atualizado para: ${user.email}`);
      } catch (error) {
        console.log(`⚠️  Erro ao processar ${user.email}: ${error.message}`);
      }
    }

    console.log('🎉 Correção de permissões concluída!');
    
  } catch (error) {
    console.error('❌ Erro na correção de permissões:', error);
  } finally {
    process.exit(0);
  }
}

fixUserPermissions();
