# 🔥 Como Criar o Bucket do Firebase Storage

## ❌ Problema Atual

O erro CORS 404 acontece porque **o bucket do Storage não foi criado ainda**.

```
CORS Preflight Did Not Succeed
Código de status: 404
```

## ✅ Solução: Criar Bucket no Console

### Passo 1: Acessar Firebase Console

1. Abra: https://console.firebase.google.com/
2. Selecione o projeto: **reuniao-ministerial**

### Passo 2: Ir para Storage

1. No menu lateral esquerdo, clique em **"Build"** (Criar)
2. Clique em **"Storage"**
3. Você verá uma tela com botão **"Get started"** (Começar)

### Passo 3: Criar o Bucket

1. Clique em **"Get started"**
2. Na primeira tela sobre regras de segurança:

   - Escolha: **"Start in production mode"** (já temos regras customizadas)
   - Clique **"Next"**

3. Na segunda tela sobre localização:
   - **IMPORTANTE**: Escolha **"southamerica-east1 (São Paulo)"**
   - Essa escolha **não pode ser mudada depois**!
   - Clique **"Done"**

### Passo 4: Aguardar Criação

- O Firebase vai criar o bucket (leva ~30 segundos)
- Você verá a tela do Storage com pasta vazia

### Passo 5: Deploy das Regras

No terminal, execute:

```bash
firebase deploy --only storage
```

Deve aparecer:

```
✔ storage: released rules storage.rules to firebase.storage
```

### Passo 6: Configurar CORS

#### Opção A: Via Console do Google Cloud

1. Acesse: https://console.cloud.google.com/storage/browser
2. Faça login com a mesma conta do Firebase
3. Clique no bucket **reuniao-ministerial.appspot.com**
4. Clique na aba **"Permissions"** (Permissões)
5. Em **"CORS Configuration"**, adicione:

```json
[
  {
    "origin": ["http://localhost:9002", "https://reuniao-ministerial.web.app"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Authorization"]
  }
]
```

#### Opção B: Via Script (requer instalação)

Instale o Google Cloud CLI:

```bash
sudo snap install google-cloud-cli
```

Configure:

```bash
gcloud auth login
gcloud config set project reuniao-ministerial
```

Aplique CORS:

```bash
gcloud storage buckets update gs://reuniao-ministerial.appspot.com --cors-file=cors.json
```

## 🧪 Teste

Depois de criar o bucket:

1. Acesse: http://localhost:9002/register
2. Faça login como admin@ipda.org.br
3. Preencha o formulário e adicione uma foto
4. Clique em "Cadastrar"

O console deve mostrar:

```
☁️ Enviando para Firebase Storage...
✅ Upload concluído: https://firebasestorage.googleapis.com/...
```

## 🔍 Verificação

No Firebase Console > Storage:

- Deve aparecer a pasta `attendance-photos/`
- Dentro, os arquivos no formato: `CPF-timestamp.png`
- Tamanho dos arquivos: ~100-500KB (comprimidos)

## ⚠️ Notas Importantes

1. **Localização é permanente**: Escolha southamerica-east1 (São Paulo)
2. **CORS é essencial**: Sem ele, o navegador bloqueia os uploads
3. **Regras já estão prontas**: O arquivo `storage.rules` já tem tudo configurado
4. **Backup automático**: O sistema usa base64 como fallback se Storage falhar

## 🆘 Se der erro

- **"Bucket não existe"**: Complete os passos 1-3 acima
- **"CORS error"**: Execute o passo 6
- **"Permission denied"**: Faça `firebase login` novamente
- **"404 not found"**: Aguarde 1-2 minutos após criar o bucket
