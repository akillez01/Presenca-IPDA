# SKILL: Presença Urgente + Deploy Plesk

## Objetivo
Padronizar o atendimento urgente para:
1) validar se novos cadastrados e presenças foram realmente salvos no Firebase,
2) gerar build estático atualizado na pasta out,
3) empacotar para envio imediato ao servidor Plesk.

## Quando usar
- Quando a equipe está registrando pessoas em tempo real e precisa confirmar persistência.
- Quando é necessário atualizar o servidor com urgência sem interromper o fluxo.
- Quando houver dúvida entre cadastro base e presença efetiva do dia.

## Não usar para
- Deploy em ambiente Node SSR (esta skill é para export estático Plesk).
- Migração estrutural de banco ou refatorações grandes.

## Pré-requisitos
- Credencial Firebase Admin válida no projeto.
- Node/NPM funcionando no workspace.
- Projeto com scripts:
  - npm run build:plesk:full
  - npm run plesk:package

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
4. Rodar build de produção para Plesk.
5. Confirmar geração de out e arquivos críticos.
6. Gerar pacote final tar.gz para upload.

## Comandos padrão
1) Conferir registros do dia:
- node consultar-firebase.cjs data 2026-04-19 2026-04-19

2) Build Plesk completo:
- npm run build:plesk:full

3) Verificar artefatos:
- ls -la out | head -n 20
- ls -la out/.htaccess out/build-report.txt
- du -sh out

4) Empacotar para servidor:
- npm run plesk:package
- ls -lh sistema-presenca-ipda-plesk.tar.gz

## Saídas esperadas
- Pasta out atualizada com timestamp do momento da execução.
- Arquivos obrigatórios presentes: .htaccess e build-report.txt.
- Pacote final: sistema-presenca-ipda-plesk.tar.gz.

## Tratamento de alertas conhecidos
- Avisos de rewrites/headers no output export são esperados para build estático.
- Se npm run plesk:validate falhar por ESM/CJS, não bloqueia o deploy quando out e pacote foram gerados corretamente.

## Checklist de entrega rápida
- Registros críticos confirmados no banco.
- Diferença entre cadastrado e presença do dia explicada ao solicitante.
- Build out gerado e validado.
- Pacote tar.gz criado e pronto para upload.
- Pronto para extração em public_html no Plesk.
