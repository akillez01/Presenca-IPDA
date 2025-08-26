#!/bin/bash

# Script para atualizar referências do domínio antigo para o novo
# De: adoring-boyd.74-208-44-241.plesk.page
# Para: ipda.app.br

echo "🔄 Atualizando referências de domínio na documentação..."

# Encontrar todos os arquivos .md que contêm o domínio antigo
echo "📋 Arquivos encontrados com domínio antigo:"
grep -r "adoring-boyd.74-208-44-241.plesk.page" *.md md/ 2>/dev/null | cut -d: -f1 | sort | uniq

echo ""
echo "⚠️  IMPORTANTE:"
echo "   • O domínio temporário será mantido na documentação histórica"
echo "   • Apenas URLs principais serão atualizadas para ipda.app.br"
echo "   • Documentos de configuração DNS manterão ambos os domínios para referência"

echo ""
echo "✅ Para fazer o deploy no novo domínio:"
echo "   1. Faça upload do build para Plesk em ipda.app.br"
echo "   2. Configure as variáveis de ambiente no Plesk"
echo "   3. Adicione ipda.app.br nos domínios autorizados do Firebase"
echo "   4. Atualize o Google Analytics para o novo domínio"

echo ""
echo "🧪 Para testar localmente com novo domínio:"
echo "   npm run dev"
echo "   # O sistema usará ipda.app.br como URL base"

echo ""
echo "🔗 URLs de produção:"
echo "   • Principal: https://ipda.app.br"
echo "   • Admin: https://ipda.app.br/config"
echo "   • Registro: https://ipda.app.br/register"
