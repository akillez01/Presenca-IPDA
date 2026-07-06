import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.ipda.presenca',
  appName: 'Sistema de Presença IPDA',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#3b82f6",
      androidSplashResourceName: "splash",
      showSpinner: true,
      spinnerColor: "#ffffff"
    },
    StatusBar: {
      // Evita que a StatusBar "coma" o topo do WebView no Android (o header ficava escondido).
      overlaysWebView: false,
      backgroundColor: "#3b82f6",
      // O plugin usa "DARK" (texto claro) / "LIGHT" (texto escuro) / "DEFAULT".
      // Mantemos texto claro para fundo azul.
      style: "DARK"
    }
  }
};

export default config;
