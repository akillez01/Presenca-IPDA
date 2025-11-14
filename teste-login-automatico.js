// Script para testar login automático e verificar a aba de presença
console.log('🔍 Iniciando teste de login automático...');

// Verificar se estamos na página de login
if (window.location.pathname === '/login' || window.location.pathname === '/login/') {
  console.log('📍 Estamos na página de login');
  
  // Aguardar a página carregar
  setTimeout(async () => {
    try {
      // Encontrar os campos de email e senha
      const emailInput = document.querySelector('input[type="email"], input[name="email"]');
      const passwordInput = document.querySelector('input[type="password"], input[name="password"]');
      const loginButton = document.querySelector('button[type="submit"], button:contains("Entrar")');
      
      if (emailInput && passwordInput && loginButton) {
        console.log('✅ Campos de login encontrados');
        
        // Preencher credenciais
        emailInput.value = 'admin@ipda.org.br';
        passwordInput.value = 'IPDA@2025Admin';
        
        // Simular eventos de input para React
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        console.log('✅ Credenciais preenchidas');
        
        // Aguardar um pouco e fazer login
        setTimeout(() => {
          loginButton.click();
          console.log('🔑 Botão de login clicado');
          
          // Aguardar redirecionamento e testar acesso à página de presença
          setTimeout(() => {
            console.log('🔄 Testando acesso à página de presença...');
            window.location.href = '/presencadecadastrados';
          }, 3000);
        }, 1000);
      } else {
        console.error('❌ Campos de login não encontrados');
        console.log('🔍 Campos disponíveis:', {
          emailInput: !!emailInput,
          passwordInput: !!passwordInput,
          loginButton: !!loginButton
        });
      }
    } catch (error) {
      console.error('❌ Erro no teste automático:', error);
    }
  }, 2000);
} else {
  console.log('📍 Não estamos na página de login. Redirecionando...');
  window.location.href = '/login';
}

// Verificar se conseguimos acessar a página de presença após 10 segundos
setTimeout(() => {
  if (window.location.pathname === '/presencadecadastrados') {
    console.log('🎉 SUCESSO! Conseguimos acessar a aba de presença de cadastrados!');
    console.log('📊 Status da página:', {
      url: window.location.href,
      title: document.title,
      loaded: document.readyState
    });
  } else {
    console.log('❌ Ainda não conseguimos acessar a aba de presença');
    console.log('📍 Página atual:', window.location.pathname);
  }
}, 10000);