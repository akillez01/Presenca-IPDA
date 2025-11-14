const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Inicializar Firebase Admin
const serviceAccount = require('./reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://reuniao-ministerial-default-rtdb.firebaseio.com"
});

const db = admin.firestore();

async function createFullBackup() {
  try {
    console.log('🔄 Iniciando backup completo do Firebase...');
    
    const backup = {
      timestamp: new Date().toISOString(),
      collections: {}
    };

    // Lista de coleções para backup
    const collections = ['attendance', 'users'];
    
    for (const collectionName of collections) {
      console.log(`📋 Fazendo backup da coleção: ${collectionName}`);
      
      const snapshot = await db.collection(collectionName).get();
      const documents = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Converter timestamps para ISO strings
        Object.keys(data).forEach(key => {
          if (data[key] && typeof data[key].toDate === 'function') {
            data[key] = data[key].toDate().toISOString();
          }
        });
        
        documents.push({
          id: doc.id,
          data: data
        });
      });
      
      backup.collections[collectionName] = {
        count: documents.length,
        documents: documents
      };
      
      console.log(`✅ ${collectionName}: ${documents.length} documentos`);
    }

    // Salvar backup completo
    const backupFileName = `firebase-backup-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(backupFileName, JSON.stringify(backup, null, 2));
    
    console.log(`💾 Backup salvo em: ${backupFileName}`);
    
    // Criar arquivo SQL para migração
    await createSQLSchema(backup);
    
    console.log('🎉 Backup completo finalizado!');
    
    return backup;
    
  } catch (error) {
    console.error('❌ Erro durante backup:', error);
    throw error;
  }
}

async function createSQLSchema(backup) {
  console.log('🔧 Criando esquema SQL...');
  
  let sql = `-- BACKUP FIREBASE PARA SQL
-- Data: ${new Date().toISOString()}
-- Total de registros: ${backup.collections.attendance ? backup.collections.attendance.count : 0}

-- Criar database
CREATE DATABASE IF NOT EXISTS presenca_ipda;
USE presenca_ipda;

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  nome VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela principal de presença/membros
CREATE TABLE IF NOT EXISTS membros (
  id VARCHAR(255) PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(14) UNIQUE,
  telefone VARCHAR(20),
  data_nascimento DATE,
  regiao VARCHAR(255),
  pastor VARCHAR(255),
  status VARCHAR(50) DEFAULT 'Presente',
  data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_cpf (cpf),
  INDEX idx_nome (nome),
  INDEX idx_regiao (regiao),
  INDEX idx_pastor (pastor),
  INDEX idx_data_nascimento (data_nascimento)
);

-- Tabela de logs de presença
CREATE TABLE IF NOT EXISTS logs_presenca (
  id INT AUTO_INCREMENT PRIMARY KEY,
  membro_id VARCHAR(255),
  data_evento DATE,
  status VARCHAR(50),
  usuario_registro VARCHAR(255),
  timestamp_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (membro_id) REFERENCES membros(id) ON DELETE CASCADE,
  INDEX idx_membro_data (membro_id, data_evento),
  INDEX idx_data_evento (data_evento)
);

-- Inserir dados dos usuários
`;

  // Inserir usuários
  if (backup.collections.users) {
    backup.collections.users.documents.forEach(user => {
      const data = user.data;
      sql += `INSERT IGNORE INTO usuarios (id, email, nome, role, ativo) VALUES (
        '${user.id}',
        '${data.email || ''}',
        '${(data.displayName || data.nome || '').replace(/'/g, "''")}',
        '${data.role || 'user'}',
        ${data.active !== false ? 'TRUE' : 'FALSE'}
      );\n`;
    });
  }

  sql += '\n-- Inserir dados dos membros\n';

  // Inserir membros da coleção attendance
  if (backup.collections.attendance) {
    backup.collections.attendance.documents.forEach(member => {
      const data = member.data;
      
      // Processar data de nascimento
      let dataNascimento = 'NULL';
      if (data.dataNascimento) {
        try {
          const date = new Date(data.dataNascimento);
          dataNascimento = `'${date.toISOString().split('T')[0]}'`;
        } catch (e) {
          dataNascimento = 'NULL';
        }
      }
      
      // Processar data de registro
      let dataRegistro = 'NULL';
      if (data.timestamp) {
        try {
          const date = new Date(data.timestamp);
          dataRegistro = `'${date.toISOString().replace('T', ' ').split('.')[0]}'`;
        } catch (e) {
          dataRegistro = 'CURRENT_TIMESTAMP';
        }
      }
      
      sql += `INSERT IGNORE INTO membros (
        id, nome, cpf, telefone, data_nascimento, regiao, pastor, status, data_registro
      ) VALUES (
        '${member.id}',
        '${(data.nome || '').replace(/'/g, "''")}',
        '${(data.cpf || '').replace(/\D/g, '')}',
        '${(data.telefone || '').replace(/'/g, "''")}',
        ${dataNascimento},
        '${(data.regiao || '').replace(/'/g, "''")}',
        '${(data.pastor || '').replace(/'/g, "''")}',
        '${data.status || 'Presente'}',
        ${dataRegistro}
      );\n`;
      
      // Inserir log de presença
      sql += `INSERT INTO logs_presenca (membro_id, data_evento, status, timestamp_registro) VALUES (
        '${member.id}',
        '${dataRegistro === 'NULL' ? new Date().toISOString().split('T')[0] : new Date(data.timestamp).toISOString().split('T')[0]}',
        '${data.status || 'Presente'}',
        ${dataRegistro === 'NULL' ? 'CURRENT_TIMESTAMP' : dataRegistro}
      );\n`;
    });
  }

  sql += `
-- Views úteis
CREATE OR REPLACE VIEW vw_presenca_hoje AS
SELECT 
  COUNT(*) as total_presente,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM membros) as percentual_presenca
FROM logs_presenca 
WHERE data_evento = CURDATE() AND status = 'Presente';

CREATE OR REPLACE VIEW vw_aniversariantes_mes AS
SELECT 
  nome, 
  data_nascimento,
  DAY(data_nascimento) as dia,
  regiao,
  pastor
FROM membros 
WHERE MONTH(data_nascimento) = MONTH(CURDATE())
ORDER BY DAY(data_nascimento);

CREATE OR REPLACE VIEW vw_estatisticas_regiao AS
SELECT 
  regiao,
  COUNT(*) as total_membros,
  COUNT(CASE WHEN data_nascimento IS NOT NULL THEN 1 END) as com_aniversario
FROM membros 
GROUP BY regiao
ORDER BY total_membros DESC;

-- Procedimentos úteis
DELIMITER //

CREATE PROCEDURE sp_buscar_membro(IN busca VARCHAR(255))
BEGIN
  SELECT * FROM membros 
  WHERE nome LIKE CONCAT('%', busca, '%')
     OR cpf LIKE CONCAT('%', busca, '%')
     OR telefone LIKE CONCAT('%', busca, '%')
     OR regiao LIKE CONCAT('%', busca, '%')
     OR pastor LIKE CONCAT('%', busca, '%');
END //

CREATE PROCEDURE sp_registrar_presenca(IN membro_id VARCHAR(255), IN usuario VARCHAR(255))
BEGIN
  INSERT INTO logs_presenca (membro_id, data_evento, status, usuario_registro) 
  VALUES (membro_id, CURDATE(), 'Presente', usuario);
END //

DELIMITER ;

-- Criar índices para performance
CREATE INDEX idx_logs_data_status ON logs_presenca(data_evento, status);
CREATE INDEX idx_membros_busca ON membros(nome, cpf, telefone);
`;

  // Salvar arquivo SQL
  const sqlFileName = `migration-to-sql-${new Date().toISOString().split('T')[0]}.sql`;
  fs.writeFileSync(sqlFileName, sql);
  
  console.log(`📄 Schema SQL criado: ${sqlFileName}`);
}

// Executar backup
createFullBackup()
  .then(backup => {
    console.log('\n📊 RESUMO DO BACKUP:');
    Object.keys(backup.collections).forEach(collection => {
      console.log(`  - ${collection}: ${backup.collections[collection].count} documentos`);
    });
  })
  .catch(error => {
    console.error('💥 Erro:', error);
    process.exit(1);
  });
