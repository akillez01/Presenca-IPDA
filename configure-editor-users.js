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

const db = admin.firestore();

const DEFAULT_PERMISSIONS = {
  SUPER_USER: [
    'dashboard',
    'register',
    'attendance',
    'letters',
    'presencadecadastrados',
    'edit_attendance',
    'reports',
    'admin_users',
    'config'
  ],
  EDITOR_USER: [
    'dashboard',
    'register',
    'attendance',
    'letters',
    'presencadecadastrados',
    'edit_attendance',
    'reports'
  ],
  BASIC_USER: [
    'dashboard',
    'register',
    'attendance',
    'letters',
    'presencadecadastrados'
  ]
};

function getDefaultRole(userType) {
  switch (userType) {
    case 'SUPER_USER':
      return 'admin';
    case 'EDITOR_USER':
      return 'editor';
    default:
      return 'basic_user';
  }
}

async function configureSpecificUsers() {
  console.log('🔧 Configurando permissões para usuários de cadastro, registro e edição...\n');

  const usersToUpdate = [
    {
      email: 'presente@ipda.app.br',
      displayName: 'Controle de Presença IPDA',
      userType: 'EDITOR_USER'
    },
    {
      email: 'cadastro@ipda.app.br',
      displayName: 'Cadastro IPDA',
      userType: 'EDITOR_USER'
    },
    {
      email: 'registro1@ipda.app.br',
      displayName: 'Terminal de Registro 1 - IPDA',
      userType: 'EDITOR_USER'
    },
    {
      email: 'registro2@ipda.app.br',
      displayName: 'Terminal de Registro 2 - IPDA',
      userType: 'EDITOR_USER'
    },
    {
      email: 'registro3@ipda.app.br',
      displayName: 'Terminal de Registro 3 - IPDA',
      userType: 'EDITOR_USER'
    },
    {
      email: 'registro4@ipda.app.br',
      displayName: 'Terminal de Registro 4 - IPDA',
      userType: 'EDITOR_USER'
    },
    {
      email: 'secretaria@ipda.org.br',
      displayName: 'Secretaria IPDA',
      userType: 'EDITOR_USER'
    },
    {
      email: 'auxiliar@ipda.org.br',
      displayName: 'Auxiliar IPDA',
      userType: 'EDITOR_USER'
    }
  ];

  for (const userInfo of usersToUpdate) {
    try {
      const userRecord = await admin.auth().getUserByEmail(userInfo.email);
      const userType = userInfo.userType || 'EDITOR_USER';
      const role = userInfo.role || getDefaultRole(userType);
      const permissions = userInfo.permissions || DEFAULT_PERMISSIONS[userType] || ['dashboard'];
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      const canEditAttendance = permissions.includes('edit_attendance');
      const canAccessReports = permissions.includes('reports');

      await admin.auth().setCustomUserClaims(userRecord.uid, {
        userType,
        permissions,
        role,
        canEditAttendance,
        canAccessReports
      });
      console.log(`✅ Custom claims configurados para: ${userInfo.email}`);

      const userDocRef = db.collection('users').doc(userRecord.uid);
      const userDocSnap = await userDocRef.get();
      const userDoc = {
        email: userInfo.email,
        displayName: userInfo.displayName,
        role,
        userType,
        permissions,
        canEditAttendance,
        canAccessReports,
        canViewAttendance: permissions.includes('attendance'),
        isActive: true,
        active: true,
        lastUpdated: timestamp,
        updatedAt: timestamp
      };

      if (!userDocSnap.exists) {
        userDoc.createdAt = timestamp;
      }

      await userDocRef.set(userDoc, { merge: true });
      console.log(`✅ Documento Firestore atualizado para: ${userInfo.email}`);

    } catch (error) {
      console.error(`❌ Erro ao configurar usuário ${userInfo.email}:`, error.message || error);
    }
  }

  console.log('\n🎉 Configuração de permissões concluída!');
  console.log('\n📋 Resumo:');
  usersToUpdate.forEach(({ email, userType }) => {
    console.log(`   - ${email} ➜ ${userType}`);
  });
}

configureSpecificUsers()
  .then(() => {
    console.log('\n✅ Script executado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro na execução do script:', error);
    process.exit(1);
  });