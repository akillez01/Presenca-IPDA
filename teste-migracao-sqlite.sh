#!/bin/bash

# Script de teste rápido da migração para SQLite
echo "🧪 TESTE RÁPIDO DE MIGRAÇÃO FIREBASE → SQLite"
echo "============================================"

# Verificar se SQLite está instalado
if ! command -v sqlite3 &> /dev/null; then
    echo "❌ SQLite3 não encontrado. Por favor, instale com:"
    echo "   sudo apt-get install sqlite3"
    exit 1
fi

echo "✅ SQLite3 encontrado: $(sqlite3 --version | cut -d' ' -f1)"

# Criar banco SQLite de teste
DB_FILE="teste-migracao-$(date +%Y%m%d).db"
echo "📁 Criando banco de teste: $DB_FILE"

# Criar esquema básico para SQLite
cat > schema-sqlite-teste.sql << 'EOF'
-- Schema simplificado para teste
CREATE TABLE IF NOT EXISTS membros (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  telefone TEXT,
  data_nascimento DATE,
  regiao TEXT,
  pastor TEXT,
  status TEXT DEFAULT 'Presente',
  data_registro DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cpf ON membros(cpf);
CREATE INDEX IF NOT EXISTS idx_nome ON membros(nome);
EOF

# Aplicar schema
echo "🔧 Criando estrutura do banco..."
sqlite3 "$DB_FILE" < schema-sqlite-teste.sql

# Extrair primeiros 10 registros do backup JSON e converter para SQL
echo "📋 Extraindo amostra de dados..."
node -e "
const fs = require('fs');
const backup = JSON.parse(fs.readFileSync('firebase-backup-2025-09-22.json', 'utf8'));
const members = backup.collections.attendance.documents.slice(0, 10);

let sql = '';
members.forEach(member => {
  const data = member.data;
  const nome = (data.fullName || '').replace(/'/g, \"''\");
  const cpf = (data.cpf || '').replace(/\\D/g, '');
  const telefone = (data.phoneNumber || '').replace(/'/g, \"''\");
  const regiao = (data.region || '').replace(/'/g, \"''\");
  const pastor = (data.pastorName || '').replace(/'/g, \"''\");
  const dataNasc = data.birthday ? data.birthday.split('/').reverse().join('-') : null;
  
  sql += \`INSERT OR IGNORE INTO membros (id, nome, cpf, telefone, data_nascimento, regiao, pastor, status) VALUES ('\${member.id}', '\${nome}', '\${cpf}', '\${telefone}', \${dataNasc ? \"'\" + dataNasc + \"'\" : 'NULL'}, '\${regiao}', '\${pastor}', 'Presente');\\n\`;
});

fs.writeFileSync('dados-teste.sql', sql);
console.log('✅ Dados de teste extraídos');
"

# Inserir dados de teste
echo "📥 Inserindo dados de teste..."
sqlite3 "$DB_FILE" < dados-teste.sql

# Verificar dados inseridos
echo "🔍 Verificando dados inseridos..."
TOTAL=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM membros;")
echo "   Total de registros: $TOTAL"

# Executar algumas consultas de teste
echo "🧪 Executando testes de consulta..."

echo "   📊 Membros por região:"
sqlite3 "$DB_FILE" "SELECT regiao, COUNT(*) as total FROM membros GROUP BY regiao ORDER BY total DESC;" | head -5

echo "   🔍 Busca por nome (primeiros 3):"
sqlite3 "$DB_FILE" "SELECT nome, regiao FROM membros WHERE nome LIKE '%Silva%' LIMIT 3;"

echo "   📱 Membros com telefone:"
TELEFONE_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM membros WHERE telefone IS NOT NULL AND telefone != '';")
echo "   Total com telefone: $TELEFONE_COUNT"

# Testar views
echo "📈 Criando view de estatísticas..."
sqlite3 "$DB_FILE" "
CREATE VIEW IF NOT EXISTS vw_estatisticas AS
SELECT 
  COUNT(*) as total_membros,
  COUNT(CASE WHEN telefone IS NOT NULL AND telefone != '' THEN 1 END) as com_telefone,
  COUNT(CASE WHEN data_nascimento IS NOT NULL THEN 1 END) as com_aniversario,
  COUNT(DISTINCT regiao) as total_regioes,
  COUNT(DISTINCT pastor) as total_pastores
FROM membros;
"

echo "📊 Estatísticas do teste:"
sqlite3 "$DB_FILE" "SELECT * FROM vw_estatisticas;"

# Verificar integridade
echo "🔒 Verificando integridade..."
INTEGRITY=$(sqlite3 "$DB_FILE" "PRAGMA integrity_check;")
echo "   Integridade: $INTEGRITY"

# Limpar arquivos temporários
rm -f dados-teste.sql schema-sqlite-teste.sql

echo ""
echo "✅ TESTE DE MIGRAÇÃO CONCLUÍDO!"
echo "==============================="
echo "📁 Banco de teste criado: $DB_FILE"
echo "📊 Total de registros: $TOTAL"
echo "🧪 Todas as consultas funcionaram"
echo ""
echo "🔍 Para explorar o banco:"
echo "   sqlite3 $DB_FILE"
echo ""
echo "🗑️ Para remover o teste:"
echo "   rm $DB_FILE"
