'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { ArrowLeft, Home, LogOut, RefreshCw, ShieldX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface AccessDeniedPageProps {
  title?: string;
  message?: string;
  userEmail?: string;
  showAutoRedirect?: boolean;
}

export function AccessDeniedPage({ 
  title = "Acesso Negado",
  message = "Você não tem permissão para acessar esta página.",
  userEmail,
  showAutoRedirect = false
}: AccessDeniedPageProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleNavigation = async (action: 'home' | 'back' | 'logout' | 'refresh') => {
    setIsLoading(true);
    
    try {
      switch (action) {
        case 'home':
          window.location.href = '/';
          break;
        case 'back':
          if (window.history.length > 1) {
            router.back();
          } else {
            window.location.href = '/';
          }
          break;
        case 'logout':
          await logout();
          window.location.href = '/';
          break;
        case 'refresh':
          window.location.reload();
          break;
      }
    } catch (error) {
      console.error('Erro na navegação:', error);
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-lg mx-auto w-full">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-red-600 text-xl">
            <ShieldX className="h-6 w-6" />
            {title}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <ShieldX className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {message}
              {userEmail && (
                <>
                  <br /><br />
                  <strong>Usuário logado:</strong> {userEmail}
                  <br />
                  <strong>Perfil:</strong> Usuário Padrão
                </>
              )}
              {showAutoRedirect && (
                <>
                  <br /><br />
                  <small className="text-muted-foreground">
                    ⏱️ Redirecionamento automático em andamento...
                  </small>
                </>
              )}
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center font-medium">
              🚪 Opções de Saída - Escolha uma:
            </p>
            
            <div className="grid grid-cols-1 gap-2">
              <Button 
                onClick={() => handleNavigation('home')} 
                className="gap-2 h-12 text-base"
                disabled={isLoading}
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Home className="h-4 w-4" />
                )}
                Página Inicial (Seguro)
              </Button>
              
              <Button 
                onClick={() => handleNavigation('back')} 
                variant="outline" 
                className="gap-2 h-12 text-base"
                disabled={isLoading}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar à Página Anterior
              </Button>
              
              <Button 
                onClick={() => handleNavigation('logout')} 
                variant="secondary" 
                className="gap-2 h-12 text-base"
                disabled={isLoading}
              >
                <LogOut className="h-4 w-4" />
                Fazer Logout e Voltar
              </Button>
              
              <Button 
                onClick={() => handleNavigation('refresh')} 
                variant="ghost" 
                className="gap-2 h-12 text-base border"
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar Página
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              💡 Se continuar com problemas, entre em contato com o administrador do sistema.
              <br />
              <strong>Versão:</strong> IPDA Sistema v1.0 - Agosto 2025
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente de uso rápido para páginas bloqueadas
export function AccessDeniedQuick() {
  const { user } = useAuth();
  
  return (
    <AccessDeniedPage
      title="🚫 Acesso Restrito"
      message="Esta área é restrita para super usuários. Você será redirecionado automaticamente."
      userEmail={user?.email || undefined}
      showAutoRedirect={true}
    />
  );
}
