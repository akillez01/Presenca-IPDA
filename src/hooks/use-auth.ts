'use client';

import { getUserType, onAuthStateChange, signInAdmin, signOutAdmin, UserType } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

// Interface expandida do usuário com role
interface ExtendedUser extends User {
  role?: string;
  cargo?: string;
  userType?: string;
  permissions?: string[];
}

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  [UserType.SUPER_USER]: [
    'dashboard',
    'register',
    'attendance',
    'letters',
    'presencadecadastrados',
    'edit_attendance',
    'reports',
    'admin_users',
    'config'
  ],
  [UserType.EDITOR_USER]: [
    'dashboard',
    'register',
    'attendance',
    'letters',
    'presencadecadastrados',
    'edit_attendance',
    'reports'
  ],
  [UserType.BASIC_USER]: [
    'dashboard',
    'register',
    'attendance',
    'letters',
    'presencadecadastrados'
  ],
};

function mapUserTypeToRole(userType?: string) {
  switch (userType) {
    case UserType.SUPER_USER:
      return 'admin';
    case UserType.EDITOR_USER:
      return 'editor';
    case UserType.BASIC_USER:
      return 'basic_user';
    default:
      return 'basic_user';
  }
}

function resolvePermissions(userType?: string, explicitPermissions?: unknown) {
  if (Array.isArray(explicitPermissions) && explicitPermissions.every(item => typeof item === 'string')) {
    return explicitPermissions as string[];
  }
  if (userType && DEFAULT_PERMISSIONS[userType]) {
    return [...DEFAULT_PERMISSIONS[userType]];
  }
  return ['dashboard'];
}

export function useAuth() {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    const processUser = async (firebaseUser: User | null) => {
      if (!mounted) return;
      
      try {
        if (firebaseUser) {
          console.log('🔄 Processando usuário Firebase:', firebaseUser.email);

          const tokenResult = await firebaseUser.getIdTokenResult();
          const claims = tokenResult.claims || {};
          
          try {
            // Aguardar um pouco para garantir que a autenticação está completa
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Carregar perfil do usuário do Firestore para obter o role
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            console.log(`🔍 Tentando acessar documento: users/${firebaseUser.uid}`);
            
            const userDocSnap = await getDoc(userDocRef);

            let extendedUser: ExtendedUser;
            const claimUserType = typeof claims.userType === 'string' ? claims.userType : undefined;
            const claimRole = typeof claims.role === 'string' ? claims.role : undefined;
            const claimPermissions = claims.permissions;

            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              console.log(`📄 Dados do usuário no Firestore:`, userData);

              const docRole = typeof userData.role === 'string' ? userData.role : undefined;
              const docUserType = typeof userData.userType === 'string' ? userData.userType : undefined;
              const docPermissions = userData.permissions;

              const resolvedUserType = docUserType || claimUserType || getUserType(firebaseUser.email || '');
              const resolvedRole = docRole || claimRole || mapUserTypeToRole(resolvedUserType);
              const resolvedPermissions = resolvePermissions(resolvedUserType, docPermissions || claimPermissions);

              if (claimUserType && docUserType && claimUserType !== docUserType) {
                console.log(`⚠️ Inconsistência de tipo: claims=${claimUserType} Firestore=${docUserType}. Preferindo Firestore.`);
              }

              extendedUser = {
                ...firebaseUser,
                role: resolvedRole,
                cargo: resolvedUserType,
                userType: resolvedUserType,
                permissions: resolvedPermissions
              } as ExtendedUser;
              console.log(`✅ Usuário com perfil Firestore:`, extendedUser.email, `role: ${resolvedRole}`, `userType: ${resolvedUserType}`);
            } else {
              console.log(`⚠️ Documento não encontrado para: ${firebaseUser.uid}`);
              const fallbackUserType = claimUserType || getUserType(firebaseUser.email || '');
              const fallbackRole = claimRole || mapUserTypeToRole(fallbackUserType);
              const fallbackPermissions = resolvePermissions(fallbackUserType, claimPermissions);

              extendedUser = {
                ...firebaseUser,
                role: fallbackRole,
                cargo: fallbackUserType,
                userType: fallbackUserType,
                permissions: fallbackPermissions
              } as ExtendedUser;
              console.log(`✅ Usuário sem perfil Firestore (padrão):`, extendedUser.email, fallbackRole);
            }
            
            if (mounted) {
              setUser(extendedUser);
            }
          } catch (error: any) {
            console.error('❌ Erro ao carregar perfil do Firestore:', error);
            console.error('🔍 Detalhes do erro:', error.code, error.message);
            
            // Fallback robusto para definição básica
            const fallbackUserType = claimUserType || getUserType(firebaseUser.email || '');
            const fallbackRole = claimRole || mapUserTypeToRole(fallbackUserType);
            const fallbackPermissions = resolvePermissions(fallbackUserType, claimPermissions);

            const extendedUser = {
              ...firebaseUser,
              role: fallbackRole,
              cargo: fallbackUserType,
              userType: fallbackUserType,
              permissions: fallbackPermissions
            } as ExtendedUser;
            
            console.log(`🔄 Fallback aplicado para ${firebaseUser.email}: role=${fallbackRole}, userType=${fallbackUserType}`);
            
            if (mounted) {
              setUser(extendedUser);
            }
          }
        } else {
          console.log('🔓 Nenhum usuário Firebase autenticado');
          if (mounted) {
            setUser(null);
          }
        }
      } catch (error) {
        console.error('❌ Erro crítico no processamento de usuário:', error);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
          if (!authInitialized) {
            setAuthInitialized(true);
          }
        }
      }
    };

    const unsubscribe = onAuthStateChange(processUser);

    return () => {
      mounted = false;
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
