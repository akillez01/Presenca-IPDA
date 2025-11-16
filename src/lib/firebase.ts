import { Analytics, getAnalytics, isSupported } from "firebase/analytics";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Declaração global para gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

// Função para detectar se está rodando no Capacitor/Mobile
function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Verificar se é Capacitor
  try {
    // @ts-ignore - Capacitor pode não estar disponível em web
    if (window.Capacitor?.isNativePlatform?.()) {
      return true;
    }
  } catch {
    // Ignorar erro se Capacitor não estiver disponível
  }
  
  // Verificar user agent para mobile
  const userAgent = window.navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

// Configuração Firebase com fallbacks para mobile
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyA6_YWMcTzvKzCbZgl88SJvWpAUuE8LilE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "reuniao-ministerial.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "reuniao-ministerial",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "reuniao-ministerial.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "23562502277",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:23562502277:web:ad150c66054fe08241e9ec",
  // Só incluir measurementId se estiver definido (produção) e não for mobile
  ...(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID && !isMobile() && {
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  }),
};

if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
  // Log apenas em modo debug explícito para evitar poluir console e afetar hidratação
  // eslint-disable-next-line no-console
  console.log('🔥 Firebase Config Debug:', {
    isMobile: isMobile(),
    hasEnvVars: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    config: {
      ...firebaseConfig,
      apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 8)}...` : 'undefined'
    }
  });
}

// Função para validar se o domínio é válido para Analytics (utilitário)
export function isValidDomainForAnalytics(): boolean {
  if (typeof window === "undefined") return false;
  if (isMobile()) return false; // Não usar Analytics no mobile
  
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
const storage = getStorage(app);

// Analytics será inicializado via componente GoogleAnalytics
let analytics: Analytics | null = null;

// Função para obter analytics se necessário (para uso programático)
export async function getAnalyticsInstance(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  if (isMobile()) return null; // Não usar Analytics no mobile
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

export { analytics, app, auth, db, storage };

