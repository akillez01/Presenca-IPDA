#!/bin/bash
echo "🚀 Iniciando deploy das regras do Firestore..."

# Verificar login
echo "🔐 Verificando autenticação..."
firebase auth:status

# Fazer deploy
echo "📤 Fazendo deploy das regras..."
firebase deploy --only firestore:rules --non-interactive

echo "✅ Deploy concluído!"
