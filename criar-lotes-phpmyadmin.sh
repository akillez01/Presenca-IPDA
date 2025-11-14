#!/bin/bash

# Script para criar arquivos de dados em lotes para phpMyAdmin
# Para evitar timeouts e problemas de memória

echo "🔄 Criando arquivos de dados para phpMyAdmin..."

# Arquivo SQL original
SQL_FILE="migration-to-sql-2025-09-22.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Arquivo $SQL_FILE não encontrado!"
    exit 1
fi

# Extrair dados de usuários
echo "👥 Extraindo dados de usuários..."
cat > ipda-dados-usuarios.sql << 'EOF'
-- DADOS DOS USUÁRIOS IPDA
-- Para importar no phpMyAdmin (banco: admin_ipda)

USE admin_ipda;

SET FOREIGN_KEY_CHECKS = 0;
SET AUTOCOMMIT = 0;

-- Inserir usuários do sistema
INSERT IGNORE INTO ipda_usuarios (id, email, nome, role, ativo) VALUES 
('dG8YjKPVQJgZC8wUsGlXCMzCeH03', 'presente@ipda.app.br', 'Presente IPDA', 'user', TRUE),
('I2U5FRbEgkPpXcKVqYhRoFzGaJ92', 'cadastro@ipda.app.br', 'Cadastro IPDA', 'user', TRUE);

COMMIT;
SET AUTOCOMMIT = 1;
SET FOREIGN_KEY_CHECKS = 1;
EOF

# Extrair e converter dados dos membros em lotes
echo "👤 Extraindo dados dos membros..."

# Extrair INSERTs de membros e dividir em lotes de 100
grep "INSERT IGNORE INTO membros" "$SQL_FILE" > temp_membros.sql

# Contar total de INSERTs
TOTAL_MEMBERS=$(wc -l < temp_membros.sql)
echo "📊 Total de membros: $TOTAL_MEMBERS"

# Dividir em lotes de 100
BATCH_SIZE=100
BATCH_NUM=1

while [ $((($BATCH_NUM - 1) * $BATCH_SIZE)) -lt $TOTAL_MEMBERS ]; do
    START_LINE=$(((BATCH_NUM - 1) * BATCH_SIZE + 1))
    END_LINE=$((BATCH_NUM * BATCH_SIZE))
    
    OUTPUT_FILE="ipda-dados-membros-lote-${BATCH_NUM}.sql"
    
    echo "📦 Criando lote $BATCH_NUM (linhas $START_LINE a $END_LINE)..."
    
    cat > "$OUTPUT_FILE" << EOF
-- DADOS DOS MEMBROS IPDA - LOTE $BATCH_NUM
-- Para importar no phpMyAdmin (banco: admin_ipda)
-- Linhas $START_LINE a $END_LINE de $TOTAL_MEMBERS

USE admin_ipda;

SET FOREIGN_KEY_CHECKS = 0;
SET AUTOCOMMIT = 0;
SET UNIQUE_CHECKS = 0;

EOF

    # Extrair lote específico e adaptar para tabela ipda_membros
    sed -n "${START_LINE},${END_LINE}p" temp_membros.sql | \
    sed 's/INSERT IGNORE INTO membros/INSERT IGNORE INTO ipda_membros/g' >> "$OUTPUT_FILE"
    
    cat >> "$OUTPUT_FILE" << EOF

COMMIT;
SET UNIQUE_CHECKS = 1;
SET AUTOCOMMIT = 1;
SET FOREIGN_KEY_CHECKS = 1;

-- Status do lote $BATCH_NUM
SELECT 'Lote $BATCH_NUM importado com sucesso!' as status;
EOF
    
    BATCH_NUM=$((BATCH_NUM + 1))
done

# Extrair logs de presença
echo "📋 Extraindo logs de presença..."
cat > ipda-dados-logs.sql << 'EOF'
-- LOGS DE PRESENÇA IPDA
-- Para importar no phpMyAdmin (banco: admin_ipda)

USE admin_ipda;

SET FOREIGN_KEY_CHECKS = 0;
SET AUTOCOMMIT = 0;

-- Criar logs de presença para todos os membros (data atual)
INSERT INTO ipda_logs_presenca (membro_id, data_evento, status, usuario_registro)
SELECT 
  id,
  CURDATE(),
  status,
  'sistema'
FROM ipda_membros;

COMMIT;
SET AUTOCOMMIT = 1;
SET FOREIGN_KEY_CHECKS = 1;

-- Verificar logs criados
SELECT COUNT(*) as total_logs, data_evento FROM ipda_logs_presenca GROUP BY data_evento;
EOF

# Limpeza
rm -f temp_membros.sql

# Criar arquivo de verificação
cat > ipda-verificacao.sql << 'EOF'
-- VERIFICAÇÃO DA MIGRAÇÃO
-- Execute este arquivo após importar todos os lotes

USE admin_ipda;

-- Verificar tabelas criadas
SHOW TABLES LIKE 'ipda_%';

-- Contagem de registros
SELECT 'Usuários' as tabela, COUNT(*) as total FROM ipda_usuarios
UNION ALL
SELECT 'Membros' as tabela, COUNT(*) as total FROM ipda_membros
UNION ALL
SELECT 'Logs Presença' as tabela, COUNT(*) as total FROM ipda_logs_presenca;

-- Verificar views
SELECT * FROM vw_ipda_resumo_geral;

-- Verificar presença de hoje
SELECT * FROM vw_ipda_presenca_hoje;

-- Alguns membros de exemplo
SELECT nome, cpf, regiao, pastor FROM ipda_membros LIMIT 5;

-- Estatísticas por região (top 5)
SELECT * FROM vw_ipda_estatisticas_regiao LIMIT 5;
EOF

# Criar guia de importação
cat > GUIA-PHPMYADMIN.md << EOF
# 📋 GUIA DE IMPORTAÇÃO PHPMAYADMIN

## 🎯 ORDEM DE IMPORTAÇÃO

### 1️⃣ **Estrutura (PRIMEIRO)**
\`\`\`
Arquivo: ipda-phpmyadmin-estrutura.sql
Descrição: Cria tabelas, views e procedures
\`\`\`

### 2️⃣ **Usuários**
\`\`\`
Arquivo: ipda-dados-usuarios.sql
Descrição: Insere usuários do sistema
\`\`\`

### 3️⃣ **Membros (EM LOTES)**
\`\`\`
Arquivos: ipda-dados-membros-lote-1.sql
          ipda-dados-membros-lote-2.sql
          ipda-dados-membros-lote-3.sql
          ...
Descrição: Insere dados dos membros em lotes de 100
\`\`\`

### 4️⃣ **Logs de Presença**
\`\`\`
Arquivo: ipda-dados-logs.sql
Descrição: Cria logs de presença para hoje
\`\`\`

### 5️⃣ **Verificação (FINAL)**
\`\`\`
Arquivo: ipda-verificacao.sql
Descrição: Verifica se tudo foi importado corretamente
\`\`\`

## 🖥️ COMO IMPORTAR NO PHPMYADMIN

1. **Acesse phpMyAdmin**
2. **Selecione o banco 'admin_ipda'**
3. **Clique na aba 'SQL'**
4. **Importe os arquivos NA ORDEM indicada acima**
5. **Para cada arquivo:**
   - Cole o conteúdo na área de texto
   - Clique em "Executar"
   - Aguarde a confirmação de sucesso

## ⚠️ DICAS IMPORTANTES

- **Não pule a ordem** de importação
- **Aguarde cada arquivo** terminar antes do próximo
- **Se der erro**, verifique se o banco está selecionado
- **Em caso de timeout**, execute os lotes menores
- **Faça backup** do banco antes de começar

## 📊 APÓS A IMPORTAÇÃO

Execute estas consultas para verificar:

\`\`\`sql
-- Verificar total de registros
SELECT COUNT(*) FROM ipda_membros;

-- Ver resumo geral
SELECT * FROM vw_ipda_resumo_geral;

-- Testar busca
CALL sp_ipda_buscar_membro('Silva');
\`\`\`

## 🎉 PRONTO!

Após importar tudo, você terá:
- ✅ $TOTAL_MEMBERS membros migrados
- ✅ Views para relatórios
- ✅ Procedures para operações
- ✅ Logs de presença
- ✅ Sistema completo funcionando
EOF

echo ""
echo "✅ ARQUIVOS CRIADOS PARA PHPMYADMIN:"
echo "=================================="
ls -la ipda-*.sql ipda-*.md | grep -v migration

echo ""
echo "📋 ORDEM DE IMPORTAÇÃO:"
echo "1️⃣ ipda-phpmyadmin-estrutura.sql"
echo "2️⃣ ipda-dados-usuarios.sql"
echo "3️⃣ ipda-dados-membros-lote-*.sql (todos os lotes)"
echo "4️⃣ ipda-dados-logs.sql"
echo "5️⃣ ipda-verificacao.sql"
echo ""
echo "📖 Leia: GUIA-PHPMYADMIN.md para instruções detalhadas"
echo ""
echo "🎉 Pronto para importar no phpMyAdmin!"
