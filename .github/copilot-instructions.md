# Instruções de Build para Produção — Sistema de Presença IPDA

Este arquivo orienta o GitHub Copilot (Chat / coding agent) sobre como este projeto é
buildado e publicado em produção. Leia antes de propor ou executar qualquer comando de
build/deploy.

## Visão geral do projeto

- **Stack**: Next.js 15 (App Router) + TypeScript + Firebase (Firestore/Auth) + Tailwind.
- **Node.js**: v18.x localmente (verificar com `node -v`); a Firebase CLI exige Node ≥20
  (`nvm use 20` quando for rodar `firebase deploy`).
- **Hospedagem de produção**: **Vercel** (projeto `achilles-projects-1c25cc7a/presenca-ipda`),
  com `ipda.app.br` proxeado via Cloudflare. Deploy é **automático a cada push em
  `origin main`** do repositório `akillez01/Presenca-IPDA` — a Vercel builda a partir do
  commit, não há passo manual de build/upload local.

## ⚠️ Regra mais importante

**Para produção, o build é `npm run build` comum** (o mesmo que a Vercel roda). Não use
`BUILD_TARGET=plesk` nem gere/envie a pasta `out/` para publicar — isso é um pipeline
legado (ver seção "Pipeline legado — Plesk" abaixo), mantido só para um eventual rollback.

Para publicar uma mudança: commit → `git push origin main` → a Vercel builda e publica
sozinha. Confirme com o usuário antes de dar push (é produção).

## Verificar o status do deploy

```bash
gh api repos/akillez01/Presenca-IPDA/commits/$(git rev-parse HEAD)/status
```

Procure o status check `context: "Vercel"`; `state` vai de `pending` para
`success`/`failure` (`target_url` linka o deployment). Geralmente termina em menos de um
minuto. Depois, `curl -sI https://ipda.app.br/<rota>` deve responder 200 com header
`server: cloudflare` e cabeçalhos RSC do Next.js (`vary: RSC, Next-Router-State-Tree, ...`).

## Regras de rotas de API

- `src/app/api/` funciona normalmente em produção (build dinâmico na Vercel, não é static
  export) — pode depender dessas rotas sem restrição especial.

## Variáveis de ambiente necessárias

As chaves `NEXT_PUBLIC_*` (Firebase, URL da app) são **embutidas no bundle em tempo de
build** — precisam estar corretas nas env vars do projeto na Vercel antes de um deploy que
dependa delas; não adiantam ser configuradas só depois. Localmente, o build lê `.env.local`
(não versionado).

Chaves obrigatórias mínimas: todas as `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_APP_URL`,
`NODE_ENV=production`.

## Pontos críticos do `next.config.ts`

- `output: 'export'` só é ativado quando `BUILD_TARGET=plesk` (pipeline legado) — o build
  normal usado pela Vercel é dinâmico (SSR/API routes), não mude isso.
- `images.unoptimized` só é `true` no build Plesk; na Vercel a otimização de imagem do
  Next.js roda normalmente.
- `typescript.ignoreBuildErrors` e `eslint.ignoreDuringBuilds` estão `true` — erros de
  tipo/lint **não** quebram o build. Rode `npm run typecheck` e `npm run lint`
  separadamente antes de considerar uma mudança pronta; não confie apenas no build passar.

## Firebase rules (Storage/Firestore) — deploy separado

Regras de Storage/Firestore **não** fazem parte do build/deploy da Vercel. Deploy manual:

```bash
firebase deploy --only storage   # ou --only firestore
```

Projeto: `reuniao-ministerial` (ver `.firebaserc`). Exige Node ≥20 no PATH. Confirme no
output que apareceu "released rules ... to firebase.storage" — uma regra só commitada no
repo **não** está publicada até esse deploy rodar.

## Checklist antes de abrir PR / considerar a mudança pronta

```bash
npm run typecheck          # sem erros de tipo bloqueantes
npm run lint                # sem lint quebrando funcionalidade
npm run build                # build dinâmico, o mesmo que a Vercel roda
```

## Erros comuns a evitar

- Usar `BUILD_TARGET=plesk` ou os scripts `plesk:*` para gerar o artefato de deploy real —
  produção não lê `out/`, é a Vercel buildando o commit direto.
- Editar arquivos dentro de `.next/` ou `out/` manualmente — são gerados, qualquer mudança
  é perdida no próximo build.
- Esquecer de repetir o build depois de mudar qualquer `NEXT_PUBLIC_*` — essas variáveis só
  entram no bundle no momento do build, não em runtime.
- Fazer push em `main` sem confirmar com o solicitante — vai direto para produção.

## Pipeline legado — Plesk (não usar para deploys de rotina)

Antes de 2026-09-10 a produção era um export estático (`output: 'export'`) servido por
Apache/Plesk em `74.208.44.241`. Mantido só como referência para um eventual rollback:

- `npm run build:plesk:full` (`scripts/build-plesk.js`) gera `out/`.
- `npm run plesk:validate` confere a integridade do export.
- `npm run plesk:package` empacota `out/` em `sistema-presenca-ipda-plesk.tar.gz`.
- `npm run plesk:upload` / `npm run plesk:deploy:live` enviam direto ao servidor via
  rsync+ssh (`scripts/deploy-plesk.cjs`, credenciais em `credentials.local.json`).

Ver `skills/presenca-urgente-plesk/SKILL.md` (seção "Legado") para o passo a passo
completo caso um rollback seja necessário.
