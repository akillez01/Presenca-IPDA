# Presença IPDA — Configuração Completa de Deploy

> Documento de referência para envio do projeto ao servidor Plesk.
> Passe este arquivo inteiro ao Claude no início de cada sessão de deploy.

---

## 1. Identificação do Projeto

| Campo | Valor |
|---|---|
| Nome | Sistema de Presença IPDA |
| Framework | Next.js (static export para Plesk) |
| Banco de dados | Firebase Firestore |
| Autenticação | Firebase Auth |
| Repositório local | `/home/achilles/Documentos/Projetos2025/Presen-a-IPDA/Presen-a-IPDA` |

---

## 2. Servidor de Produção

| Campo | Valor |
|---|---|
| IP do servidor | `74.208.44.241` |
| Usuário SSH | `root` |
| Senha SSH | `5Kb1lSjY` |
| Domínio produção | `https://ipda.app.br` |
| Painel Plesk | `https://74.208.44.241:8443` |
| Diretório no servidor | `/var/www/vhosts/ipda.app.br/httpdocs/` |
| Tipo de servidor | Apache + Plesk (sem suporte a Node.js em runtime) |

---

## 3. Fluxo Completo de Build e Deploy

### 3.1 Passo a passo

```bash
# 1. Entrar no diretório do projeto
cd /home/achilles/Documentos/Projetos2025/Presen-a-IPDA/Presen-a-IPDA

# 2. Build completo para Plesk (único comando necessário)
npm run build:plesk:full

# 3. Deploy via rsync para o servidor
sshpass -p '5Kb1lSjY' rsync -avz --delete \
  /home/achilles/Documentos/Projetos2025/Presen-a-IPDA/Presen-a-IPDA/out/ \
  root@74.208.44.241:/var/www/vhosts/ipda.app.br/httpdocs/
```

### 3.2 O que o `npm run build:plesk:full` faz

1. Limpa `.next/` e `out/`
2. Remove pastas de teste (`src/app/test-*`, etc.)
3. Move `src/app/api/` → `src/app/__api-export-backup/` (APIs não funcionam em static export)
4. Executa `BUILD_TARGET=plesk NODE_ENV=production next build` → gera `out/`
5. Otimiza HTML/CSS
6. Gera `.htaccess` completo em `out/`
7. Restaura `src/app/api/` de volta

> **NUNCA** usar `npm run build` sozinho para deploy — gera build dinâmico, sem a pasta `out/`.

### 3.3 Scripts disponíveis (referência)

```
npm run build:plesk:full     → build completo (usar sempre para deploy)
npm run build:plesk:htaccess → gera só o .htaccess
npm run plesk:deploy         → build + empacota em .tar.gz
npm run dev                  → servidor local na porta 9002
```

---

## 4. Variáveis de Ambiente (`.env.local`)

```env
# URL da aplicação
NEXT_PUBLIC_APP_URL="https://ipda.app.br"

# Firebase — projeto: reuniao-ministerial
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyA6_YWMcTzvKzCbZgl88SJvWpAUuE8LilE"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="reuniao-ministerial.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="reuniao-ministerial"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="reuniao-ministerial.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="23562502277"
NEXT_PUBLIC_FIREBASE_APP_ID="1:23562502277:web:ad150c66054fe08241e9ec"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-80D41520JN"

# Credenciais de admin
ADMIN_EMAIL="admin@ipda.org.br"
ADMIN_PASSWORD="IPDA@2025Admin"
SUPER_USER_2_EMAIL="marciodesk@ipda.app.br"
SUPER_USER_2_PASSWORD="Michelin@1"

# Ambiente
NODE_ENV="production"
NEXT_PUBLIC_SECURE_COOKIES="true"
NEXT_PUBLIC_FORCE_HTTPS="true"

# Firebase Admin SDK (Service Account)
GOOGLE_APPLICATION_CREDENTIALS=/home/achilles/Documentos/Projetos2025/Presen-a-IPDA/Presen-a-IPDA/reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json
FIREBASE_PROJECT_ID=reuniao-ministerial
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@reuniao-ministerial.iam.gserviceaccount.com
```

> As variáveis `NEXT_PUBLIC_*` são embarcadas no bundle estático durante o build — não precisam existir no servidor.

---

## 5. Configuração do Next.js (`next.config.ts`)

Pontos críticos:

```ts
const isPleskBuild = process.env.BUILD_TARGET === 'plesk';

output: isPleskBuild ? 'export' : undefined,  // static export apenas para Plesk
trailingSlash: isPleskBuild,                   // /pagina/ em vez de /pagina
images: { unoptimized: true },                 // obrigatório para static export
assetPrefix: isPleskBuild ? '' : undefined,
```

- Build normal (`npm run build`): dinâmico, com API routes, sem `output: 'export'`
- Build Plesk (`BUILD_TARGET=plesk`): static export, sem API routes, gera `out/`

---

## 6. Firebase — Estrutura de Dados

| Coleção | Chave | Descrição |
|---|---|---|
| `members/{cpf}` | CPF do membro | Perfil completo (source of truth) |
| `attendance/{dateKey__shift__cpf}` | data+turno+CPF | Registros individuais de presença |

**Campos do membro:** `fullName`, `cpf`, `birthday`, `reclassification`, `pastorName`, `region`, `churchPosition`, `city`, `shift`, `totvs`, `etda`, `phone`, `photoUrl`, `status`, `createdAt`, `updatedAt`, `lastPresenceAt`, `memberId`, `sourceCollection`

**Projeto Firebase:** `reuniao-ministerial`

**Regras Firestore em produção:** arquivo `firestore-production.rules`

---

## 7. Arquitetura da Aplicação

```
src/app/
  page.tsx                    → tela de login
  presenca/page.tsx           → registro de presença (público)
  presencadecadastrados/      → presença de membros cadastrados
  register/page.tsx           → cadastro de novo membro
  scanner/page.tsx            → scanner de QR Code / câmera
  reports/page.tsx            → relatórios e diretório
  admin/                      → painel administrativo
  api/                        → rotas API (removidas no build Plesk)

src/lib/
  actions.ts                  → funções Firebase (leitura/escrita)
  api-actions.ts              → chamadas às API routes
  schemas.ts                  → validação Zod
  auth-production.ts          → lógica de autenticação

src/hooks/
  use-auth.ts                 → estado global de autenticação
  use-realtime.ts             → listener de presença em tempo real
```

**Fluxo de cadastro:** `register/page.tsx` → `addMember()` → `createMemberProfile()` → `members/{cpf}`

**Fluxo de presença:** Scanner/CPF → `registerAttendanceByCpf()` → `attendance/{key}` + `upsertMemberProfile()`

---

## 8. Regras Importantes ao Modificar o Projeto

- Ao adicionar campos de membro: atualizar `schemas.ts`, `types.ts`, `member-data.ts` (funções `extractMemberProfileFields` e `toAttendanceLikeRecord`), `actions.ts` (`buildAttendancePayloadFromMember`), e os componentes `register/page.tsx` e `reports/page.tsx`
- API routes (`src/app/api/`) funcionam apenas em desenvolvimento local — são removidas automaticamente no build para Plesk
- O servidor Plesk roda Apache estático, não Node.js
- `.htaccess` é gerado automaticamente pelo script `scripts/generate-htaccess.js` durante o build

---

## 9. Verificação Pós-Deploy

```bash
# Testar se o site está respondendo
curl -I https://ipda.app.br

# Verificar tamanho do build gerado
du -sh out/

# Testar localmente o build antes de enviar
npm run plesk:test   # sobe Python HTTP server na porta 8080
```

---

## 10. Credenciais de Acesso Rápido

| Sistema | Usuário | Senha |
|---|---|---|
| SSH / Plesk | `root@74.208.44.241` | `5Kb1lSjY` |
| Painel Plesk | `https://74.208.44.241:8443` | (mesmo usuário root) |
| Admin app (principal) | `admin@ipda.org.br` | `IPDA@2025Admin` |
| Admin app (Marcio) | `marciodesk@ipda.app.br` | `Michelin@1` |
