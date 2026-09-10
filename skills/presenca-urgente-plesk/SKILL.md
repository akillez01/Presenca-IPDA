# SKILL: Presença Urgente + Deploy (Vercel)

## Objetivo
Padronizar o atendimento urgente para:
1) validar se novos cadastrados e presenças foram realmente salvos no Firebase,
2) quando o atendimento exigir mudança de código, publicar em produção via `git push origin main` (Vercel builda e publica automaticamente).

> **Correção (2026-09-10):** produção não é mais Plesk. `ipda.app.br` é servido pela
> Vercel (via Cloudflare), com deploy automático a cada push em `main`. O nome desta
> skill ficou como legado; o fluxo de build/upload para Plesk abaixo é só histórico
> (ver seção "Legado — pipeline Plesk").

## Quando usar
- Quando a equipe está registrando pessoas em tempo real e precisa confirmar persistência.
- Quando é necessário publicar uma correção de código com urgência sem interromper o fluxo.
- Quando houver dúvida entre cadastro base e presença efetiva do dia.

## Não usar para
- Migração estrutural de banco ou refatorações grandes.
- Deploy de regras do Firebase (Storage/Firestore) — isso é separado do deploy do app,
  veja "Firebase rules" abaixo.

## Pré-requisitos
- Credencial Firebase Admin válida no projeto.
- Node/NPM funcionando no workspace.
- Push liberado para `origin main` no repositório `akillez01/Presenca-IPDA`
  (confirmar com o solicitante antes de qualquer push, é produção).

## Coleções e significado
- members: base de cadastrados (cadastro mestre).
- presenca: diretório sincronizado de cadastrados para operação.
- attendance: presença efetiva lançada no culto/dia (registro de presença).

## Regra de validação correta
- Estar em members e presenca = cadastrado/sincronizado.
- Estar em attendance (data atual) = presença lançada hoje.
- Não confundir cadastro com presença do dia.

## Fluxo operacional (ordem obrigatória)
1. Validar registro específico (nome/CPF) em members e presenca.
2. Validar se já existe em attendance no dia atual.
3. Validar amostra de nomes recebidos (ex.: print/WhatsApp) em lote.
4. Se o atendimento não exigir mudança de código, pare aqui — não há nada para
   publicar.
5. Se exigir mudança de código: `npm run typecheck` e `npm run lint` antes de commitar.
6. Confirmar com o solicitante antes do push real (ação em produção).
7. `git add`, `git commit`, `git push origin main`.
8. Acompanhar o status do deploy no commit (`gh api repos/akillez01/Presenca-IPDA/commits/<sha>/status`,
   procurar `context: "Vercel"`) até `state: success` — geralmente leva menos de 1 minuto.
9. Verificar `curl -sI https://ipda.app.br/<rota alterada>` (deve responder 200, com
   headers `server: cloudflare` e cabeçalhos RSC do Next.js).

## Comandos padrão
1) Conferir registros do dia:
- node consultar-firebase.cjs data 2026-04-19 2026-04-19

2) Checar tipos/lint antes de publicar:
- npm run typecheck
- npm run lint

3) Publicar (após confirmação do solicitante):
- git push origin main

4) Acompanhar o deploy:
- gh api repos/akillez01/Presenca-IPDA/commits/$(git rev-parse HEAD)/status
- curl -sI https://ipda.app.br

## Firebase rules (Storage/Firestore)
- Não fazem parte do build da Vercel. Deploy manual com
  `firebase deploy --only storage` (ou `--only firestore`), projeto `reuniao-ministerial`.
- Exige Node ≥20 no PATH para a Firebase CLI (`nvm use 20` se o padrão for Node 18).
- Depois do deploy, confirmar no output que apareceu "released rules ... to
  firebase.storage" — não assumir que uma regra commitada já está publicada.

## Saídas esperadas
- Commit publicado em `origin main`.
- Status check "Vercel" com `state: success` para o commit.
- `https://ipda.app.br` respondendo 200 após o deploy.

## Checklist de entrega rápida
- Registros críticos confirmados no banco.
- Diferença entre cadastrado e presença do dia explicada ao solicitante.
- typecheck/lint passando antes do push (quando houve mudança de código).
- Push feito e status "Vercel" confirmado como success.
- https://ipda.app.br respondendo 200 após o envio.

---

## Legado — pipeline Plesk (não usar para deploys de rotina)

Este era o fluxo de produção antes da migração para Vercel (2026-09-10). Produção era
um export estático Next.js (`output: 'export'`) servido por Apache/Plesk em
`https://ipda.app.br`, servidor `74.208.44.241`. Mantido só como referência para um
eventual rollback.

- Build: `npm run build:plesk:full` (`scripts/build-plesk.js`).
- Empacotar: `npm run plesk:package` → `sistema-presenca-ipda-plesk.tar.gz`.
- Upload direto: `npm run plesk:upload` (rsync+ssh, `scripts/deploy-plesk.cjs`, lê a
  seção `plesk` de `credentials.local.json` — formato em `credentials.example.json`).
- Um comando só: `npm run plesk:deploy:live` (build + upload).
- Bloqueio conhecido (pode já não valer mais): SSH (porta 22) para `74.208.44.241`
  historicamente instável. Alternativa: Plesk File Manager em
  `https://74.208.44.241:8443`, extraindo o tar.gz em `httpdocs/`.
