import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.selects.film',
  appName: 'Selects',
  webDir: 'dist',
  backgroundColor: '#0A0A0B',
  ios: {
    contentInset: 'never',
    backgroundColor: '#0A0A0B',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0A0A0B',
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
    },
  },
};

export default config;
