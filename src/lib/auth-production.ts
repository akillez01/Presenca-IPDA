import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    User
} from 'firebase/auth';
import { auth } from './firebase';

// Credenciais do admin
const ADMIN_EMAIL = 'admin@ipda.org.br';
const ADMIN_PASSWORD = 'IPDA@2025Admin';

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
    // Verificar se são as credenciais corretas do admin
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return {
        success: false,
        error: 'Credenciais inválidas. Apenas administradores têm acesso.'
      };
    }

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

    // Tentar Firebase Auth primeiro (se disponível)
    if (isFirebaseAvailable()) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return {
          success: true,
          user: userCredential.user
        };
      } catch (firebaseError: any) {
        // Se usuário não existe no Firebase, tentar criar
        if (firebaseError.code === 'auth/user-not-found' ||
            firebaseError.code === 'auth/invalid-credential' ||
            firebaseError.code === 'auth/wrong-password') {
          try {
            const newUserCredential = await createUserWithEmailAndPassword(auth, email, password);
            return {
              success: true,
              user: newUserCredential.user
            };
          } catch (createError: any) {
            // Silent error handling, fallback to local
          }
        }
      }
    }

    // Sistema local (fallback garantido)
    localUser = createLocalUser();
    
    // Notificar todos os callbacks sobre a mudança de estado
    setTimeout(() => {
      notifyAuthStateChange(localUser);
    }, 50);
    
    return {
      success: true,
      user: localUser
    };
  } catch (error: any) {
    // Mesmo em caso de erro geral, se as credenciais estão corretas, usar sistema local
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
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
