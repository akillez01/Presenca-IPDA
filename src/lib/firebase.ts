import { Analytics, getAnalytics, isSupported } from "firebase/analytics";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Declaração global para gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "reuniao-ministerial.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // Só incluir measurementId se estiver definido (produção)
  ...(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID && {
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  }),
};

// Função para validar se o domínio é válido para Analytics (utilitário)
export function isValidDomainForAnalytics(): boolean {
  if (typeof window === "undefined") return false;
  
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Lista de domínios/padrões inválidos
  const invalidPatterns = [
    /^localhost$/,
    /^127\.0\.0\.1$/,
    /^192\.168\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^\d+\.\d+\.\d+\.\d+$/, // IPs em geral
    /^file:\/\//,
    /\.local$/,
    /^[^.]+$/, // Hostnames sem domínio
  ];
  
  // Verificar se não é HTTPS em produção (exceto para domínios específicos)
  if (process.env.NODE_ENV === "production" && protocol !== "https:") {
    return false;
  }
  
  // Verificar padrões inválidos
  for (const pattern of invalidPatterns) {
    if (pattern.test(hostname)) {
      return false;
    }
  }
  
  // Verificar se tem pelo menos um ponto (domínio válido)
  if (!hostname.includes(".")) {
    return false;
  }
  
  return true;
}

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services
const db = getFirestore(app);
const auth = getAuth(app);

// Analytics será inicializado via componente GoogleAnalytics
let analytics: Analytics | null = null;

// Função para obter analytics se necessário (para uso programático)
export async function getAnalyticsInstance(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  if (process.env.NODE_ENV !== "production") return null;
  if (!process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) return null;
  if (!isValidDomainForAnalytics()) return null;
  
  if (!analytics) {
    try {
      const supported = await isSupported();
      if (supported) {
        analytics = getAnalytics(app);
      }
    } catch (error) {
      // Silent error handling in production
    }
  }
  
  return analytics;
}

export { analytics, app, auth, db };

