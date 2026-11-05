'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useSettings } from '@/hooks/use-settings';
import { getTheme } from '@/lib/themes';

/**
 * Keeps the document in sync with the selected theme:
 * - <html data-theme="..."> switches the CSS variables (see globals.css)
 * - <meta name="theme-color"> follows the theme colour (browser / PWA)
 * - inside the Android APK the status bar gets the theme colour too
 * Renders nothing.
 */
export function ThemeApplier() {
  const { settings } = useSettings();
  const themeId = settings.theme;

  useEffect(() => {
    const theme = getTheme(themeId);
    const root = document.documentElement;

    if (themeId === 'default') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', themeId);
    root.classList.toggle('dark', !!theme.isDark);

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = theme.chrome;

    if (Capacitor.isNativePlatform()) {
      root.style.setProperty('background-color', theme.chrome);
      (async () => {
        try {
          // Style.Dark = white icons (for dark bars), Style.Light = dark icons (for light bars)
          await StatusBar.setStyle({ style: theme.lightChrome ? Style.Light : Style.Dark });
          await StatusBar.setBackgroundColor({ color: theme.chrome });
        } catch {
          /* never break the app over a status bar */
        }
      })();
    }
  }, [themeId]);

  return null;
}
