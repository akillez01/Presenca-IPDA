/*
🆘 SCRIPT DE EMERGÊNCIA - RECOVERY IPDA
================================================================

Se você está preso em uma página e não consegue sair, 
copie e cole este código INTEIRO no console do navegador:

Como usar:
1. Pressione F12 (ou Ctrl+Shift+I) para abrir o DevTools
2. Vá para a aba "Console"
3. Cole todo este código e pressione Enter
4. O sistema tentará te levar de volta ao início

================================================================
*/

console.log('🚨 INICIANDO SCRIPT DE EMERGÊNCIA IPDA');

// Função principal de recuperação
function emergencyRecovery() {
    console.log('🔧 Executando recuperação de emergência...');
    
    // 1. Limpar todos os dados armazenados
    try {
        localStorage.clear();
        sessionStorage.clear();
        console.log('✅ Storage limpo');
    } catch (e) {
        console.log('⚠️ Erro ao limpar storage:', e);
    }

    // 2. Tentar remover service workers se existirem
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for(let registration of registrations) {
                registration.unregister();
            }
            console.log('✅ Service workers removidos');
        }).catch(e => console.log('⚠️ Erro ao limpar service workers:', e));
    }

    // 3. Sequência de redirecionamentos com delays
    const redirectMethods = [
        { method: () => window.location = '/', name: 'window.location direct' },
        { method: () => window.location.replace('/'), name: 'window.location.replace' },
        { method: () => window.location.href = '/', name: 'window.location.href' },
        { method: () => window.location.assign('/'), name: 'window.location.assign' },
        { method: () => window.open('/', '_self'), name: 'window.open _self' },
        { method: () => window.history.replaceState({}, '', '/'), name: 'history.replaceState' }
    ];

    console.log('🔄 Iniciando sequência de redirecionamento...');
    
    redirectMethods.forEach((redirectMethod, index) => {
        setTimeout(() => {
            try {
                console.log(`🎯 Tentativa ${index + 1}: ${redirectMethod.name}`);
                redirectMethod.method();
            } catch (error) {
                console.error(`❌ Falha na tentativa ${index + 1}:`, error);
            }
        }, index * 500); // 500ms entre cada tentativa
    });

    // 4. Último recurso - recarregar a página na raiz após 5 segundos
    setTimeout(() => {
        console.log('🔄 ÚLTIMO RECURSO: Recarregando página...');
        try {
            window.location.replace(window.location.origin + '/');
        } catch (e) {
            window.location.reload();
        }
    }, 5000);
}

// Executar imediatamente
emergencyRecovery();

console.log('✅ Script de emergência executado. Aguarde o redirecionamento...');

// Também disponibilizar uma função global para execução manual
window.emergencyRecovery = emergencyRecovery;

console.log('💡 Para executar novamente, digite: emergencyRecovery()');
