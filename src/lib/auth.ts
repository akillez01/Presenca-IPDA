import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    User
} from 'firebase/auth';
import { auth } from './firebase';

// Credenciais dos super usuários
const SUPER_USERS = {
  'admin@ipda.org.br': 'IPDA@2025Admin',
  'marciodesk@ipda.app.br': 'Michelin@1'
};

// Credenciais dos usuários básicos (acesso limitado)
const BASIC_USERS = {
  'presente@ipda.app.br': 'presente@2025', // Usuário já existente no Firebase
  'secretaria@ipda.org.br': 'SecretariaIPDA@2025',
  'auxiliar@ipda.org.br': 'AuxiliarIPDA@2025',
  'cadastro@ipda.app.br': 'ipda@2025',
  'achilles.oliveira.souza@gmail.com': 'achilles@2025' // Usuário Achilles
};

// Todos os usuários válidos
const ALL_USERS = { ...SUPER_USERS, ...BASIC_USERS };

// Enum para tipos de usuário
export enum UserType {
  SUPER_USER = 'SUPER_USER',
  BASIC_USER = 'BASIC_USER',
  UNKNOWN = 'UNKNOWN'
}

// Função para verificar se é super usuário
export function isSuperUser(email: string): boolean {
  return email in SUPER_USERS;
}

// Função para verificar se é usuário básico
export function isBasicUser(email: string): boolean {
  return email in BASIC_USERS;
}

// Função para obter tipo de usuário
export function getUserType(email: string): UserType {
  if (isSuperUser(email)) return UserType.SUPER_USER;
  if (isBasicUser(email)) return UserType.BASIC_USER;
  return UserType.UNKNOWN;
}

// Função para verificar se as credenciais são de super usuário
export function isSuperUserCredentials(email: string, password: string): boolean {
  return (SUPER_USERS as Record<string, string>)[email] === password;
}

// Função para verificar se as credenciais são de usuário básico
export function isBasicUserCredentials(email: string, password: string): boolean {
  return (BASIC_USERS as Record<string, string>)[email] === password;
}

// Função para verificar se as credenciais são válidas (qualquer tipo)
export function isValidUserCredentials(email: string, password: string): boolean {
  return (ALL_USERS as Record<string, string>)[email] === password;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

// Sistema de autenticação local temporário (fallback)
let localUser: User | null = null;
let authStateCallbacks: ((user: User | null) => void)[] = [];

// Função para notificar todos os callbacks sobre mudança de estado
function notifyAuthStateChange(user: User | null) {
  authStateCallbacks.forEach(callback => {
    try {
      callback(user);
    } catch (error) {
      // Silent error handling in production
    }
  });
}

// Função para verificar se Firebase está disponível
function isFirebaseAvailable(): boolean {
  try {
    return !!(auth && auth.app && auth.app.options.apiKey);
  } catch (error) {
    return false;
  }
}

export async function signInAdmin(email: string, password: string): Promise<AuthResult> {
  try {
    // Função para criar usuário local
    const createLocalUser = (): User => {
      return {
        uid: 'local-admin',
        email: email,
        emailVerified: true,
        displayName: 'Administrador Local',
        isAnonymous: false,
        phoneNumber: null,
        photoURL: null,
        providerId: 'password',
        metadata: {
          creationTime: new Date().toISOString(),
          lastSignInTime: new Date().toISOString()
        },
        providerData: [],
        refreshToken: 'local-token',
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => 'local-token',
        getIdTokenResult: async () => ({
          token: 'local-token',
          authTime: new Date().toISOString(),
          issuedAtTime: new Date().toISOString(),
          expirationTime: new Date(Date.now() + 3600000).toISOString(),
          signInProvider: 'password',
          signInSecondFactor: null,
          claims: {}
        }),
        reload: async () => {},
        toJSON: () => ({})
      } as User;
    };

    // Tentar Firebase Auth primeiro (se disponível) - QUALQUER USUÁRIO VÁLIDO
    if (isFirebaseAvailable()) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return {
          success: true,
          user: userCredential.user
        };
      } catch (firebaseError: any) {
        // Se usuário não existe no Firebase e é super usuário, tentar criar
        if ((firebaseError.code === 'auth/user-not-found' ||
            firebaseError.code === 'auth/invalid-credential' ||
            firebaseError.code === 'auth/wrong-password') &&
            isSuperUserCredentials(email, password)) {
          try {
            const newUserCredential = await createUserWithEmailAndPassword(auth, email, password);
            return {
              success: true,
              user: newUserCredential.user
            };
          } catch (createError: any) {
            // Silent error handling, fallback to local for admin
          }
        } else {
          // Para usuários não autorizados, retornar erro específico
          return {
            success: false,
            error: 'Credenciais inválidas. Verifique email e senha.'
          };
        }
      }
    }

    // Sistema local (fallback garantido para usuários autorizados)
    if (isValidUserCredentials(email, password)) {
      localUser = createLocalUser();
      
      // Notificar todos os callbacks sobre a mudança de estado
      setTimeout(() => {
        notifyAuthStateChange(localUser);
      }, 50);
      
      return {
        success: true,
        user: localUser
      };
    }

    // Se não é usuário autorizado, negar acesso
    return {
      success: false,
      error: 'Credenciais inválidas. Verifique email e senha.'
    };
  } catch (error: any) {
    // Mesmo em caso de erro geral, se as credenciais estão corretas, usar sistema local
    if (isValidUserCredentials(email, password)) {
      localUser = {
        uid: 'local-admin',
        email: email,
        emailVerified: true,
        displayName: 'Administrador Local',
        isAnonymous: false,
        phoneNumber: null,
        photoURL: null,
        providerId: 'password',
        metadata: {
          creationTime: new Date().toISOString(),
          lastSignInTime: new Date().toISOString()
        },
        providerData: [],
        refreshToken: 'local-token',
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => 'local-token',
        getIdTokenResult: async () => ({
          token: 'local-token',
          authTime: new Date().toISOString(),
          issuedAtTime: new Date().toISOString(),
          expirationTime: new Date(Date.now() + 3600000).toISOString(),
          signInProvider: 'password',
          signInSecondFactor: null,
          claims: {}
        }),
        reload: async () => {},
        toJSON: () => ({})
      } as User;

      setTimeout(() => {
        notifyAuthStateChange(localUser);
      }, 50);
      
      return {
        success: true,
        user: localUser
      };
    }
    
    return {
      success: false,
      error: `Erro geral: ${error.message}`
    };
  }
}

export async function signOutAdmin(): Promise<AuthResult> {
  try {
    // Se há usuário local, limpar e notificar
    if (localUser) {
      localUser = null;
      setTimeout(() => {
        notifyAuthStateChange(null);
      }, 50);
      return { success: true };
    }

    // Tentar logout do Firebase
    if (isFirebaseAvailable()) {
      await signOut(auth);
    }
    
    return { success: true };
  } catch (error: any) {
    // Mesmo com erro, considerar logout bem-sucedido
    localUser = null;
    notifyAuthStateChange(null);
    return { success: true };
  }
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  // Adicionar callback à lista
  authStateCallbacks.push(callback);

  // Se há usuário local, chamar callback imediatamente
  if (localUser) {
    setTimeout(() => callback(localUser), 10);
  } else {
    // Verificar se Firebase está disponível
    if (isFirebaseAvailable()) {
      try {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          // Dar prioridade ao usuário local se existir
          const currentUser = localUser || firebaseUser;
          callback(currentUser);
        });
        
        // Retornar função de cleanup que remove o callback da lista
        return () => {
          const index = authStateCallbacks.indexOf(callback);
          if (index > -1) {
            authStateCallbacks.splice(index, 1);
          }
          if (unsubscribe) unsubscribe();
        };
      } catch (error) {
        // Silent error handling
      }
    }
    // Chamar callback com null se não há usuário
    setTimeout(() => callback(null), 10);
  }

  // Retornar função de cleanup padrão
  return () => {
    const index = authStateCallbacks.indexOf(callback);
    if (index > -1) {
      authStateCallbacks.splice(index, 1);
    }
  };
}

export function isAuthenticated(): boolean {
  try {
    return !!(localUser || (isFirebaseAvailable() && auth.currentUser));
  } catch (error) {
    return !!localUser;
  }
}

export function getCurrentUser(): User | null {
  try {
    return localUser || (isFirebaseAvailable() ? auth.currentUser : null);
  } catch (error) {
    return localUser;
  }
}
