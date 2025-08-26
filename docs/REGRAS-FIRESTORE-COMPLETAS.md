# 🔥 Regras Completas do Firestore para Produção

## 📋 **Regras Completas do Firebase Firestore**

### 📁 **Arquivo**: `firestore-production.rules`

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // REGRAS DE PRODUÇÃO - CONTROLE DE ACESSO POR NÍVEIS

    // Função para verificar se é super usuário
    function isSuperUser() {
      return request.auth != null &&
             (request.auth.token.email == 'admin@ipda.org.br' ||
              request.auth.token.email == 'marciodesk@ipda.app.br');
    }

    // Função para verificar se é usuário autenticado
    function isAuthenticated() {
      return request.auth != null;
    }

    // ============================================
    // COLEÇÃO DE PRESENÇA (attendance)
    // ============================================
    match /attendance/{document} {
      // LEITURA: Todos os usuários autenticados podem ler
      allow read: if isAuthenticated();

      // CRIAÇÃO: Todos os usuários autenticados podem criar registros
      // Validação obrigatória: fullName, status, cpf
      allow create: if isAuthenticated() &&
                    request.resource.data.keys().hasAll(['fullName', 'status', 'cpf']) &&
                    request.resource.data.fullName is string &&
                    request.resource.data.status in ['Presente', 'Ausente', 'Justificado'] &&
                    request.resource.data.cpf is string &&
                    request.resource.data.cpf.size() == 11;

      // ATUALIZAÇÃO: Apenas super usuários podem atualizar
      allow update: if isSuperUser();

      // EXCLUSÃO: Apenas super usuários podem excluir
      allow delete: if isSuperUser();
    }

    // ============================================
    // COLEÇÃO DE USUÁRIOS (users)
    // ============================================
    match /users/{userId} {
      // LEITURA: Usuários podem ver apenas seu próprio perfil
      // OU super usuários podem ver todos os perfis
      allow read: if isAuthenticated() &&
                     (request.auth.uid == userId || isSuperUser());

      // ESCRITA: Apenas super usuários podem criar/modificar usuários
      // Isso inclui: create, update, delete
      allow write: if isSuperUser();
    }

    // ============================================
    // COLEÇÃO DE CONFIGURAÇÕES DO SISTEMA (system)
    // ============================================
    match /system/{document} {
      // LEITURA: Todos os usuários autenticados podem ler configurações
      // Isso permite que o app funcione para todos os usuários
      allow read: if isAuthenticated();

      // ESCRITA: Apenas super usuários podem modificar configurações
      // Configurações como: cargos dinâmicos, opções do sistema, etc.
      allow write: if isSuperUser();
    }

    // ============================================
    // COLEÇÃO DE LOGS/AUDITORIA (logs)
    // ============================================
    match /logs/{document} {
      // LEITURA: Apenas super usuários podem ver logs
      allow read: if isSuperUser();

      // CRIAÇÃO: Sistema pode criar logs automaticamente
      // Qualquer usuário autenticado pode gerar logs (para auditoria)
      allow create: if isAuthenticated();

      // PROTEÇÃO: Não permitir atualização/exclusão de logs
      // Logs são imutáveis para integridade da auditoria
      allow update, delete: if false;
    }

    // ============================================
    // REGRA PADRÃO: NEGAÇÃO DE ACESSO
    // ============================================
    // Qualquer coleção não especificada acima será negada
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## ⚙️ **Configuração do firebase.json**

### 📁 **Arquivo**: `firebase.json`

```json
{
  "firestore": {
    "rules": "firestore-production.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "out",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "trailingSlash": false,
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

## 🚀 **Como Aplicar as Regras**

### 1. **Deploy Apenas das Regras**:

```bash
cd /caminho/para/seu/projeto
firebase deploy --only firestore:rules
```

### 2. **Deploy Completo** (regras + hosting):

```bash
firebase deploy
```

### 3. **Verificar Deploy**:

```bash
firebase firestore:indexes
```

## 📊 **Resumo das Permissões**

| Coleção        | Super Usuários                    | Usuários Normais             | Não Autenticados |
| -------------- | --------------------------------- | ---------------------------- | ---------------- |
| **attendance** | ✅ Ler/Criar/Editar/Excluir       | ✅ Ler/Criar                 | ❌ Sem acesso    |
| **users**      | ✅ Ler todos/Criar/Editar/Excluir | ✅ Ler apenas próprio perfil | ❌ Sem acesso    |
| **system**     | ✅ Ler/Editar configurações       | ✅ Ler configurações         | ❌ Sem acesso    |
| **logs**       | ✅ Ler logs                       | ✅ Criar logs                | ❌ Sem acesso    |
| **outras**     | ❌ Acesso negado                  | ❌ Acesso negado             | ❌ Acesso negado |

## 🔒 **Recursos de Segurança**

### ✅ **Validações Implementadas**:

1. **Registro de Presença**:

   - Campos obrigatórios: `fullName`, `status`, `cpf`
   - CPF deve ter exatamente 11 caracteres
   - Status deve ser: 'Presente', 'Ausente' ou 'Justificado'

2. **Controle de Usuários**:

   - Apenas super usuários podem criar/editar usuários
   - Usuários normais só veem próprio perfil

3. **Configurações do Sistema**:

   - Todos podem ler (necessário para funcionamento do app)
   - Apenas super usuários podem modificar

4. **Logs de Auditoria**:
   - Logs são imutáveis (não podem ser editados/excluídos)
   - Apenas super usuários podem visualizar logs

### 🚨 **Super Usuários Definidos**:

- `admin@ipda.org.br`
- `marciodesk@ipda.app.br`

## ✅ **Status da Implementação**

- ✅ Regras de produção criadas
- ✅ firebase.json atualizado
- ✅ Validações de segurança implementadas
- ✅ Controle de acesso por níveis configurado
- 🔄 **Pronto para deploy**

## 🎯 **Próximos Passos**

1. **Deploy das regras**: `firebase deploy --only firestore:rules`
2. **Testar acessos** com usuários normais e super usuários
3. **Verificar funcionamento** do painel de usuários
4. **Confirmar restrições** de acesso

---

**Data**: Janeiro 2025  
**Status**: ✅ Regras completas e prontas para produção  
**Segurança**: 🔒 Máxima proteção implementada
