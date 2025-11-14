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
      backgroundColor: "#3b82f6",
      style: "light"
    }
  }
};

export default config;
