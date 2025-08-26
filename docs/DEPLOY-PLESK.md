# 🌐 Deploy para Plesk - Sistema de Presença IPDA

**👨‍💻 Desenvolvido por AchillesOS**

Este guia detalha como fazer deploy do Sistema de Presença IPDA em servidores Plesk.

## 📋 **Pré-requisitos**

### **Servidor Plesk**

- ✅ Plesk Obsidian 18.0+ (recomendado)
- ✅ PHP 8.0+ (para suporte completo)
- ✅ Apache ou Nginx
- ✅ SSL/TLS habilitado
- ✅ Mod_rewrite habilitado (Apache)
- ✅ Gzip compression suportado

### **Domínio**

- ✅ Domínio configurado no Plesk
- ✅ DNS apontando para o servidor
- ✅ Certificado SSL válido

## 🚀 **Processo de Deploy**

### **1. Build para Plesk**

#### **Build Completo (Recomendado)**

```bash
# Build otimizado com todas as configurações
npm run build:plesk:full
```

#### **Build Manual (Avançado)**

```bash
# 1. Limpar cache
npm run clean:cache

# 2. Build específico para Plesk
npm run build:plesk

# 3. Gerar .htaccess
npm run build:plesk:htaccess

# 4. Validar build
npm run plesk:validate
```

### **2. Validação do Build**

```bash
# Verificar se o build está correto
npm run plesk:validate

# Testar localmente (opcional)
npm run plesk:test
# Acesse: http://localhost:8080
```

### **3. Empacotamento**

```bash
# Criar pacote .tar.gz para upload
npm run plesk:package

# Resultado: sistema-presenca-ipda-plesk.tar.gz
```

### **4. Upload para Plesk**

#### **Via Plesk File Manager**

1. Acesse o Plesk do seu domínio
2. Vá em "Arquivos" → "Gerenciador de Arquivos"
3. Navegue até `httpdocs/` ou `public_html/`
4. Faça upload do arquivo `sistema-presenca-ipda-plesk.tar.gz`
5. Extraia o arquivo no diretório
6. Remova o arquivo .tar.gz após extração

#### **Via FTP/SFTP**

```bash
# Exemplo com SCP
scp sistema-presenca-ipda-plesk.tar.gz usuario@servidor.com:~/httpdocs/

# No servidor, extrair
ssh usuario@servidor.com
cd httpdocs
tar -xzf sistema-presenca-ipda-plesk.tar.gz
rm sistema-presenca-ipda-plesk.tar.gz
```

#### **Via SSH**

```bash
# Conectar ao servidor
ssh usuario@servidor.com

# Ir para o diretório web
cd /var/www/vhosts/seu-dominio.com/httpdocs/

# Download direto (se tiver acesso ao repositório)
wget https://github.com/AchillesOS/sistema-presenca-ipda/releases/latest/download/sistema-presenca-ipda-plesk.tar.gz

# Extrair
tar -xzf sistema-presenca-ipda-plesk.tar.gz
rm sistema-presenca-ipda-plesk.tar.gz
```

## ⚙️ **Configuração no Plesk**

### **1. Configurações de Domínio**

#### **Document Root**

- Certifique-se que o Document Root aponta para o diretório onde você extraiu os arquivos
- Geralmente: `/var/www/vhosts/seu-dominio.com/httpdocs/`

#### **Configurações Apache (se aplicável)**

```apache
# Adicionar ao .htaccess ou configuração do virtual host
<IfModule mod_rewrite.c>
    RewriteEngine On

    # Forçar HTTPS (opcional)
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

    # SPA Routing
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

### **2. Configurações de SSL**

1. No Plesk, vá em "SSL/TLS Certificates"
2. Se não tiver certificado, use "Let's Encrypt" (gratuito)
3. Habilite "Redirect from HTTP to HTTPS"
4. Marque "HSTS" para segurança adicional

### **3. Configurações de Performance**

#### **Compressão Gzip**

```apache
# Já incluído no .htaccess gerado automaticamente
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css application/javascript
</IfModule>
```

#### **Cache de Browser**

```apache
# Já incluído no .htaccess gerado automaticamente
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
</IfModule>
```

## 🔧 **Configurações Específicas**

### **1. Variáveis de Ambiente**

Copie o arquivo `.env.plesk` para `.env.local` e configure:

```env
# Firebase Produção
NEXT_PUBLIC_FIREBASE_API_KEY=sua_chave_real
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu-projeto-id

# URL do seu domínio
NEXT_PUBLIC_SITE_URL=https://seu-dominio.com
```

### **2. Configurações do Firebase**

1. No Firebase Console, adicione seu domínio aos "Authorized domains"
2. Configure as regras do Firestore para produção
3. Ative autenticação por email/senha

### **3. DNS e Subdomínios**

Se usando subdomínio (ex: sistema.igreja.com.br):

```apache
# .htaccess para subdomínio
RewriteEngine On
RewriteBase /sistema/

RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /sistema/index.html [L]
```

## 🧪 **Testes e Validação**

### **1. Testes Básicos**

Após o deploy, teste:

- ✅ **Página inicial carrega**: `https://seu-dominio.com`
- ✅ **Login funciona**: Teste com usuário real
- ✅ **Dashboard exibe dados**: Verifique conexão Firebase
- ✅ **Rotas funcionam**: Navegue entre páginas
- ✅ **Responsividade**: Teste em mobile/tablet

### **2. Testes de Performance**

```bash
# PageSpeed Insights
https://pagespeed.web.dev/analysis?url=https://seu-dominio.com

# GTmetrix
https://gtmetrix.com/

# Lighthouse (Chrome DevTools)
# F12 → Lighthouse → Run audit
```

### **3. Testes de Segurança**

```bash
# SSL Test
https://www.ssllabs.com/ssltest/analyze.html?d=seu-dominio.com

# Security Headers
https://securityheaders.com/?q=seu-dominio.com

# Observatory Mozilla
https://observatory.mozilla.org/analyze/seu-dominio.com
```

## 🔄 **Atualizações**

### **Deploy de Nova Versão**

```bash
# 1. Build nova versão
git pull origin main
npm install
npm run build:plesk:full

# 2. Backup da versão atual (no servidor)
mv httpdocs httpdocs.backup.$(date +%Y%m%d-%H%M%S)

# 3. Upload nova versão
npm run plesk:package
# Upload e extração como descrito acima

# 4. Teste e rollback se necessário
# Se problemas: mv httpdocs.backup.XXXXXXXX httpdocs
```

### **Backup Automático**

Configure backup automático no Plesk:

1. Vá em "Backup Manager"
2. Configure backup diário/semanal
3. Inclua arquivos web e bancos de dados

## 🚨 **Troubleshooting**

### **Problemas Comuns**

#### **404 em rotas internas**

```apache
# Verificar se .htaccess está correto
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

#### **Erro de conexão Firebase**

- ✅ Verificar se o domínio está nos "Authorized domains"
- ✅ Verificar variáveis de ambiente
- ✅ Verificar regras do Firestore

#### **Assets não carregam**

- ✅ Verificar se pasta `_next/static` foi extraída
- ✅ Verificar permissões dos arquivos (755 para pastas, 644 para arquivos)

#### **Erro de HTTPS**

- ✅ Verificar certificado SSL no Plesk
- ✅ Habilitar redirecionamento HTTP → HTTPS
- ✅ Verificar configurações de HSTS

### **Logs e Debug**

#### **Logs do Apache (Plesk)**

```bash
# Localização comum dos logs
/var/www/vhosts/system/seu-dominio.com/logs/

# Visualizar logs em tempo real
tail -f /var/www/vhosts/system/seu-dominio.com/logs/error_log
tail -f /var/www/vhosts/system/seu-dominio.com/logs/access_log
```

#### **Debug no Browser**

```javascript
// Console do navegador
console.log("Firebase Config:", firebase.app().options);
console.log("Environment:", process.env.NODE_ENV);
```

## 📞 **Suporte**

### **Documentação Adicional**

- 📖 [Documentação Plesk Oficial](https://docs.plesk.com/)
- 🔥 [Firebase Hosting Guide](https://firebase.google.com/docs/hosting)
- ⚛️ [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)

### **Contato**

- **👨‍💻 Desenvolvedor**: AchillesOS
- **📧 Email**: achilles.dev@exemplo.com
- **🐛 Issues**: [GitHub Issues](https://github.com/AchillesOS/sistema-presenca-ipda/issues)

---

**✨ Desenvolvido com ❤️ para a Igreja Pentecostal Deus é Amor**
