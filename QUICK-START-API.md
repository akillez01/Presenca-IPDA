# 🚀 Quick Start - API IPDA

Guia rápido para começar em 5 minutos.

## 1️⃣ Preparação (2 minutos)

### Clone/Copie o código

```bash
cd /caminho/do/projeto
cd api
```

### Instale dependências

```bash
npm install
```

### Configure variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env`:

```env
PORT=3001
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=ipdadb
DATABASE_USER=ipdaadmin
DATABASE_PASSWORD=sua_senha
JWT_SECRET=gerar-com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 2️⃣ Banco de Dados (1 minuto)

### Execute SQL de setup

```bash
# Se tiver PostgreSQL local
psql < ../API-SETUP-GUIDE.md  # Copie SQL de lá

# Ou use seu host remoto
psql -h 100.69.128.31 -U postgres
CREATE DATABASE ipdadb;
CREATE USER ipdaadmin WITH PASSWORD 'senha';
GRANT ALL ON DATABASE ipdadb TO ipdaadmin;
```

## 3️⃣ Desenvolvimento (1 minuto)

### Inicie em dev mode

```bash
npm run dev
```

Esperado:

```
╔════════════════════════════════════════════════╗
║     IPDA Attendance API - v1.0.0              ║
╠════════════════════════════════════════════════╣
║  Servidor rodando em: http://localhost:3001
```

### Teste health check

```bash
curl http://localhost:3001/health
```

Resposta:

```json
{
  "success": true,
  "message": "API está funcionando normalmente"
}
```

## 4️⃣ Teste Endpoints (30 segundos)

### Importe Postman

1. Abra Postman
2. Importe: `IPDA-Attendance-API.postman_collection.json`
3. Configure `base_url` = `http://localhost:3001`
4. Clique "Login" em Autenticação

### Ou teste via curl

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ipda.com.br",
    "senha": "senha123"
  }'

# Copie o token retornado

# Listar membros (replace TOKEN)
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/membros
```

## 5️⃣ Build para Produção (30 segundos)

```bash
npm run build
npm start
```

---

## 📁 Arquivos Importantes

| Arquivo                  | Descrição             |
| ------------------------ | --------------------- |
| `src/routes/auth.ts`     | Login/Registro        |
| `src/routes/presenca.ts` | Marcar presença       |
| `src/routes/membros.ts`  | Gerenciar membros     |
| `src/routes/stats.ts`    | Estatísticas          |
| `.env`                   | Variáveis de ambiente |
| `README.md`              | Documentação completa |

---

## 🆘 Ajuda Rápida

### Erro: "Cannot connect to database"

```bash
# Verifique credenciais em .env
psql -h $DATABASE_HOST -U $DATABASE_USER -d $DATABASE_NAME
```

### Erro: "Port 3001 already in use"

```bash
lsof -i :3001
kill -9 <PID>
```

### Erro: "Table does not exist"

```bash
# Execute SQL setup (veja API-SETUP-GUIDE.md)
# Ou rode script de migração
npm run migrate
```

---

## 📚 Documentação Completa

- **`API-SETUP-GUIDE.md`** - Setup detalhado
- **`API-INTEGRATION-GUIDE.md`** - Integrar com Next.js
- **`README.md`** - API docs
- **`DEPLOYMENT-PM2-PLESK.md`** - Deploy produção

---

## 🎯 Próximas Ações

✅ **Desenvolvimento local**

```bash
npm run dev
```

✅ **Integrar com Next.js**

- Copie `lib/api-client.ts` para projeto Next.js
- Configure `NEXT_PUBLIC_API_URL=http://localhost:3001`

✅ **Testar endpoints**

- Use Postman collection
- Ou curl commands acima

✅ **Deploy para produção**

- Siga `DEPLOYMENT-PM2-PLESK.md`

---

## 💡 Dicas

- 🔑 Token JWT salvo automaticamente no cliente
- 🔄 Refresh token renovado automaticamente
- 📊 Rate limiting: 100 req/15min
- 🔒 Admin-only endpoints: `/api/auth/register`, `/api/membros` (POST/PUT/DELETE)
- 📱 API REST puro - funciona com qualquer cliente

---

**Pronto? Vamos começar! 🚀**

```bash
npm run dev
```

Veja você em http://localhost:3001/health

---

**Versão:** 1.0.0  
**Última atualização:** Janeiro 2025
