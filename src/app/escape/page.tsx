'use client';

import { useEffect } from 'react';

export default function EscapePage() {
  useEffect(() => {
    console.log('🆘 PÁGINA DE ESCAPE CARREGADA');
    
    // Limpar tudo
    localStorage.clear();
    sessionStorage.clear();
    
    // Redirecionar para home após limpeza
    setTimeout(() => {
      window.location.replace('/');
    }, 1000);
  }, []);

  return (
    <div className="min-h-screen bg-red-600 flex items-center justify-center text-white">
      <div className="text-center">
        <div className="text-6xl mb-4">🆘</div>
        <h1 className="text-2xl font-bold mb-4">Página de Escape</h1>
        <p>Limpando dados e redirecionando...</p>
      </div>
    </div>
  );
}
