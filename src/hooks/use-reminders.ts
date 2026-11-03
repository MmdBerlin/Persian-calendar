'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { canCompleteOccurrence } from '@/lib/reminder-schedule';

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
const LAST_COMPLETION_UNDO_KEY = 'persian-calendar-last-completion-undo-v1';
type LastCompletionUndo = { kind: 'deleted'; reminder: Reminder; title: string } | { kind: 'occurrence'; reminderId: string; isoDay: string; title: string };
let cachedUndoRaw: string | null = null;
let cachedUndo: LastCompletionUndo | null = null;

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
function getLastCompletionUndoClient(): LastCompletionUndo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_COMPLETION_UNDO_KEY);
    if (raw === cachedUndoRaw) return cachedUndo;
    cachedUndoRaw = raw;
    cachedUndo = raw ? (JSON.parse(raw) as LastCompletionUndo) : null;
  } catch {
    cachedUndoRaw = null;
    cachedUndo = null;
  }
  return cachedUndo;
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
  const lastCompletionUndo = useSyncExternalStore(
    subscribeReminders,
    getLastCompletionUndoClient,
    () => null
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
    if (done) {
      const target = current.find((r) => r.id === id);
      if (target) {
        const undo: LastCompletionUndo = { kind: 'occurrence', reminderId: id, isoDay, title: target.title };
        try { localStorage.setItem(LAST_COMPLETION_UNDO_KEY, JSON.stringify(undo)); cachedUndoRaw = null; } catch { /* storage unavailable */ }
      }
    } else {
      const last = getLastCompletionUndoClient();
      if (last?.kind === 'occurrence' && last.reminderId === id && last.isoDay === isoDay) {
        try { localStorage.removeItem(LAST_COMPLETION_UNDO_KEY); cachedUndoRaw = null; cachedUndo = null; } catch { /* storage unavailable */ }
      }
    }
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
   * "انجام شد" — برای همه یادآورها فقط در روز موعد و فقط یک بار زده می‌شود
   * (see canCompleteOccurrence in reminder-schedule).
   * یک‌باره‌ها با «انجام شد» حذف می‌شوند؛ تکرارشونده‌ها فقط همان سررسید رد می‌شود
   * (و با setOccurrenceDone(..., false) قابل برگرداندن است).
   */
  const completeOccurrence = useCallback((id: string, isoDay: string) => {
    const current = getRemindersClient();
    const target = current.find((r) => r.id === id);
    if (!target) return;
    // همه یادآورها: فقط در روز موعد و فقط یک بار (حتی یک‌باره‌ها)
    if (!canCompleteOccurrence(target, isoDay)) return;
    const repeating = (target.repeat ?? (target.annual ? 'yearly' : 'none')) !== 'none';
    if (!repeating) {
      const undo: LastCompletionUndo = { kind: 'deleted', reminder: target, title: target.title };
      try { localStorage.setItem(LAST_COMPLETION_UNDO_KEY, JSON.stringify(undo)); cachedUndoRaw = null; } catch { /* storage unavailable */ }
      setRemindersStore(current.filter((r) => r.id !== id));
      return;
    }
    const undo: LastCompletionUndo = { kind: 'occurrence', reminderId: id, isoDay, title: target.title };
    try { localStorage.setItem(LAST_COMPLETION_UNDO_KEY, JSON.stringify(undo)); cachedUndoRaw = null; } catch { /* storage unavailable */ }
    const set = new Set(target.completed ?? []);
    set.add(isoDay);
    const list = [...set].sort().slice(-60);
    setRemindersStore(current.map((r) => (r.id === id ? { ...r, completed: list } : r)));
  }, []);

  const undoLastCompletion = useCallback(() => {
    const undo = getLastCompletionUndoClient();
    if (!undo) return;
    const current = getRemindersClient();
    let next = current;
    if (undo.kind === 'deleted') {
      if (!current.some((r) => r.id === undo.reminder.id)) next = [...current, undo.reminder];
    } else {
      next = current.map((r) => {
        if (r.id !== undo.reminderId) return r;
        return { ...r, completed: (r.completed ?? []).filter((day) => day !== undo.isoDay) };
      });
    }
    try { localStorage.removeItem(LAST_COMPLETION_UNDO_KEY); cachedUndoRaw = null; cachedUndo = null; } catch { /* storage unavailable */ }
    setRemindersStore(next);
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
    lastCompletionUndo,
    undoLastCompletion,
    deleteReminder,
    deleteMultiple,
    clearAll,
    exportReminders,
    importReminders,
  };
}
