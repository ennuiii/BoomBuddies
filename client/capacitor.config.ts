import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.gamebuddies.bomberman',
  appName: 'Bomberman',
  webDir: 'dist',
  server: {
    // For development, uncomment and set to your local IP:
    // url: 'http://YOUR_LOCAL_IP:5173',
    // cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#1a1a2e',
      showSpinner: true,
      spinnerColor: '#3b82f6',
    },
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
  },
};

export default config;
