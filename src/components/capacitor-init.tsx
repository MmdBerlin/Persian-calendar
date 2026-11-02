'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { hideAppSplash } from '@/components/app-splash';

/** Minimum time the splash stays visible so it never just flashes. */
const MIN_SPLASH_MS = 450;
/** Safety net: hide the splash no matter what. */
const MAX_SPLASH_MS = 4000;

const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;

/**
 * CapacitorInit: runs once on the client.
 * - Hides the start-up splash (HTML splash + native Android splash) as soon as the app is ready.
 * - Inside the Android APK it also configures the StatusBar (solid white background, dark icons).
 */
export function CapacitorInit() {
  useEffect(() => {
    let cancelled = false;

    const finishSplash = () => {
      if (cancelled) return;
      hideAppSplash();
      if (Capacitor.isNativePlatform()) {
        SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {
          /* already hidden */
        });
      }
    };

    // Wait for the first painted frame, then respect the minimum display time.
    const wait = Math.max(0, MIN_SPLASH_MS - (performance.now() - startedAt));
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setTimeout(finishSplash, wait));
    });
    const failSafe = setTimeout(finishSplash, MAX_SPLASH_MS);

    if (Capacitor.isNativePlatform()) {
      (async () => {
        try {
          // Style.Light = dark icons, for a light background
          await StatusBar.setStyle({ style: Style.Light });
          await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
          await StatusBar.setOverlaysWebView({ overlay: false });
        } catch {
          // some calls are not supported on every Android version; never break the app
        }
      })();
      document.documentElement.style.setProperty('background-color', '#FFFFFF');
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(failSafe);
    };
  }, []);

  return null;
}
