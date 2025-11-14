"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PresencaCadastradosPageDEBUG() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pageState, setPageState] = useState("loading");

  useEffect(() => {
    console.log('🔍 DEBUG Page - useEffect executado:', { user: !!user, loading });
    
    if (loading) {
      setPageState("loading-auth");
      return;
    }
    
    if (!user) {
      console.log('❌ DEBUG Page - Sem usuário, redirecionando para login');
      setPageState("redirecting-login");
      router.replace("/login");
      return;
    }
    
    console.log('✅ DEBUG Page - Usuário autenticado, carregando página');
    setPageState("authenticated");
    
    // Simular carregamento de dados
    setTimeout(() => {
      setPageState("loaded");
    }, 1000);
  }, [user, loading, router]);

  console.log('🔍 DEBUG Page - Render:', { pageState, user: !!user, loading });

  // Mostrar estado de loading
  if (pageState === "loading" || pageState === "loading-auth") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">Carregando...</h2>
          <p className="text-gray-500 mt-2">Verificando autenticação</p>
          <p className="text-sm text-gray-400 mt-4">Estado: {pageState}</p>
        </div>
      </div>
    );
  }

  // Mostrar estado de redirecionamento
  if (pageState === "redirecting-login") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-orange-700">Redirecionando...</h2>
          <p className="text-orange-500 mt-2">Você precisa fazer login</p>
        </div>
      </div>
    );
  }

  // Mostrar estado autenticado
  if (pageState === "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <div className="animate-pulse h-8 w-8 bg-green-500 rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-green-700">Usuário Autenticado!</h2>
          <p className="text-green-500 mt-2">Carregando dados...</p>
        </div>
      </div>
    );
  }

  // Página carregada com sucesso
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header de Sucesso */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center mr-4">
              <span className="text-white font-bold">✓</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-green-800">🎉 PÁGINA FUNCIONANDO!</h1>
              <p className="text-green-600 mt-1">Presença de Cadastrados - Versão DEBUG</p>
            </div>
          </div>
        </div>

        {/* Informações do Usuário */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-800 mb-4">👤 Informações do Usuário</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Email:</strong> {user?.email}</p>
              <p><strong>UID:</strong> {user?.uid}</p>
              <p><strong>Cargo:</strong> {(user as any)?.cargo || 'N/A'}</p>
              <p><strong>Role:</strong> {(user as any)?.role || 'N/A'}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-800 mb-4">📊 Status da Página</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Estado:</strong> <span className="text-green-600 font-semibold">{pageState}</span></p>
              <p><strong>Autenticação:</strong> <span className="text-green-600">✅ OK</span></p>
              <p><strong>Permissões:</strong> <span className="text-green-600">✅ OK</span></p>
              <p><strong>Loading:</strong> {loading ? "Sim" : "Não"}</p>
            </div>
          </div>
        </div>

        {/* Botões de Teste */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="font-semibold text-gray-800 mb-4">🧪 Testes de Navegação</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                console.log('🔄 Testando reload da página...');
                window.location.reload();
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              🔄 Reload Página
            </button>
            
            <button
              onClick={() => {
                console.log('🏠 Navegando para home...');
                router.push('/');
              }}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
            >
              🏠 Ir para Home
            </button>
            
            <button
              onClick={() => {
                console.log('📊 Tentando carregar página original...');
                // Renomear esta página temporariamente
                alert('Esta é a versão DEBUG. A página original estava com problemas.');
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg"
            >
              📋 Versão Original
            </button>
          </div>
        </div>

        {/* Simulação de dados */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-800 mb-4">📋 Simulação: Lista de Presença</h3>
          <div className="text-sm text-gray-600 mb-4">
            Esta é uma versão simplificada para teste. Se esta página funciona, o problema está na implementação original.
          </div>
          
          <div className="bg-gray-50 rounded p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>João Silva</strong><br/>
                CPF: 123.456.789-00<br/>
                Status: <span className="text-green-600">Presente</span>
              </div>
              <div>
                <strong>Maria Santos</strong><br/>
                CPF: 987.654.321-00<br/>
                Status: <span className="text-red-600">Ausente</span>
              </div>
              <div>
                <strong>Pedro Costa</strong><br/>
                CPF: 456.789.123-00<br/>
                Status: <span className="text-green-600">Presente</span>
              </div>
            </div>
          </div>
        </div>

        {/* Logs de Debug */}
        <div className="bg-gray-800 text-white rounded-lg p-4 mt-8">
          <h4 className="font-semibold mb-2">🔍 Logs de Debug</h4>
          <div className="text-xs font-mono">
            <p>✅ Página carregada com sucesso</p>
            <p>✅ Usuário autenticado: {user?.email}</p>
            <p>✅ Estado final: {pageState}</p>
            <p>✅ Timestamp: {new Date().toLocaleString()}</p>
            <p>✅ URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}