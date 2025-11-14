#!/bin/bash

echo "🔄 Forçando atualização do status no frontend..."

# 1. Limpar cache do Next.js
echo "🧹 Limpando cache..."
rm -rf .next
rm -rf node_modules/.cache

# 2. Verificar se há problemas de compilação
echo "📋 Verificando tipos TypeScript..."
npx tsc --noEmit --pretty

# 3. Mostrar status atual do banco
echo ""
echo "📊 Status atual do banco de dados:"
node quick-check.cjs

echo ""
echo "✅ Para ver o status correto:"
echo "   1. Execute 'npm run dev'"
echo "   2. Abra o navegador em modo incógnito"
echo "   3. Verifique se os números coincidem com os dados reais"
echo ""
echo "🔍 Dados que DEVERIAM aparecer:"
echo "   • Registros totais: 1803"
echo "   • Registros hoje: ~1803 (se todos são de hoje)"
echo "   • Taxa de presença: ~100% (se todos estão como 'Presente')"
