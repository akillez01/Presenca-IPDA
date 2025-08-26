#!/bin/bash

# Script para consultar Firebase via REST API
# Necessita de um token de acesso (obtido via: firebase auth:print-access-token)

PROJECT_ID="reuniao-ministerial"
COLLECTION="attendance"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== CONSULTA FIREBASE REST API ===${NC}"

# Função para obter token de acesso
get_access_token() {
    echo -e "${YELLOW}Obtendo token de acesso...${NC}"
    firebase auth:print-access-token 2>/dev/null
}

# Função para listar documentos
list_documents() {
    local token=$(get_access_token)
    local limit=${1:-10}
    
    if [ -z "$token" ]; then
        echo -e "${RED}Erro: Não foi possível obter o token de acesso${NC}"
        echo -e "${YELLOW}Execute: firebase login${NC}"
        return 1
    fi
    
    echo -e "${GREEN}Listando últimos $limit documentos...${NC}"
    
    curl -s -H "Authorization: Bearer $token" \
        "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/$COLLECTION?pageSize=$limit&orderBy=timestamp%20desc" \
        | jq -r '.documents[]? | "\(.name | split("/")[-1]): \(.fields.fullName.stringValue // "N/A") - \(.fields.status.stringValue // "Presente") - \(.fields.timestamp.timestampValue // "N/A")"'
}

# Função para contar documentos
count_documents() {
    local token=$(get_access_token)
    
    if [ -z "$token" ]; then
        echo -e "${RED}Erro: Não foi possível obter o token de acesso${NC}"
        return 1
    fi
    
    echo -e "${GREEN}Contando documentos...${NC}"
    
    local count=$(curl -s -H "Authorization: Bearer $token" \
        "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/$COLLECTION" \
        | jq '.documents | length')
    
    echo -e "${BLUE}Total de documentos: $count${NC}"
}

# Função para buscar por campo específico
search_by_field() {
    local field=$1
    local value=$2
    local token=$(get_access_token)
    
    if [ -z "$token" ]; then
        echo -e "${RED}Erro: Não foi possível obter o token de acesso${NC}"
        return 1
    fi
    
    echo -e "${GREEN}Buscando documentos onde $field = '$value'...${NC}"
    
    # Criar query estruturada para Firestore
    local query_json=$(cat <<EOF
{
  "structuredQuery": {
    "from": [{"collectionId": "$COLLECTION"}],
    "where": {
      "fieldFilter": {
        "field": {"fieldPath": "$field"},
        "op": "EQUAL",
        "value": {"stringValue": "$value"}
      }
    },
    "orderBy": [{"field": {"fieldPath": "timestamp"}, "direction": "DESCENDING"}]
  }
}
EOF
)
    
    curl -s -X POST -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "$query_json" \
        "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents:runQuery" \
        | jq -r '.[] | select(.document) | .document | "\(.name | split("/")[-1]): \(.fields.fullName.stringValue // "N/A") - \(.fields.status.stringValue // "Presente")"'
}

# Menu principal
case "$1" in
    "list"|"listar")
        list_documents ${2:-10}
        ;;
    "count"|"contar")
        count_documents
        ;;
    "search"|"buscar")
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo -e "${YELLOW}Uso: $0 search [campo] [valor]${NC}"
            echo -e "${YELLOW}Exemplo: $0 search status Presente${NC}"
            exit 1
        fi
        search_by_field "$2" "$3"
        ;;
    "token")
        get_access_token
        ;;
    *)
        echo -e "${BLUE}=== SCRIPT DE CONSULTA FIREBASE REST API ===${NC}"
        echo ""
        echo -e "${GREEN}Comandos disponíveis:${NC}"
        echo -e "  ${YELLOW}$0 list [N]${NC}         - Lista últimos N documentos"
        echo -e "  ${YELLOW}$0 count${NC}             - Conta total de documentos"
        echo -e "  ${YELLOW}$0 search [campo] [valor]${NC} - Busca por campo específico"
        echo -e "  ${YELLOW}$0 token${NC}             - Obtém token de acesso atual"
        echo ""
        echo -e "${GREEN}Exemplos:${NC}"
        echo -e "  $0 list 20"
        echo -e "  $0 search status Presente"
        echo -e "  $0 search region 'Norte'"
        echo ""
        echo -e "${RED}Nota:${NC} Certifique-se de ter feito login: ${YELLOW}firebase login${NC}"
        ;;
esac
