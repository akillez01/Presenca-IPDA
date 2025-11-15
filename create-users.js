import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Inicializar Firebase Admin (usando o arquivo de service account)
const serviceAccount = JSON.parse(readFileSync('./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Usuários já existentes no Firebase (que precisam ser configurados)
const usuariosExistentes = [
  {
    email: 'presente@ipda.app.br',
    uid: 'h9jGbyblHYXGMy52z6aDoKvWMeA3',
    password: 'presente@2025', // Definir senha para este usuário
    displayName: 'Controle de Presença IPDA',
    tipo: 'Usuário Editor'
  },
  {
    email: 'admin@ipda.org.br',
    uid: 'RAiUb6brHcaVokG05bdgJf2glMh2',
    password: 'IPDA@2025Admin', // Senha do admin
    displayName: 'Administrador IPDA',
    tipo: 'Super Usuário'
  },
  {
    email: 'marciodesk@ipda.app.br',
    uid: 'jeDLZ5xqexU9UXsEdDKc9PG3Ek52',
    password: 'Michelin@1', // Senha do Márcio
    displayName: 'Márcio Administrador',
    tipo: 'Super Usuário'
  }
];

// Usuários que precisam ser criados
const usuariosNovos = [
  {
    email: 'secretaria@ipda.org.br',
    password: 'SecretariaIPDA@2025',
    displayName: 'Secretaria IPDA',
    tipo: 'Usuário Editor'
  },
  {
    email: 'auxiliar@ipda.org.br',
    password: 'AuxiliarIPDA@2025',
    displayName: 'Auxiliar IPDA',
    tipo: 'Usuário Editor'
  },
  {
    email: 'cadastro@ipda.app.br',
    password: 'ipda@2025',
    displayName: 'Cadastro IPDA',
    tipo: 'Usuário Editor'
  }
];

function resolveUserType(tipo) {
  if (tipo === 'Super Usuário') return 'SUPER_USER';
  if (tipo === 'Usuário Editor') return 'EDITOR_USER';
  return 'BASIC_USER';
}

function resolveRole(userType) {
  if (userType === 'SUPER_USER') return 'admin';
  if (userType === 'EDITOR_USER') return 'editor';
  return 'basic_user';
}

function resolvePermissions(userType) {
  if (userType === 'SUPER_USER') {
    return ['dashboard', 'register', 'attendance', 'letters', 'presencadecadastrados', 'edit_attendance', 'reports', 'admin_users', 'config'];
  }
  if (userType === 'EDITOR_USER') {
    return ['dashboard', 'register', 'attendance', 'letters', 'presencadecadastrados', 'edit_attendance', 'reports'];
  }
  return ['dashboard', 'register', 'attendance', 'letters', 'presencadecadastrados'];
}

async function configurarUsuarios() {
  console.log('🚀 Iniciando configuração de usuários no Firebase...\n');

  // Configurar usuários existentes
  console.log('📋 Configurando usuários existentes...\n');
  
  for (const usuario of usuariosExistentes) {
    try {
      // Atualizar dados do usuário incluindo senha
      await admin.auth().updateUser(usuario.uid, {
        password: usuario.password, // Definir/atualizar senha
        displayName: usuario.displayName,
        emailVerified: true,
      });

      // Definir custom claims para controle de acesso
      const userType = resolveUserType(usuario.tipo);
      const customClaims = {
        userType,
        permissions: resolvePermissions(userType),
        role: resolveRole(userType),
        canEditAttendance: userType !== 'BASIC_USER',
        canAccessReports: userType !== 'BASIC_USER'
      };

      await admin.auth().setCustomUserClaims(usuario.uid, customClaims);
      
      console.log(`✅ ${usuario.email} configurado como: ${usuario.tipo}`);
      console.log(`   UID: ${usuario.uid}`);
      console.log(`   Senha: ${usuario.password}`);
      console.log(`   Claims: ${customClaims.userType}\n`);
      
    } catch (error) {
      console.error(`❌ Erro ao configurar usuário ${usuario.email}:`, error.message);
    }
  }

  // Criar usuários novos
  console.log('🆕 Criando usuários novos...\n');
  
  for (const usuario of usuariosNovos) {
    try {
      // Verificar se usuário já existe
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(usuario.email);
        console.log(`⚠️  Usuário ${usuario.email} já existe. Atualizando...`);
        
        // Atualizar usuário existente
        await admin.auth().updateUser(userRecord.uid, {
          password: usuario.password,
          displayName: usuario.displayName,
          emailVerified: true,
        });
        
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          // Criar novo usuário
          userRecord = await admin.auth().createUser({
            email: usuario.email,
            password: usuario.password,
            displayName: usuario.displayName,
            emailVerified: true,
          });
          
          console.log(`✅ Usuário ${usuario.email} criado com sucesso!`);
        } else {
          throw error;
        }
      }

      // Definir custom claims
      const userType = resolveUserType(usuario.tipo);
      const customClaims = {
        userType,
        permissions: resolvePermissions(userType),
        role: resolveRole(userType),
        canEditAttendance: userType !== 'BASIC_USER',
        canAccessReports: userType !== 'BASIC_USER'
      };

      await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);
      
      console.log(`🏷️  Claims definidos para ${usuario.email}: ${usuario.tipo}`);
      console.log(`   UID: ${userRecord.uid}\n`);
      
    } catch (error) {
      console.error(`❌ Erro ao criar/configurar usuário ${usuario.email}:`, error.message);
    }
  }

  console.log('🎉 Configuração de usuários finalizada!\n');
  
  console.log('📋 Resumo Final dos Usuários:');
  console.log('\n🔴 SUPER USUÁRIOS (Acesso Total):');
  console.log('   • admin@ipda.org.br - Administrador IPDA');
  console.log('   • marciodesk@ipda.app.br - Márcio Administrador');
  
  console.log('\n� USUÁRIOS EDITORES (Cadastro, Registro e Ajustes):');
  console.log('   • presente@ipda.app.br - Controle de Presença IPDA');
  console.log('   • cadastro@ipda.app.br - Cadastro IPDA');
  console.log('   • secretaria@ipda.org.br - Secretaria IPDA');
  console.log('   • auxiliar@ipda.org.br - Auxiliar IPDA');
  
  console.log('\n🔐 Permissões dos Usuários Editores:');
  console.log('   ✅ Dashboard, Registrar Presença, Presença de Cadastrados');
  console.log('   ✅ Carta de Recomendação, Carta 1 Dia, Relatórios');
  console.log('   ✅ Editar registros de presença');
}

// Executar script
configurarUsuarios()
  .then(() => {
    console.log('\n✅ Script executado com sucesso!');
    console.log('\n🎯 Próximos passos:');
    console.log('   1. Teste o login com os usuários básicos');
    console.log('   2. Verifique se as permissões estão funcionando');
    console.log('   3. Confirme que o sidebar mostra apenas as opções corretas');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro durante execução:', error);
    process.exit(1);
  });
