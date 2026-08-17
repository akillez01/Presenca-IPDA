'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const DEBUG = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG === 'true';

interface AuthGuardProps {
  children: React.ReactNode;
}

// Rotas acessíveis sem estar logado / sem gate de aprovação.
const PUBLIC_AUTH_PATHS = ['/login', '/sede-estadual/acesso'];

function isPublicAuthPath(pathname: string) {
  return PUBLIC_AUTH_PATHS.some((path) => pathname === path || pathname === `${path}/`);
}

const LoadingScreen = ({ message }: { message: string }) => {
  return (
    <div className="min-h-screen flex items-center justify-center" suppressHydrationWarning>
      <div className="text-center" suppressHydrationWarning>
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] mx-auto mb-4 text-primary" role="status">
          <span className="sr-only">Carregando...</span>
        </div>
        <p className="text-muted-foreground" suppressHydrationWarning>{message}</p>
      </div>
    </div>
  );
};

const PendingApprovalScreen = ({ status, onLogout }: { status: 'pendente' | 'reprovado'; onLogout: () => void }) => {
  const isRejected = status === 'reprovado';
  return (
    <div className="min-h-screen flex items-center justify-center p-4" suppressHydrationWarning>
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-800">
          {isRejected ? 'Acesso não liberado' : 'Cadastro aguardando aprovação'}
        </h2>
        <p className="text-gray-600">
          {isRejected
            ? 'Sua solicitação de acesso não foi aprovada. Fale com um administrador para mais detalhes.'
            : 'Sua conta foi criada, mas ainda precisa ser liberada por um administrador. Tente novamente mais tarde.'}
        </p>
        <Button onClick={onLogout}>Sair</Button>
      </div>
    </div>
  );
};

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // Effect para marcar quando o componente foi montado no cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  // Effect para redirecionamento - apenas no cliente
  useEffect(() => {
    if (mounted && !loading && !user && pathname && !isPublicAuthPath(pathname)) {
      router.push('/login');
    }
  }, [mounted, loading, user, pathname, router]);

  // Consolidar renderização em um único bloco para minimizar diferença de árvore para hidratação
  const publicPath = !!pathname && isPublicAuthPath(pathname);
  const shouldShowLoading = !mounted || loading || (!user && !publicPath);
  if (DEBUG) {
    // Log leve para estados
    console.log('🔒 AuthGuard State:', { mounted, loading, hasUser: !!user, pathname, shouldShowLoading });
  }

  if (shouldShowLoading) {
    return (
      <LoadingScreen
        message={!mounted ? 'Inicializando...' : loading ? 'Verificando autenticação...' : 'Redirecionando para login...'}
      />
    );
  }

  // Conta autenticada mas ainda não aprovada por um administrador: bloqueia o app inteiro,
  // exceto nas páginas públicas de login/solicitação (para não interromper o fluxo de cadastro).
  if (user && !publicPath && (user.status === 'pendente' || user.status === 'reprovado')) {
    return <PendingApprovalScreen status={user.status} onLogout={logout} />;
  }

  return <>{children}</>;
}
