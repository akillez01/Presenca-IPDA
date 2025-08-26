'use client';

import { onAuthStateChange, signInAdmin, signOutAdmin } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

// Interface expandida do usuário com role
interface ExtendedUser extends User {
  role?: string;
  cargo?: string;
}

export function useAuth() {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Carregar perfil do usuário do Firestore para obter o role
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            // Extender o objeto user do Firebase com dados do Firestore
            const extendedUser = {
              ...firebaseUser,
              role: userData.role || 'basic_user', // ✅ Adicionar role do Firestore
              cargo: userData.cargo || 'BASIC_USER'
            } as ExtendedUser;
            
            console.log(`🔑 Usuário autenticado com role:`, extendedUser.email, extendedUser.role);
            setUser(extendedUser);
          } else {
            // Se não tem perfil no Firestore, assumir usuário básico
            const extendedUser = {
              ...firebaseUser,
              role: 'basic_user',
              cargo: 'BASIC_USER'
            } as ExtendedUser;
            
            console.log(`🔑 Usuário autenticado sem perfil Firestore, assumindo básico:`, extendedUser.email);
            setUser(extendedUser);
          }
        } catch (error: any) {
          // Silenciar erros de permissão - são esperados até as regras serem atualizadas
          if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
            console.log(`🔑 Perfil não acessível (permissões), assumindo usuário básico:`, firebaseUser.email);
          } else {
            console.warn('⚠️ Erro ao carregar perfil do usuário:', error);
          }
          
          // Em caso de qualquer erro, assumir usuário básico e continuar
          const extendedUser = {
            ...firebaseUser,
            role: 'basic_user',
            cargo: 'BASIC_USER'
          } as ExtendedUser;
          setUser(extendedUser);
        }
      } else {
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await signInAdmin(email, password);
      if (result.success && result.user) {
        // Não setUser aqui - deixar o onAuthStateChange fazer isso
      }
      return result;
    } catch (error) {
      return { success: false, error: 'Erro no hook de login' };
    }
  };

  const logout = async () => {
    const result = await signOutAdmin();
    if (result.success) {
      setUser(null);
    }
    return result;
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout
  };
}
