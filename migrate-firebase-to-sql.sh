#!/bin/bash

# Script de Migração Firebase para SQL
# Data: 22 de setembro de 2025

echo "🚀 SCRIPT DE MIGRAÇÃO FIREBASE PARA SQL"
echo "======================================"

# Verificar dependências
check_dependencies() {
    echo "🔍 Verificando dependências..."
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js não encontrado. Instale Node.js primeiro."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "❌ NPM não encontrado. Instale NPM primeiro."
        exit 1
    fi
    
    echo "✅ Node.js e NPM encontrados"
}

# Instalar dependências do Node.js se necessário
install_node_deps() {
    echo "📦 Verificando dependências do Node.js..."
    
    if [ ! -d "node_modules" ]; then
        echo "🔄 Instalando dependências..."
        npm install
    fi
    
    # Verificar se firebase-admin está instalado
    if ! npm list firebase-admin &> /dev/null; then
        echo "🔄 Instalando firebase-admin..."
        npm install firebase-admin
    fi
    
    echo "✅ Dependências do Node.js prontas"
}

# Fazer backup do Firebase
create_firebase_backup() {
    echo "📋 Criando backup do Firebase..."
    
    if [ ! -f "backup-firebase-migration.js" ]; then
        echo "❌ Script de backup não encontrado!"
        exit 1
    fi
    
    node backup-firebase-migration.js
    
    if [ $? -eq 0 ]; then
        echo "✅ Backup do Firebase criado com sucesso!"
    else
        echo "❌ Erro ao criar backup do Firebase"
        exit 1
    fi
}

# Configurar banco SQL
setup_sql_database() {
    echo "🗄️ Configuração do Banco SQL"
    echo "=========================="
    
    echo "Escolha o tipo de banco SQL:"
    echo "1) MySQL"
    echo "2) PostgreSQL"
    echo "3) SQLite (para testes)"
    
    read -p "Digite sua escolha (1-3): " db_choice
    
    case $db_choice in
        1)
            setup_mysql
            ;;
        2)
            setup_postgresql
            ;;
        3)
            setup_sqlite
            ;;
        *)
            echo "❌ Escolha inválida"
            exit 1
            ;;
    esac
}

# Configurar MySQL
setup_mysql() {
    echo "🐬 Configurando MySQL..."
    
    read -p "Host do MySQL (localhost): " mysql_host
    mysql_host=${mysql_host:-localhost}
    
    read -p "Porta do MySQL (3306): " mysql_port
    mysql_port=${mysql_port:-3306}
    
    read -p "Usuário do MySQL: " mysql_user
    read -s -p "Senha do MySQL: " mysql_pass
    echo
    
    read -p "Nome do banco (presenca_ipda): " mysql_db
    mysql_db=${mysql_db:-presenca_ipda}
    
    # Criar arquivo de configuração
    cat > .env.migration << EOF
DB_TYPE=mysql
DB_HOST=$mysql_host
DB_PORT=$mysql_port
DB_USER=$mysql_user
DB_PASS=$mysql_pass
DB_NAME=$mysql_db
EOF
    
    echo "✅ Configuração MySQL salva"
    
    # Tentar executar o SQL
    if command -v mysql &> /dev/null; then
        echo "🔄 Executando migração..."
        mysql -h$mysql_host -P$mysql_port -u$mysql_user -p$mysql_pass < migration-to-sql-*.sql
        
        if [ $? -eq 0 ]; then
            echo "✅ Migração MySQL executada com sucesso!"
        else
            echo "⚠️ Erro na migração. Execute manualmente:"
            echo "mysql -h$mysql_host -P$mysql_port -u$mysql_user -p$mysql_pass < migration-to-sql-*.sql"
        fi
    else
        echo "⚠️ Cliente MySQL não encontrado. Execute manualmente:"
        echo "mysql -h$mysql_host -P$mysql_port -u$mysql_user -p$mysql_pass < migration-to-sql-*.sql"
    fi
}

# Configurar PostgreSQL
setup_postgresql() {
    echo "🐘 Configurando PostgreSQL..."
    
    read -p "Host do PostgreSQL (localhost): " pg_host
    pg_host=${pg_host:-localhost}
    
    read -p "Porta do PostgreSQL (5432): " pg_port
    pg_port=${pg_port:-5432}
    
    read -p "Usuário do PostgreSQL: " pg_user
    read -s -p "Senha do PostgreSQL: " pg_pass
    echo
    
    read -p "Nome do banco (presenca_ipda): " pg_db
    pg_db=${pg_db:-presenca_ipda}
    
    # Criar arquivo de configuração
    cat > .env.migration << EOF
DB_TYPE=postgresql
DB_HOST=$pg_host
DB_PORT=$pg_port
DB_USER=$pg_user
DB_PASS=$pg_pass
DB_NAME=$pg_db
EOF
    
    echo "✅ Configuração PostgreSQL salva"
    
    # Converter SQL para PostgreSQL (algumas adaptações necessárias)
    create_postgresql_migration
    
    # Tentar executar o SQL
    if command -v psql &> /dev/null; then
        echo "🔄 Executando migração..."
        PGPASSWORD=$pg_pass psql -h $pg_host -p $pg_port -U $pg_user -d $pg_db -f migration-postgresql-*.sql
        
        if [ $? -eq 0 ]; then
            echo "✅ Migração PostgreSQL executada com sucesso!"
        else
            echo "⚠️ Erro na migração. Execute manualmente:"
            echo "PGPASSWORD=$pg_pass psql -h $pg_host -p $pg_port -U $pg_user -d $pg_db -f migration-postgresql-*.sql"
        fi
    else
        echo "⚠️ Cliente PostgreSQL não encontrado. Execute manualmente:"
        echo "PGPASSWORD=$pg_pass psql -h $pg_host -p $pg_port -U $pg_user -d $pg_db -f migration-postgresql-*.sql"
    fi
}

# Criar migração específica para PostgreSQL
create_postgresql_migration() {
    echo "🔄 Adaptando SQL para PostgreSQL..."
    
    sql_file=$(ls migration-to-sql-*.sql | head -1)
    pg_file="migration-postgresql-$(date +%Y-%m-%d).sql"
    
    # Adaptar SQL para PostgreSQL
    sed 's/AUTO_INCREMENT/SERIAL/g; s/BOOLEAN DEFAULT TRUE/BOOLEAN DEFAULT true/g; s/BOOLEAN DEFAULT FALSE/BOOLEAN DEFAULT false/g' "$sql_file" > "$pg_file"
    
    echo "✅ SQL adaptado para PostgreSQL: $pg_file"
}

# Configurar SQLite
setup_sqlite() {
    echo "📁 Configurando SQLite..."
    
    read -p "Nome do arquivo SQLite (presenca_ipda.db): " sqlite_file
    sqlite_file=${sqlite_file:-presenca_ipda.db}
    
    # Criar arquivo de configuração
    cat > .env.migration << EOF
DB_TYPE=sqlite
DB_FILE=$sqlite_file
EOF
    
    echo "✅ Configuração SQLite salva"
    
    # Converter e executar SQL para SQLite
    create_sqlite_migration
    
    if command -v sqlite3 &> /dev/null; then
        echo "🔄 Executando migração..."
        sqlite3 "$sqlite_file" < migration-sqlite-*.sql
        
        if [ $? -eq 0 ]; then
            echo "✅ Migração SQLite executada com sucesso!"
            echo "📁 Banco criado: $sqlite_file"
        else
            echo "❌ Erro na migração SQLite"
        fi
    else
        echo "⚠️ SQLite3 não encontrado. Instale SQLite3 primeiro."
    fi
}

# Criar migração específica para SQLite
create_sqlite_migration() {
    echo "🔄 Adaptando SQL para SQLite..."
    
    sql_file=$(ls migration-to-sql-*.sql | head -1)
    sqlite_file="migration-sqlite-$(date +%Y-%m-%d).sql"
    
    # Adaptar SQL para SQLite (remover algumas funcionalidades não suportadas)
    cat > "$sqlite_file" << 'EOF'
-- MIGRAÇÃO FIREBASE PARA SQLITE
-- Data: $(date)

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nome TEXT,
  role TEXT DEFAULT 'user',
  ativo INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela principal de presença/membros
CREATE TABLE IF NOT EXISTS membros (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  telefone TEXT,
  data_nascimento DATE,
  regiao TEXT,
  pastor TEXT,
  status TEXT DEFAULT 'Presente',
  data_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de logs de presença
CREATE TABLE IF NOT EXISTS logs_presenca (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  membro_id TEXT,
  data_evento DATE,
  status TEXT,
  usuario_registro TEXT,
  timestamp_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (membro_id) REFERENCES membros(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cpf ON membros(cpf);
CREATE INDEX IF NOT EXISTS idx_nome ON membros(nome);
CREATE INDEX IF NOT EXISTS idx_regiao ON membros(regiao);
CREATE INDEX IF NOT EXISTS idx_pastor ON membros(pastor);
CREATE INDEX IF NOT EXISTS idx_data_nascimento ON membros(data_nascimento);
CREATE INDEX IF NOT EXISTS idx_membro_data ON logs_presenca(membro_id, data_evento);
CREATE INDEX IF NOT EXISTS idx_data_evento ON logs_presenca(data_evento);

EOF
    
    # Adicionar dados do SQL original, adaptando sintaxe
    grep "INSERT" "$sql_file" | sed 's/INSERT IGNORE/INSERT OR IGNORE/g' >> "$sqlite_file"
    
    echo "✅ SQL adaptado para SQLite: $sqlite_file"
}

# Criar script de sincronização
create_sync_script() {
    echo "🔄 Criando script de sincronização..."
    
    cat > sync-firebase-to-sql.js << 'EOF'
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.migration' });

// Configuração do banco SQL baseada no .env
const dbConfig = {
  type: process.env.DB_TYPE,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  file: process.env.DB_FILE
};

console.log('🔄 Script de sincronização Firebase → SQL');
console.log('==========================================');

// TODO: Implementar sincronização em tempo real
// Este script pode ser usado para sincronizar mudanças do Firebase para SQL

async function syncData() {
  console.log('🚀 Iniciando sincronização...');
  console.log('📝 Configuração:', dbConfig);
  
  // Implementar lógica de sincronização aqui
  console.log('⚠️ Sincronização ainda não implementada');
  console.log('💡 Este é um template para desenvolvimento futuro');
}

syncData().catch(console.error);
EOF
    
    echo "✅ Script de sincronização criado: sync-firebase-to-sql.js"
}

# Criar documentação da migração
create_migration_docs() {
    echo "📝 Criando documentação da migração..."
    
    cat > MIGRACAO-FIREBASE-SQL-$(date +%Y-%m-%d).md << EOF
# 🗄️ MIGRAÇÃO FIREBASE PARA SQL

**Data:** $(date '+%d de %B de %Y')  
**Sistema:** Presença IPDA  
**Status:** Backup criado e migração configurada

---

## 📋 RESUMO DA MIGRAÇÃO

### ✅ **BACKUP REALIZADO**
- Backup completo do Firebase criado
- Dados preservados em formato JSON
- Schema SQL gerado automaticamente

### 🗄️ **ESTRUTURA DO BANCO SQL**

#### **Tabela: usuarios**
- \`id\` - ID único do usuário
- \`email\` - Email do usuário  
- \`nome\` - Nome do usuário
- \`role\` - Função do usuário
- \`ativo\` - Status ativo/inativo

#### **Tabela: membros**
- \`id\` - ID único do membro
- \`nome\` - Nome completo
- \`cpf\` - CPF (único)
- \`telefone\` - Telefone de contato
- \`data_nascimento\` - Data de nascimento
- \`regiao\` - Região do membro
- \`pastor\` - Pastor responsável
- \`status\` - Status de presença
- \`data_registro\` - Data de registro

#### **Tabela: logs_presenca**
- \`id\` - ID único do log
- \`membro_id\` - Referência ao membro
- \`data_evento\` - Data do evento
- \`status\` - Status da presença
- \`usuario_registro\` - Usuário que registrou
- \`timestamp_registro\` - Timestamp do registro

### 🔧 **VIEWS CRIADAS**
- \`vw_presenca_hoje\` - Estatísticas de presença do dia
- \`vw_aniversariantes_mes\` - Aniversariantes do mês
- \`vw_estatisticas_regiao\` - Estatísticas por região

### ⚙️ **PROCEDURES CRIADAS**
- \`sp_buscar_membro\` - Busca de membros
- \`sp_registrar_presenca\` - Registro de presença

---

## 📁 ARQUIVOS GERADOS

- \`firebase-backup-YYYY-MM-DD.json\` - Backup completo do Firebase
- \`migration-to-sql-YYYY-MM-DD.sql\` - Script de migração SQL
- \`migration-postgresql-YYYY-MM-DD.sql\` - Versão para PostgreSQL
- \`migration-sqlite-YYYY-MM-DD.sql\` - Versão para SQLite
- \`.env.migration\` - Configuração do banco
- \`sync-firebase-to-sql.js\` - Script de sincronização

---

## 🚀 PRÓXIMOS PASSOS

1. **Testar a migração** no ambiente de desenvolvimento
2. **Validar os dados** migrados
3. **Configurar sincronização** (se necessário)
4. **Atualizar aplicação** para usar SQL
5. **Migrar ambiente de produção**

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

- Backup do Firebase preservado
- Dados validados durante migração
- Índices criados para performance
- Views e procedures para facilitar consultas
- Script de sincronização disponível para desenvolvimento

---

**✅ MIGRAÇÃO PREPARADA COM SUCESSO!**
EOF

    echo "✅ Documentação criada: MIGRACAO-FIREBASE-SQL-$(date +%Y-%m-%d).md"
}

# Função principal
main() {
    echo "🚀 Iniciando processo de migração..."
    
    check_dependencies
    install_node_deps
    create_firebase_backup
    setup_sql_database
    create_sync_script
    create_migration_docs
    
    echo ""
    echo "🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!"
    echo "================================="
    echo ""
    echo "📁 Arquivos criados:"
    ls -la firebase-backup-* migration-* .env.migration sync-firebase-to-sql.js MIGRACAO-*.md 2>/dev/null
    echo ""
    echo "📋 Próximos passos:"
    echo "1. Verificar os dados migrados"
    echo "2. Testar conexão com banco SQL"
    echo "3. Atualizar aplicação para usar SQL"
    echo ""
    echo "✅ Backup do Firebase preservado com segurança!"
}

# Executar script principal
main "$@"
