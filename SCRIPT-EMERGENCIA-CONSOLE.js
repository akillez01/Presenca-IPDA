// 🆘 SCRIPT DE EMERGÊNCIA - COLE NO CONSOLE DO NAVEGADOR
// Pressione F12 para abrir o console, cole este código e pressione Enter

console.log('🆘 SCRIPT DE EMERGÊNCIA EXECUTANDO...');

// Função de escape absoluto
function escapeAbsoluto() {
    console.log('🚨 EXECUTANDO ESCAPE ABSOLUTO');
    
    // 1. Parar tudo que está carregando
    try {
        window.stop();
    } catch (e) {
        console.log('window.stop falhou:', e);
    }
    
    // 2. Limpar TUDO
    try {
        localStorage.clear();
        sessionStorage.clear();
        console.log('✅ Storage limpo');
    } catch (e) {
        console.error('Erro ao limpar storage:', e);
    }
    
    // 3. Tentar limpar IndexedDB do Firebase
    try {
        if ('indexedDB' in window) {
            indexedDB.deleteDatabase('firebaseLocalStorageDb');
            console.log('✅ IndexedDB limpo');
        }
    } catch (e) {
        console.error('Erro ao limpar IndexedDB:', e);
    }
    
    // 4. Múltiplas tentativas de redirecionamento
    const redirectMethods = [
        () => { window.location = 'http://localhost:9002/' },
        () => { window.location.replace('http://localhost:9002/') },
        () => { window.location.href = 'http://localhost:9002/' },
        () => { window.location.assign('http://localhost:9002/') },
        () => { window.open('http://localhost:9002/', '_self') },
        () => { window.history.go(-10); setTimeout(() => window.location.replace('/'), 1000); }
    ];
    
    // Executar todos os métodos
    redirectMethods.forEach((method, index) => {
        setTimeout(() => {
            try {
                console.log(`🔄 Tentativa ${index + 1} de redirecionamento`);
                method();
            } catch (error) {
                console.error(`❌ Falha na tentativa ${index + 1}:`, error);
            }
        }, index * 500); // 500ms entre cada tentativa
    });
    
    // Último recurso - recarregar após 5 segundos
    setTimeout(() => {
        console.log('🔄 ÚLTIMO RECURSO - RECARREGANDO PÁGINA');
        window.location.reload();
    }, 5000);
}

// Executar imediatamente
escapeAbsoluto();

console.log('🆘 SCRIPT DE EMERGÊNCIA EXECUTADO');
console.log('📋 INSTRUÇÕES:');
console.log('1. Se não funcionar, feche TODAS as abas do navegador');
console.log('2. Abra um novo navegador');
console.log('3. Digite: http://localhost:9002/');
console.log('4. Se ainda não funcionar, reinicie o servidor (Ctrl+C no terminal e npm run dev)');
