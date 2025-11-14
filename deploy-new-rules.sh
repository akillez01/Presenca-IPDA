#!/bin/bash

# Script para aplicar as regras de Firestore atualizadas com controle de concorrência

echo "🚀 Aplicando regras de Firestore atualizadas..."

# Verificar se o Firebase CLI está instalado
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI não encontrado. Instale com: npm install -g firebase-tools"
    exit 1
fi

# Verificar se está logado
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Fazendo login no Firebase..."
    firebase login
fi

# Fazer backup das regras atuais
echo "💾 Fazendo backup das regras atuais..."
firebase firestore:rules:get > firestore-rules-backup-$(date +%Y%m%d-%H%M%S).rules 2>/dev/null || true

# Aplicar as novas regras
echo "📝 Aplicando novas regras de Firestore..."
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo "✅ Regras aplicadas com sucesso!"
    echo ""
    echo "📋 Principais melhorias aplicadas:"
    echo "   • Controle de concorrência com updateCount"
    echo "   • Campos de auditoria obrigatórios"
    echo "   • Validação de timestamps"
    echo "   • Proteção contra race conditions"
    echo "   • Logs de auditoria estruturados"
    echo ""
    echo "⚠️  IMPORTANTE: Teste o sistema em ambiente de desenvolvimento antes do uso em produção"
else
    echo "❌ Erro ao aplicar regras. Verifique o arquivo firestore.rules"
    exit 1
fi