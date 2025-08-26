'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Home, LogOut, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function ForceRedirectHome() {
  const router = useRouter();
  const { logout } = useAuth();
  const [countdown, setCountdown] = useState(5);
  const [attempts, setAttempts] = useState(0);

  // Função de redirecionamento com múltiplas tentativas
  const forceGoHome = async () => {
    console.log('🔴 ForceGoHome executando - iniciando sequência de escape');
    
    // Limpar tudo primeiro
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.log('Erro ao limpar storage:', e);
    }

    // Sequência de tentativas de redirecionamento
    const redirectMethods = [
      () => { window.location.replace('/'); },
      () => { window.location.href = '/'; },
      () => { window.location.assign('/'); },
      () => { (window.location as any) = '/'; },
      () => { window.open('/', '_self'); }
    ];

    // Executar todos os métodos em sequência rápida
    for (let i = 0; i < redirectMethods.length; i++) {
      try {
        console.log(`🔄 Tentativa ${i + 1} de redirecionamento`);
        redirectMethods[i]();
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Erro no método ${i + 1}:`, error);
      }
    }

    // Se ainda estiver aqui, tentar logout + redirect
    try {
      console.log('🚪 Tentando logout + redirect');
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };  // Auto-redirect com múltiplas tentativas
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          forceGoHome();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Tentativa imediata de redirecionamento
    setTimeout(() => forceGoHome(), 100);

    return () => clearInterval(timer);
  }, []);

  // Se muitas tentativas falharam, tentar método extremo
  useEffect(() => {
    if (attempts >= 3) {
      console.log('🆘 Muitas tentativas falharam - método extremo');
      setTimeout(() => {
        // Limpeza + redirecionamento forçado
        localStorage.clear();
        sessionStorage.clear();
        window.location = '/' as any;
      }, 1000);
    }
  }, [attempts]);

  return (
    <div className="fixed inset-0 bg-red-900/90 flex items-center justify-center p-4 z-[9999]">
      <Card className="max-w-lg w-full border-red-300 bg-white">
        <CardHeader className="text-center bg-red-100">
          <CardTitle className="text-red-800 text-xl">
            🚨 REDIRECIONANDO PARA INÍCIO
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-6 text-center space-y-6">
          <div className="text-6xl font-bold text-red-600 animate-pulse">
            {countdown}
          </div>
          
          <p className="text-lg">
            Você será redirecionado automaticamente em <strong>{countdown}</strong> segundos
          </p>
          
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Se o redirecionamento não funcionar, clique em uma opção abaixo:
            </p>
            
            <div className="grid gap-3">
              <Button 
                onClick={() => forceGoHome()} 
                size="lg" 
                className="bg-green-600 hover:bg-green-700 text-white h-12"
              >
                <Home className="h-5 w-5 mr-2" />
                🏠 FORÇAR IDA PARA INÍCIO
              </Button>
              
              <Button 
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.reload();
                }} 
                size="lg" 
                variant="outline" 
                className="h-12"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                🔄 RECARREGAR + IR PARA INÍCIO
              </Button>
              
              <Button 
                onClick={async () => {
                  try {
                    await logout();
                    window.location.replace('/');
                  } catch (e) {
                    window.location.replace('/');
                  }
                }} 
                size="lg" 
                variant="secondary" 
                className="h-12"
              >
                <LogOut className="h-5 w-5 mr-2" />
                🚪 LOGOUT + INÍCIO
              </Button>
            </div>
          </div>
          
          {attempts > 0 && (
            <div className="bg-yellow-100 p-3 rounded border border-yellow-300">
              <p className="text-sm text-yellow-800">
                <strong>Tentativas realizadas:</strong> {attempts}
              </p>
            </div>
          )}
          
          <div className="border-t pt-4 text-xs text-gray-500">
            <p><strong>💡 Se nada funcionar:</strong></p>
            <p>1. Feche o navegador completamente</p>
            <p>2. Abra novamente e digite o endereço do site</p>
            <p>3. Ou pressione Ctrl+Shift+Delete para limpar dados</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente que tenta múltiplas estratégias em sequência
export function MultipleRedirectStrategies() {
  const [currentStrategy, setCurrentStrategy] = useState(0);
  
  const strategies = [
    { name: 'window.location.replace', action: () => window.location.replace('/') },
    { name: 'window.location.href', action: () => window.location.href = '/' },
    { name: 'window.location.assign', action: () => window.location.assign('/') },
    { name: 'Full URL replace', action: () => window.location.replace(window.location.origin + '/') },
    { name: 'Force reload at root', action: () => { window.location.replace('/'); window.location.reload(); } }
  ];

  useEffect(() => {
    const tryNextStrategy = () => {
      if (currentStrategy < strategies.length) {
        console.log(`🔄 Tentando estratégia ${currentStrategy + 1}: ${strategies[currentStrategy].name}`);
        try {
          strategies[currentStrategy].action();
        } catch (error) {
          console.error(`❌ Falha na estratégia ${currentStrategy + 1}:`, error);
        }
        setCurrentStrategy(prev => prev + 1);
      }
    };

    // Tentar primeira estratégia imediatamente
    if (currentStrategy === 0) {
      tryNextStrategy();
    }

    // Tentar próxima estratégia após 2 segundos se a anterior falhar
    const timer = setTimeout(tryNextStrategy, 2000);
    
    return () => clearTimeout(timer);
  }, [currentStrategy, strategies]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
      <div className="bg-white p-6 rounded-lg max-w-md text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">Redirecionando...</h2>
        <p className="text-sm text-gray-600 mb-4">
          Tentativa {currentStrategy + 1} de {strategies.length}
        </p>
        {currentStrategy < strategies.length && (
          <p className="text-xs text-blue-600">
            {strategies[currentStrategy]?.name}
          </p>
        )}
      </div>
    </div>
  );
}
