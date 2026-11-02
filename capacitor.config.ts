import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.persiancalendar.app',
  appName: 'تقویم شمسی',
  webDir: 'out',
  // WebView background while the page loads (prevents a black/dark flash)
  backgroundColor: '#F7F8FA',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#5856D6',
    },
    StatusBar: {
      backgroundColor: '#FFFFFF',
      style: 'LIGHT',
      overlaysWebView: false,
    },
    SplashScreen: {
      // The app hides the splash itself (CapacitorInit) once the UI is ready.
      launchAutoHide: false,
      launchShowDuration: 0,
      launchFadeOutDuration: 250,
      backgroundColor: '#F7F8FA',
      showSpinner: false,
    },
  },
};

export default config;
