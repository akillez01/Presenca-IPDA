# 🚀 GUIA COMPLETO - API REST PRESENÇA IPDA

**Status:** Pronto para implementação
**Data:** 29 de Novembro de 2025
**Arquitetura:** Node.js + Express + PostgreSQL

---

## 📋 ÍNDICE

1. [Verificação de Pré-requisitos](#verificação)
2. [Arquitetura da Solução](#arquitetura)
3. [Configuração PostgreSQL](#postgresql)
4. [Criar API Node.js](#criar-api)
5. [Endpoints REST](#endpoints)
6. [Integração Next.js](#integração-nextjs)
7. [Deploy Plesk](#deploy)

---

## ✅ Verificação de Pré-requisitos {#verificação}

### 1️⃣ Verificar Node.js no Plesk

**No terminal do Plesk/servidor:**

```bash
# Verificar versão do Node
node --version
npm --version

# Deve retornar algo como:
# v18.17.0 (ou superior)
# 9.6.7
```

Se não tiver, instale via Plesk Manager ou:

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2️⃣ Verificar Tailscale no Plesk

```bash
# Testar conexão com PostgreSQL
ping 100.69.128.31

# Se Tailscale está instalado:
tailscale status

# Se não tiver Tailscale, instale:
curl -fsSL https://tailscale.com/install.sh | sh

# Após instalar, autorize:
sudo tailscale up

# Use o link fornecido para autenticar
```

**Se Tailscale NÃO estiver disponível no Plesk**, use a seção "Alternativa: Túnel SSH" no final deste guia.

### 3️⃣ Testar Conexão PostgreSQL

```bash
# Instalar cliente PostgreSQL
sudo apt-get install -y postgresql-client

# Testar conexão
psql -h 100.69.128.31 -U ipdaadmin -d ipdadb -c "SELECT 1;"

# Deve retornar:
# ?column?
# ----------
#        1
```

---

## 🏗️ Arquitetura da Solução {#arquitetura}

```
┌─────────────────────────────────────────────────────────┐
│                   FRONT-END                              │
│  ✅ Next.js 15 (Seu app atual no Plesk)               │
│  ✅ React Native / Flutter (App Mobile)                │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ HTTPS Requests
                 ↓
┌─────────────────────────────────────────────────────────┐
│               API REST (Node.js)                         │
│  📍 https://ipda.app.br/api                            │
│  📍 https://seivadigital.com.br/api                    │
│                                                          │
│  ✅ Express.js                                          │
│  ✅ JWT Authentication                                 │
│  ✅ Rate Limiting                                      │
│  ✅ CORS Enabled                                       │
│  ✅ Error Handling                                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ Tailscale Network (Criptografado)
                 │ ou SSH Tunnel (Backup)
                 ↓
┌─────────────────────────────────────────────────────────┐
│           PostgreSQL (App Server)                        │
│  📍 100.69.128.31:5432                                 │
│  📍 Database: ipdadb                                   │
│  📍 User: ipdaadmin                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 🗄️ Configuração PostgreSQL {#postgresql}

### Script de Criação de Tabelas

Execute no pgAdmin ou psql:

```sql
-- ======================================
-- TABELA: usuarios (autenticação)
-- ======================================
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    nome_completo VARCHAR(255) NOT NULL,
    tipo_usuario VARCHAR(50) NOT NULL, -- 'admin', 'pastor', 'membro'
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================================
-- TABELA: membros
-- ======================================
CREATE TABLE membros (
    id SERIAL PRIMARY KEY,
    cpf VARCHAR(11) UNIQUE NOT NULL,
    nome_completo VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(20),
    data_nascimento DATE,
    cargo_igreja VARCHAR(100),
    pastor_id INTEGER REFERENCES usuarios(id),
    regiao VARCHAR(100),
    reclassificacao VARCHAR(100),
    cidade VARCHAR(100),
    turno VARCHAR(50), -- 'Manhã', 'Tarde', 'Noite'
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================================
-- TABELA: presencas (attendance records)
-- ======================================
CREATE TABLE presencas (
    id SERIAL PRIMARY KEY,
    membro_id INTEGER NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL, -- 'Presente', 'Justificado', 'Ausente'
    data_presenca DATE NOT NULL,
    hora_presenca TIME,
    justificativa TEXT,
    registrado_por INTEGER REFERENCES usuarios(id),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(membro_id, data_presenca)
);

-- ======================================
-- TABELA: auditoria (logging)
-- ======================================
CREATE TABLE auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    acao VARCHAR(100) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    tabela VARCHAR(50) NOT NULL,
    registro_id INTEGER,
    dados_anteriores JSONB,
    dados_novos JSONB,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================================
-- ÍNDICES (Performance)
-- ======================================
CREATE INDEX idx_presencas_membro ON presencas(membro_id);
CREATE INDEX idx_presencas_data ON presencas(data_presenca);
CREATE INDEX idx_presencas_status ON presencas(status);
CREATE INDEX idx_membros_pastor ON membros(pastor_id);
CREATE INDEX idx_membros_regiao ON membros(regiao);
CREATE INDEX idx_usuarios_email ON usuarios(email);

-- ======================================
-- VIEWS (Relatórios)
-- ======================================
CREATE VIEW v_presencas_hoje AS
SELECT
    p.id,
    m.id as membro_id,
    m.nome_completo,
    m.cpf,
    m.cargo_igreja,
    m.regiao,
    p.status,
    p.hora_presenca,
    p.justificativa
FROM presencas p
JOIN membros m ON p.membro_id = m.id
WHERE p.data_presenca = CURRENT_DATE
ORDER BY m.nome_completo;

CREATE VIEW v_estatisticas_diarias AS
SELECT
    CURRENT_DATE as data,
    COUNT(*) as total_membros,
    SUM(CASE WHEN p.status = 'Presente' THEN 1 ELSE 0 END) as presentes,
    SUM(CASE WHEN p.status = 'Justificado' THEN 1 ELSE 0 END) as justificados,
    SUM(CASE WHEN p.status = 'Ausente' THEN 1 ELSE 0 END) as ausentes,
    ROUND(100.0 * SUM(CASE WHEN p.status = 'Presente' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as taxa_presenca
FROM presencas p
WHERE p.data_presenca = CURRENT_DATE;
```

### Executar Script no PostgreSQL

```bash
# Via psql
psql -h 100.69.128.31 -U ipdaadmin -d ipdadb -f setup-database.sql

# Ou via arquivo local
cat setup-database.sql | psql -h 100.69.128.31 -U ipdaadmin -d ipdadb
```

---

## 🛠️ Criar API Node.js {#criar-api}

### Passo 1: Criar estrutura do projeto

```bash
# Criar diretório
mkdir -p ~/api-presenca
cd ~/api-presenca

# Inicializar projeto
npm init -y

# Instalar dependências principais
npm install express pg cors dotenv bcryptjs jsonwebtoken helmet express-rate-limit
npm install -D typescript ts-node @types/node @types/express nodemon

# Gerar tsconfig.json
npx tsc --init --target es2020 --module commonjs --outDir dist --resolveJsonModule --skipLibCheck --strict
```

### Passo 2: Estrutura de pastas

```bash
mkdir -p src/{config,middleware,routes,controllers,services,types}
mkdir -p migrations tests

# Criar arquivos principais
touch src/app.ts
touch src/config/database.ts
touch src/config/jwt.ts
touch .env.example
touch .env
```

---

## 📡 Endpoints REST {#endpoints}

### 1️⃣ **Autenticação**

#### `POST /api/auth/login`

```json
{
  "email": "usuario@ipda.com.br",
  "senha": "sua_senha_segura"
}
```

**Resposta:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": 1,
    "email": "usuario@ipda.com.br",
    "nome_completo": "João Silva",
    "tipo_usuario": "pastor"
  }
}
```

---

#### `POST /api/auth/register`

```json
{
  "email": "novo@ipda.com.br",
  "senha": "senha_forte_123",
  "nome_completo": "Maria Santos",
  "tipo_usuario": "membro"
}
```

---

#### `POST /api/auth/refresh-token`

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 2️⃣ **Presença**

#### `POST /api/presenca/marcar`

```json
{
  "membro_id": 42,
  "status": "Presente",
  "data_presenca": "2025-11-29",
  "hora_presenca": "09:30:00",
  "justificativa": null
}
```

**Headers obrigatórios:**

```
Authorization: Bearer SEU_TOKEN_JWT
```

---

#### `GET /api/presenca/listar?data=2025-11-29`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "membro_id": 42,
      "nome_completo": "João Silva",
      "status": "Presente",
      "data_presenca": "2025-11-29",
      "hora_presenca": "09:30:00"
    }
  ],
  "total": 45,
  "presentes": 40,
  "justificados": 3,
  "ausentes": 2
}
```

---

#### `GET /api/presenca/estatisticas?data_inicio=2025-11-01&data_fim=2025-11-29`

```json
{
  "success": true,
  "data": {
    "total_registros": 450,
    "taxa_presenca": 88.5,
    "presentes": 399,
    "justificados": 35,
    "ausentes": 16
  }
}
```

---

#### `PUT /api/presenca/:id`

```json
{
  "status": "Justificado",
  "justificativa": "Doente"
}
```

---

#### `DELETE /api/presenca/:id`

```
Status 200
{
  "success": true,
  "message": "Presença deletada com sucesso"
}
```

---

### 3️⃣ **Membros**

#### `GET /api/membros`

```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "cpf": "12345678901",
      "nome_completo": "João Silva",
      "cargo_igreja": "Pastor",
      "regiao": "Centro",
      "turno": "Manhã",
      "ativo": true
    }
  ],
  "total": 150
}
```

---

#### `POST /api/membros`

```json
{
  "cpf": "98765432100",
  "nome_completo": "Pedro Santos",
  "email": "pedro@email.com",
  "telefone": "11999999999",
  "data_nascimento": "1990-05-15",
  "cargo_igreja": "Diácono",
  "pastor_id": 1,
  "regiao": "Norte",
  "turno": "Tarde",
  "reclassificacao": "Local"
}
```

---

#### `GET /api/membros/:id`

```json
{
  "success": true,
  "data": {
    "id": 42,
    "cpf": "12345678901",
    "nome_completo": "João Silva",
    "email": "joao@email.com",
    "cargo_igreja": "Pastor",
    "presencas": [
      {
        "data": "2025-11-29",
        "status": "Presente",
        "hora": "09:30"
      }
    ]
  }
}
```

---

#### `PUT /api/membros/:id`

```json
{
  "cargo_igreja": "Presbítero",
  "regiao": "Sul"
}
```

---

#### `DELETE /api/membros/:id`

```json
{
  "success": true,
  "message": "Membro desativado com sucesso"
}
```

---

### 4️⃣ **Dashboard/Estatísticas**

#### `GET /api/stats/resumo`

```json
{
  "success": true,
  "data": {
    "data": "2025-11-29",
    "total_membros": 150,
    "presentes": 132,
    "justificados": 12,
    "ausentes": 6,
    "taxa_presenca": 88.0,
    "por_turno": {
      "manha": { "presentes": 50, "total": 55 },
      "tarde": { "presentes": 62, "total": 70 },
      "noite": { "presentes": 20, "total": 25 }
    },
    "por_regiao": {
      "Centro": 45,
      "Norte": 35,
      "Sul": 42,
      "Leste": 28
    }
  }
}
```

---

#### `GET /api/stats/por-regiao?data=2025-11-29`

```json
{
  "success": true,
  "data": [
    {
      "regiao": "Centro",
      "total": 45,
      "presentes": 40,
      "justificados": 3,
      "ausentes": 2,
      "taxa": 88.9
    }
  ]
}
```

---

#### `GET /api/stats/por-pastor?data=2025-11-29`

```json
{
  "success": true,
  "data": [
    {
      "pastor_id": 1,
      "pastor_nome": "João Silva",
      "total_membros": 50,
      "presentes": 45,
      "justificados": 3,
      "ausentes": 2,
      "taxa": 90.0
    }
  ]
}
```

---

## 🔌 Integração Next.js {#integração-nextjs}

Será criado um **client API** para seu Next.js usar.

```typescript
// lib/api-client.ts
import axios, { AxiosError } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://ipda.app.br/api";

class APIClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("authToken");
    }
  }

  async login(email: string, senha: string) {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        senha,
      });

      const { token, refreshToken } = response.data;
      localStorage.setItem("authToken", token);
      localStorage.setItem("refreshToken", refreshToken);
      this.token = token;

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async marcarPresenca(membro_id: number, status: string) {
    try {
      const response = await axios.post(
        `${API_URL}/presenca/marcar`,
        {
          membro_id,
          status,
          data_presenca: new Date().toISOString().split("T")[0],
          hora_presenca: new Date().toTimeString().split(" ")[0],
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any) {
    if (error.response?.status === 401) {
      localStorage.removeItem("authToken");
      window.location.href = "/login";
    }
    return error.response?.data || error.message;
  }
}

export const apiClient = new APIClient();
```

---

## 🚀 Deploy no Plesk {#deploy}

### Opção A: Deploy via PM2 (Recomendado)

```bash
# 1. Instalar PM2 globalmente
sudo npm install -g pm2

# 2. Na pasta da API
npm run build

# 3. Iniciar com PM2
pm2 start dist/app.js --name "api-presenca"

# 4. Configurar inicialização automática
pm2 startup
pm2 save

# 5. Verificar status
pm2 status
pm2 logs api-presenca
```

### Opção B: Deploy via Node.js no Plesk Manager

1. Acesse **Plesk Manager**
2. Vá para **Aplicativos e Bases de Dados** > **Node.js**
3. Clique em **Adicionar aplicação Node.js**
4. Configure:
   - **Nome:** api-presenca
   - **Caminho:** /home/usuario/api-presenca
   - **Arquivo de aplicação:** dist/app.js
   - **Porta:** 3001 (ou disponível)

### Opção C: Deploy com Nginx (Proxy)

```nginx
server {
    listen 443 ssl http2;
    server_name ipda.app.br;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🔐 Variáveis de Ambiente {#env}

Crie `.env` baseado em `.env.example`:

```env
# Servidor
NODE_ENV=production
PORT=3001

# PostgreSQL
DB_HOST=100.69.128.31
DB_PORT=5432
DB_NAME=ipdadb
DB_USER=ipdaadmin
DB_PASSWORD=sua_senha_super_segura
DB_SSL=true

# JWT
JWT_SECRET=sua_chave_jwt_super_segura_gerada_aleatoriamente
JWT_EXPIRES_IN=7d

# Domínios CORS permitidos
CORS_ORIGINS=https://ipda.app.br,https://seivadigital.com.br,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# API
API_URL=https://ipda.app.br/api
```

---

## ⚡ Próximos Passos

1. ✅ Criar tabelas no PostgreSQL (execute script SQL acima)
2. ✅ Implementar API Node.js (código completo será gerado)
3. ✅ Testar endpoints com Postman
4. ✅ Integrar no Next.js
5. ✅ Deploy no Plesk
6. ✅ Configurar App Mobile (Flutter/React Native)

---

## 📞 Suporte

Se encontrar problemas:

- Verifique logs: `pm2 logs api-presenca`
- Teste conexão: `psql -h 100.69.128.31 -U ipdaadmin -d ipdadb -c "SELECT 1;"`
- Verifique firewall/Tailscale: `tailscale status`

---

**Pronto para começar! 🚀**
