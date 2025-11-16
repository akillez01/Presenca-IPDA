"use client"

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const dynamic = 'force-dynamic';

export default function TestePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (!mounted || loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Carregando...</h1>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Redirecionando para login...</h1>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white min-h-screen">
      <h1 className="text-3xl font-bold text-green-600 mb-8">✅ PÁGINA FUNCIONANDO!</h1>
      
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">👤 Informações do Usuário</h2>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>UID:</strong> {user.uid}</p>
        <p><strong>Nome:</strong> {user.displayName || 'N/A'}</p>
      </div>

      <div className="bg-green-50 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">🎯 Status do Sistema</h2>
        <p>✅ Autenticação: <strong>FUNCIONANDO</strong></p>
        <p>✅ Firebase: <strong>CONECTADO</strong></p>
        <p>✅ Página: <strong>CARREGADA</strong></p>
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">🔗 Links de Teste</h2>
        <div className="space-y-2">
          <a 
            href="/presencadecadastrados" 
            className="block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            🎯 Acessar Presença de Cadastrados
          </a>
          <a 
            href="/" 
            className="block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            🏠 Ir para Dashboard
          </a>
        </div>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">🔧 Debug Info</h2>
        <pre className="text-sm bg-white p-3 rounded border overflow-auto">
{JSON.stringify({
  user: {
    email: user.email,
    uid: user.uid,
    authenticated: !!user
  },
  loading,
  mounted,
  timestamp: new Date().toISOString()
}, null, 2)}
        </pre>
      </div>
    </div>
  );
}