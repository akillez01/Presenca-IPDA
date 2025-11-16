/**
 * Suprimir avisos de hydration causados por extensões do navegador (Dark Reader, etc.)
 * 
 * Extensões como Dark Reader modificam o DOM adicionando atributos style e data-*
 * que não existem no HTML renderizado pelo servidor, causando warnings de hydration.
 * 
 * Esta solução suprime esses avisos específicos sem ocultar erros reais de hydration.
 */
if (typeof window !== 'undefined') {
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Lista de padrões que indicam warnings relacionados a extensões do navegador
  const BROWSER_EXTENSION_PATTERNS = [
    'data-darkreader',
    '--darkreader-inline',
    'darkreader',
    'Hydration failed because the server rendered HTML didn\'t match the client',
    'This can happen if a SSR-ed Client Component used',
  ];
  
  // Função auxiliar para verificar se uma mensagem deve ser suprimida
  const shouldSuppress = (message: any): boolean => {
    if (typeof message !== 'string') return false;
    
    return BROWSER_EXTENSION_PATTERNS.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  };
  
  console.error = (...args) => {
    if (shouldSuppress(args[0])) {
      return;
    }
    originalError.apply(console, args);
  };

  console.warn = (...args) => {
    if (shouldSuppress(args[0])) {
      return;
    }
    originalWarn.apply(console, args);
  };
  
  // Suprimir warnings do React sobre hydration mismatch causado por extensões
  const originalReactWarn = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__?.rendererInterfaces;
  if (originalReactWarn) {
    Object.keys(originalReactWarn).forEach((key) => {
      const renderer = originalReactWarn[key];
      if (renderer && renderer.handleCommitFiberRoot) {
        const originalHandleCommitFiberRoot = renderer.handleCommitFiberRoot;
        renderer.handleCommitFiberRoot = function (id: any, root: any, priorityLevel: any) {
          try {
            originalHandleCommitFiberRoot.call(this, id, root, priorityLevel);
          } catch (err: any) {
            if (!shouldSuppress(err?.message)) {
              throw err;
            }
          }
        };
      }
    });
  }
}

export { };

