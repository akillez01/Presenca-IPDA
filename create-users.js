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
    tipo: 'Usuário Básico'
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
    tipo: 'Usuário Básico'
  },
  {
    email: 'auxiliar@ipda.org.br',
    password: 'AuxiliarIPDA@2025',
    displayName: 'Auxiliar IPDA',
    tipo: 'Usuário Básico'
  },
  {
    email: 'cadastro@ipda.app.br',
    password: 'ipda@2025',
    displayName: 'Cadastro IPDA',
    tipo: 'Usuário Básico'
  }
];

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
      const customClaims = {
        userType: usuario.tipo === 'Super Usuário' ? 'SUPER_USER' : 'BASIC_USER',
        permissions: usuario.tipo === 'Super Usuário' 
          ? ['dashboard', 'register', 'attendance', 'letters', 'reports', 'admin', 'config']
          : ['dashboard', 'register', 'attendance', 'letters'],
        role: usuario.tipo === 'Super Usuário' ? 'admin' : 'basic_user'
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
      const customClaims = {
        userType: usuario.tipo === 'Super Usuário' ? 'SUPER_USER' : 'BASIC_USER',
        permissions: usuario.tipo === 'Super Usuário' 
          ? ['dashboard', 'register', 'attendance', 'letters', 'reports', 'admin', 'config']
          : ['dashboard', 'register', 'attendance', 'letters'],
        role: usuario.tipo === 'Super Usuário' ? 'admin' : 'basic_user'
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
  
  console.log('\n🟡 USUÁRIOS BÁSICOS (Acesso Limitado):');
  console.log('   • presente@ipda.app.br - Controle de Presença IPDA');
  console.log('   • secretaria@ipda.org.br - Secretaria IPDA');
  console.log('   • auxiliar@ipda.org.br - Auxiliar IPDA');
  console.log('   • cadastro@ipda.app.br - Cadastro IPDA');
  
  console.log('\n🔐 Permissões dos Usuários Básicos:');
  console.log('   ✅ Dashboard, Registrar Presença, Presença de Cadastrados');
  console.log('   ✅ Carta de Recomendação, Carta 1 Dia');
  console.log('   ❌ Relatórios, Gerenciar Usuários, Configurações');
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
