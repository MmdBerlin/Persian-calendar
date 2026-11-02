'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { DEFAULT_EVENT_NOTIFY, type EventNotifyPrefs } from '@/lib/event-notify-prefs';

export interface AppSettings {
  // Event category visibility
  showShamsiEvents: boolean;
  showQamariEvents: boolean;
  showGlobalEvents: boolean;
  // Notification defaults
  defaultNotifyDaysBefore: number;
  // Notifications for official occasions (holidays, shamsi / qamari / global)
  eventNotify: EventNotifyPrefs;
  // Always-visible notification with today's date (the status-bar icon is the day number)
  showTodayNotification: boolean;
  // Last calculated age (persisted)
  lastAge: {
    years: number;
    months: number;
    days: number;
    totalDays: number;
    totalWeeks: number;
    totalMonths: number;
    nextBirthdayJalali: { jy: number; jm: number; jd: number };
    daysUntilNextBirthday: number;
    birthLabel: string; // e.g. "1370/01/01 (شمسی)"
    calculatedAt: number; // timestamp
  } | null;
}

const STORAGE_KEY = 'persian-calendar-settings-v1';

const DEFAULT_SETTINGS: AppSettings = {
  showShamsiEvents: true,
  showQamariEvents: true,
  showGlobalEvents: true,
  defaultNotifyDaysBefore: 0,
  eventNotify: DEFAULT_EVENT_NOTIFY,
  showTodayNotification: true,
  lastAge: null,
};

// --- useSyncExternalStore setup ---
const settingsListeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedSettings: AppSettings = DEFAULT_SETTINGS;

function notifyListeners() {
  settingsListeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  settingsListeners.add(cb);
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
  }
  return () => {
    settingsListeners.delete(cb);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
    }
  };
}

function handleStorageEvent(e: StorageEvent) {
  if (e.key === STORAGE_KEY) {
    cachedRaw = null;
    notifyListeners();
  }
}

function getSettingsClient(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedSettings;
    cachedRaw = raw;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      cachedSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        eventNotify: { ...DEFAULT_EVENT_NOTIFY, ...(parsed.eventNotify ?? {}) },
      };
    } else {
      cachedSettings = DEFAULT_SETTINGS;
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
    cachedSettings = DEFAULT_SETTINGS;
  }
  return cachedSettings;
}

function getSettingsServer(): AppSettings {
  return DEFAULT_SETTINGS;
}

function setSettingsStore(value: AppSettings) {
  if (typeof window === 'undefined') return;
  try {
    const str = JSON.stringify(value);
    localStorage.setItem(STORAGE_KEY, str);
    cachedRaw = str;
    cachedSettings = value;
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
  notifyListeners();
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSettingsClient, getSettingsServer);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    const current = getSettingsClient();
    setSettingsStore({ ...current, ...updates });
  }, []);

  const setLastAge = useCallback((age: AppSettings['lastAge']) => {
    updateSettings({ lastAge: age });
  }, [updateSettings]);

  const clearLastAge = useCallback(() => {
    updateSettings({ lastAge: null });
  }, [updateSettings]);

  return {
    settings,
    updateSettings,
    setLastAge,
    clearLastAge,
  };
}
