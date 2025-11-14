#!/usr/bin/env node

/**
 * Script de Migração e Padronização de Usuários
 * 
 * Este script:
 * 1. Padroniza a estrutura de todos os usuários
 * 2. Corrige inconsistências de roles e permissões
 * 3. Adiciona campos obrigatórios ausentes
 * 4. Cria backup antes das alterações
 */

const admin = require('firebase-admin');

// Configuração do Firebase
try {
  const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'reuniao-ministerial'
  });
} catch (error) {
  console.error('❌ Erro ao configurar Firebase:', error.message);
  process.exit(1);
}

const db = admin.firestore();

// Definir estrutura padrão de permissões por role
const ROLE_PERMISSIONS = {
  admin: {
    permissions: [
      "dashboard", "register", "attendance", "letters", 
      "presencadecadastrados", "edit_attendance", "user_management",
      "reports", "settings", "audit_logs", "monitoring"
    ],
    canEditAttendance: true,
    canRegister: true,
    canViewAttendance: true,
    canManageUsers: true,
    canAccessReports: true,
    userType: "ADMIN_USER"
  },
  editor: {
    permissions: [
      "dashboard", "register", "attendance", "letters", 
      "presencadecadastrados", "edit_attendance"
    ],
    canEditAttendance: true,
    canRegister: true,
    canViewAttendance: true,
    canManageUsers: false,
    canAccessReports: true,
    userType: "EDITOR_USER"
  },
  user: {
    permissions: [
      "dashboard", "attendance", "presencadecadastrados"
    ],
    canEditAttendance: false,
    canRegister: false,
    canViewAttendance: true,
    canManageUsers: false,
    canAccessReports: false,
    userType: "STANDARD_USER"
  },
  moderator: {
    permissions: [
      "dashboard", "register", "attendance", "letters", 
      "presencadecadastrados", "edit_attendance", "reports"
    ],
    canEditAttendance: true,
    canRegister: true,
    canViewAttendance: true,
    canManageUsers: false,
    canAccessReports: true,
    userType: "MODERATOR_USER"
  }
};

// Mapeamento de roles sugeridos baseado no email/função
const SUGGESTED_ROLES = {
  'admin@ipda.org.br': 'admin',
  'marciodesk@ipda.app.br': 'admin',
  'auxiliar@ipda.org.br': 'moderator', // Upgrade de 'user' para 'moderator'
  'secretaria@ipda.org.br': 'moderator', // Upgrade de 'user' para 'moderator'
  'cadastro@ipda.app.br': 'editor',
  'presente@ipda.app.br': 'editor'
};

async function migrateUsers() {
  console.log('🚀 Iniciando migração de usuários...\n');
  
  try {
    // 1. Backup dos usuários atuais
    console.log('💾 Criando backup dos usuários...');
    const usersSnapshot = await db.collection('users').get();
    const backup = [];
    
    usersSnapshot.docs.forEach(doc => {
      backup.push({ id: doc.id, data: doc.data() });
    });
    
    // Salvar backup
    const backupRef = db.collection('backups').doc(`users_backup_${Date.now()}`);
    await backupRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      totalUsers: backup.length,
      users: backup
    });
    console.log(`✅ Backup criado com ${backup.length} usuários\n`);
    
    // 2. Analisar e migrar cada usuário
    console.log('🔄 Analisando e migrando usuários...\n');
    const migrations = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      console.log(`📋 Analisando: ${userData.email || userId}`);
      
      // Determinar role correto
      const currentRole = userData.role || 'user';
      const suggestedRole = SUGGESTED_ROLES[userData.email] || currentRole;
      const rolePermissions = ROLE_PERMISSIONS[suggestedRole] || ROLE_PERMISSIONS.user;
      
      // Criar estrutura padronizada
      const migratedUser = {
        // Campos básicos (manter existentes)
        uid: userData.uid || userId,
        email: userData.email,
        displayName: userData.displayName,
        
        // Role atualizado
        role: suggestedRole,
        
        // Status padronizado
        active: userData.active !== undefined ? userData.active : userData.isActive !== undefined ? userData.isActive : true,
        isActive: userData.active !== undefined ? userData.active : userData.isActive !== undefined ? userData.isActive : true,
        
        // Timestamps padronizados
        createdAt: userData.createdAt ? (userData.createdAt.toDate ? userData.createdAt : new Date(userData.createdAt)) : admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: userData.lastLoginAt || userData.lastLoginAt,
        
        // Permissões completas
        ...rolePermissions,
        
        // Campos de auditoria
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        migrationVersion: "1.0.0",
        previousRole: currentRole
      };
      
      // Remover campos undefined
      Object.keys(migratedUser).forEach(key => {
        if (migratedUser[key] === undefined) {
          delete migratedUser[key];
        }
      });
      
      migrations.push({
        userId,
        original: userData,
        migrated: migratedUser,
        changes: {
          roleChanged: currentRole !== suggestedRole,
          addedPermissions: !userData.permissions,
          addedCapabilities: !userData.canEditAttendance,
          structureUpdated: true
        }
      });
      
      console.log(`  📊 Role: ${currentRole} → ${suggestedRole}`);
      console.log(`  🔑 Permissões: ${rolePermissions.permissions.length} adicionadas`);
      console.log(`  ✅ Estrutura padronizada\n`);
    }
    
    // 3. Aplicar migrações
    console.log('💾 Aplicando migrações...\n');
    const batch = db.batch();
    
    migrations.forEach(migration => {
      const userRef = db.collection('users').doc(migration.userId);
      batch.set(userRef, migration.migrated, { merge: false });
    });
    
    await batch.commit();
    
    // 4. Salvar log de migração
    const migrationLogRef = db.collection('migration_logs').doc(`user_migration_${Date.now()}`);
    await migrationLogRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type: 'user_structure_migration',
      totalMigrated: migrations.length,
      migrations: migrations.map(m => ({
        userId: m.userId,
        email: m.original.email,
        changes: m.changes
      }))
    });
    
    // 5. Relatório final
    console.log('🎉 MIGRAÇÃO CONCLUÍDA!\n');
    console.log('📊 RESUMO:');
    console.log(`   👥 Total de usuários migrados: ${migrations.length}`);
    console.log(`   🔄 Roles atualizados: ${migrations.filter(m => m.changes.roleChanged).length}`);
    console.log(`   🔑 Permissões adicionadas: ${migrations.filter(m => m.changes.addedPermissions).length}`);
    console.log(`   ⚙️ Capacidades adicionadas: ${migrations.filter(m => m.changes.addedCapabilities).length}`);
    
    console.log('\n📋 ROLES FINAIS:');
    migrations.forEach(m => {
      console.log(`   ${m.migrated.email}: ${m.migrated.role} (${m.migrated.userType})`);
    });
    
    console.log('\n✅ Todos os usuários agora têm estrutura consistente!');
    console.log('💾 Backup salvo na coleção "backups"');
    console.log('📝 Log detalhado salvo na coleção "migration_logs"');
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    process.exit(1);
  }
}

// Executar migração
migrateUsers().then(() => {
  console.log('\n🏁 Processo concluído com sucesso!');
  process.exit(0);
}).catch(console.error);