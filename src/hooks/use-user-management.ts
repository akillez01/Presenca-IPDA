'use client';

import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { User, UserRole } from '@/lib/types';
import {
    addDoc,
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

export function useUserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificar se o usuário atual pode gerenciar outros usuários
  const canManageUsers = user?.email === 'admin@ipda.org.br' || 
                        user?.email === 'marciodesk@ipda.app.br';

  // Buscar todos os usuários
  const fetchUsers = useCallback(async () => {
    if (!canManageUsers) {
      setError('Sem permissão para gerenciar usuários');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const usersQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(usersQuery);
      const userList: User[] = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        userList.push({
          uid: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt || Date.now()),
          lastUpdated: data.lastUpdated?.toDate?.() || new Date(data.lastUpdated || Date.now())
        } as User);
      });
      
      setUsers(userList);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      setError('Erro ao carregar usuários');
    } finally {
      setIsLoading(false);
    }
  }, [canManageUsers]);

  // Atualizar role de um usuário
  const updateUserRole = useCallback(async (userId: string, newRole: UserRole) => {
    if (!canManageUsers) {
      throw new Error('Sem permissão para alterar usuários');
    }

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: newRole,
        lastUpdated: serverTimestamp(),
        updatedBy: user?.email
      });

      // Log da ação
      await addDoc(collection(db, 'audit_logs'), {
        event: 'USER_ROLE_UPDATED',
        timestamp: serverTimestamp(),
        data: {
          targetUserId: userId,
          newRole: newRole,
          updatedBy: user?.email,
          updatedByUid: user?.uid
        }
      });

      // Atualizar estado local
      setUsers(prev => prev.map(u => 
        u.uid === userId 
          ? { ...u, role: newRole, lastUpdated: new Date() }
          : u
      ));

      return { success: true };
    } catch (err) {
      console.error('Erro ao atualizar role:', err);
      throw new Error('Erro ao atualizar permissões do usuário');
    }
  }, [canManageUsers, user]);

  // Ativar/desativar usuário
  const toggleUserStatus = useCallback(async (userId: string, active: boolean) => {
    if (!canManageUsers) {
      throw new Error('Sem permissão para alterar usuários');
    }

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        active: active,
        isActive: active,
        lastUpdated: serverTimestamp(),
        updatedBy: user?.email
      });

      // Log da ação
      await addDoc(collection(db, 'audit_logs'), {
        event: active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        timestamp: serverTimestamp(),
        data: {
          targetUserId: userId,
          newStatus: active,
          updatedBy: user?.email,
          updatedByUid: user?.uid
        }
      });

      // Atualizar estado local
      setUsers(prev => prev.map(u => 
        u.uid === userId 
          ? { ...u, active, isActive: active, lastUpdated: new Date() }
          : u
      ));

      return { success: true };
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      throw new Error('Erro ao alterar status do usuário');
    }
  }, [canManageUsers, user]);

  // Buscar usuários por role
  const getUsersByRole = useCallback((role: UserRole) => {
    return users.filter(u => u.role === role);
  }, [users]);

  // Estatísticas dos usuários
  const getUserStats = useCallback(() => {
    const total = users.length;
    const active = users.filter(u => u.active).length;
    const byRole = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {} as Record<UserRole, number>);

    return {
      total,
      active,
      inactive: total - active,
      byRole
    };
  }, [users]);

  // Verificar inconsistências nos usuários
  const checkUserInconsistencies = useCallback(() => {
    const inconsistencies: Array<{
      userId: string;
      email: string;
      issues: string[];
    }> = [];

    users.forEach(user => {
      const issues: string[] = [];

      // Verificar campos obrigatórios
      if (!user.permissions || user.permissions.length === 0) {
        issues.push('Sem permissões definidas');
      }
      
      if (user.canEditAttendance === undefined) {
        issues.push('Campo canEditAttendance ausente');
      }
      
      if (!user.userType) {
        issues.push('Tipo de usuário não definido');
      }
      
      if (user.active !== user.isActive) {
        issues.push('Inconsistência entre active e isActive');
      }

      if (issues.length > 0) {
        inconsistencies.push({
          userId: user.uid,
          email: user.email,
          issues
        });
      }
    });

    return inconsistencies;
  }, [users]);

  // Carregar usuários na inicialização
  useEffect(() => {
    if (canManageUsers) {
      fetchUsers();
    }
  }, [fetchUsers, canManageUsers]);

  return {
    users,
    isLoading,
    error,
    canManageUsers,
    
    // Ações
    fetchUsers,
    updateUserRole,
    toggleUserStatus,
    
    // Consultas
    getUsersByRole,
    getUserStats,
    checkUserInconsistencies
  };
}