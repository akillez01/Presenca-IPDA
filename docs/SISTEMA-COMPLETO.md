# Sistema de Presença IPDA — Documentação Completa

> Última atualização: 15/05/2026  
> Autor: AchillesOS

---

## 1. Visão Geral

Sistema web de controle de presença para eventos e reuniões da IPDA. Permite:

- **Cadastro de membros** com foto, CPF e dados ministeriais
- **Registro de presença** via scanner de QR Code ou busca por CPF
- **Relatórios** filtráveis por data, turno, região e status
- **Gestão de usuários** com diferentes níveis de acesso

**Stack:**
| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 15 (App Router, static export para Plesk) |
| Banco de dados | Firebase Firestore |
| Autenticação | Firebase Auth |
| Armazenamento de fotos | Firebase Storage + base64 fallback |
| Hospedagem | Plesk (Apache) — ipda.app.br |
| Deploy | rsync via SSH para `74.208.44.241` |

---

## 2. Arquitetura do Banco de Dados (Firebase Firestore)

### 2.1 Coleções Principais

```
firestore/
├── members/{cpf}          ← Perfil mestre do membro
├── attendance/{key}       ← Registro individual de presença
├── system/config          ← Configurações globais do sistema
├── users/{uid}            ← Usuários do sistema
└── reports/{doc}          ← Apenas super usuários
```

### 2.2 Coleção `members` — Perfil Mestre

**Chave do documento:** CPF numérico limpo (ex: `34822283291`)

**Campos:**
```typescript
{
  cpf: string;              // Chave natural — 11 dígitos
  fullName: string;
  birthday?: string;        // Formato: "YYYY-MM-DD"
  reclassification: string; // Local | Setorial | Central | Casa de oração | Estadual | Regional
  pastorName: string;
  region: string;
  churchPosition: string;   // Ver enum completo em schemas.ts
  city: string;
  shift: string;            // "Manhã" | "Tarde"
  totvs?: string;
  etda?: string;
  phone?: string;           // Adicionado em 15/05/2026
  cfoCourse?: string;       // "SIM" | "NÃO"
  photoUrl?: string | null; // URL Firebase Storage ou base64
  status: string;
  memberId: string;         // Igual ao CPF
  sourceCollection: "members";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastPresenceAt: Timestamp | null;
}
```

**Regra de ouro:** `members` é a **source of truth** dos dados pessoais. Ao editar o nome, cargo ou região de um membro, a alteração vai para `members/{cpf}` — não diretamente em `attendance`.

### 2.3 Coleção `attendance` — Registros de Presença

**Chave do documento (determinística):**
```
{YYYY-MM-DD}__{turno-slug}__{cpf}
Exemplo: 2026-05-17__manha__34822283291
```

Esta chave **impede duplicatas por design** — mesmo duas chamadas simultâneas não criam dois registros para a mesma pessoa no mesmo turno do mesmo dia.

**Campos:**
```typescript
{
  // Identificação
  cpf: string;
  fullName: string;
  // ... todos os campos do membro (copiados no momento do registro)
  
  // Controle de sessão
  attendanceKey: string;     // Chave determinística (igual ao ID do documento)
  attendanceDateKey: string; // "YYYY-MM-DD"
  shift: string;             // Turno do evento
  
  // Status
  status: "Presente" | "Ausente" | "Justificado";
  absentReason?: string;
  
  // Timestamps
  timestamp: Timestamp;      // Data/hora do registro de presença
  createdAt: Timestamp;
  lastUpdated: Timestamp;
  updatedAt: Timestamp;
}
```

### 2.4 Relacionamento entre Coleções

```
members/{cpf} ──────────────────────────────────────────┐
   (perfil mestre)                                       │
                                                         │ cpf como chave
attendance/2026-05-17__manha__12345 ──── lê e copia ────┘
attendance/2026-05-17__tarde__12345
attendance/2026-05-10__manha__12345
   (um registro por sessão por dia)
```

Quando um membro é editado em Relatórios ou Presença de Cadastrados, o sistema chama:
1. `updateAttendanceRecord(id, data)` — atualiza o registro de presença específico
2. `syncMemberProfile(data)` → `upsertMemberProfile(data)` — sincroniza o perfil mestre

---

## 3. Fluxo de Dados

### 3.1 Cadastro de Novo Membro

```
/register → addMember() → createMemberProfile()
                          ↓
                    members/{cpf}  (setDoc via runTransaction)
                    SE CPF já existe: retorna erro MEMBER_ALREADY_EXISTS
```

### 3.2 Registro de Presença (Scanner / CPF)

```
Scanner detecta CPF
    ↓
registerAttendanceByCpf(cpf)
    ↓
getMemberRecordByCpf(cpf)  ← busca em members; fallback em attendance
    ↓
getAttendanceByCpfForSession(cpf, shift, hoje)
    ↓
[já existe?]
    ├── SIM → updateAttendanceStatus(id, "Presente")
    └── NÃO → createAttendanceSessionRecord(payload, hoje, "update")
                ↓
          runTransaction → setDoc(attendance/{chave_deterministica})
                ↓
          upsertMemberProfile(data)  ← atualiza lastPresenceAt em members
```

### 3.3 Relatórios

```
/reports → useRealtimeReports()
    ↓
getAttendanceRecords()  ← lê TODA a coleção attendance (getDocs)
    ↓  [atualiza a cada 5 minutos]
getMemberDirectoryRecords()  ← lê members + attendance (com cache 5min)
    ↓
filteredRecords (client-side por data, turno, região, status, CPF)
    ↓
Modal ao clicar no nome → exibe foto + QR Code + telefone + histórico
```

---

## 4. Permissões e Segurança

### 4.1 Níveis de Usuário

| Tipo | UserRole | Acesso |
|------|----------|--------|
| Super Admin | `admin` | Tudo, incluindo deletar membros e acessar reports |
| Editor | `editor` | Cadastrar, editar presença, ver relatórios |
| Moderador | `moderator` | Ver e editar presença, sem gerenciar usuários |
| Usuário padrão | `user` | Somente scanner e presença |
| Usuário batismo | `baptism_user` | Apenas módulo de batismo |

### 4.2 Regras do Firestore

```javascript
// members: qualquer autenticado lê e cria/atualiza; só super deleta
match /members/{document} {
  allow read, create, update: if request.auth != null;
  allow delete: if isSuperUser();
}

// attendance: qualquer autenticado lê e escreve
match /attendance/{document} {
  allow read, write: if request.auth != null;
}

// system/config: qualquer autenticado lê; só super escreve
match /system/{document} {
  allow read: if request.auth != null;
  allow write: if isSuperUser();
}
```

**Super usuários hardcoded:** `admin@ipda.org.br` e `marciodesk@ipda.app.br`

---

## 5. Deploy e Infraestrutura

### 5.1 Processo de Deploy

O projeto gera um **export estático** (sem Node.js no servidor) pois o Plesk usa Apache.

```bash
# 1. Build local
npm run build:plesk:full
# Gera: out/ com HTML, CSS, JS estáticos
# Remove temporariamente as rotas /api durante o build

# 2. Envio ao servidor
sshpass -p '5Kb1lSjY' rsync -avz --delete \
  ./out/ \
  root@74.208.44.241:/var/www/vhosts/ipda.app.br/httpdocs/
```

### 5.2 Servidor

| Item | Valor |
|------|-------|
| IP | `74.208.44.241` |
| SSH | `root@74.208.44.241` (senha: `5Kb1lSjY`) |
| Painel | https://74.208.44.241:8443 |
| Domínio | https://ipda.app.br |
| Pasta pública | `/var/www/vhosts/ipda.app.br/httpdocs/` |

### 5.3 Atenção: Rotas API

As rotas em `src/app/api/` **não funcionam** no servidor Plesk (export estático). Elas são removidas durante o build e restauradas depois. Toda a lógica de dados usa Firebase diretamente do cliente.

---

## 6. Componentes e Arquivos Chave

```
src/
├── app/
│   ├── register/page.tsx          ← Formulário de cadastro
│   ├── presencadecadastrados/     ← Marcar presença de membros cadastrados
│   ├── scanner/page.tsx           ← Scanner de QR Code / CPF
│   ├── reports/page.tsx           ← Relatórios com filtros e modal
│   └── admin/                     ← Gestão de usuários, configurações
│
├── lib/
│   ├── actions.ts                 ← Ações server-side (addMember, registerAttendanceByCpf)
│   ├── member-data.ts             ← CRUD members + cache do diretório
│   ├── presenca-mysql.ts          ← CRUD attendance (nome legado — é Firebase)
│   ├── api-actions.ts             ← Ações client-side (getAttendanceRecords)
│   ├── schemas.ts                 ← Validação Zod do formulário
│   ├── types.ts                   ← Tipos TypeScript (AttendanceRecord, User...)
│   └── firebase.ts                ← Inicialização Firebase
│
├── hooks/
│   ├── use-reports.ts             ← Hook de relatórios (refresh 5min)
│   ├── use-realtime.ts            ← Hook de configuração do sistema
│   └── use-auth.ts                ← Hook de autenticação
│
└── components/
    ├── attendance/photo-capture-field.tsx   ← Captura de foto (câmera/upload)
    └── auth/route-guard.tsx                 ← Proteção de rotas
```

---

## 7. Proteções Anti-Duplicação

O sistema tem **3 camadas** de proteção contra registros duplicados:

### Camada 1 — Chave Determinística (principal)
```
ID do documento = {data}__{turno}__{cpf}
```
O Firestore não permite dois documentos com o mesmo ID. Se o mesmo CPF tentar registrar presença duas vezes no mesmo turno do mesmo dia, o segundo `setDoc` simplesmente atualiza o existente.

### Camada 2 — `runTransaction`
`createAttendanceSessionRecord` usa transação atômica: lê e verifica o documento antes de escrever. Mesmo em condições de race condition (dois usuários simultâneos), apenas uma escrita é confirmada.

### Camada 3 — Verificação de sessão prévia
`getAttendanceByCpfForSession` verifica antes de criar se já existe um registro para aquela pessoa/turno/dia. Se existir, apenas atualiza o status — não cria novo documento.

---

## 8. Cota e Performance do Firebase

### 8.1 Limites da Conta Gratuita (Spark)

| Operação | Limite/dia |
|----------|-----------|
| Leituras | 50.000 |
| Escritas | 20.000 |
| Exclusões | 20.000 |

### 8.2 Estimativa de Consumo (evento com 200 membros)

| Operação | Frequência | Leituras/dia |
|----------|-----------|--------------|
| Relatórios (refresh 5min) | 288 ciclos × 200 docs | ~57.600 |
| Cache de membros (5min TTL) | 288 ciclos / cache | ~200 |
| Registros de presença | 200 membros | 400 (leitura + escrita) |
| **Total estimado** | | **~58.200** |

⚠️ O limite é 50.000/dia. Para eventos grandes, **recomendado** usar Firebase Blaze (pago) ou reduzir abas abertas.

### 8.3 Otimizações Implementadas

- **Cache de 5 minutos** em `getMemberDirectoryRecords` — evita scan duplo
- **Refresh de 5 minutos** no hook de relatórios (era 30 segundos — 10× mais leituras)
- **Scan único de members** — só consulta attendance como fallback se members estiver vazio
- **Chave determinística** — evita escrever documentos duplicados

---

## 9. Melhorias Futuras Recomendadas

### 9.1 Críticas (resolver antes de crescer muito)

| Melhoria | Por quê | Esforço |
|----------|---------|---------|
| **Migrar para Firestore `onSnapshot`** | Listener em tempo real substitui o polling de 5min — dados instantâneos sem custo extra de leituras | Alto |
| **Índice composto em `attendance`** | `cpf + attendanceDateKey` como índice — queries por CPF ficam ~10× mais rápidas | Médio |
| **Paginação em relatórios** | Com 1000+ registros, o load completo vai ser lento | Alto |

### 9.2 Importantes

| Melhoria | Por quê | Esforço |
|----------|---------|---------|
| **Remover/limpar `addPresenca` legada** | Função `presenca-mysql.ts` ainda exportada mas não usada — confusão futura | Baixo |
| **Remover `getAttendance()` duplicada** | Existe `getAttendance()` e `getPresencas()` fazendo a mesma coisa | Baixo |
| **Tratamento de offline** | Se a conexão cair durante o evento, o usuário vê loading infinito sem mensagem | Médio |
| **Mover credenciais do firebase.ts** | API key está hardcoded como fallback — colocar tudo em .env | Baixo |

### 9.3 Desejáveis

| Melhoria | Por quê | Esforço |
|----------|---------|---------|
| **Compressão de fotos antes do upload** | Fotos em base64 grandes deixam documentos pesados | Médio |
| **Exportar presença em tempo real para CSV** | Atualmente gera snapshot — poderia ter link de download contínuo | Médio |
| **Histórico de presença no perfil do membro** | Modal de relatórios já mostra, mas não é acessível no scanner | Baixo |
| **Notificação de cota Firebase** | Alertar admin quando se aproximar de 40k leituras/dia | Médio |

---

## 10. Variáveis de Ambiente

```bash
# Firebase (obrigatório)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID= # opcional — Google Analytics

# Firebase Admin (apenas server-side / scripts)
GOOGLE_APPLICATION_CREDENTIALS=./reuniao-ministerial-firebase-adminsdk-*.json

# Opcional
NEXT_PUBLIC_DEBUG=true  # Ativa logs detalhados do Firebase
```

---

## 11. Scripts Úteis

```bash
# Desenvolvimento
npm run dev                    # Inicia servidor local em :9002

# Build e deploy
npm run build:plesk:full       # Build estático completo para Plesk
npm run typecheck              # Verificar tipos TypeScript

# Dados e migrações
node scripts/migrate-members-from-attendance.mjs   # Migra membros de attendance → members
node scripts/restore-missing-attendance.mjs        # Restaura registros faltantes

# Deploy manual
sshpass -p '5Kb1lSjY' rsync -avz --delete ./out/ \
  root@74.208.44.241:/var/www/vhosts/ipda.app.br/httpdocs/
```

---

## 12. Histórico de Alterações Recentes

| Data | Alteração |
|------|-----------|
| 15/05/2026 | Adicionado campo `phone` (telefone/WhatsApp) em todo o fluxo |
| 15/05/2026 | Foto do membro exibida no modal de relatórios |
| 15/05/2026 | Refresh de relatórios aumentado de 30s → 5min (prevenção de cota) |
| 15/05/2026 | Cache de 5min em `getMemberDirectoryRecords` |
| 15/05/2026 | `addPresenca` corrigida para usar chave determinística + `runTransaction` |
| 15/05/2026 | `processFirebaseTimestamp` retorna null em vez de `new Date()` para timestamps inválidos |
| 15/05/2026 | Scan duplo de `attendance` eliminado quando `members` já tem os dados |
