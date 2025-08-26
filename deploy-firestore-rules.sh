#!/bin/bash

echo "🔥 Implantando novas regras do Firestore com acesso aos novos usuários..."

echo "📤 Enviando regras atualizadas para o Firebase..."
firebase deploy --only firestore:rules

echo "✅ Regras do Firestore atualizadas com sucesso!"

echo ""
echo "🎯 Regras implantadas incluem:"
echo ""
echo "   🔴 Super Usuários (acesso total):"
echo "      • admin@ipda.org.br"
echo "      • marciodesk@ipda.app.br"
echo ""
echo "   🟡 Usuários Básicos (acesso limitado):"
echo "      • presente@ipda.app.br"
echo "      • secretaria@ipda.org.br" 
echo "      • auxiliar@ipda.org.br"
echo "      • cadastro@ipda.app.br"
echo ""
echo "🔐 Permissões configuradas:"
echo "   ✅ Básicos: presença, usuários, leitura de sistema"
echo "   ✅ Super: acesso total incluindo relatórios e admin"
echo "   • Usuários básicos: presente@ipda.app.br, secretaria@ipda.org.br, auxiliar@ipda.org.br, cadastro@ipda.app.br"
echo "   • Permissões diferenciadas por tipo de usuário"
echo ""
echo "🧪 Teste agora o login com os usuários!"
