'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserManagement } from '@/hooks/use-user-management';
import { UserRole } from '@/lib/types';
import {
    AlertTriangle,
    CheckCircle,
    Database,
    RefreshCw,
    Shield,
    Users,
    UserX
} from 'lucide-react';
import { useState } from 'react';

export function UserManagementPanel() {
  const {
    users,
    isLoading,
    error,
    canManageUsers,
    fetchUsers,
    updateUserRole,
    toggleUserStatus,
    getUserStats,
    checkUserInconsistencies
  } = useUserManagement();

  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const stats = getUserStats();
  const inconsistencies = checkUserInconsistencies();

  const handleRoleUpdate = async (userId: string, newRole: UserRole) => {
    setUpdatingUser(userId);
    try {
      await updateUserRole(userId, newRole);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleStatusToggle = async (userId: string, active: boolean) => {
    setUpdatingUser(userId);
    try {
      await toggleUserStatus(userId, active);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setUpdatingUser(null);
    }
  };

  if (!canManageUsers) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <Shield className="h-5 w-5" />
              <span>Acesso negado. Apenas administradores podem gerenciar usuários.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'editor': return 'bg-blue-100 text-blue-800';
      case 'moderator': return 'bg-purple-100 text-purple-800';
      case 'user': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">
            Controle de roles, permissões e status dos usuários
          </p>
        </div>
        
        <Button onClick={fetchUsers} disabled={isLoading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="h-4 w-4 mr-2 text-blue-600" />
              Total de Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
              Usuários Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <UserX className="h-4 w-4 mr-2 text-red-600" />
              Usuários Inativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.inactive}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 text-yellow-600" />
              Inconsistências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{inconsistencies.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Inconsistências Detectadas */}
      {inconsistencies.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Inconsistências Detectadas
            </CardTitle>
            <CardDescription>
              Os seguintes usuários possuem problemas na estrutura de dados:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inconsistencies.map((issue, index) => (
                <div key={index} className="p-3 bg-white rounded border">
                  <div className="font-medium text-sm">{issue.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {issue.issues.join(', ')}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button variant="outline" className="text-yellow-700 border-yellow-300">
                <Database className="h-4 w-4 mr-2" />
                Executar Migração Automática
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Usuários */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>
            Todos os usuários registrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.uid} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="font-medium">{user.displayName}</span>
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                    <span className="text-xs text-muted-foreground">
                      Criado: {user.createdAt?.toLocaleDateString?.() || 'N/A'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge className={getRoleBadgeColor(user.role)}>
                      {user.role}
                    </Badge>
                    
                    {user.active ? (
                      <Badge className="bg-green-100 text-green-800">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">
                        Inativo
                      </Badge>
                    )}

                    {user.userType && (
                      <Badge variant="outline" className="text-xs">
                        {user.userType}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Alterar Role */}
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleUpdate(user.uid, e.target.value as UserRole)}
                    disabled={updatingUser === user.uid}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="user">Usuário</option>
                    <option value="moderator">Moderador</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>

                  {/* Toggle Status */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusToggle(user.uid, !user.active)}
                    disabled={updatingUser === user.uid}
                  >
                    {updatingUser === user.uid ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : user.active ? (
                      <UserX className="h-4 w-4" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Distribuição por Role */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Role</CardTitle>
          <CardDescription>
            Quantidade de usuários por nível de acesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.byRole).map(([role, count]) => (
              <div key={role} className="text-center p-4 border rounded">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-muted-foreground capitalize">{role}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}