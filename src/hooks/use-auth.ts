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

function buildExtendedUser(
  firebaseUser: User,
  extra: Pick<ExtendedUser, 'role' | 'cargo' | 'userType' | 'permissions'>
): ExtendedUser {
  return Object.assign(Object.create(Object.getPrototypeOf(firebaseUser)), firebaseUser, extra);
}

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  ADMIN_USER: [
    'dashboard',
    'scanner',
    'register',
    'attendance',
    'letters',
    'baptism',
    'sedeEstadual',
    'presencadecadastrados',
    'edit_attendance',
    'reports',
    'admin_users',
    'config'
  ],
  [UserType.SUPER_USER]: [
    'dashboard',
    'scanner',
    'register',
    'attendance',
    'letters',
    'baptism',
    'sedeEstadual',
    'presencadecadastrados',
    'edit_attendance',
    'reports',
    'admin_users',
    'config'
  ],
  [UserType.EDITOR_USER]: [
    'dashboard',
    'scanner',
    'register',
    'attendance',
    'letters',
    'baptism',
    'sedeEstadual',
    'presencadecadastrados',
    'edit_attendance',
    'reports'
  ],
  [UserType.BASIC_USER]: [
    'dashboard',
    'scanner',
    'register',
    'attendance',
    'letters',
    'baptism',
    'presencadecadastrados'
  ],
  [UserType.BAPTISM_USER]: [
    'dashboard',
    'baptism'
  ],
};

function mapUserTypeToRole(userType?: string) {
  switch (userType) {
    case 'ADMIN_USER':
      return 'admin';
    case UserType.SUPER_USER:
      return 'admin';
    case UserType.EDITOR_USER:
      return 'editor';
    case UserType.BASIC_USER:
      return 'basic_user';
    case UserType.BAPTISM_USER:
      return 'baptism_user';
    default:
      return 'basic_user';
  }
}

function isAdminIdentity(userType?: string, role?: string) {
  return (
    userType === 'ADMIN_USER' ||
    userType === UserType.SUPER_USER ||
    role === 'admin' ||
    role === 'super'
  );
}

function resolvePermissions(userType?: string, explicitPermissions?: unknown, role?: string) {
  if (isAdminIdentity(userType, role)) {
    return [...DEFAULT_PERMISSIONS.ADMIN_USER];
  }

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
          const DEBUG = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG === 'true';
          if (DEBUG) console.log('🔄 Processando usuário Firebase:', firebaseUser.email);

          const tokenResult = await firebaseUser.getIdTokenResult();
          const claims = tokenResult.claims || {};
          // Declarar antecipadamente para uso em todos os blocos (incluindo fallback do catch)
          const claimUserType = typeof claims.userType === 'string' ? claims.userType : undefined;
          const claimRole = typeof claims.role === 'string' ? claims.role : undefined;
          const claimPermissions = claims.permissions;
          
          try {
            // Aguardar um pouco para garantir que a autenticação está completa
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Carregar perfil do usuário do Firestore para obter o role
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            if (DEBUG) console.log(`🔍 Tentando acessar documento: users/${firebaseUser.uid}`);
            
            const userDocSnap = await getDoc(userDocRef);

            let extendedUser: ExtendedUser;

            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              if (DEBUG) console.log(`📄 Dados do usuário no Firestore:`, userData);

              const docRole = typeof userData.role === 'string' ? userData.role : undefined;
              const docUserType = typeof userData.userType === 'string' ? userData.userType : undefined;
              const docPermissions = userData.permissions;

              const resolvedUserType = docUserType || claimUserType || getUserType(firebaseUser.email || '');
              const resolvedRole = docRole || claimRole || mapUserTypeToRole(resolvedUserType);
              const resolvedPermissions = resolvePermissions(
                resolvedUserType,
                docPermissions || claimPermissions,
                resolvedRole
              );

              if (claimUserType && docUserType && claimUserType !== docUserType) {
                if (DEBUG) console.log(`⚠️ Inconsistência de tipo: claims=${claimUserType} Firestore=${docUserType}. Preferindo Firestore.`);
              }

              extendedUser = buildExtendedUser(firebaseUser, {
                role: resolvedRole,
                cargo: resolvedUserType,
                userType: resolvedUserType,
                permissions: resolvedPermissions,
              });
              if (DEBUG) console.log(`✅ Usuário com perfil Firestore:`, extendedUser.email, `role: ${resolvedRole}`, `userType: ${resolvedUserType}`);
            } else {
              if (DEBUG) console.log(`⚠️ Documento não encontrado para: ${firebaseUser.uid}`);
              const fallbackUserType = claimUserType || getUserType(firebaseUser.email || '');
              const fallbackRole = claimRole || mapUserTypeToRole(fallbackUserType);
              const fallbackPermissions = resolvePermissions(
                fallbackUserType,
                claimPermissions,
                fallbackRole
              );

              extendedUser = buildExtendedUser(firebaseUser, {
                role: fallbackRole,
                cargo: fallbackUserType,
                userType: fallbackUserType,
                permissions: fallbackPermissions,
              });
              if (DEBUG) console.log(`✅ Usuário sem perfil Firestore (padrão):`, extendedUser.email, fallbackRole);
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
            const fallbackPermissions = resolvePermissions(
              fallbackUserType,
              claimPermissions,
              fallbackRole
            );

            const extendedUser = buildExtendedUser(firebaseUser, {
              role: fallbackRole,
              cargo: fallbackUserType,
              userType: fallbackUserType,
              permissions: fallbackPermissions,
            });
            
            if (DEBUG) console.log(`🔄 Fallback aplicado para ${firebaseUser.email}: role=${fallbackRole}, userType=${fallbackUserType}`);
            
            if (mounted) {
              setUser(extendedUser);
            }
          }
        } else {
          const DEBUG = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG === 'true';
          if (DEBUG) console.log('🔓 Nenhum usuário Firebase autenticado');
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
