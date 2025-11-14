'use client';

import { useAuth } from '@/hooks/use-auth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
}

const LoadingScreen = ({ message }: { message: string }) => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] mx-auto mb-4 text-primary" role="status">
        <span className="sr-only">Carregando...</span>
      </div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  </div>
);

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

  // Durante a hidratação, sempre mostrar loading para evitar diferenças servidor/cliente
  if (!mounted) {
    return <LoadingScreen message="Inicializando..." />;
  }

  // Durante o loading de autenticação
  if (loading) {
    return <LoadingScreen message="Verificando autenticação..." />;
  }

  // Se temos um usuário autenticado, permitir acesso
  if (user) {
    return <>{children}</>;
  }

  // Se não há usuário e não estamos na página de login, mostrar loading enquanto redireciona
  if (!user && pathname !== '/login' && pathname !== '/login/') {
    return <LoadingScreen message="Redirecionando para login..." />;
  }

  // Se estiver na página de login e não tem usuário, permitir acesso
  return <>{children}</>;
}
