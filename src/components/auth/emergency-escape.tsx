'use client';

import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

// COMPONENTE DE EMERGÊNCIA - ESCAPE TOTAL
export function EmergencyEscape() {
  
  // Função de escape ABSOLUTO
  const absoluteEscape = () => {
    console.log('🆘 ESCAPE ABSOLUTO ATIVADO');
    
    // Limpar TUDO
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('firebaseLocalStorageDb');
      }
    } catch (e) {
      console.log('Erro limpeza:', e);
    }

    // FORÇA BRUTA - ir para raiz
    try {
      window.stop(); // Para qualquer carregamento
      window.location = 'http://localhost:9002/' as any;
    } catch (e) {
      try {
        window.location.replace('http://localhost:9002/');
      } catch (e2) {
        try {
          window.location.href = 'http://localhost:9002/';
        } catch (e3) {
          // Último recurso - recarregar página
          window.location.reload();
        }
      }
    }
  };

  // Executar escape automaticamente após 2 segundos
  useEffect(() => {
    console.log('🚨 COMPONENTE DE EMERGÊNCIA MONTADO');
    
    // Escape imediato
    const immediateTimer = setTimeout(() => {
      console.log('🚨 EXECUTANDO ESCAPE IMEDIATO');
      absoluteEscape();
    }, 100);

    // Escape de backup
    const backupTimer = setTimeout(() => {
      console.log('🚨 EXECUTANDO ESCAPE DE BACKUP');
      absoluteEscape();
    }, 2000);

    return () => {
      clearTimeout(immediateTimer);
      clearTimeout(backupTimer);
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-red-600 flex items-center justify-center z-[99999]"
      style={{ zIndex: 99999 }}
    >
      <div className="bg-white p-8 rounded-lg max-w-sm text-center shadow-2xl">
        <div className="text-6xl mb-4">🆘</div>
        <h1 className="text-xl font-bold text-red-800 mb-4">
          ESCAPE DE EMERGÊNCIA
        </h1>
        <p className="text-sm mb-6">
          Redirecionando automaticamente...
        </p>
        
        <div className="space-y-2">
          <Button 
            onClick={absoluteEscape}
            className="w-full bg-red-600 hover:bg-red-700 text-white text-lg py-3"
          >
            🏠 FORÇAR SAÍDA AGORA
          </Button>
          
          <Button 
            onClick={() => {
              window.location.reload();
            }}
            variant="outline"
            className="w-full"
          >
            🔄 RECARREGAR PÁGINA
          </Button>
          
          <Button 
            onClick={() => {
              window.history.go(-10); // Volta 10 páginas no histórico
              setTimeout(() => window.location.replace('/'), 1000);
            }}
            variant="secondary"
            className="w-full"
          >
            ⬅️ VOLTAR NO HISTÓRICO
          </Button>
        </div>
        
        <div className="mt-4 text-xs text-gray-600">
          <p>Se nada funcionar, feche o navegador e abra novamente</p>
        </div>
      </div>
    </div>
  );
}
