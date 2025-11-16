"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default function PageSimples() {
  const { user, loading } = useAuth();

  return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>🎯 Sistema IPDA - Teste de Navegação</CardTitle>
              <CardDescription>
                Página simplificada para testar a navegação para presença de cadastrados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status do usuário */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">👤 Status do Usuário</h3>
                {loading ? (
                  <p className="text-blue-700">Carregando informações do usuário...</p>
                ) : user ? (
                  <div className="text-blue-700">
                    <p>✅ <strong>Logado como:</strong> {user.email}</p>
                    <p>🔑 <strong>Cargo:</strong> {user.cargo || 'N/A'}</p>
                    <p>👥 <strong>Role:</strong> {user.role || 'N/A'}</p>
                  </div>
                ) : (
                  <p className="text-red-700">❌ Usuário não autenticado</p>
                )}
              </div>

              {/* Navegação */}
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-4">🧭 Navegação</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Botão principal - Presença de Cadastrados */}
                  <Link href="/presencadecadastrados" className="block">
                    <Button className="w-full h-16 text-lg bg-green-600 hover:bg-green-700">
                      📋 Presença de Cadastrados (Link)
                    </Button>
                  </Link>

                  {/* Botão alternativo - JavaScript direto */}
                  <Button 
                    onClick={() => {
                      console.log('🔄 Navegando para /presencadecadastrados via JavaScript...');
                      window.location.href = '/presencadecadastrados';
                    }}
                    className="w-full h-16 text-lg bg-blue-600 hover:bg-blue-700"
                  >
                    🚀 Presença de Cadastrados (JS)
                  </Button>

                  {/* Botão de teste */}
                  <Link href="/teste">
                    <Button variant="outline" className="w-full h-16 text-lg">
                      🔧 Página de Teste
                    </Button>
                  </Link>

                  {/* Botão para dashboard completo */}
                  <Link href="/dashboard">
                    <Button variant="outline" className="w-full h-16 text-lg">
                      📊 Dashboard Completo
                    </Button>
                  </Link>

                  {/* Botão para login */}
                  <Link href="/login">
                    <Button variant="outline" className="w-full h-16 text-lg">
                      🔑 Página de Login
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Teste direto com JavaScript */}
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="font-semibold text-yellow-900 mb-4">⚡ Teste JavaScript</h3>
                <Button 
                  onClick={() => {
                    console.log('🚀 Navegando para /presencadecadastrados via JavaScript...');
                    window.location.href = '/presencadecadastrados';
                  }}
                  className="w-full bg-yellow-600 hover:bg-yellow-700"
                >
                  🔗 Ir para Presença (JavaScript)
                </Button>
              </div>

              {/* Informações do sistema */}
              <div className="bg-gray-100 p-4 rounded-lg text-sm">
                <h3 className="font-semibold text-gray-900 mb-2">ℹ️ Informações do Sistema</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-700">
                  <p><strong>URL Atual:</strong> {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
                  <p><strong>Timestamp:</strong> {new Date().toLocaleString()}</p>
                  <p><strong>User Agent:</strong> {typeof window !== 'undefined' ? navigator.userAgent.substring(0, 50) + '...' : 'N/A'}</p>
                  <p><strong>Loading:</strong> {loading ? 'Sim' : 'Não'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}