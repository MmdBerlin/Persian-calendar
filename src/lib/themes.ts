/**
 * Pooste ha (themes).
 *
 * The colours of every theme live in globals.css (`:root` = default, `:root[data-theme="..."]` = others).
 * This file only describes the themes for the settings page, and the few places that need a plain hex
 * value (Android status bar, <meta name="theme-color">, the little preview swatches).
 */

export type ThemeId = 'default' | 'green' | 'sage' | 'dark';

export interface ThemeInfo {
  id: ThemeId;
  label: string;
  description: string;
  /** Page background (preview + status bar fallback) */
  bg: string;
  /** Card surface (preview only) */
  card: string;
  /** Main colour */
  primary: string;
  /** Second colour of the theme (preview only) */
  secondary?: string;
  /** Android status bar / browser theme colour */
  chrome: string;
  /** true when the status bar colour is light, so its icons must be dark */
  lightChrome?: boolean;
  /** dark theme: html also gets the `dark` class (shadcn dark variants, native form controls) */
  isDark?: boolean;
}

export const THEMES: ThemeInfo[] = [
  {
    id: 'default',
    label: 'پوسته اصلی',
    description: 'آبی روشن و ساده',
    bg: '#F7F8FA',
    card: '#FFFFFF',
    primary: '#056AFA',
    secondary: '#70BBF5',
    chrome: '#056AFA',
  },
  {
    id: 'green',
    label: 'پوسته سبز',
    description: 'رنگ اصلی سبز روی زمینه خاکستری روشن',
    bg: '#E6E6E6',
    card: '#F4F4F4',
    primary: '#259D6D',
    chrome: '#259D6D',
  },
  {
    id: 'sage',
    label: 'پوسته ملایم',
    description: 'سبز مریمی و هلویی روی زمینه سفید، با متن مشکی',
    bg: '#FFFFFF',
    card: '#F3F7EC',
    primary: '#AEC783',
    secondary: '#DFA482',
    chrome: '#AEC783',
    lightChrome: true,
  },
  {
    id: 'dark',
    label: 'پوسته تاریک',
    description: 'زمینه سرمه ای تیره با رنگ اصلی آبی روشن و متن سفید',
    bg: '#1A2730',
    card: '#223340',
    primary: '#43AEDC',
    chrome: '#1A2730',
    isDark: true,
  },
];

export const DEFAULT_THEME: ThemeId = 'default';

export function isThemeId(v: unknown): v is ThemeId {
  return THEMES.some((t) => t.id === v);
}

export function getTheme(id: ThemeId | undefined): ThemeInfo {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Same key as use-settings.ts (kept here so the early script and CapacitorInit can read it without React). */
export const SETTINGS_STORAGE_KEY = 'persian-calendar-settings-v1';

/** Read the saved theme straight from localStorage (no React). Safe on the server. */
export function readStoredThemeId(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const t = (JSON.parse(raw) as { theme?: unknown }).theme;
    return isThemeId(t) ? t : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Tiny script placed in <head> so the saved theme is applied before the first paint
 * (no flash of the default theme when the app opens with another theme selected).
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var r=localStorage.getItem(${JSON.stringify(
  SETTINGS_STORAGE_KEY,
)});var t=r&&JSON.parse(r).theme;var m=${JSON.stringify(Object.fromEntries(THEMES.filter((x) => x.id !== DEFAULT_THEME).map((x) => [x.id, x.isDark ? 1 : 0])))};if(t&&m.hasOwnProperty(t)){var d=document.documentElement;d.setAttribute("data-theme",t);if(m[t])d.classList.add("dark");}}catch(e){}})();`;
