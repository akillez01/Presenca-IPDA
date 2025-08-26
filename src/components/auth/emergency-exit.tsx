'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { ArrowLeft, Home, LogOut, RefreshCw, ShieldX, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface EmergencyExitProps {
  title?: string;
  message?: string;
  userEmail?: string;
  autoRedirectSeconds?: number;
}

export function EmergencyExit({ 
  title = "🚨 ACESSO NEGADO - SAÍDA DE EMERGÊNCIA",
  message = "Você não tem permissão para acessar esta área. Múltiplas opções de saída disponíveis.",
  userEmail,
  autoRedirectSeconds = 3
}: EmergencyExitProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const [countdown, setCountdown] = useState(autoRedirectSeconds);
  const [isExecuting, setIsExecuting] = useState(false);
  const [attemptedMethods, setAttemptedMethods] = useState<string[]>([]);

  // Auto-redirect forçado
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          forceExit('auto');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Função de saída forçada com múltiplas estratégias
  const forceExit = async (method: string) => {
    setIsExecuting(true);
    setAttemptedMethods(prev => [...prev, method]);

    try {
      // Estratégia 1: Redirecionamento imediato via window.location
      if (method === 'force-home' || method === 'auto') {
        console.log(`🚨 Tentando saída forçada via: ${method}`);
        window.location.replace('/');
        return;
      }

      // Estratégia 2: Logout + redirecionamento
      if (method === 'logout') {
        console.log('🚨 Tentando logout + redirecionamento');
        await logout();
        setTimeout(() => window.location.replace('/'), 500);
        return;
      }

      // Estratégia 3: Voltar na história + fallback
      if (method === 'back') {
        console.log('🚨 Tentando voltar na história');
        if (window.history.length > 1) {
          router.back();
          // Fallback após 2 segundos
          setTimeout(() => {
            if (window.location.pathname.includes('admin')) {
              window.location.replace('/');
            }
          }, 2000);
        } else {
          window.location.replace('/');
        }
        return;
      }

      // Estratégia 4: Reload completo
      if (method === 'reload') {
        console.log('🚨 Tentando reload da página');
        window.location.reload();
        return;
      }

      // Estratégia 5: Abrir nova aba + fechar atual
      if (method === 'new-tab') {
        console.log('🚨 Tentando abrir nova aba');
        window.open('/', '_blank');
        setTimeout(() => window.close(), 1000);
        return;
      }

    } catch (error) {
      console.error(`❌ Erro na estratégia ${method}:`, error);
      // Fallback final - sempre funciona
      setTimeout(() => window.location.replace('/'), 1000);
    }
  };

  // Botão de pânico - múltiplas estratégias simultâneas
  const panicButton = () => {
    console.log('🆘 BOTÃO DE PÂNICO ATIVADO');
    setIsExecuting(true);
    
    // Executar múltiplas estratégias
    forceExit('force-home');
    setTimeout(() => forceExit('logout'), 500);
    setTimeout(() => forceExit('reload'), 1000);
    setTimeout(() => window.location.href = '/', 1500);
  };

  return (
    <div className="fixed inset-0 bg-red-50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-2xl w-full border-red-200 shadow-2xl">
        <CardHeader className="text-center bg-red-100">
          <CardTitle className="flex items-center justify-center gap-2 text-red-700 text-xl">
            <ShieldX className="h-8 w-8" />
            {title}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6 p-6">
          {/* Alerta Principal */}
          <Alert variant="destructive" className="border-red-300">
            <ShieldX className="h-5 w-5" />
            <AlertDescription className="text-base">
              {message}
              {userEmail && (
                <>
                  <br /><br />
                  <strong>👤 Usuário:</strong> {userEmail}
                  <br />
                  <strong>🔒 Perfil:</strong> Usuário Padrão (Sem Permissão Admin)
                </>
              )}
            </AlertDescription>
          </Alert>

          {/* Countdown */}
          <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-700 mb-2">
              ⏰ Auto-Redirecionamento: {countdown}s
            </div>
            <p className="text-sm text-yellow-600">
              Você será redirecionado automaticamente para a página inicial
            </p>
          </div>

          {/* Botões de Saída de Emergência */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center text-gray-800">
              🚪 OPÇÕES DE SAÍDA DE EMERGÊNCIA
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Saída Forçada */}
              <Button 
                onClick={() => forceExit('force-home')} 
                className="h-14 text-base bg-green-600 hover:bg-green-700"
                disabled={isExecuting}
              >
                {isExecuting ? (
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Home className="h-5 w-5 mr-2" />
                )}
                🏠 SAÍDA FORÇADA (Principal)
              </Button>

              {/* Voltar */}
              <Button 
                onClick={() => forceExit('back')} 
                variant="outline" 
                className="h-14 text-base border-blue-300 hover:bg-blue-50"
                disabled={isExecuting}
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                ⬅️ VOLTAR (Seguro)
              </Button>

              {/* Logout */}
              <Button 
                onClick={() => forceExit('logout')} 
                variant="secondary" 
                className="h-14 text-base"
                disabled={isExecuting}
              >
                <LogOut className="h-5 w-5 mr-2" />
                🚪 LOGOUT + SAIR
              </Button>

              {/* Recarregar */}
              <Button 
                onClick={() => forceExit('reload')} 
                variant="outline" 
                className="h-14 text-base border-purple-300 hover:bg-purple-50"
                disabled={isExecuting}
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                🔄 RECARREGAR TUDO
              </Button>
            </div>

            {/* Botão de Pânico */}
            <div className="pt-4 border-t border-gray-200">
              <Button 
                onClick={panicButton}
                variant="destructive"
                className="w-full h-16 text-lg font-bold animate-pulse"
                disabled={isExecuting}
              >
                <Zap className="h-6 w-6 mr-3" />
                🆘 BOTÃO DE PÂNICO - SAIR AGORA!
              </Button>
              <p className="text-xs text-center text-red-600 mt-2">
                ↑ Use este botão se nada mais funcionar ↑
              </p>
            </div>
          </div>

          {/* Status de Tentativas */}
          {attemptedMethods.length > 0 && (
            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <h4 className="text-sm font-medium text-blue-800 mb-1">
                🔧 Métodos Tentados:
              </h4>
              <div className="text-xs text-blue-600">
                {attemptedMethods.map((method, index) => (
                  <span key={index} className="inline-block bg-blue-100 px-2 py-1 rounded mr-1 mb-1">
                    {method}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Informações de Ajuda */}
          <div className="text-center text-xs text-gray-500 space-y-1 pt-4 border-t border-gray-200">
            <p><strong>💡 Dica:</strong> Se todos os botões falharem, feche o navegador e abra novamente</p>
            <p><strong>📞 Suporte:</strong> Entre em contato com o administrador se o problema persistir</p>
            <p><strong>⚡ Sistema:</strong> IPDA - Controle de Presença v2.0 - Agosto 2025</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente simplificado para uso rápido
export function AccessDeniedEmergency() {
  const { user } = useAuth();
  
  return (
    <EmergencyExit
      userEmail={user?.email || undefined}
      autoRedirectSeconds={3}
    />
  );
}
