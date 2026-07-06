# IPDA Attendance API

API REST para sistema de presença - Igreja de Deus em Adoração (IPDA).

## Início Rápido

### Pré-requisitos

- Node.js 18+ instalado
- PostgreSQL 14+ acessível
- npm ou yarn

### Instalação e Execução Local

1. **Clone o repositório e instale dependências:**

```bash
cd api
npm install
```

2. **Configure as variáveis de ambiente:**

```bash
cp .env.example .env
```

Edite `.env` com suas configurações:

```env
# Servidor
PORT=3001
NODE_ENV=development

# Banco de dados PostgreSQL
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=ipdadb
DATABASE_USER=ipdaadmin
DATABASE_PASSWORD=sua_senha_aqui
DATABASE_SSL=false

# JWT
JWT_SECRET=sua_chave_secreta_muito_segura_aqui
JWT_EXPIRATION=7d
JWT_REFRESH_EXPIRATION=30d

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

3. **Execute em desenvolvimento:**

```bash
npm run dev
```

A API estará disponível em `http://localhost:3001`

### Build para Produção

```bash
npm run build
```

### Scripts Disponíveis

- `npm run dev` - Inicia em modo desenvolvimento com hot-reload
- `npm run build` - Compila TypeScript para JavaScript
- `npm start` - Inicia servidor compilado
- `npm test` - Executa testes

## Estrutura do Projeto

```
api/
├── src/
│   ├── config/
│   │   ├── database.ts      # Configuração PostgreSQL
│   │   └── jwt.ts           # Geração e verificação de tokens JWT
│   ├── middleware/
│   │   ├── auth.ts          # Autenticação e autorização
│   │   └── errorHandler.ts  # Tratamento centralizado de erros
│   ├── routes/
│   │   ├── auth.ts          # Endpoints de autenticação
│   │   ├── presenca.ts      # Endpoints de presença
│   │   ├── membros.ts       # Endpoints de membros
│   │   └── stats.ts         # Endpoints de estatísticas
│   ├── app.ts              # Aplicação Express
│   └── index.ts            # Ponto de entrada
├── package.json
├── tsconfig.json
└── .env.example
```

## Endpoints da API

### Autenticação

#### POST /api/auth/login

Autentica um usuário e retorna JWT token.

**Request:**

```json
{
  "email": "usuario@example.com",
  "senha": "senha123"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "nome_completo": "João Silva",
      "email": "joao@example.com",
      "papel": "pastor"
    }
  }
}
```

#### POST /api/auth/register

Registra um novo usuário (admin only).

**Request:**

```json
{
  "nome_completo": "João Silva",
  "email": "joao@example.com",
  "senha": "senha123",
  "papel": "pastor"
}
```

#### POST /api/auth/refresh-token

Renova o JWT token usando refresh token.

**Request:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### GET /api/auth/me

Obtém informações do usuário autenticado.

**Headers:**

```
Authorization: Bearer <token>
```

---

### Presença

#### POST /api/presenca/marcar

Marca presença de um membro.

**Request:**

```json
{
  "membro_id": "uuid",
  "status": "Presente",
  "data_presenca": "2025-01-20",
  "hora_presenca": "19:30:00",
  "justificativa": "Motivo da ausência (opcional)"
}
```

**Status válidos:** `Presente`, `Justificado`, `Ausente`

#### GET /api/presenca/listar

Lista presenças com filtros.

**Query Parameters:**

- `data` - Data específica (formato: YYYY-MM-DD)
- `regiao` - Filtrar por região
- `pastor_id` - Filtrar por pastor
- `status` - Filtrar por status

**Example:**

```
GET /api/presenca/listar?data=2025-01-20&status=Presente
```

#### GET /api/presenca/estatisticas

Obtém estatísticas de presença em um período.

**Query Parameters:**

- `data_inicio` - Data inicial (formato: YYYY-MM-DD)
- `data_fim` - Data final (formato: YYYY-MM-DD)

#### PUT /api/presenca/:id

Atualiza um registro de presença.

**Request:**

```json
{
  "status": "Justificado",
  "justificativa": "Motivo da ausência"
}
```

#### DELETE /api/presenca/:id

Remove um registro de presença.

---

### Membros

#### GET /api/membros

Lista membros com paginação.

**Query Parameters:**

- `pagina` - Página (padrão: 1)
- `limite` - Registros por página (padrão: 20)
- `regiao` - Filtrar por região
- `cargo_igreja` - Filtrar por cargo
- `status` - `ativo` ou `inativo`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nome_completo": "João Silva",
      "email": "joao@example.com",
      "cpf": "123.456.789-00",
      "telefone": "(11) 98765-4321",
      "cargo_igreja": "Pastor",
      "regiao": "Zona Norte",
      "ativo": true,
      ...
    }
  ],
  "paginacao": {
    "total": 150,
    "pagina": 1,
    "limite": 20,
    "total_paginas": 8
  }
}
```

#### POST /api/membros

Cria um novo membro (admin only).

**Request:**

```json
{
  "nome_completo": "João Silva",
  "email": "joao@example.com",
  "cpf": "123.456.789-00",
  "telefone": "(11) 98765-4321",
  "data_nascimento": "1990-01-15",
  "genero": "M",
  "endereco": "Rua exemplo",
  "numero": "123",
  "bairro": "Bairro",
  "cidade": "São Paulo",
  "estado": "SP",
  "cep": "01234-567",
  "cargo_igreja": "Membro",
  "regiao": "Zona Norte",
  "turno": "Noite",
  "pastor_id": "uuid"
}
```

#### GET /api/membros/:id

Obtém detalhes de um membro com presenças recentes.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nome_completo": "João Silva",
    ...
    "presencas_recentes": [...],
    "estatisticas_mes": {
      "total_registros": 4,
      "presentes": 3,
      "justificados": 1,
      "ausentes": 0
    }
  }
}
```

#### PUT /api/membros/:id

Atualiza informações de um membro (admin only).

#### DELETE /api/membros/:id

Desativa um membro (soft delete, admin only).

---

### Estatísticas

#### GET /api/stats/resumo

Retorna resumo de presença do dia.

**Query Parameters:**

- `data` - Data específica (padrão: hoje)

**Response:**

```json
{
  "success": true,
  "data": {
    "data": "2025-01-20",
    "total_membros_ativos": 150,
    "presencas": {
      "total_registrado": 120,
      "presentes": 110,
      "justificados": 8,
      "ausentes": 2,
      "nao_registrado": 30
    },
    "taxa_presenca": "91.67%"
  }
}
```

#### GET /api/stats/por-regiao

Estatísticas de presença por região.

#### GET /api/stats/por-pastor

Estatísticas de presença por pastor.

#### GET /api/stats/historico

Histórico de presenças em um período.

**Query Parameters:**

- `data_inicio` - Data inicial (padrão: 30 dias atrás)
- `data_fim` - Data final (padrão: hoje)
- `dias` - Número de dias retroativos (padrão: 30)

#### GET /api/stats/membros-sem-presenca

Lista membros que ainda não marcaram presença no dia.

---

## Autenticação

A API usa **JWT (JSON Web Token)** para autenticação.

### Como usar:

1. **Obtenha um token:**

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "senha": "senha123"
  }'
```

2. **Use o token em requisições protegidas:**

```bash
curl -H "Authorization: Bearer <seu_token_aqui>" \
  http://localhost:3001/api/membros
```

3. **Renove o token:**

```bash
curl -X POST http://localhost:3001/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<seu_refresh_token_aqui>"
  }'
```

## Deployment no Plesk

### Opção 1: Node.js com PM2

1. **Instale PM2 globalmente:**

```bash
npm install -g pm2
```

2. **Inicie a aplicação com PM2:**

```bash
cd /path/to/api
pm2 start npm --name "ipda-api" -- start
pm2 save
pm2 startup
```

3. **Configure proxy reverso no Plesk:**
   - Domínios & Certificados → Seu domínio
   - Routing não seguro → `http://localhost:3001`
   - Habilitar proxy HTTP

### Opção 2: Docker

Crie `Dockerfile` na raiz da API:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3001
CMD ["node", "dist/src/index.js"]
```

Build e execute:

```bash
docker build -t ipda-api .
docker run -d --name ipda-api -p 3001:3001 --env-file .env ipda-api
```

### Opção 3: Cloud Platform

Hospede em plataformas como:

- Heroku
- Railway
- Render
- AWS EC2
- Google Cloud Run

## Variáveis de Ambiente em Produção

Nunca commitir `.env` no repositório. Configurar via painel do host ou CI/CD.

```env
NODE_ENV=production
DATABASE_HOST=seu-host-postgres
DATABASE_USER=seu-usuario
DATABASE_PASSWORD=sua-senha-segura
JWT_SECRET=uma-chave-muito-secreta-e-aleatoria
CORS_ORIGIN=https://seu-dominio.com.br
```

## Segurança

- ✅ JWT para autenticação stateless
- ✅ Hash bcrypt para senhas
- ✅ Rate limiting (100 req/15min, 5 login/15min)
- ✅ CORS configurado
- ✅ Helmet para headers de segurança
- ✅ Validação de entrada
- ✅ Auditoria de operações
- ✅ Soft delete para integridade de dados

## Troubleshooting

### Erro de conexão com banco de dados

```
Error: getaddrinfo ENOTFOUND database_host
```

Verifique:

1. Host e porta do PostgreSQL em `.env`
2. Credenciais de acesso
3. Firewall/Security Groups permitem conexão
4. Se usar Tailscale, certifique-se que está conectado

### Erro de porta em uso

```
Error: listen EADDRINUSE: address already in use :::3001
```

```bash
# Encontre processo usando porta 3001
lsof -i :3001

# Encerre processo
kill -9 <PID>
```

### Erro de CORS

Se receber erro de CORS, adicione seu domínio em `corsOptions` no arquivo `app.ts` ou configure a variável de ambiente `CORS_ORIGIN`.

## Integração com Next.js

Veja `lib/api-client.ts` no projeto principal para exemplos de integração.

## Integração com Mobile

Use endpoints REST normalmente:

```javascript
// React Native / Flutter
const response = await fetch("https://ipda.app.br/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    senha: "senha123",
  }),
});

const data = await response.json();
// Use data.data.token para requisições subsequentes
```

## Suporte

Para problemas ou sugestões, entre em contato através do email ou crie uma issue no repositório.

---

**Versão:** 1.0.0  
**Última atualização:** Janeiro 2025
