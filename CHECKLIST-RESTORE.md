# Checklist de Backup e Restauração (Firestore)

## Rotina de backup (diária)
- Executar export full do Firestore para bucket GCS:
  - `gcloud firestore export gs://<bucket>/firestore-backup/daily-$(date +%Y%m%d)`
- Manter retenção mínima de 30 dias no bucket (lifecycle rule).
- Baixar um snapshot semanal off-site (armazenamento seguro). 
- Verificar logs do job (alerta se falhar).

## Snapshot rápido local (coleções-chave)
- Script local: `node scripts/backup-firestore-local.mjs` (members + attendance).
- Guardar arquivo gerado com timestamp fora do repo.

## Teste mensal de restauração (staging)
1. Criar projeto de staging ou usar projeto isolado.
2. Restaurar o export GCS mais recente:
   - `gcloud firestore import gs://<bucket>/firestore-backup/daily-YYYYMMDD` (no projeto de staging).
3. Validar:
   - Contagem de coleções principais (members, attendance).
   - Login/admin de teste acessa sem erros.
   - Tela de cadastro/presença funciona.
4. Registrar resultado (OK/erros) e corrigir antes do próximo ciclo.

## Procedimento de restauração em produção (em caso de perda)
1. Congelar writes (desligar triggers/processos ou colocar site em manutenção).
2. Escolher backup GCS (data mais recente íntegra).
3. `gcloud firestore import ...` no projeto de produção.
4. Revalidar contagens e funcionalidade (membros/presenças).
5. Reativar writes.

## Segurança de dados
- Nunca versionar service accounts no repositório.
- Rotacionar chaves expostas.
- Regras Firestore devem bloquear fallback aberto; coleções sensíveis com validação de campos.
- Proibir delete para usuários comuns; apenas superuser.

## Separação cadastro x presença
- `members`: somente cadastros (CPF único, sem presença).
- `attendance`: somente registros de presença (referenciam CPF).
- Formular de cadastro grava em `members`; telas de presença só alteram `attendance`.
- CSV de conflitos (needsReview) para limpar duplicidades de nome/CPF.
