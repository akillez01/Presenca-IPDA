# Painel de Usuários - Sistema IPDA

## Visão Geral

O painel de usuários é uma interface administrativa responsiva que permite aos super usuários gerenciar todos os usuários do sistema. Esta funcionalidade está protegida por controle de acesso e apenas super usuários podem acessá-la.

## Acesso ao Painel

### URL

```
/admin/users
```

### Requisitos de Acesso

- Usuário deve estar autenticado
- Usuário deve ser um super usuário (admin@ipda.org.br ou marciodesk@ipda.app.br)
- Página protegida pelo componente `SuperUserGuard`

## Funcionalidades

### 1. Adicionar Novos Usuários

**Campos do Formulário:**

- **Email**: Email único do usuário (obrigatório)
- **Nome de Exibição**: Nome que será mostrado no sistema
- **Tipo de Usuário**:
  - Usuário Normal: Acesso básico ao sistema
  - Administrador: Acesso a funcionalidades administrativas
- **Senha**: Senha mínima de 6 caracteres (obrigatório)

**Processo de Criação:**

1. Usuário é criado no Firebase Authentication
2. Perfil é atualizado com nome de exibição
3. Registro é criado na coleção `users` do Firestore
4. Usuário recebe acesso imediato ao sistema

### 2. Listar Usuários

**Informações Exibidas:**

- Email do usuário
- Nome de exibição
- Tipo de usuário (Super Usuário ou Usuário Normal)
- Status de verificação de email
- Último acesso (oculto em dispositivos móveis)
- Ações disponíveis

**Tipos de Usuários:**

- **Super Usuários**: Identificados com badge vermelho e ícone de escudo
- **Usuários Normais**: Identificados com badge cinza e ícone de usuário

### 3. Editar Usuários

**Edição Inline:**

- Click no ícone de edição para ativar modo de edição
- Campos editáveis: Nome de exibição e tipo de usuário
- Botões de confirmar/cancelar aparecem durante a edição
- Apenas usuários normais podem ser editados

### 4. Excluir Usuários

**Restrições:**

- Apenas usuários normais podem ser excluídos
- Super usuários não podem ser excluídos
- Usuário atual não pode excluir a si mesmo
- Confirmação obrigatória antes da exclusão

### 5. Estatísticas

**Cards de Resumo:**

- Total de Super Usuários
- Total de Usuários Normais
- Total Geral de Usuários

## Responsividade

### Desktop (md+)

- Tabela completa com todas as colunas
- Ações inline com botões separados
- Formulário modal em uma coluna

### Tablet/Mobile (sm-)

- Coluna "Último Acesso" oculta para economizar espaço
- Menu de ações em popover (botão com três pontos)
- Formulário modal responsivo
- Edição inline adaptada para telas pequenas
- Botões de ação empilhados verticalmente

### Melhorias de UX Móvel

- Overflow horizontal na tabela
- Widths mínimos nas colunas
- Popover com informações condensadas
- Formulário otimizado para touch

## Segurança

### Controle de Acesso

- Página protegida por `SuperUserGuard`
- Verificação de super usuário no frontend e backend
- Regras do Firestore impedem modificações não autorizadas

### Validações

- Email deve ser único no Firebase Auth
- Senha mínima de 6 caracteres
- Campos obrigatórios validados no frontend
- Tratamento de erros do Firebase

## Integração com Firebase

### Authentication

- Criação de usuários via `createUserWithEmailAndPassword`
- Atualização de perfil via `updateProfile`
- Gerenciamento automático de UIDs

### Firestore

- Coleção: `users`
- Documento ID: UID do usuário
- Campos salvos:
  ```typescript
  {
    uid: string,
    email: string,
    displayName: string,
    role: 'user' | 'admin',
    createdAt: string,
    active: boolean
  }
  ```

### Sincronização

- Lista atualizada automaticamente após ações
- Botão de atualização manual disponível
- Estados de loading durante operações

## Mensagens e Feedback

### Toasts de Sucesso

- Usuário criado com sucesso
- Usuário atualizado com sucesso
- Usuário excluído com sucesso

### Toasts de Erro

- Erro ao criar usuário (email já existe, senha fraca, etc.)
- Erro ao atualizar usuário
- Erro ao excluir usuário
- Erro ao carregar lista de usuários

### Estados de Loading

- Loading na criação de usuário
- Loading na atualização da lista
- Loading geral durante carregamento inicial

## Estrutura de Arquivos

```
src/
├── app/
│   └── admin/
│       └── users/
│           └── page.tsx              # Página principal do painel
├── components/
│   ├── admin/
│   │   └── user-management.tsx       # Componente principal
│   └── auth/
│       └── super-user-guard.tsx      # Proteção de acesso
└── lib/
    ├── auth.ts                       # Funções de autenticação
    ├── firebase.ts                   # Configuração Firebase
    └── types.ts                      # Tipos TypeScript
```

## Uso do Painel

### Para Adicionar Usuário

1. Acesse `/admin/users`
2. Clique em "Adicionar Usuário"
3. Preencha os campos obrigatórios
4. Selecione o tipo de usuário
5. Clique em "Criar Usuário"

### Para Editar Usuário

1. Localize o usuário na lista
2. Clique no ícone de edição (lápis)
3. Modifique os campos desejados
4. Clique no ícone de confirmação (check)

### Para Excluir Usuário

1. Localize o usuário na lista
2. Clique no ícone de lixeira (ou menu em mobile)
3. Confirme a exclusão no diálogo

## Limitações Conhecidas

1. **Exclusão no Firebase Auth**: O sistema remove o usuário do Firestore, mas não do Firebase Authentication (limitação da API client-side)
2. **Super Usuários Hardcoded**: Lista de super usuários está configurada no código
3. **Sem Paginação**: Todos os usuários são carregados de uma vez
4. **Sem Filtros**: Não há funcionalidade de busca ou filtros

## Próximas Melhorias

1. Implementar paginação para listas grandes
2. Adicionar filtros e busca de usuários
3. Melhorar gerenciamento de super usuários
4. Adicionar logs de auditoria para ações administrativas
5. Implementar exclusão também do Firebase Auth (requer admin SDK)

## Manutenção

### Monitoramento

- Verificar logs de erro no console do navegador
- Monitorar toast messages para feedback do usuário
- Acompanhar métricas de criação/exclusão de usuários

### Atualizações

- Manter dependências do Firebase atualizadas
- Revisar regras de segurança do Firestore periodicamente
- Testar responsividade em diferentes dispositivos

---

**Documentação criada em**: Janeiro 2025  
**Sistema**: IPDA - Controle de Presença  
**Versão**: 1.0
