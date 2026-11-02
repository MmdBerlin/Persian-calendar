/**
 * Cross-platform notification layer.
 *
 * Android APK (Capacitor):
 *   Notifications are scheduled natively with @capacitor/local-notifications
 *   (AlarmManager), so they appear at the right time even when the app is
 *   closed and they are restored after a phone reboot by the plugin.
 *
 * Browser / PWA:
 *   Service worker or the Web Notification API (only while the page is open).
 */

'use client';

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Reminder } from '@/hooks/use-reminders';
import { gregorianToJalali } from '@/lib/jalali';
import {
  buildReminderMessage,
  buildEventMessage,
  buildTodayMessage,
  notifyTimeOf,
  occurrenceAge,
} from '@/lib/notification-text';
import { getEventsForJalaliDate } from '@/lib/events';
import { DEFAULT_EVENT_NOTIFY, type EventNotifyPrefs } from '@/lib/event-notify-prefs';
import {
  upcomingOccurrences,
  offsetsOf,
  isCompleted,
  isoOf,
  addDays,
  startOfDay,
  occursOnDate,
} from '@/lib/reminder-schedule';

export const ANDROID_CHANNEL_ID = 'calendar-reminders';
export const EVENTS_CHANNEL_ID = 'calendar-events';
export const TODAY_CHANNEL_ID = 'calendar-today';
/** Buttons under every reminder notification: done / snooze 10 min / snooze 1 h (registered once). */
export const ACTION_TYPE_REMINDER = 'REMINDER_ACTIONS';
/** How many days ahead the "today" notification is scheduled (each day replaces the previous at 00:00). */
const TODAY_HORIZON_DAYS = 14;
/** How many days ahead official-occasion notifications are scheduled. */
const EVENT_HORIZON_DAYS = 45;
/** Default local time at which reminder notifications are delivered (09:00). */
export const NOTIFY_HOUR = 9;
export const NOTIFY_MINUTE = 0;
/** Safety cap on the number of pending native notifications. */
const MAX_SCHEDULED = 400;
const FIRED_KEY = 'persian-calendar-native-fired';

export type NotificationChannel =
  | 'capacitor'    // native Android via Capacitor
  | 'serviceworker' // PWA service worker
  | 'webapi'       // desktop main-thread Notification
  | 'unsupported'; // nothing available

type Perm = 'granted' | 'denied' | 'prompt' | 'unsupported';

export function isNativePlatform(): boolean {
  try {
    return typeof window !== 'undefined' && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Detect the best available notification channel. */
export function detectNotificationChannel(): NotificationChannel {
  if (typeof window === 'undefined') return 'unsupported';
  if (isNativePlatform()) return 'capacitor';
  if ('serviceWorker' in navigator) return 'serviceworker';
  if ('Notification' in window) return 'webapi';
  return 'unsupported';
}

/** True when the platform can show notifications at all. */
export function notificationsSupported(): boolean {
  return detectNotificationChannel() !== 'unsupported';
}

function mapPermission(display: string | undefined): Perm {
  if (display === 'granted') return 'granted';
  if (display === 'denied') return 'denied';
  return 'prompt';
}

// ---------------------------------------------------------------------------
// Android channel
// ---------------------------------------------------------------------------

let channelPromise: Promise<void> | null = null;

/** Create the Android notification channels once (required on API 26+). */
function ensureAndroidChannel(): Promise<void> {
  if (!channelPromise) {
    channelPromise = (async () => {
      try {
        await LocalNotifications.createChannel({
          id: ANDROID_CHANNEL_ID,
          name: 'یادآورهای تقویم',
          description: 'نوتیفیکیشن تولدها، سالگردها، کارها و یادداشت ها',
          importance: 4, // HIGH: heads-up + sound
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#5856D6',
        });
        // Separate channel so official occasions can be muted from Android settings on their own
        await LocalNotifications.createChannel({
          id: EVENTS_CHANNEL_ID,
          name: 'مناسبت های تقویم',
          description: 'تعطیلات رسمی و مناسبت های شمسی، قمری و جهانی',
          importance: 3, // DEFAULT: sound, no heads-up
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#10B981',
        });
        // Quiet channel for the always-visible date notification (no sound, no vibration)
        await LocalNotifications.createChannel({
          id: TODAY_CHANNEL_ID,
          name: 'تاریخ امروز',
          description: 'نوتیفیکیشن همیشگی با تاریخ و مناسبت های امروز',
          importance: 2, // LOW: silent, shown in the shade
          visibility: 1,
          vibration: false,
          lights: false,
        });
      } catch (e) {
        console.error('createChannel failed:', e);
        channelPromise = null; // allow retry
      }
    })();
  }
  return channelPromise;
}

let actionTypesPromise: Promise<void> | null = null;

/** Register the notification buttons: done / snooze (Android shows them under the notification). */
function ensureActionTypes(): Promise<void> {
  if (!actionTypesPromise) {
    actionTypesPromise = LocalNotifications.registerActionTypes({
      types: [
        {
          id: ACTION_TYPE_REMINDER,
          actions: [
            { id: 'done', title: 'انجام شد' },
            { id: 'snooze10', title: '۱۰ دقیقه بعد' },
            { id: 'snooze60', title: '۱ ساعت بعد' },
          ],
        },
      ],
    }).catch((e) => {
      console.error('registerActionTypes failed:', e);
      actionTypesPromise = null;
    });
  }
  return actionTypesPromise;
}

// ---------------------------------------------------------------------------
// Immediate notification (test / welcome / web fallbacks)
// ---------------------------------------------------------------------------

interface ShowOptions {
  title: string;
  body: string;
  tag?: string;
  id?: number;
}

export async function showNotification(opts: ShowOptions): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const channel = detectNotificationChannel();

  // 1) Capacitor native: the APK path
  if (channel === 'capacitor') {
    try {
      await ensureAndroidChannel();
      await LocalNotifications.schedule({
        notifications: [
          {
            title: opts.title,
            body: opts.body,
            id: opts.id ?? (Math.floor(Date.now() / 1000) % 2147483000) + 1,
            channelId: ANDROID_CHANNEL_ID,
            schedule: { at: new Date(Date.now() + 200), allowWhileIdle: true },
            // Do not send the user to the "Alarms & reminders" settings page.
            isExactNotification: false,
            extra: { tag: opts.tag },
          },
        ],
      });
      return true;
    } catch (e) {
      console.error('Capacitor notification failed:', e);
      return false;
    }
  }

  const iconUrl = window.location.origin + '/icons/icon-192.png';

  // 2) Service Worker (PWA)
  if (channel === 'serviceworker') {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(opts.title, {
        body: opts.body,
        icon: iconUrl,
        badge: '/icons/icon-96.png',
        dir: 'rtl',
        lang: 'fa',
        tag: opts.tag || 'calendar',
        vibrate: [200, 100, 200],
      } as NotificationOptions);
      return true;
    } catch (e) {
      console.warn('SW notification failed, trying main thread:', e);
    }
  }

  // 3) main-thread Web Notification (desktop)
  if ('Notification' in window) {
    try {
      const notif = new Notification(opts.title, {
        body: opts.body,
        icon: iconUrl,
        dir: 'rtl',
        lang: 'fa',
        tag: opts.tag || 'calendar',
      });
      setTimeout(() => { try { notif.close(); } catch { /* ignore */ } }, 8000);
      return true;
    } catch (e) {
      console.error('Web notification failed:', e);
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export type ExactAlarmState = 'granted' | 'denied' | 'prompt' | 'unsupported';

/** Check the Android "Alarms & reminders" (exact alarm) special permission. */
export async function checkExactAlarmSetting(): Promise<ExactAlarmState> {
  if (!isNativePlatform()) return 'unsupported';
  try {
    const status = await LocalNotifications.checkExactNotificationSetting();
    const v = (status as { exact_alarm?: string }).exact_alarm;
    if (v === 'granted') return 'granted';
    if (v === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'unsupported';
  }
}

/** Open the Android settings page where the user allows exact alarms (so reminders fire exactly on time). */
export async function openExactAlarmSettings(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await LocalNotifications.changeExactNotificationSetting();
  } catch {
    // ignore
  }
}

export async function requestNotificationPermission(): Promise<Perm> {
  if (typeof window === 'undefined') return 'unsupported';

  const channel = detectNotificationChannel();
  if (channel === 'unsupported') return 'unsupported';

  if (channel === 'capacitor') {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') {
        await ensureAndroidChannel();
        return 'granted';
      }
      const req = await LocalNotifications.requestPermissions();
      if (req.display === 'granted') {
        await ensureAndroidChannel();
        return 'granted';
      }
      return 'denied';
    } catch (e) {
      console.error('Capacitor permission failed:', e);
      return 'denied';
    }
  }

  if ('Notification' in window) {
    try {
      const result = await Notification.requestPermission();
      if (result === 'granted' && 'serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('/sw.js');
        } catch {
          // main-thread notifications still work
        }
      }
      return result === 'default' ? 'prompt' : (result as Perm);
    } catch {
      return 'denied';
    }
  }

  return 'unsupported';
}

/** Check the current permission state without prompting. */
export async function checkNotificationPermission(): Promise<Perm> {
  if (typeof window === 'undefined') return 'unsupported';

  const channel = detectNotificationChannel();
  if (channel === 'unsupported') return 'unsupported';

  if (channel === 'capacitor') {
    try {
      const status = await LocalNotifications.checkPermissions();
      return mapPermission(status.display);
    } catch {
      return 'prompt';
    }
  }

  if ('Notification' in window) {
    return Notification.permission === 'default'
      ? 'prompt'
      : (Notification.permission as Perm);
  }
  return 'unsupported';
}

// ---------------------------------------------------------------------------
// Native scheduling (works while the app is closed)
// ---------------------------------------------------------------------------

export { DEFAULT_EVENT_NOTIFY };
export type { EventNotifyPrefs };

export interface NotificationExtra {
  kind: 'reminder' | 'event' | 'snooze' | 'today';
  key: string;
  reminderId?: string;
  /** Gregorian YYYY-MM-DD of the occurrence this notification is about */
  occurrence?: string;
  actionTypeId?: string;
}

export interface PlannedNotification {
  id: number;
  key: string;
  title: string;
  body: string;
  at: Date;
  channelId: string;
  actionTypeId?: string;
  /** Status-bar icon (drawable name), e.g. ic_day_12 */
  smallIcon?: string;
  /** Expanded text */
  largeBody?: string;
  ongoing?: boolean;
  autoCancel?: boolean;
  extra: NotificationExtra;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Stable positive 31-bit id from a string (Android needs a 32-bit int). */
function hashId(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 2147483646) + 1;
}

/** Notifications for the user's reminders: every occurrence x every "days before" value. */
function planReminders(reminders: Reminder[], now: Date, fired: Set<string>): PlannedNotification[] {
  const plan: PlannedNotification[] = [];

  for (const r of reminders) {
    const offsets = offsetsOf(r);
    const { hour, minute } = notifyTimeOf(r);
    // Look a little back so "3 days before" of an occurrence that is 2 days away is still planned
    const from = startOfDay(now);

    for (const day of upcomingOccurrences(r, from, 40)) {
      if (isCompleted(r, day)) continue; // marked done: no more notifications for this occurrence
      const occIso = isoOf(day);

      for (const offset of offsets) {
        const notifyDay = addDays(day, -offset);
        const fireAt = new Date(notifyDay.getFullYear(), notifyDay.getMonth(), notifyDay.getDate(), hour, minute, 0);
        const key = `${r.id}|${occIso}|${offset}|t${pad(hour)}${pad(minute)}`;

        let at: Date | null = null;
        if (fireAt.getTime() > now.getTime() + 1000) {
          at = fireAt; // future: schedule exactly
        } else if (
          fireAt.getFullYear() === now.getFullYear() &&
          fireAt.getMonth() === now.getMonth() &&
          fireAt.getDate() === now.getDate() &&
          !fired.has(key)
        ) {
          // catch-up: today's time already passed -> fire almost immediately (no delay)
          at = new Date(now.getTime() + 1500);
        }
        if (!at) continue;

        const msg = buildReminderMessage(r, offset, occurrenceAge(r, day));
        const actionTypeId = ACTION_TYPE_REMINDER;
        plan.push({
          id: hashId(key),
          key,
          title: msg.title,
          body: msg.body,
          at,
          channelId: ANDROID_CHANNEL_ID,
          actionTypeId,
          extra: { kind: 'reminder', key, reminderId: r.id, occurrence: occIso, actionTypeId },
        });
      }
    }
  }
  return plan;
}

/** Notifications for official occasions ("tomorrow is a public holiday"), next EVENT_HORIZON_DAYS days. */
function planEvents(prefs: EventNotifyPrefs, now: Date): PlannedNotification[] {
  if (!(prefs.holidays || prefs.shamsi || prefs.qamari || prefs.global)) return [];
  const [hh, mm] = (prefs.time || '20:00').split(':').map((x) => parseInt(x, 10));
  const hour = Number.isFinite(hh) ? Math.min(23, Math.max(0, hh)) : 20;
  const minute = Number.isFinite(mm) ? Math.min(59, Math.max(0, mm)) : 0;
  const before = prefs.daysBefore > 0 ? 1 : 0;
  const all = { showShamsiEvents: true, showQamariEvents: true, showGlobalEvents: true };
  const plan: PlannedNotification[] = [];
  const today = startOfDay(now);

  for (let k = 0; k <= EVENT_HORIZON_DAYS + before; k++) {
    const eventDay = addDays(today, k);
    const notifyDay = addDays(eventDay, -before);
    const fireAt = new Date(notifyDay.getFullYear(), notifyDay.getMonth(), notifyDay.getDate(), hour, minute, 0);
    if (fireAt.getTime() <= now.getTime() + 2000) continue; // past times are not caught up for occasions

    const j = gregorianToJalali(eventDay.getFullYear(), eventDay.getMonth() + 1, eventDay.getDate());
    const events = getEventsForJalaliDate(j.jy, j.jm, j.jd, all).filter(
      (e) =>
        (prefs.holidays && e.isHoliday) ||
        (e.category === 'shamsi' && prefs.shamsi) ||
        (e.category === 'qamari' && prefs.qamari) ||
        (e.category === 'global' && prefs.global)
    );
    if (events.length === 0) continue;

    const occIso = isoOf(eventDay);
    const key = `ev|${occIso}|${before}|t${pad(hour)}${pad(minute)}`;
    const msg = buildEventMessage(events, before);
    plan.push({
      id: hashId(key),
      key,
      title: msg.title,
      body: msg.body,
      at: fireAt,
      channelId: EVENTS_CHANNEL_ID,
      extra: { kind: 'event', key, occurrence: occIso },
    });
  }
  return plan;
}

/**
 * The always-visible "today" notification: one per day for the next TODAY_HORIZON_DAYS days.
 * Today's is posted right away, each following day's appears at 00:00:30. The status-bar icon is the Jalali day number.
 */
function planToday(reminders: Reminder[], now: Date): PlannedNotification[] {
  const all = { showShamsiEvents: true, showQamariEvents: true, showGlobalEvents: true };
  const plan: PlannedNotification[] = [];
  const today = startOfDay(now);

  for (let k = 0; k < TODAY_HORIZON_DAYS; k++) {
    const day = addDays(today, k);
    const at = k === 0 ? new Date(now.getTime() + 2000) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 30);
    const j = gregorianToJalali(day.getFullYear(), day.getMonth() + 1, day.getDate());
    const events = getEventsForJalaliDate(j.jy, j.jm, j.jd, all);
    const count = reminders.filter((r) => occursOnDate(r, day) && !isCompleted(r, day)).length;
    const msg = buildTodayMessage(day, events, count);
    const key = `today|${isoOf(day)}`;
    plan.push({
      id: hashId(key),
      key,
      title: msg.title,
      body: msg.body,
      largeBody: msg.largeBody,
      at,
      channelId: TODAY_CHANNEL_ID,
      smallIcon: `ic_day_${msg.dayNumber}`,
      ongoing: true,
      autoCancel: false,
      extra: { kind: 'today', key, occurrence: isoOf(day) },
    });
  }
  return plan;
}

/**
 * Pure planning function (no native calls): which notifications should exist.
 * `fired` holds keys already delivered/scheduled so that a reminder whose
 * time already passed today is only caught up once.
 */
export function planNotifications(
  reminders: Reminder[],
  now: Date,
  fired: Set<string>,
  eventPrefs?: EventNotifyPrefs,
  showToday = false
): PlannedNotification[] {
  const todayPlan = showToday ? planToday(reminders, now) : [];
  const plan = [
    ...planReminders(reminders, now, fired),
    ...(eventPrefs ? planEvents(eventPrefs, now) : []),
  ];
  plan.sort((a, b) => a.at.getTime() - b.at.getTime());
  // The "today" entries are small and must never be pushed out by a long reminder list
  return [...todayPlan, ...plan.slice(0, MAX_SCHEDULED - todayPlan.length)].sort(
    (a, b) => a.at.getTime() - b.at.getTime()
  );
}

const FIRED_VERSION_KEY = 'persian-calendar-native-fired-v';
const FIRED_VERSION = '4'; // bump when key format changes

function loadFired(): Set<string> {
  try {
    if (localStorage.getItem(FIRED_VERSION_KEY) !== FIRED_VERSION) {
      localStorage.removeItem(FIRED_KEY);
      localStorage.setItem(FIRED_VERSION_KEY, FIRED_VERSION);
      return new Set();
    }
    const raw = localStorage.getItem(FIRED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function saveFired(set: Set<string>, now: Date) {
  try {
    const limit = isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));
    const keep = [...set].filter((k) => (k.split('|')[1] ?? '') >= limit);
    localStorage.setItem(FIRED_KEY, JSON.stringify(keep));
  } catch {
    // ignore
  }
}

// --- snoozed notifications: kept out of the "cancel everything and re-plan" step ---
const SNOOZE_KEY = 'persian-calendar-snoozed';
interface SnoozeEntry {
  id: number;
  at: number;
}
function loadSnoozes(): SnoozeEntry[] {
  try {
    const list = JSON.parse(localStorage.getItem(SNOOZE_KEY) || '[]') as SnoozeEntry[];
    return Array.isArray(list) ? list.filter((s) => s.at > Date.now()) : [];
  } catch {
    return [];
  }
}
function saveSnoozes(list: SnoozeEntry[]) {
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

let syncChain: Promise<void> = Promise.resolve();

async function cancelPending(): Promise<void> {
  const keep = new Set(loadSnoozes().map((s) => s.id));
  const pending = await LocalNotifications.getPending();
  const toCancel = pending.notifications.filter((n) => !keep.has(n.id));
  if (toCancel.length > 0) {
    await LocalNotifications.cancel({ notifications: toCancel.map((n) => ({ id: n.id })) });
  }
}

// --- the "today" notification: keep exactly one visible, up to date ---
const TODAY_STATE_KEY = 'persian-calendar-today-notif';
interface TodayState {
  /** every id used so far -> content signature */
  sigs: Record<string, string>;
}
function loadTodayState(): TodayState {
  try {
    return JSON.parse(localStorage.getItem(TODAY_STATE_KEY) || '{"sigs":{}}') as TodayState;
  } catch {
    return { sigs: {} };
  }
}

/**
 * Removes yesterday's (and older) "today" notifications from the shade, and skips re-posting
 * today's when the visible one already shows the same text. When the setting is off, removes them all.
 */
async function syncTodayNotification(plan: PlannedNotification[], showToday: boolean): Promise<PlannedNotification[]> {
  const state = loadTodayState();
  const todayEntry = plan.find((p) => p.extra.kind === 'today' && p.at.getTime() - Date.now() < 30_000);
  try {
    const delivered = (await LocalNotifications.getDeliveredNotifications()).notifications;
    const known = new Set(Object.keys(state.sigs).map(Number));
    const stale = delivered
      .filter((n) => known.has(n.id) && (!showToday || n.id !== todayEntry?.id))
      .map((n) => n.id);
    if (stale.length > 0) await LocalNotifications.removeDeliveredNotificationsById({ ids: stale });

    if (showToday && todayEntry) {
      const sig = `${todayEntry.title}|${todayEntry.body}|${todayEntry.largeBody}`;
      const visible = delivered.some((n) => n.id === todayEntry.id);
      if (visible && state.sigs[todayEntry.id] === sig) {
        plan = plan.filter((p) => p !== todayEntry); // already showing the same thing
      }
    }
  } catch (e) {
    console.error('syncTodayNotification failed:', e);
  }

  // remember signatures of every planned "today" notification (latest 40)
  const sigs: Record<string, string> = {};
  for (const p of plan) if (p.extra.kind === 'today') sigs[p.id] = `${p.title}|${p.body}|${p.largeBody}`;
  if (todayEntry && !plan.includes(todayEntry)) sigs[todayEntry.id] = `${todayEntry.title}|${todayEntry.body}|${todayEntry.largeBody}`;
  try {
    const merged = { ...state.sigs, ...sigs };
    const keys = Object.keys(merged).slice(-40);
    localStorage.setItem(TODAY_STATE_KEY, JSON.stringify({ sigs: Object.fromEntries(keys.map((k) => [k, merged[k]])) }));
  } catch {
    // ignore
  }
  return plan;
}

/** Replace all pending native notifications with the plan for `reminders` (+ official occasions). */
export function scheduleReminderNotifications(
  reminders: Reminder[],
  eventPrefs?: EventNotifyPrefs,
  showToday = false
): Promise<void> {
  if (!isNativePlatform()) return Promise.resolve();
  syncChain = syncChain
    .then(async () => {
      await ensureAndroidChannel();
      await ensureActionTypes();
      const now = new Date();
      const fired = loadFired();
      let plan = planNotifications(reminders, now, fired, eventPrefs, showToday);

      await cancelPending();
      plan = await syncTodayNotification(plan, showToday);

      // Only mark near-term catch-ups as fired (not future schedules),
      // otherwise a reschedule after the hour would skip today's notif forever.
      const catchUpKeys: string[] = [];

      for (let i = 0; i < plan.length; i += 50) {
        const chunk = plan.slice(i, i + 50);
        await LocalNotifications.schedule({
          notifications: chunk.map((p) => {
            const isCatchUp = p.at.getTime() - now.getTime() < 30_000;
            if (isCatchUp) catchUpKeys.push(p.key);
            return {
              id: p.id,
              title: p.title,
              body: p.body,
              channelId: p.channelId,
              actionTypeId: p.actionTypeId,
              smallIcon: p.smallIcon,
              largeBody: p.largeBody,
              ongoing: p.ongoing,
              autoCancel: p.autoCancel,
              schedule: { at: p.at, allowWhileIdle: true },
              // Prefer exact alarms when the OS allows them
              isExactNotification: true,
              extra: p.extra,
            };
          }),
        });
      }

      catchUpKeys.forEach((k) => fired.add(k));
      saveFired(fired, now);

      if (typeof console !== 'undefined') {
        console.log(
          `[notifications] scheduled ${plan.length} notification(s)`,
          plan.slice(0, 5).map((p) => ({ title: p.title, at: p.at.toISOString() }))
        );
      }
    })
    .catch((e) => {
      console.error('scheduleReminderNotifications failed:', e);
    });
  return syncChain;
}

/** Remove every pending native notification (notifications turned off). */
export function cancelAllScheduledNotifications(): Promise<void> {
  if (!isNativePlatform()) return Promise.resolve();
  syncChain = syncChain
    .then(async () => {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      }
      saveSnoozes([]);
    })
    .catch((e) => {
      console.error('cancelAllScheduledNotifications failed:', e);
    });
  return syncChain;
}

// ---------------------------------------------------------------------------
// Notification buttons (done / snooze)
// ---------------------------------------------------------------------------

export interface NotificationActionEvent {
  actionId: string; // 'done' | 'snooze10' | 'snooze60' | 'tap'
  title: string;
  body: string;
  extra: Partial<NotificationExtra>;
}

/** Schedule the same notification again after `minutes`. */
export async function snoozeNotification(
  ev: Pick<NotificationActionEvent, 'title' | 'body' | 'extra'>,
  minutes: number
): Promise<void> {
  if (!isNativePlatform()) return;
  await ensureAndroidChannel();
  await ensureActionTypes();
  const at = new Date(Date.now() + minutes * 60_000);
  const key = `snooze|${ev.extra.key ?? 'n'}|${at.getTime()}`;
  const id = hashId(key);
  const channelId = ev.extra.kind === 'event' ? EVENTS_CHANNEL_ID : ANDROID_CHANNEL_ID;
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title: ev.title,
        body: ev.body,
        channelId,
        actionTypeId: ACTION_TYPE_REMINDER,
        schedule: { at, allowWhileIdle: true },
        isExactNotification: true,
        extra: { ...ev.extra, kind: 'snooze', key },
      },
    ],
  });
  saveSnoozes([...loadSnoozes(), { id, at: at.getTime() }]);
}

/**
 * Listen for taps on notification buttons. Returns a function that removes the listener.
 * Android opens the app briefly when a button is pressed; the action is handled right after.
 */
export function addNotificationActionListener(handler: (ev: NotificationActionEvent) => void): () => void {
  if (!isNativePlatform()) return () => {};
  let removed = false;
  let remove: (() => void) | null = null;
  LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    handler({
      actionId: e.actionId,
      title: e.notification.title ?? '',
      body: e.notification.body ?? '',
      extra: (e.notification.extra ?? {}) as Partial<NotificationExtra>,
    });
  })
    .then((h) => {
      if (removed) void h.remove();
      else remove = () => void h.remove();
    })
    .catch((e) => console.error('addListener failed:', e));
  return () => {
    removed = true;
    remove?.();
  };
}
