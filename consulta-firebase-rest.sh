#!/bin/bash

# Script para consultar Firebase usando REST API (sem necessidade de SDK)
# Utiliza a REST API pública do Firestore

PROJECT_ID="reuniao-ministerial"
COLLECTION="attendance"

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔥 CONSULTA FIREBASE - REST API${NC}"
echo "Projeto: $PROJECT_ID"
echo "Coleção: $COLLECTION"
echo ""

# Função para listar documentos usando REST API pública
list_documents_rest() {
    echo -e "${GREEN}📋 Listando documentos (REST API)...${NC}"
    
    # URL da REST API pública do Firestore
    local url="https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/$COLLECTION"
    
    # Fazer request
    local response=$(curl -s "$url")
    
    # Verificar se há erro
    if echo "$response" | grep -q "error"; then
        echo -e "${RED}❌ Erro ao acessar Firestore:${NC}"
        echo "$response" | jq -r '.error.message // "Erro desconhecido"'
        return 1
    fi
    
    # Verificar se há documentos
    if echo "$response" | jq -e '.documents' > /dev/null; then
        local count=$(echo "$response" | jq '.documents | length')
        echo -e "${GREEN}✅ Encontrados $count documentos${NC}"
        echo ""
        
        # Mostrar alguns documentos
        echo "$response" | jq -r '.documents[0:5][] | 
            "📄 ID: " + (.name | split("/")[-1]) + 
            "\n   Nome: " + (.fields.fullName.stringValue // "N/A") + 
            "\n   CPF: " + (.fields.cpf.stringValue // "N/A") + 
            "\n   Status: " + (.fields.status.stringValue // "Presente") + 
            "\n   Região: " + (.fields.region.stringValue // "N/A") + 
            "\n   ---"'
    else
        echo -e "${RED}⚠️ Nenhum documento encontrado ou coleção vazia${NC}"
    fi
}

# Função para contar documentos
count_documents_rest() {
    echo -e "${GREEN}🔢 Contando documentos...${NC}"
    
    local url="https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/$COLLECTION"
    local response=$(curl -s "$url")
    
    if echo "$response" | jq -e '.documents' > /dev/null; then
        local count=$(echo "$response" | jq '.documents | length')
        echo -e "${BLUE}📊 Total: $count documentos${NC}"
    else
        echo -e "${RED}❌ Não foi possível contar documentos${NC}"
    fi
}

# Função para verificar conexão
check_connection() {
    echo -e "${GREEN}🌐 Testando conexão com Firebase...${NC}"
    
    local url="https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)"
    local response=$(curl -s -w "%{http_code}" -o /tmp/firebase_test "$url")
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ Conexão OK - Projeto '$PROJECT_ID' acessível${NC}"
        return 0
    else
        echo -e "${RED}❌ Erro de conexão (HTTP $response)${NC}"
        cat /tmp/firebase_test
        return 1
    fi
}

# Função para exportar dados para JSON
export_to_json() {
    echo -e "${GREEN}💾 Exportando dados para JSON...${NC}"
    
    local url="https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/$COLLECTION"
    local filename="firebase-export-$(date +%Y-%m-%d_%H-%M-%S).json"
    
    curl -s "$url" | jq '.' > "$filename"
    
    if [ $? -eq 0 ]; then
        local size=$(stat -f%z "$filename" 2>/dev/null || stat -c%s "$filename")
        echo -e "${GREEN}✅ Dados exportados para: $filename (${size} bytes)${NC}"
    else
        echo -e "${RED}❌ Erro ao exportar dados${NC}"
    fi
}

# Menu principal
case "${1:-help}" in
    "list"|"listar")
        list_documents_rest
        ;;
    "count"|"contar")  
        count_documents_rest
        ;;
    "test"|"testar")
        check_connection
        ;;
    "export"|"exportar")
        export_to_json
        ;;
    "all"|"tudo")
        check_connection
        echo ""
        count_documents_rest  
        echo ""
        list_documents_rest
        ;;
    *)
        echo -e "${BLUE}=== COMANDOS DISPONÍVEIS ===${NC}"
        echo ""
        echo -e "${GREEN}$0 test${NC}     - Testa conexão com Firebase"
        echo -e "${GREEN}$0 count${NC}    - Conta documentos na coleção"  
        echo -e "${GREEN}$0 list${NC}     - Lista alguns documentos"
        echo -e "${GREEN}$0 export${NC}   - Exporta dados para JSON"
        echo -e "${GREEN}$0 all${NC}      - Executa todos os comandos"
        echo ""
        echo -e "${BLUE}📋 Exemplo de uso:${NC}"
        echo "  $0 all"
        echo ""
        echo -e "${RED}⚠️ Nota:${NC} Este script usa a REST API pública (sem autenticação)"
        echo "Para dados privados, use os scripts com Firebase Admin SDK"
        ;;
esac
