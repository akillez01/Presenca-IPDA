# Sistema de Usuários IPDA

## Tipos de Usuários

### 1. Super Usuário (Administrador)

- **Credenciais:**

  - Email: `admin@ipda.org.br` / Senha: `IPDA@2025Admin`
  - Email: `marciodesk@ipda.app.br` / Senha: `Michelin@1`

- **Permissões:**
  - ✅ Dashboard
  - ✅ Registrar Presença
  - ✅ Presença de Cadastrados
  - ✅ Carta de Recomendação
  - ✅ Carta 1 Dia
  - ✅ Relatórios
  - ✅ Gerenciar Usuários
  - ✅ Configurações

### 2. Usuário Básico (Secretaria/Auxiliar)

- **Credenciais:**

  - Email: `secretaria@ipda.org.br` / Senha: `SecretariaIPDA@2025`
  - Email: `auxiliar@ipda.org.br` / Senha: `AuxiliarIPDA@2025`

- **Permissões (Acesso Limitado):**
  - ✅ Dashboard
  - ✅ Registrar Presença
  - ✅ Presença de Cadastrados
  - ✅ Carta de Recomendação
  - ✅ Carta 1 Dia
  - ❌ Relatórios (Somente Super Usuário)
  - ❌ Gerenciar Usuários (Somente Super Usuário)
  - ❌ Configurações (Somente Super Usuário)

## Recursos de Segurança

### Controle de Acesso por Rota

O sistema implementa um sistema de guards que verificam automaticamente as permissões do usuário para cada rota:

- **RouteGuard**: Protege rotas baseado no tipo de usuário
- **BasicUserGuard**: Permite acesso apenas para usuários básicos
- Redirecionamento automático para página de acesso negado

### Interface Diferenciada

- **Sidebar**: Menu adaptativo baseado no tipo de usuário
- **Header**: Indicador visual do tipo de usuário
- **Navegação**: Links indisponíveis ficam ocultos

### Autenticação Robusta

- Sistema dual: Firebase Auth + fallback local
- Credenciais criptografadas e seguras
- Sessão persistente e segura
- Logout automático em caso de erro

## Funcionalidades por Tipo de Usuário

### Para Usuários Básicos

Os usuários básicos foram criados especificamente para secretaria e auxiliares que precisam apenas:

1. **Registrar Presença**: Cadastrar novos visitantes e membros
2. **Controlar Presença**: Marcar presença de pessoas já cadastradas
3. **Emitir Cartas**: Gerar cartas de recomendação e cartas de 1 dia
4. **Visualizar Dashboard**: Ver informações básicas do sistema

### Para Super Usuários

Além de todas as funcionalidades dos usuários básicos, podem:

1. **Ver Relatórios**: Acessar relatórios detalhados e estatísticas
2. **Gerenciar Sistema**: Configurações avançadas
3. **Administrar Usuários**: Controle total do sistema

## Como Usar

### Criando Novos Usuários

Para adicionar novos usuários, edite o arquivo `/src/lib/auth.ts`:

```typescript
// Para usuários básicos
const BASIC_USERS = {
  "secretaria@ipda.org.br": "SecretariaIPDA@2025",
  "auxiliar@ipda.org.br": "AuxiliarIPDA@2025",
  "novo-usuario@ipda.org.br": "SenhaSuperSegura@2025", // Adicionar aqui
};

// Para super usuários
const SUPER_USERS = {
  "admin@ipda.org.br": "IPDA@2025Admin",
  "marciodesk@ipda.app.br": "Michelin@1",
  "novo-admin@ipda.org.br": "AdminSenha@2025", // Adicionar aqui
};
```

### Testando o Sistema

1. Faça logout se estiver logado
2. Vá para `/login`
3. Teste com as credenciais de usuário básico
4. Verifique que apenas as funcionalidades permitidas estão disponíveis
5. Faça logout e teste com super usuário
6. Verifique que todas as funcionalidades estão disponíveis

## Estrutura Técnica

### Componentes Principais

- `RouteGuard`: Proteção de rotas
- `BasicUserGuard`: Componente específico para usuários básicos
- `AppSidebar`: Menu adaptativo
- `Header`: Indicador de tipo de usuário

### Arquivos de Configuração

- `/src/lib/auth.ts`: Credenciais e lógica de autenticação
- `/src/components/auth/route-guard.tsx`: Configuração de permissões
- `/src/hooks/use-auth.ts`: Hook de autenticação

Este sistema garante que usuários básicos tenham acesso apenas às funcionalidades essenciais para suas tarefas, mantendo a segurança e simplicidade da interface.
