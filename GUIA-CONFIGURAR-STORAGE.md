# 🔧 GUIA: Configurar Firebase Storage

## ⚠️ ERRO ATUAL

```
Firebase Storage has not been set up on project 'reuniao-ministerial'
```

O Firebase Storage **NÃO** está inicializado no projeto. Por isso as fotos estão sendo salvas em base64 (fallback).

## 📝 SOLUÇÃO: Inicializar Storage (2 minutos)

### Passo 1: Acessar o Console Firebase

1. Abra: https://console.firebase.google.com/project/reuniao-ministerial/storage
2. Faça login com sua conta Google
3. Selecione o projeto `reuniao-ministerial`

### Passo 2: Ativar Storage

Você verá uma tela dizendo **"Get Started"** ou **"Começar"**

1. Clique no botão **"Get Started"** / **"Começar"**
2. Uma modal aparecerá perguntando sobre as regras de segurança
3. Selecione: **"Start in production mode"** (modo produção)
4. Clique em **"Next"** / **"Avançar"**
5. Escolha a localização (recomendado: **southamerica-east1** - São Paulo)
6. Clique em **"Done"** / **"Concluído"**

### Passo 3: Deploy das Regras

Após a inicialização, volte ao terminal e execute:

```bash
firebase deploy --only storage
```

Você deve ver:

```
✔ Deploy complete!
✔ Storage rules successfully deployed
```

### Passo 4: Testar

1. Acesse: http://localhost:9002/test-photo-upload.html
2. Ou faça um novo cadastro em: http://localhost:9002/register
3. A foto agora será salva no Storage (não mais em base64)

## ✅ Verificação de Sucesso

Após configurar, você verá no console:

- **Firebase Console → Storage**: Pasta `attendance-photos/` com arquivos
- **Teste de fotos**: Mostrará "☁️ Firebase Storage" ao invés de "💾 Base64"
- **Firestore**: Campo `photoUrl` com URL do tipo `https://firebasestorage.googleapis.com/...`

## 📊 Benefícios Imediatos

| Antes (Base64)          | Depois (Storage)        |
| ----------------------- | ----------------------- |
| 520 KB por documento    | 150 bytes por documento |
| Lento para consultar    | Rápido                  |
| Custo 6x maior          | Custo otimizado         |
| Limite de 1-2 fotos/doc | Ilimitado               |

## 🔒 Regras de Segurança (já configuradas)

As regras em `storage.rules` garantem:

- ✅ Upload apenas para usuários **autenticados**
- ✅ Máximo **2 MB** por foto (já comprimida automaticamente)
- ✅ Apenas arquivos de **imagem**
- ✅ Leitura apenas para usuários **autenticados**

## 💰 Custo (Firebase Storage)

### Plano Spark (Gratuito):

- **Storage**: 5 GB
- **Download**: 1 GB/dia
- **Upload**: 20.000 uploads/dia

**Suficiente para ~10.000 fotos (500KB cada)**

### Se ultrapassar (Plano Blaze):

- Storage: $0.026/GB/mês
- Download: $0.12/GB
- Upload: Gratuito

**Exemplo:** 1000 fotos/mês = ~$0.013/mês de storage + ~$0.60/mês de downloads = **$0.61/mês**

## 🚨 Troubleshooting

### Erro: "Permission denied"

- Verifique se o usuário está autenticado
- Execute: `firebase deploy --only storage` novamente

### Erro: "CORS"

- Storage está bloqueando requisições do navegador
- Configure CORS (geralmente não é necessário)

### Fotos ainda em base64

- Limpe o cache do navegador (Ctrl+F5)
- Faça logout e login novamente
- Verifique console do navegador (F12) por erros

## 📞 Links Úteis

- [Firebase Console - Storage](https://console.firebase.google.com/project/reuniao-ministerial/storage)
- [Documentação Storage Rules](https://firebase.google.com/docs/storage/security)
- [Preços Firebase Storage](https://firebase.google.com/pricing)

---

**⏱️ Tempo total:** ~2 minutos para configurar

**🎯 Próximo passo:** Após configurar, execute `firebase deploy --only storage`
