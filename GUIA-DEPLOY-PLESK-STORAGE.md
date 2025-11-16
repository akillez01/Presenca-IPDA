# 🚀 Guia de Deploy para Plesk - Com Firebase Storage

## ✅ Pré-requisitos Configurados

- [x] Firebase Storage configurado: `reuniao-ministerial.firebasestorage.app`
- [x] CORS configurado com domínios:
  - ✅ `https://ipda.app.br`
  - ✅ `https://www.ipda.app.br`
  - ✅ localhost (desenvolvimento)
- [x] Variáveis de ambiente atualizadas (`.env.production`)
- [x] Storage Rules deployadas

---

## 📋 Checklist de Deploy

### 1. **Build do Projeto**

```bash
# No seu ambiente local
cd /home/achilles/Documentos/Projetos2025/Presen-a-IPDA/Presen-a-IPDA

# Limpar cache
rm -rf .next out

# Build para produção (Plesk)
BUILD_TARGET=plesk npm run build
```

### 2. **Verificar Build**

Confirme que a pasta `out/` foi criada com:

- ✅ `index.html`
- ✅ `_next/` (assets)
- ✅ Todas as páginas estáticas

### 3. **Upload para Plesk**

**Via FTP/SFTP:**

```
Local: ./out/
Remote: /httpdocs/
```

**Ou via rsync:**

```bash
rsync -avz --delete out/ usuario@ipda.app.br:/httpdocs/
```

### 4. **Configurar Arquivo .env no Plesk**

No Plesk, crie/edite `.env` em `/httpdocs/` com:

```bash
NEXT_PUBLIC_APP_URL="https://ipda.app.br"
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyA6_YWMcTzvKzCbZgl88SJvWpAUuE8LilE"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="reuniao-ministerial.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="reuniao-ministerial"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="reuniao-ministerial.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="23562502277"
NEXT_PUBLIC_FIREBASE_APP_ID="1:23562502277:web:ad150c66054fe08241e9ec"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-80D41520JN"
```

**⚠️ IMPORTANTE:** Não esqueça o bucket correto: `.firebasestorage.app`

### 5. **Configurar .htaccess (se necessário)**

Crie/edite `.htaccess` em `/httpdocs/`:

```apache
# Redirecionar HTTP para HTTPS
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Suporte para SPA (Single Page Application)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Headers de segurança
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "DENY"
    Header set X-XSS-Protection "1; mode=block"
    Header set Referrer-Policy "origin-when-cross-origin"
</IfModule>

# Compressão Gzip
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# Cache de assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/webp "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
</IfModule>
```

### 6. **Testar Produção**

Acesse: `https://ipda.app.br`

**Teste completo:**

1. ✅ **Login**: Entre com admin@ipda.org.br
2. ✅ **Dashboard**: Verifica se carrega dados
3. ✅ **Cadastro com foto**: `/register`
   - Preencha formulário
   - Adicione foto
   - Clique "Cadastrar"
4. ✅ **Console do navegador** (F12):
   - Deve mostrar: `☁️ Enviando para Firebase Storage...`
   - Deve mostrar: `✅ Upload concluído!`
   - **NÃO deve mostrar**: Erros de CORS

### 7. **Verificar Firebase Storage**

No Firebase Console:

1. Acesse: Storage > Arquivos
2. Verifique pasta: `attendance-photos/`
3. Confirme que novas fotos aparecem após cadastro

---

## 🐛 Troubleshooting

### ❌ Erro de CORS no Plesk

**Sintoma:**

```
CORS Preflight Did Not Succeed
```

**Solução:**

```bash
# Reaplicar CORS (execute localmente)
gcloud storage buckets update gs://reuniao-ministerial.firebasestorage.app --cors-file=cors.json
```

### ❌ Fotos não aparecem

**Verifique:**

1. URL no console começa com `https://firebasestorage.googleapis.com/`
2. Bucket correto: `.firebasestorage.app` (não `.appspot.com`)
3. CORS tem domínio: `https://ipda.app.br`

### ❌ Erro 404 nas rotas

**Solução:** Verifique `.htaccess` tem a regra de rewrite para `/index.html`

### ❌ Variáveis de ambiente não carregam

**No Plesk:** Certifique-se que `.env` está em `/httpdocs/` (raiz do site)

---

## 📊 Monitoramento Pós-Deploy

### Firebase Console

**Firestore Database:**

- Monitore quantidade de reads/writes
- Verifique tamanho dos documentos (~500 bytes com URL)

**Storage:**

- Monitore espaço usado
- Verifique downloads (cobrados por GB)

**Authentication:**

- Monitore usuários ativos

### Plesk

**Logs de Acesso:**

- Plesk > Logs > access_log
- Verifique requisições para `/register`

**Logs de Erro:**

- Plesk > Logs > error_log
- Procure por erros 500, 404

---

## 🎯 Checklist Final

Antes de considerar deploy completo:

- [ ] Build gerado: `out/` existe
- [ ] Upload feito: Arquivos em `/httpdocs/`
- [ ] `.env` configurado no servidor
- [ ] `.htaccess` criado (se necessário)
- [ ] CORS atualizado com `ipda.app.br`
- [ ] Teste de login funcionando
- [ ] Teste de upload de foto funcionando
- [ ] Console sem erros de CORS
- [ ] Firebase Storage recebendo arquivos
- [ ] Dashboard carregando normalmente

---

## 💰 Custos Estimados (com fotos)

**Para 1000 registros/mês:**

- Firestore: ~$0.01 (URLs apenas)
- Storage: ~$0.01 (500MB)
- Downloads: ~$0.06 (quando visualizados)
- **Total: ~$0.08/mês** 💚

Bem abaixo do plano gratuito! 🎉

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique console do navegador (F12)
2. Verifique logs do Plesk
3. Verifique Firebase Console > Usage
4. Compare com ambiente local (localhost:9002)
