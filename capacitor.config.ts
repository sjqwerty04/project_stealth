import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.selects.film',
  appName: 'Selects',
  // The app loads production; this folder only ships the offline page.
  webDir: 'native-shell',
  backgroundColor: '#0A0A0B',
  server: {
    url: 'https://selects-film.vercel.app',
    errorPath: 'offline.html',
    // Hosts that stay inside the app. Any other top-level link opens in Safari.
    allowNavigation: [
      'mvplockedin.firebaseapp.com',
      'www.youtube.com',
      'www.youtube-nocookie.com',
    ],
  },
  ios: {
    // The web app pads for the notch and home indicator itself (viewport-fit=cover).
    contentInset: 'never',
    backgroundColor: '#0A0A0B',
  },
};

export default config;
