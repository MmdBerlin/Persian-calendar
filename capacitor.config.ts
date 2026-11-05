import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.persiancalendar.app',
  appName: 'Persian Calendar',
  webDir: 'out',
  // WebView background while the page loads — the app blue, same as the launch splash
  backgroundColor: '#056AFA',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#056AFA',
    },
    // Blue with white icons while the launch splash shows; CapacitorInit switches
    // back to white with dark icons as soon as the app UI is ready.
    StatusBar: {
      backgroundColor: '#056AFA',
      style: 'DARK',
      overlaysWebView: false,
    },
    SplashScreen: {
      // The app hides the splash itself (CapacitorInit) once the UI is ready.
      launchAutoHide: false,
      launchShowDuration: 0,
      launchFadeOutDuration: 250,
      backgroundColor: '#056AFA',
      showSpinner: false,
    },
  },
};

export default config;
