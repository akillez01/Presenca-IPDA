#!/bin/bash

# Script para fazer deploy das regras do Firebase Storage
# Uso: ./deploy-storage-rules.sh

echo "🚀 Fazendo deploy das regras do Firebase Storage..."

# Verifica se o Firebase CLI está instalado
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI não encontrado!"
    echo "📦 Instale com: npm install -g firebase-tools"
    exit 1
fi

# Verifica se está logado no Firebase
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Fazendo login no Firebase..."
    firebase login
fi

# Faz deploy apenas das regras do Storage
echo "📤 Enviando regras do Storage..."
firebase deploy --only storage

if [ $? -eq 0 ]; then
    echo "✅ Regras do Storage atualizadas com sucesso!"
    echo ""
    echo "As regras agora permitem:"
    echo "  - Leitura pública das fotos"
    echo "  - Upload apenas para usuários autenticados"
    echo "  - Limite de 5MB por arquivo"
    echo "  - Apenas arquivos de imagem"
else
    echo "❌ Erro ao fazer deploy das regras"
    exit 1
fi
