# 🔍 GUIA DE TESTE MANUAL PARA RESOLVER A ABA DE PRESENÇA

## ✅ ETAPA 1: Verificar se o servidor está rodando

1. Abra o terminal
2. Execute: `cd /home/achilles/Documentos/Projetos2025/Presen-a-IPDA/Presen-a-IPDA && npm run dev`
3. Aguarde aparecer: `Ready in XXXXms`
4. Confirme que mostra: `Local: http://localhost:9002`

## 🌐 ETAPA 2: Testar no navegador

### 2.1 Abrir o navegador

1. Abra o **Firefox** ou **Chrome**
2. Vá para: `http://localhost:9002`

### 2.2 Fazer login

1. Clique em "Entrar" ou vá direto para: `http://localhost:9002/login`
2. **Credenciais para usar:**
   - Email: `admin@ipda.org.br`
   - Senha: definida no arquivo local `credentials.local.json`
3. Clique em "Entrar"

### 2.3 Testar acesso à aba de presença

Após fazer login, teste essas 3 maneiras:

**Método 1:** URL Direta

- Digite na barra de endereços: `http://localhost:9002/presencadecadastrados`
- Pressione Enter

**Método 2:** Menu de navegação

- Procure um menu ou botão "Presença de Cadastrados"
- Clique nele

**Método 3:** Página inicial

- Vá para `http://localhost:9002`
- Procure links ou botões para acessar a funcionalidade

## 🔧 ETAPA 3: Debug com F12

Se a página ainda não abrir:

### 3.1 Abrir Console do Navegador

1. Pressione **F12** (ou Ctrl+Shift+I)
2. Clique na aba **Console**
3. Recarregue a página (F5)

### 3.2 Executar Script de Teste

1. No console, cole este código e pressione Enter:

```javascript
// Teste rápido de autenticação
console.log("🔍 Testando autenticação...");
console.log("URL atual:", window.location.href);
console.log("Local Storage:", localStorage.getItem("firebase:authUser:"));
console.log("Session Storage:", sessionStorage.getItem("firebase:authUser:"));

// Tentar ir para presença
setTimeout(() => {
  window.location.href = "/presencadecadastrados";
}, 2000);
```

### 3.3 Verificar Erros

Procure por mensagens em **vermelho** no console que indiquem:

- Erros de JavaScript
- Problemas de rede
- Erros de autenticação

## 📋 ETAPA 4: Verificar Status da Aplicação

### 4.1 Página de Teste

1. Vá para: `http://localhost:9002/teste`
2. Verifique se mostra informações do usuário autenticado
3. Anote o que aparece na tela

### 4.2 Rede (Network Tab)

1. No F12, clique na aba **Network**
2. Recarregue a página
3. Procure por requisições que falham (status 404, 500, etc.)

## 🎯 RESULTADOS ESPERADOS

✅ **Se funcionar:**

- Você verá a página com uma tabela de pessoas cadastradas
- Filtros por nome, CPF, região
- Botão de exportar
- Dados carregando (pode demorar alguns segundos)

❌ **Se não funcionar:**

- Página em branco
- Erro de carregamento
- Redirecionamento para login
- Mensagens de erro no console

## 📞 REPORTAR RESULTADOS

Depois de testar, me informe:

1. **Conseguiu fazer login?** (Sim/Não)
2. **Qual método funcionou?** (URL direta, menu, página inicial, nenhum)
3. **O que aparece no console F12?** (copie as mensagens)
4. **A página de teste funciona?** (`/teste`)
5. **Há erros na aba Network?**

---

💡 **DICA:** Se nada funcionar, tente limpar o cache do navegador:

- Ctrl+Shift+Delete → Limpar dados de navegação
- Ou modo incógnito: Ctrl+Shift+N
