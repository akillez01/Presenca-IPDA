# Checklist de Deployment - IPDA API

Guia de verificação completo antes de colocar em produção.

## 📋 Pré-Deployment

### Infraestrutura

- [ ] Node.js 18+ instalado no servidor
- [ ] PostgreSQL 14+ acessível e testado
- [ ] Plesk configurado com proxy reverso
- [ ] Tailscale conectado no servidor (para acessar banco)
- [ ] Firewall permite conexão banco de dados
- [ ] Certificado SSL/TLS válido
- [ ] Domínios configurados (ipda.app.br e seivadigital.com.br)

### Código

- [ ] Todas as variáveis de ambiente em `.env`
- [ ] Nenhum token/senha em código ou git
- [ ] TypeScript compila sem erros: `npm run build`
- [ ] Dependências instaladas: `npm ci --only=production`
- [ ] `.gitignore` configurado corretamente

### Banco de Dados

- [ ] Banco PostgreSQL criado: `ipdadb`
- [ ] Usuário criado: `ipdaadmin`
- [ ] Schema inicializado (tabelas criadas)
- [ ] Índices criados para performance
- [ ] Views de estatísticas criadas
- [ ] Usuário admin inserido na tabela `usuarios`
- [ ] Backup realizado antes da migração

### Segurança

- [ ] JWT_SECRET gerado aleatoriamente (32+ caracteres)
- [ ] Senhas do banco de dados fortes
- [ ] CORS configurado apenas para domínios permitidos
- [ ] Rate limiting ativado
- [ ] HTTPS forçado para todas as rotas
- [ ] Headers de segurança (Helmet) ativados
- [ ] Validação de entrada em todos os endpoints
- [ ] Senhas no banco hasheadas (bcryptjs)

## 🚀 Deployment

### Instalação

- [ ] PM2 instalado globalmente: `npm install -g pm2`
- [ ] Código clonado/copiado para servidor
- [ ] Dependências instaladas em produção
- [ ] Build compilado: `npm run build`
- [ ] Arquivo `.env` criado com valores corretos
- [ ] Permissões de arquivo corretas

### Teste Inicial

- [ ] Inicie manualmente: `node dist/src/index.js`
- [ ] Verifique logs para erros
- [ ] Teste health check: `curl http://localhost:3001/health`
- [ ] Teste login com usuário admin
- [ ] Teste CORS fazendo requisição do navegador

### PM2 Setup

- [ ] Inicie com PM2: `pm2 start dist/src/index.js --name "ipda-api"`
- [ ] Salve configuração: `pm2 save`
- [ ] Configure startup automático: `pm2 startup`
- [ ] Execute comando que PM2 fornece
- [ ] Teste restart: `pm2 restart ipda-api`

### Configuração Plesk

- [ ] Acesse painel Plesk
- [ ] Configure proxy reverso para `http://localhost:3001`
- [ ] Ative HTTPS permanente
- [ ] Teste endpoint via domínio: `curl https://ipda.app.br/api/health`
- [ ] Verifique logs do Plesk para erros

## 🧪 Testes Funcionais

### Autenticação

- [ ] POST /api/auth/login - Login bem-sucedido
- [ ] POST /api/auth/login - Falha com senha errada
- [ ] POST /api/auth/register - Criar novo usuário (admin)
- [ ] POST /api/auth/refresh-token - Renovar token
- [ ] GET /api/auth/me - Obter usuário autenticado
- [ ] Requisições sem token retornam 401

### Membros

- [ ] GET /api/membros - Listar com paginação
- [ ] POST /api/membros - Criar novo membro
- [ ] GET /api/membros/:id - Obter detalhes
- [ ] PUT /api/membros/:id - Atualizar membro
- [ ] DELETE /api/membros/:id - Soft delete funciona

### Presença

- [ ] POST /api/presenca/marcar - Marcar presença
- [ ] GET /api/presenca/listar - Listar com filtros
- [ ] GET /api/presenca/estatisticas - Obter estatísticas
- [ ] PUT /api/presenca/:id - Atualizar presença
- [ ] DELETE /api/presenca/:id - Deletar presença

### Estatísticas

- [ ] GET /api/stats/resumo - Resumo do dia
- [ ] GET /api/stats/por-regiao - Por região
- [ ] GET /api/stats/por-pastor - Por pastor
- [ ] GET /api/stats/historico - Histórico
- [ ] GET /api/stats/membros-sem-presenca - Sem presença

### Erros

- [ ] 400 Bad Request para dados inválidos
- [ ] 401 Unauthorized sem token
- [ ] 403 Forbidden para admin-only sem permissão
- [ ] 404 Not Found para recurso inexistente
- [ ] 500 com mensagem de erro útil em falhas

## 📊 Monitoramento

### Logs

- [ ] PM2 logs acessíveis: `pm2 logs ipda-api`
- [ ] Logs rotativos configurados: `pm2 install pm2-logrotate`
- [ ] Erros sendo capturados e logados
- [ ] Auditoria logada em banco de dados

### Performance

- [ ] Tempo de resposta < 500ms
- [ ] Sem memory leaks (monitor com `pm2 monit`)
- [ ] CPU utilização normal (< 50% em repouso)
- [ ] Conexões de banco pooladas corretamente

### Backup

- [ ] Script de backup criado
- [ ] Backup executado com sucesso
- [ ] Restauração testada manualmente
- [ ] Backup agendado no crontab

## 🔄 Integração Next.js

### Configuração

- [ ] `.env.local` com `NEXT_PUBLIC_API_URL` correto
- [ ] `lib/api-client.ts` copiado para projeto
- [ ] Imports atualizados em todas as páginas

### Páginas

- [ ] `/login` usando novo `apiClient`
- [ ] `/presencadecadastrados` conectado à API
- [ ] `/reports` mostrando dados da API
- [ ] `/register` salvando no banco correto

### Testes

- [ ] Login funciona e salva token
- [ ] Listagem de membros exibe dados do banco
- [ ] Marcar presença salva no novo banco
- [ ] Relatórios mostram dados corretos

## ⚠️ Rollback Plan

Se houver problemas:

1. [ ] PM2 `restart`: `pm2 restart ipda-api`
2. [ ] Voltar para versão anterior: `git revert` ou `npm install` + `npm run build`
3. [ ] Restaurar banco de dados: `psql < backup.sql`
4. [ ] Reverter proxy Plesk para Firebase se necessário
5. [ ] Contatar suporte se persistir

## 📝 Documentação

- [ ] README.md atualizado
- [ ] API-INTEGRATION-GUIDE.md disponível
- [ ] DEPLOYMENT-PM2-PLESK.md com instruções
- [ ] Postman collection importável
- [ ] Credenciais documentadas com segurança

## 🎯 Pós-Deployment

### 24 Horas

- [ ] Monitorar logs para erros
- [ ] Testar principais funcionalidades
- [ ] Verificar performance
- [ ] Coletar feedback dos usuários

### 1 Semana

- [ ] Revisar e otimizar queries lentas
- [ ] Análise de uptime e disponibilidade
- [ ] Planejar próximas melhorias
- [ ] Documentar lições aprendidas

### Contínuo

- [ ] Monitorar uptimes e performance
- [ ] Backups regulares verificados
- [ ] Atualizações de segurança aplicadas
- [ ] Logs analisados para anomalias

---

## Contato de Suporte

**Em caso de problemas:**

1. Verificar logs: `pm2 logs ipda-api`
2. Testar conectividade: `curl http://localhost:3001/health`
3. Revisar este checklist
4. Consultar documentação: `API-SETUP-GUIDE.md`

**Email de suporte:** [seu-email@ipda.com.br]

---

**Data da última atualização:** Janeiro 2025  
**Versão da API:** 1.0.0  
**Node.js mínimo:** 18+  
**PostgreSQL mínimo:** 14+
