'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';


/**
 * CapacitorInit: runs once on the client.
 * - Hides the native Android launch screen immediately.
 * - Inside the Android APK the StatusBar keeps the app-blue background with white icons while
 *   the blue launch splash is visible, then switches to the light app style (white, dark icons).
 */
export function CapacitorInit() {
  useEffect(() => {
    let cancelled = false;

    const finishSplash = () => {
      if (cancelled) return;
      if (Capacitor.isNativePlatform()) {
        SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {
          /* already hidden */
        });
        // The app itself is light: back to a white status bar with dark icons
        // (and a white WebView background) once the splash is gone.
        (async () => {
          try {
            await StatusBar.setStyle({ style: Style.Light });
            await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
          } catch {
            /* never break the app over a status bar */
          }
        })();
        document.documentElement.style.setProperty('background-color', '#FFFFFF');
      }
    };

    // Hide the native Android launch screen immediately; no app-branded splash is shown.
    finishSplash();

    if (Capacitor.isNativePlatform()) {
      (async () => {
        try {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#2B62EF' });
          await StatusBar.setOverlaysWebView({ overlay: false });
        } catch {
          // some calls are not supported on every Android version; never break the app
        }
      })();
      document.documentElement.style.setProperty('background-color', '#2B62EF');
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
