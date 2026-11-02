'use client';

import { useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import type { Reminder } from '@/hooks/use-reminders';
import { buildReminderMessage, notifyTimeOf, occurrenceAge } from '@/lib/notification-text';
import { offsetsOf, occursOnDate, isCompleted, addDays, startOfDay } from '@/lib/reminder-schedule';
import type { EventNotifyPrefs } from '@/lib/event-notify-prefs';
import {
  detectNotificationChannel,
  isNativePlatform,
  notificationsSupported,
  scheduleReminderNotifications,
  cancelAllScheduledNotifications,
  requestNotificationPermission,
  checkNotificationPermission,
  showNotification,
  addNotificationActionListener,
  snoozeNotification,
  checkExactAlarmSetting,
  openExactAlarmSettings,
  type ExactAlarmState,
  type NotificationChannel,
} from '@/lib/notifications';

const PERMISSION_KEY = 'persian-calendar-notification-permission-requested';
const ENABLED_KEY = 'persian-calendar-notifications-enabled';

// --- exact alarm store (Android "Alarms & reminders" special access) ---
const exactListeners = new Set<() => void>();
let exactAlarmOverride: ExactAlarmState | null = null;
function notifyExactListeners() {
  exactListeners.forEach((l) => l());
}
function subscribeExact(cb: () => void) {
  exactListeners.add(cb);
  return () => exactListeners.delete(cb);
}
function getExactClient(): ExactAlarmState {
  return exactAlarmOverride ?? 'unsupported';
}
function getExactServer(): ExactAlarmState {
  return 'unsupported';
}
// --- end exact alarm store ---

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

// --- permission store (useSyncExternalStore) ---
const permListeners = new Set<() => void>();
let permOverride: NotificationPermissionState | null = null;
function notifyPermListeners() {
  permListeners.forEach((l) => l());
}
function subscribePerm(cb: () => void) {
  permListeners.add(cb);
  return () => permListeners.delete(cb);
}
function getPermissionClient(): NotificationPermissionState {
  if (permOverride) return permOverride;
  if (typeof window === 'undefined') return 'unsupported';
  if (!notificationsSupported()) return 'unsupported';
  // Android APK: never read the (absent) Web Notification API, the real
  // permission is resolved asynchronously through the native plugin.
  if (isNativePlatform()) return 'default';
  // Web API available (Capacitor path resolves async via override)
  if ('Notification' in window) {
    return Notification.permission as NotificationPermissionState;
  }
  // Capacitor-only environment: assume default until checked async
  return 'default';
}
function getPermissionServer(): NotificationPermissionState {
  return 'default';
}
// --- end permission store ---

// --- enabled store ---
const enabledListeners = new Set<() => void>();
function notifyEnabledListeners() {
  enabledListeners.forEach((l) => l());
}
function subscribeEnabled(cb: () => void) {
  enabledListeners.add(cb);
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
  }
  return () => {
    enabledListeners.delete(cb);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
    }
  };
}
function handleStorageEvent(e: StorageEvent) {
  if (e.key === ENABLED_KEY) {
    notifyEnabledListeners();
  }
}
function getEnabledClient(): boolean {
  if (typeof window === 'undefined') return false;
  // In Capacitor there is no Notification.permission gate — only our flag
  const channel = detectNotificationChannel();
  if (channel === 'capacitor') {
    try {
      return localStorage.getItem(ENABLED_KEY) === 'true';
    } catch {
      return false;
    }
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}
function getEnabledServer(): boolean {
  return false;
}
function setEnabledStore(value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ENABLED_KEY, value ? 'true' : 'false');
  } catch {
    // ignore
  }
  notifyEnabledListeners();
}
// --- end enabled store ---

// --- channel store (useSyncExternalStore; the channel never changes at runtime) ---
const channelListeners = new Set<() => void>();
function subscribeChannel(cb: () => void) {
  channelListeners.add(cb);
  return () => channelListeners.delete(cb);
}
let cachedChannel: NotificationChannel | null = null;
function getChannelClient(): NotificationChannel {
  if (cachedChannel === null) {
    cachedChannel = detectNotificationChannel();
  }
  return cachedChannel;
}
function getChannelServer(): NotificationChannel {
  return 'webapi'; // server snapshot; matches typical browser render
}
// --- end channel store ---

/**
 * Calculate days until next occurrence of a reminder from today
 */
export interface UseNotificationsOptions {
  /** Notifications for official occasions (holidays, ...) */
  eventPrefs?: EventNotifyPrefs;
  /** Changes when occasion data is updated, so they are planned again */
  eventsVersion?: number;
  /** Show the always-visible "today" notification (date, occasions, day-number icon) */
  showToday?: boolean;
  /** The "انجام شد" button of a reminder notification was pressed */
  onReminderDone?: (reminderId: string, occurrenceIso: string) => void;
}

export function useNotifications(reminders: Reminder[], options: UseNotificationsOptions = {}) {
  const { eventPrefs, eventsVersion = 0, showToday = false, onReminderDone } = options;
  // Stable key so a new-but-equal prefs object does not re-schedule everything
  const eventPrefsKey = JSON.stringify(eventPrefs ?? null);
  const onDoneRef = useRef(onReminderDone);
  useEffect(() => {
    onDoneRef.current = onReminderDone;
  }, [onReminderDone]);
  const permission = useSyncExternalStore(subscribePerm, getPermissionClient, getPermissionServer);
  const enabled = useSyncExternalStore(subscribeEnabled, getEnabledClient, getEnabledServer);
  const firedRef = useRef<Set<string>>(new Set());

  // The channel we're actually running on (for UI hints) — no setState-in-effect
  const channel = useSyncExternalStore(subscribeChannel, getChannelClient, getChannelServer);

  // Exact alarm permission (Android 12+): needed so notifications fire exactly on time
  const exactAlarm = useSyncExternalStore(subscribeExact, getExactClient, getExactServer);

  // Resolve the exact alarm state once (and after the app comes back — the user
  // may have just granted it in the Android settings page)
  useEffect(() => {
    if (channel !== 'capacitor') return;
    let cancelled = false;
    const check = () =>
      checkExactAlarmSetting().then((state) => {
        if (cancelled) return;
        exactAlarmOverride = state;
        notifyExactListeners();
      }).catch(() => { /* ignore */ });
    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [channel]);

  // In Capacitor, permission resolves asynchronously — kick off the check once
  // and push the result into the external permission store (not React state).
  useEffect(() => {
    if (channel !== 'capacitor' || permOverride) return;
    let cancelled = false;
    checkNotificationPermission().then((perm) => {
      if (cancelled || permOverride) return; // user already acted
      if (perm === 'granted') {
        permOverride = 'granted';
      } else if (perm === 'denied') {
        permOverride = 'denied';
      }
      notifyPermListeners();
    }).catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [channel]);

  // Request permission from user (works on both Capacitor and web)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const result = await requestNotificationPermission();
    const mapped: NotificationPermissionState =
      result === 'granted' ? 'granted' :
      result === 'denied' ? 'denied' :
      result === 'unsupported' ? 'unsupported' : 'default';
    permOverride = mapped;
    notifyPermListeners();

    if (mapped === 'granted') {
      setEnabledStore(true);
      try {
        localStorage.setItem(PERMISSION_KEY, 'true');
      } catch { /* ignore */ }
      // Welcome notification (best effort)
      setTimeout(() => {
        showNotification({
          title: 'تقویم شمسی',
          body: 'نوتیفیکیشن با موفقیت فعال شد',
          tag: 'welcome',
        }).catch(() => { /* ignore */ });
      }, 400);
      return true;
    }
    return false;
  }, []);

  const disable = useCallback(() => {
    setEnabledStore(false);
  }, []);

  /** روشن کردن دوباره وقتی قبلاً اجازه داده شده است */
  const enable = useCallback(() => {
    setEnabledStore(true);
  }, []);

  // Fire a single notification (browser / PWA)
  const fireNotification = useCallback((reminder: Reminder, daysUntil: number) => {
    if (!enabled || permission !== 'granted') return;
    if (typeof window === 'undefined') return;

    // One notification per reminder / offset / day (per session)
    const fireKey = `${reminder.id}|${daysUntil}|${new Date().toDateString()}`;
    if (firedRef.current.has(fireKey)) return;
    firedRef.current.add(fireKey);

    const occurrence = new Date();
    occurrence.setDate(occurrence.getDate() + daysUntil);
    const msg = buildReminderMessage(reminder, daysUntil, occurrenceAge(reminder, occurrence));

    showNotification({ title: msg.title, body: msg.body, tag: reminder.id }).catch((e) => {
      console.error('Failed to fire notification:', e);
    });
  }, [enabled, permission]);

  // Browser/PWA: fire every reminder whose notification time (hour:minute) has been reached today.
  // Runs shortly after load, whenever reminders change, and every 20 seconds while the page is open.
  const checkAndFire = useCallback(() => {
    if (channel === 'capacitor') return; // native: scheduled ahead of time, see effect below
    if (!enabled || permission !== 'granted') return;
    if (typeof window === 'undefined') return;

    const today = startOfDay(new Date());
    const now = Date.now();

    reminders.forEach((r) => {
      for (const offset of offsetsOf(r)) {
        // The occurrence that is `offset` days away from today
        const occurrence = addDays(today, offset);
        if (!occursOnDate(r, occurrence) || isCompleted(r, occurrence)) continue;
        const { hour, minute } = notifyTimeOf(r);
        const at = new Date();
        at.setHours(hour, minute, 0, 0);
        if (at.getTime() <= now) fireNotification(r, offset);
      }
    });
  }, [channel, enabled, permission, reminders, fireNotification]);

  useEffect(() => {
    if (channel === 'capacitor') return;
    if (!enabled || permission !== 'granted') return;
    const initialTimer = setTimeout(() => checkAndFire(), 1500);
    const interval = setInterval(() => checkAndFire(), 20 * 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [channel, enabled, permission, checkAndFire]);

  // Android APK: (re)schedule native notifications so they are delivered at
  // the right time even when the app is closed. Runs on start, on every
  // reminder change, and BOTH when the app goes to the background (so the
  // freshest plan is armed before the app is killed) and when it comes back.
  useEffect(() => {
    if (channel !== 'capacitor') return;
    if (permission === 'default' || permission === 'unsupported') return; // not resolved yet
    if (!enabled || permission !== 'granted') {
      void cancelAllScheduledNotifications();
      return;
    }
    const prefs = eventPrefsKey === 'null' ? undefined : (JSON.parse(eventPrefsKey) as EventNotifyPrefs);
    void scheduleReminderNotifications(reminders, prefs, showToday);
    const onVisibility = () => {
      // hidden = app sent to background: re-arm everything right now.
      // visible = app came back: re-plan (missed/catch-up notifications fire).
      void scheduleReminderNotifications(reminders, prefs, showToday);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [channel, enabled, permission, reminders, eventPrefsKey, eventsVersion, showToday]);

  // Android APK: buttons on the notification (done / snooze)
  useEffect(() => {
    if (channel !== 'capacitor') return;
    return addNotificationActionListener((ev) => {
      if (ev.actionId === 'done') {
        if (ev.extra.reminderId && ev.extra.occurrence) {
          onDoneRef.current?.(ev.extra.reminderId, ev.extra.occurrence);
        }
      } else if (ev.actionId === 'snooze10') {
        void snoozeNotification(ev, 10);
      } else if (ev.actionId === 'snooze60') {
        void snoozeNotification(ev, 60);
      }
    });
  }, [channel]);

  // Manual test notification
  const sendTestNotification = useCallback(() => {
    if (permission !== 'granted') return;
    showNotification({
      title: 'تقویم شمسی — آزمایش',
      body: 'این یک نوتیفیکیشن آزمایشی است',
      tag: 'test',
    }).catch((e) => {
      console.error('Test notification failed:', e);
    });
  }, [permission]);

  return {
    permission,
    enabled,
    channel,
    exactAlarm,
    openExactAlarmSettings,
    requestPermission,
    enable,
    disable,
    sendTestNotification,
    fireNotification,
    checkAndFire,
  };
}
