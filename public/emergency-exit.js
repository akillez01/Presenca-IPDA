// Script de emergência para limpar estado do navegador
// Execute no console do navegador se ficar preso na página

(function emergencyCleaner() {
  console.log('🆘 INICIANDO LIMPEZA DE EMERGÊNCIA DO NAVEGADOR');
  
  try {
    // 1. Limpar localStorage
    localStorage.clear();
    console.log('✅ localStorage limpo');
    
    // 2. Limpar sessionStorage
    sessionStorage.clear();
    console.log('✅ sessionStorage limpo');
    
    // 3. Limpar cookies relacionados ao Firebase
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    console.log('✅ Cookies limpos');
    
    // 4. Forçar redirecionamento múltiplo
    console.log('🔄 Tentando redirecionamentos múltiplos...');
    
    setTimeout(() => {
      console.log('Tentativa 1: window.location.replace');
      window.location.replace('/');
    }, 100);
    
    setTimeout(() => {
      console.log('Tentativa 2: window.location.href');  
      window.location.href = '/';
    }, 500);
    
    setTimeout(() => {
      console.log('Tentativa 3: window.location.assign');
      window.location.assign('/');
    }, 1000);
    
    setTimeout(() => {
      console.log('Tentativa 4: Recarregar página');
      window.location.reload(true);
    }, 1500);
    
    setTimeout(() => {
      console.log('Tentativa 5: Abrir nova aba + fechar atual');
      window.open('/', '_blank');
      window.close();
    }, 2000);
    
    console.log('🎯 Limpeza iniciada - aguarde redirecionamento...');
    
  } catch (error) {
    console.error('❌ Erro na limpeza de emergência:', error);
    // Fallback final
    window.location = '/';
  }
})();

// Função adicional para executar manualmente
window.forceExit = function() {
  console.log('🚨 FORÇA DE SAÍDA ATIVADA');
  localStorage.clear();
  sessionStorage.clear();
  window.location.replace('/');
};

console.log(`
🆘 COMANDOS DE EMERGÊNCIA DISPONÍVEIS:

1. Execute: forceExit()
2. Feche o navegador e abra novamente
3. Ctrl+Shift+Delete para limpar dados
4. Modo incógnito/privado

Se NADA funcionar:
- Reinicie o computador
- Use outro navegador
- Contate o administrador
`);
