# Deployment da API no Plesk com PM2

Guia passo a passo para colocar a API em produção no Plesk.

## Pré-requisitos

- Acesso SSH ao servidor Plesk
- Node.js 18+ instalado
- PostgreSQL 14+ configurado
- Domínio configurado no Plesk

## Etapa 1: Preparação do Servidor

### 1.1 Conecte via SSH

```bash
ssh root@seu-servidor-ip
```

### 1.2 Instale PM2 globalmente

```bash
npm install -g pm2
```

### 1.3 Crie diretório da aplicação

```bash
mkdir -p /var/www/api-ipda
cd /var/www/api-ipda
```

## Etapa 2: Deploy do Código

### 2.1 Clone ou copie o código

Opção 1 - Clone do repositório:

```bash
git clone seu-repositorio.git .
cd api
```

Opção 2 - Copie os arquivos via SCP:

```bash
scp -r api/ root@seu-servidor:/var/www/api-ipda/
```

### 2.2 Instale dependências

```bash
cd /var/www/api-ipda
npm ci --only=production
```

### 2.3 Compile TypeScript

```bash
npm run build
```

## Etapa 3: Configurar Variáveis de Ambiente

### 3.1 Crie arquivo `.env`

```bash
nano /var/www/api-ipda/.env
```

### 3.2 Configure variáveis para produção

```env
# Servidor
PORT=3001
NODE_ENV=production

# Banco de dados
DATABASE_HOST=100.69.128.31
DATABASE_PORT=5432
DATABASE_NAME=ipdadb
DATABASE_USER=ipdaadmin
DATABASE_PASSWORD=sua_senha_super_segura_aqui
DATABASE_SSL=true

# JWT
JWT_SECRET=gerar-uma-chave-aleatoria-muito-segura-com-pelo-menos-32-caracteres
JWT_EXPIRATION=7d
JWT_REFRESH_EXPIRATION=30d

# CORS
CORS_ORIGIN=https://ipda.app.br,https://www.ipda.app.br,https://seivadigital.com.br,https://www.seivadigital.com.br

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

**Gerar JWT_SECRET seguro:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Etapa 4: Inicie com PM2

### 4.1 Inicie a aplicação

```bash
cd /var/www/api-ipda
pm2 start dist/src/index.js --name "ipda-api" --env production
```

### 4.2 Salve configuração do PM2

```bash
pm2 save
pm2 startup
```

Copie e execute o comando que aparecer para ativar startup automático.

### 4.3 Verifique status

```bash
pm2 status
pm2 logs ipda-api
```

## Etapa 5: Configurar Proxy Reverso no Plesk

### 5.1 Acesse Plesk

1. Abra https://seu-servidor:8443
2. Faça login como admin
3. Vá para **Domínios & Certificados** → Seu domínio → **Routing não seguro**

### 5.2 Configure rota para API

**Para ipda.app.br/api**

- **Proxy para:** `http://localhost:3001`
- **Path:** `/api/`

### 5.3 Ative HTTPS

1. Em **Certificados SSL/TLS**, certifique-se de ter um certificado válido
2. Em **Gerenciar hosts** → Seu domínio, ative **HTTPS permanente**

## Etapa 6: Criar Banco de Dados

Se ainda não criou o banco PostgreSQL:

```bash
# Conecte ao PostgreSQL
psql -h 100.69.128.31 -U postgres

# Crie banco
CREATE DATABASE ipdadb ENCODING 'UTF8';
CREATE USER ipdaadmin WITH PASSWORD 'sua_senha_aqui';
GRANT ALL PRIVILEGES ON DATABASE ipdadb TO ipdaadmin;

# Saia
\q
```

## Etapa 7: Executar Migrações

### 7.1 Inicie banco com schema

```bash
cd /var/www/api-ipda
npm run migrate
```

Ou execute SQL manualmente:

```bash
psql -h 100.69.128.31 -U ipdaadmin -d ipdadb < schema.sql
```

## Etapa 8: Teste a API

### 8.1 Teste health check

```bash
curl https://ipda.app.br/api/health
```

Esperado:

```json
{
  "success": true,
  "message": "API está funcionando normalmente"
}
```

### 8.2 Teste autenticação

```bash
curl -X POST https://ipda.app.br/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ipda.com.br",
    "senha": "senha123"
  }'
```

### 8.3 Use Postman

Importe `IPDA-Attendance-API.postman_collection.json` e altere `base_url` para `https://ipda.app.br`.

## Gerenciamento com PM2

### Comandos úteis

```bash
# Ver logs
pm2 logs ipda-api

# Ver logs em tempo real
pm2 logs ipda-api --lines 100 --follow

# Reiniciar
pm2 restart ipda-api

# Parar
pm2 stop ipda-api

# Deletar
pm2 delete ipda-api

# Listar todas as aplicações
pm2 list

# Monitoramento
pm2 monit
```

### Configuração avançada com arquivo PM2

Crie `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "ipda-api",
      script: "./dist/src/index.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
    },
  ],
};
```

Inicie com:

```bash
pm2 start ecosystem.config.js
```

## Monitoring e Logs

### Visualizar logs

```bash
# Últimas linhas
pm2 logs ipda-api --lines 50

# Com filtro
pm2 logs ipda-api | grep "error"
```

### Configurar rotação de logs

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Atualizar Aplicação

### Quando novo código está disponível

```bash
cd /var/www/api-ipda

# Baixe novo código
git pull origin main

# Instale dependências
npm ci --only=production

# Compile
npm run build

# Reinicie
pm2 restart ipda-api

# Verifique
pm2 logs ipda-api
```

## SSL/TLS com Certbot

Se usar Let's Encrypt:

```bash
# Instale certbot
apt-get install certbot python3-certbot-nginx

# Gere certificado
certbot certonly --standalone -d ipda.app.br -d seivadigital.com.br

# Configure renovação automática
certbot renew --dry-run
```

## Troubleshooting

### Erro: "Port 3001 already in use"

```bash
# Encontre processo
lsof -i :3001

# Encerre
kill -9 <PID>
```

### Erro: "Cannot connect to database"

```bash
# Teste conexão
psql -h 100.69.128.31 -U ipdaadmin -d ipdadb

# Verifique firewall
sudo ufw allow 5432
```

### Erro: "Access denied" no login

```bash
# Verifique usuários no banco
psql -U postgres -d ipdadb -c "SELECT * FROM usuarios;"

# Crie usuário admin se necessário
psql -U postgres -d ipdadb -c "INSERT INTO usuarios (nome_completo, email, senha_hash, papel) VALUES ('Admin', 'admin@ipda.com.br', 'hash_aqui', 'admin');"
```

### PM2 não inicia ao rebootar

```bash
# Reexecute startup
pm2 startup systemd -u root --hp /root

# Salve novamente
pm2 save
```

## Backup Automático

Crie script `backup-db.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/api-ipda"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup do PostgreSQL
pg_dump -h 100.69.128.31 -U ipdaadmin -d ipdadb > $BACKUP_DIR/backup_$TIMESTAMP.sql

# Comprimir
gzip $BACKUP_DIR/backup_$TIMESTAMP.sql

# Remover backups antigos (>7 dias)
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +7 -delete

echo "Backup concluído: $BACKUP_DIR/backup_$TIMESTAMP.sql.gz"
```

Adicione ao crontab:

```bash
crontab -e

# Backup diário às 2AM
0 2 * * * /root/backup-db.sh
```

## Renovação de Certificado SSL

Se usar Plesk, o certificado é renovado automaticamente.

Se usar Let's Encrypt manual:

```bash
certbot renew --force-renewal
systemctl reload nginx
```

## Suporte

Para problemas, verifique:

1. Logs: `pm2 logs ipda-api`
2. Conectividade: `curl http://localhost:3001/health`
3. Banco: `psql -h 100.69.128.31 -U ipdaadmin -d ipdadb`

---

**Versão:** 1.0.0  
**Data:** Janeiro 2025
