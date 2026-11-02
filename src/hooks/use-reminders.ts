'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type ReminderType =
  | 'birthday'
  | 'anniversary'
  | 'event'
  | 'task'
  | 'appointment'
  | 'meeting'
  | 'medicine'
  | 'installment'
  | 'bill'
  | 'rent'
  | 'check'
  | 'insurance'
  | 'note';

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  type: ReminderType;
  calendar: 'jalali' | 'gregorian';
  year?: number; // birth year (for age calculation) - optional for annual reminders
  month: number; // 1-12
  day: number; // 1-31
  annual: boolean; // repeat every year (kept in sync with `repeat === 'yearly'`)
  /** Repeat rule. Missing on old reminders: `annual` decides (yearly / none). */
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  /** Repeat every N units (days / weeks / months); default 1 */
  repeatEvery?: number;
  notifyDaysBefore: number; // largest "days before" value (kept for old code); 0 = on the day
  /** Every "days before" at which to notify, e.g. [3, 1, 0]. Missing on old reminders. */
  notifyOffsets?: number[];
  /** Occurrence dates (YYYY-MM-DD, Gregorian) marked as done */
  completed?: string[];
  /** Local hour (0–23) to fire the notification; default 9 if omitted */
  notifyHour?: number;
  /** Minute (0–59) to fire the notification; default 0 if omitted */
  notifyMinute?: number;
  color?: string;
  createdAt: number;
}

const STORAGE_KEY = 'persian-calendar-reminders-v1';

/** Old versions stored SMS fields on reminders; drop them when loading. */
function stripLegacyFields(list: Reminder[]): Reminder[] {
  return list.map((r) => {
    const {
      smsEnabled: _a,
      smsPhone: _b,
      smsText: _c,
      smsHour: _d,
      ...rest
    } = r as Reminder & { smsEnabled?: unknown; smsPhone?: unknown; smsText?: unknown; smsHour?: unknown };
    return rest as Reminder;
  });
}

// --- useSyncExternalStore setup for reminders ---
// SSR returns [] so server HTML matches initial client render (no hydration mismatch).
// The client snapshot is cached: we only re-parse localStorage when the raw string changes,
// so useSyncExternalStore sees a stable reference between notifications.
const remindersListeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedReminders: Reminder[] = [];

function notifyRemindersListeners() {
  remindersListeners.forEach((l) => l());
}
function subscribeReminders(cb: () => void) {
  remindersListeners.add(cb);
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
  }
  return () => {
    remindersListeners.delete(cb);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
    }
  };
}
function handleStorageEvent(e: StorageEvent) {
  if (e.key === STORAGE_KEY) {
    cachedRaw = null; // invalidate cache
    notifyRemindersListeners();
  }
}
function getRemindersClient(): Reminder[] {
  if (typeof window === 'undefined') return EMPTY_REMINDERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedReminders; // stable reference, no re-parse
    cachedRaw = raw;
    if (raw) {
      const parsed = JSON.parse(raw) as Reminder[];
      cachedReminders = Array.isArray(parsed) ? stripLegacyFields(parsed) : EMPTY_REMINDERS;
    } else {
      cachedReminders = EMPTY_REMINDERS;
    }
  } catch (e) {
    console.error('Failed to load reminders:', e);
    cachedReminders = EMPTY_REMINDERS;
  }
  return cachedReminders;
}
// Cache the server snapshot to avoid infinite loop warnings from React
const EMPTY_REMINDERS: Reminder[] = [];
function getRemindersServer(): Reminder[] {
  return EMPTY_REMINDERS;
}
function setRemindersStore(value: Reminder[]) {
  if (typeof window === 'undefined') return;
  try {
    const str = JSON.stringify(value);
    localStorage.setItem(STORAGE_KEY, str);
    // Update cache so next getRemindersClient() returns the same array reference
    cachedRaw = str;
    cachedReminders = value;
  } catch (e) {
    console.error('Failed to save reminders:', e);
  }
  notifyRemindersListeners();
}
// --- End reminders store ---

export function useReminders() {
  // useSyncExternalStore reads localStorage on client, returns [] on server.
  // No hydration mismatch, no setState-in-effect.
  const reminders = useSyncExternalStore(
    subscribeReminders,
    getRemindersClient,
    getRemindersServer
  );

  const addReminder = useCallback((reminder: Omit<Reminder, 'id' | 'createdAt'>) => {
    const newReminder: Reminder = {
      ...reminder,
      id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
    };
    const current = getRemindersClient();
    setRemindersStore([...current, newReminder]);
    return newReminder;
  }, []);

  const updateReminder = useCallback((id: string, updates: Partial<Reminder>) => {
    const current = getRemindersClient();
    setRemindersStore(current.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }, []);

  /** Mark one occurrence (Gregorian YYYY-MM-DD) of a reminder as done / not done. */
  const setOccurrenceDone = useCallback((id: string, isoDay: string, done: boolean) => {
    const current = getRemindersClient();
    setRemindersStore(
      current.map((r) => {
        if (r.id !== id) return r;
        const set = new Set(r.completed ?? []);
        if (done) set.add(isoDay);
        else set.delete(isoDay);
        // keep the list small: only the most recent 60 days matter
        const list = [...set].sort().slice(-60);
        return { ...r, completed: list };
      })
    );
  }, []);

  /**
   * "انجام شد": a one-time reminder is removed; a repeating one only skips this occurrence
   * (the series continues, and the occurrence can be restored with setOccurrenceDone(..., false)).
   */
  const completeOccurrence = useCallback((id: string, isoDay: string) => {
    const current = getRemindersClient();
    const target = current.find((r) => r.id === id);
    if (!target) return;
    const repeating = (target.repeat ?? (target.annual ? 'yearly' : 'none')) !== 'none';
    if (!repeating) {
      setRemindersStore(current.filter((r) => r.id !== id));
      return;
    }
    const set = new Set(target.completed ?? []);
    set.add(isoDay);
    const list = [...set].sort().slice(-60);
    setRemindersStore(current.map((r) => (r.id === id ? { ...r, completed: list } : r)));
  }, []);

  const deleteReminder = useCallback((id: string) => {
    const current = getRemindersClient();
    setRemindersStore(current.filter((r) => r.id !== id));
  }, []);

  const deleteMultiple = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    const current = getRemindersClient();
    setRemindersStore(current.filter((r) => !idSet.has(r.id)));
  }, []);

  const clearAll = useCallback(() => {
    setRemindersStore([]);
  }, []);

  // Export to JSON
  const exportReminders = useCallback((): string => {
    return JSON.stringify(reminders, null, 2);
  }, [reminders]);

  // Import from JSON
  const importReminders = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as Reminder[];
      if (Array.isArray(parsed)) {
        setRemindersStore(stripLegacyFields(parsed));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  return {
    reminders,
    loaded: true,
    addReminder,
    updateReminder,
    setOccurrenceDone,
    completeOccurrence,
    deleteReminder,
    deleteMultiple,
    clearAll,
    exportReminders,
    importReminders,
  };
}
