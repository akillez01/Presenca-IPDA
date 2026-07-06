import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User
} from 'firebase/auth';
import { auth } from './firebase';

const DEFAULT_SUPER_USER_EMAILS = ['admin@ipda.org.br', 'marciodesk@ipda.app.br'];
const DEFAULT_EDITOR_USER_EMAILS = [
  'presente@ipda.app.br',
  'cadastro@ipda.app.br',
  'registro1@ipda.app.br',
  'registro2@ipda.app.br',
  'registro3@ipda.app.br',
  'registro4@ipda.app.br',
  'secretaria@ipda.org.br',
  'auxiliar@ipda.org.br',
];

function normalizeEmail(email: string | null | undefined) {
  return (email || '').trim().toLowerCase();
}

function parseEmailList(rawValue: string | undefined, fallback: string[]) {
  const raw = (rawValue || '').trim();
  if (!raw) {
    return fallback;
  }

  return raw
    .split(',')
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

const SUPER_USER_EMAILS = new Set(
  parseEmailList(
    process.env.NEXT_PUBLIC_SUPER_USER_EMAILS || process.env.SUPER_USER_EMAILS,
    DEFAULT_SUPER_USER_EMAILS
  )
);

const EDITOR_USER_EMAILS = new Set(
  parseEmailList(
    process.env.NEXT_PUBLIC_EDITOR_USER_EMAILS || process.env.EDITOR_USER_EMAILS,
    DEFAULT_EDITOR_USER_EMAILS
  )
);

const BASIC_USER_EMAILS = new Set(
  parseEmailList(process.env.NEXT_PUBLIC_BASIC_USER_EMAILS || process.env.BASIC_USER_EMAILS, [])
);

// Enum para tipos de usuário
export enum UserType {
  SUPER_USER = 'SUPER_USER',
  EDITOR_USER = 'EDITOR_USER',
  BASIC_USER = 'BASIC_USER',
  BAPTISM_USER = 'BAPTISM_USER',
  UNKNOWN = 'UNKNOWN'
}

// Função para verificar se é super usuário
export function isSuperUser(email: string): boolean {
  return SUPER_USER_EMAILS.has(normalizeEmail(email));
}

// Função para verificar se é usuário básico
export function isBasicUser(email: string): boolean {
  return BASIC_USER_EMAILS.has(normalizeEmail(email));
}

// Função para verificar se é usuário editor
export function isEditorUser(email: string): boolean {
  return EDITOR_USER_EMAILS.has(normalizeEmail(email));
}

// Função para obter tipo de usuário
export function getUserType(email: string): UserType {
  if (isSuperUser(email)) return UserType.SUPER_USER;
  if (isEditorUser(email)) return UserType.EDITOR_USER;
  if (isBasicUser(email)) return UserType.BASIC_USER;
  return UserType.UNKNOWN;
}

// Legado: credenciais não são mais comparadas no frontend.
export function isSuperUserCredentials(email: string, password: string): boolean {
  return false;
}

// Legado: credenciais não são mais comparadas no frontend.
export function isBasicUserCredentials(email: string, password: string): boolean {
  return false;
}

// Legado: credenciais não são mais comparadas no frontend.
export function isValidUserCredentials(email: string, password: string): boolean {
  return false;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

// Sistema de callbacks para mudança de estado de autenticação
const authStateCallbacks: ((user: User | null) => void)[] = [];

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
    // Usar apenas Firebase Auth - sem fallback local e sem bootstrap automático.
    if (!isFirebaseAvailable()) {
      return {
        success: false,
        error: 'Firebase não está disponível.'
      };
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return {
      success: true,
      user: userCredential.user
    };
  } catch (error: any) {
    return {
      success: false,
      error: 'Credenciais inválidas. Verifique email e senha.'
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
  authStateCallbacks.push(callback);

  if (isFirebaseAvailable()) {
    try {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        callback(firebaseUser);
      });

      return () => {
        const index = authStateCallbacks.indexOf(callback);
        if (index > -1) {
          authStateCallbacks.splice(index, 1);
        }
        if (unsubscribe) unsubscribe();
      };
    } catch (error) {
      // Silent error handling in production
    }
  }

  setTimeout(() => callback(null), 10);

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
