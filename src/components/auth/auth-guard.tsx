'use client';

import { useAuth } from '@/hooks/use-auth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const DEBUG = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG === 'true';

interface AuthGuardProps {
  children: React.ReactNode;
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

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // Effect para marcar quando o componente foi montado no cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  // Effect para redirecionamento - apenas no cliente
  useEffect(() => {
    if (mounted && !loading && !user && pathname !== '/login' && pathname !== '/login/') {
      router.push('/login');
    }
  }, [mounted, loading, user, pathname, router]);

  // Consolidar renderização em um único bloco para minimizar diferença de árvore para hidratação
  const shouldShowLoading = !mounted || loading || (!user && pathname !== '/login' && pathname !== '/login/');
  if (DEBUG) {
    // Log leve para estados
    console.log('🔒 AuthGuard State:', { mounted, loading, hasUser: !!user, pathname, shouldShowLoading });
  }
  return shouldShowLoading ? <LoadingScreen message={!mounted ? 'Inicializando...' : loading ? 'Verificando autenticação...' : 'Redirecionando para login...'} /> : <>{children}</>;
}
