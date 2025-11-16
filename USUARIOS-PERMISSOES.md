# 👥 USUÁRIOS DO SISTEMA

## 📊 Permissões Configuradas

O sistema usa **autenticação obrigatória** com diferentes níveis de acesso:

### 🔑 **Super Usuários** (Acesso Total)

- `admin@ipda.org.br`
- `marciodesk@ipda.app.br`

**Permissões:**

- ✅ Criar, ler, atualizar e deletar registros
- ✅ Acessar todos os relatórios
- ✅ Gerenciar usuários
- ✅ Upload/visualização de fotos

---

### 👤 **Usuários Básicos** (Acesso Limitado)

#### Equipe Administrativa:

- `presente@ipda.app.br`
- `secretaria@ipda.org.br`
- `auxiliar@ipda.org.br`
- `cadastro@ipda.app.br`

#### Usuários de Registro (Eventos):

- `registro1@ipda.app.br`
- `registro2@ipda.app.br`
- `registro3@ipda.app.br`
- `registro4@ipda.app.br`

**Permissões:**

- ✅ Criar registros de presença
- ✅ Ler registros
- ✅ Atualizar registros
- ✅ Upload/visualização de fotos
- ❌ Deletar registros (apenas Super Usuários)

---

## 🔒 **Regras de Segurança**

### **Firebase Storage** (`storage.rules`)

```javascript
match /attendance-photos/{fileName} {
  // Requer autenticação
  allow read: if request.auth != null;
  allow write: if request.auth != null
               && request.resource.size < 2 * 1024 * 1024  // Max 2MB
               && request.resource.contentType.matches('image/.*');
}
```

### **Firestore** (`firestore-production.rules`)

```javascript
// Leitura/escrita apenas para usuários autorizados
allow read: if isAuthorizedUser();
allow create: if isAuthorizedUser() && [validações];
allow update: if isAuthorizedUser();
allow delete: if isSuperUser();  // Apenas Super Usuários
```

---

## 🧪 **Para Testar as Ferramentas**

### 1️⃣ **Fazer Login**

Acesse: http://localhost:9002/login

Use um dos usuários listados acima (você precisa da senha)

### 2️⃣ **Após Login, Testar:**

#### **Teste de Fotos:**

http://localhost:9002/test-photo-upload.html

- ✅ Agora mostrará seu email no botão
- ✅ Poderá verificar fotos

#### **Migração:**

http://localhost:9002/migrate-photos.html

- ✅ Agora mostrará seu email no botão
- ✅ Poderá escanear e migrar fotos

---

## 🆕 **Criar Novos Usuários**

### Via Firebase Console:

1. Acesse: https://console.firebase.google.com/project/reuniao-ministerial/authentication/users
2. Clique em "Add User"
3. Digite email e senha
4. Salve

### Via Código:

O sistema já tem scripts para criar usuários. Verifique:

- `create-users.js`
- `configure-user-claims.js`

---

## ⚠️ **IMPORTANTE**

### ❌ **Sem Autenticação = Sem Acesso**

Todas as operações exigem login:

- ❌ Consultar Firestore
- ❌ Upload de fotos no Storage
- ❌ Visualizar fotos
- ❌ Criar/editar registros

### ✅ **Com Autenticação = Acesso Total**

Após login, todas as ferramentas funcionam normalmente:

- ✅ Páginas de teste
- ✅ Migração de fotos
- ✅ Cadastros
- ✅ Relatórios

---

## 📝 **Troubleshooting**

### Erro: "Missing or insufficient permissions"

**Causa:** Tentando acessar sem estar autenticado

**Solução:**

1. Faça login em `/login`
2. Recarregue a página de teste
3. O botão deve mostrar seu email

### Erro: "User not authorized"

**Causa:** Usuário não está na lista de autorizados

**Solução:**

1. Verifique se o email está nas regras do Firestore
2. Adicione o email nas regras se necessário
3. Re-deploy: `firebase deploy --only firestore`

---

## 🔄 **Fluxo Correto de Uso**

```
1. Login (/login)
   ↓
2. Autenticação OK
   ↓
3. Acessar ferramentas:
   - /register (cadastro)
   - /test-photo-upload.html (teste)
   - /migrate-photos.html (migração)
   ↓
4. Operações funcionam normalmente
```

---

## 📞 **Links Úteis**

- **Firebase Auth:** https://console.firebase.google.com/project/reuniao-ministerial/authentication/users
- **Login:** http://localhost:9002/login
- **Teste Fotos:** http://localhost:9002/test-photo-upload.html
- **Migração:** http://localhost:9002/migrate-photos.html
