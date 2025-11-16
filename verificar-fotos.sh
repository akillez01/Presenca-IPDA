#!/bin/bash

# Script para executar a verificação de fotos salvas

echo "🔍 Verificando fotos salvas no Firestore..."
echo ""

# Executa o script Node.js
node verificar-fotos-salvas.cjs

echo ""
echo "Dica: Execute este script após fazer um cadastro para verificar se a foto foi salva."
