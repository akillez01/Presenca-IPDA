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
  'secretaria@ipda.org.br': 'SecretariaIPDA@2025',
  'auxiliar@ipda.org.br': 'AuxiliarIPDA@2025'
};

// Credenciais dos usuários editores (podem editar presenças)
const EDITOR_USERS = {
  'presente@ipda.app.br': 'presente@2025', // Usuário já existente no Firebase
  'cadastro@ipda.app.br': 'ipda@2025',
};

// Todos os usuários válidos
const ALL_USERS = { ...SUPER_USERS, ...BASIC_USERS, ...EDITOR_USERS };

// Enum para tipos de usuário
export enum UserType {
  SUPER_USER = 'SUPER_USER',
  EDITOR_USER = 'EDITOR_USER',
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

// Função para verificar se é usuário editor
export function isEditorUser(email: string): boolean {
  return email in EDITOR_USERS;
}

// Função para obter tipo de usuário
export function getUserType(email: string): UserType {
  if (isSuperUser(email)) return UserType.SUPER_USER;
  if (isEditorUser(email)) return UserType.EDITOR_USER;
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

// Sistema de callbacks para mudança de estado de autenticação
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
    // Usar apenas Firebase Auth - sem fallback local
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
            return {
              success: false,
              error: 'Erro ao criar usuário no Firebase.'
            };
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

    // Se Firebase não está disponível, falhar
    return {
      success: false,
      error: 'Firebase não está disponível.'
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Erro geral: ${error.message}`
    };
  }
}

export async function signOutAdmin(): Promise<AuthResult> {
  try {
    // Logout do Firebase
    if (isFirebaseAvailable()) {
      await signOut(auth);
    }
    
    return { success: true };
  } catch (error: any) {
    // Mesmo com erro, considerar logout bem-sucedido
    return { success: true };
  }
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  // Adicionar callback à lista
  authStateCallbacks.push(callback);

  // Verificar se Firebase está disponível
  if (isFirebaseAvailable()) {
    try {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        callback(firebaseUser);
      });
        
        // Retornar função de cleanup que remove o callback da lista
        return () => {
          const index = authStateCallbacks.indexOf(callback);
          if (index > -1) {
            authStateCallbacks.splice(index, 1);
          }
          if (unsubscribe) unsubscribe();
        };
      
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
  
  // Chamar callback com null se Firebase não está disponível
  setTimeout(() => callback(null), 10);

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
    return !!(isFirebaseAvailable() && auth.currentUser);
  } catch (error) {
    return false;
  }
}

export function getCurrentUser(): User | null {
  try {
    return isFirebaseAvailable() ? auth.currentUser : null;
  } catch (error) {
    return null;
  }
}
