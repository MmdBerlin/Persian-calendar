/**
 * Reminder scheduling rules: repeat (daily / weekly / monthly / yearly), several
 * "days before" offsets, completed occurrences. Pure functions, no React, no native calls.
 *
 * Dates are local-midnight `Date` objects. A reminder lives in its own calendar
 * (`jalali` or `gregorian`), so "monthly" means "the same day of each month of that calendar".
 */

import type { Reminder } from '@/hooks/use-reminders';
import {
  gregorianToJalali,
  jalaliToGregorian,
  jalaliMonthLength,
  JALALI_MONTHS,
  GREGORIAN_MONTHS,
  WEEKDAYS_FA,
  jalaliWeekday,
  toPersianDigits,
} from '@/lib/jalali';

export type RepeatKind = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export const REPEAT_LABELS: Record<RepeatKind, string> = {
  none: 'ندارد',
  daily: 'روزانه',
  weekly: 'هفتگی',
  monthly: 'ماهانه',
  yearly: 'سالانه',
};

/** Preset "days before" choices shown in the form. */
export const OFFSET_PRESETS = [0, 1, 2, 3, 7, 14, 30];

const YEARS_AHEAD = 3;
/** How far ahead (in days) sub-yearly repeats are expanded. */
const HORIZON_DAYS: Record<'daily' | 'weekly' | 'monthly', number> = {
  daily: 45,
  weekly: 200,
  monthly: 420,
};

// ---------------------------------------------------------------------------
// Basic date helpers
// ---------------------------------------------------------------------------

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
/** Whole days from a to b (b - a), DST safe. */
export function diffDays(a: Date, b: Date): number {
  return Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
      Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
      86400000
  );
}
export function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Cal = 'jalali' | 'gregorian';
interface Parts {
  y: number;
  m: number;
  d: number;
}

export function partsOf(date: Date, cal: Cal): Parts {
  if (cal === 'jalali') {
    const j = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    return { y: j.jy, m: j.jm, d: j.jd };
  }
  return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
}

function monthLength(cal: Cal, y: number, m: number): number {
  return cal === 'jalali' ? jalaliMonthLength(y, m) : new Date(y, m, 0).getDate();
}

/** Date of (y, m, d) in `cal`; the day is clamped to the month length (31st in a 30-day month, 30 Esfand...). */
export function buildDate(cal: Cal, y: number, m: number, d: number): Date {
  const day = Math.min(d, monthLength(cal, y, m));
  if (cal === 'jalali') {
    const g = jalaliToGregorian(y, m, day);
    return new Date(g.gy, g.gm - 1, g.gd);
  }
  return new Date(y, m - 1, day);
}

// ---------------------------------------------------------------------------
// Reminder settings (with backward compatibility for old stored reminders)
// ---------------------------------------------------------------------------

export function repeatOf(r: Pick<Reminder, 'repeat' | 'annual'>): RepeatKind {
  return r.repeat ?? (r.annual ? 'yearly' : 'none');
}

export function repeatEveryOf(r: Pick<Reminder, 'repeatEvery'>): number {
  const n = Math.floor(Number(r.repeatEvery ?? 1));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 365) : 1;
}

/** "Days before" at which this reminder notifies, largest first (e.g. [3, 1, 0]). Always has at least one value. */
export function offsetsOf(r: Pick<Reminder, 'notifyOffsets' | 'notifyDaysBefore'>): number[] {
  let list: number[];
  if (Array.isArray(r.notifyOffsets) && r.notifyOffsets.length > 0) {
    list = r.notifyOffsets;
  } else {
    const before = Math.max(0, Math.floor(r.notifyDaysBefore || 0));
    list = before > 0 ? [before, 0] : [0];
  }
  const clean = [...new Set(list.map((n) => Math.floor(Number(n))).filter((n) => Number.isFinite(n) && n >= 0 && n <= 365))];
  clean.sort((a, b) => b - a);
  return clean.length > 0 ? clean : [0];
}

export function isCompleted(r: Pick<Reminder, 'completed'>, day: Date): boolean {
  return !!r.completed && r.completed.includes(isoOf(day));
}

/** First date of a repeating reminder (needs a year; falls back to the creation year). */
function anchorOf(r: Reminder): Date {
  const y = r.year ?? partsOf(new Date(r.createdAt || Date.now()), r.calendar).y;
  return buildDate(r.calendar, y, r.month, r.day);
}

// ---------------------------------------------------------------------------
// Occurrences
// ---------------------------------------------------------------------------

/** True when the reminder falls on `date` (used by the calendar grid and the day panel). */
export function occursOnDate(r: Reminder, date: Date): boolean {
  const day = startOfDay(date);
  const kind = repeatOf(r);
  const p = partsOf(day, r.calendar);

  switch (kind) {
    case 'none':
      return r.year ? p.y === r.year && p.m === r.month && p.d === r.day : p.m === r.month && p.d === r.day;
    case 'yearly': {
      if (r.year && (r.type === 'birthday' || r.type === 'anniversary') && p.y < r.year) return false;
      return diffDays(buildDate(r.calendar, p.y, r.month, r.day), day) === 0;
    }
    case 'daily':
    case 'weekly': {
      const step = repeatEveryOf(r) * (kind === 'weekly' ? 7 : 1);
      const delta = diffDays(anchorOf(r), day);
      return delta >= 0 && delta % step === 0;
    }
    case 'monthly': {
      const a = partsOf(anchorOf(r), r.calendar);
      const months = (p.y - a.y) * 12 + (p.m - a.m);
      if (months < 0 || months % repeatEveryOf(r) !== 0) return false;
      return diffDays(buildDate(r.calendar, p.y, p.m, r.day), day) === 0 && diffDays(anchorOf(r), day) >= 0;
    }
  }
}

/** Upcoming dates (>= from), nearest first, regardless of completion. */
export function upcomingOccurrences(r: Reminder, from: Date, max = 40): Date[] {
  const kind = repeatOf(r);
  const cal = r.calendar;
  const f = startOfDay(from);
  const out: Date[] = [];

  if (kind === 'none') {
    if (r.year) {
      const d = buildDate(cal, r.year, r.month, r.day);
      if (d >= f) out.push(d);
      return out;
    }
    const y0 = partsOf(f, cal).y;
    for (let k = 0; k <= 1; k++) {
      const d = buildDate(cal, y0 + k, r.month, r.day);
      if (d >= f) {
        out.push(d);
        break;
      }
    }
    return out;
  }

  if (kind === 'yearly') {
    const y0 = partsOf(f, cal).y;
    for (let k = 0; k <= YEARS_AHEAD + 1 && out.length < max; k++) {
      const y = y0 + k;
      if (r.year && (r.type === 'birthday' || r.type === 'anniversary') && y < r.year) continue;
      const d = buildDate(cal, y, r.month, r.day);
      if (d >= f) out.push(d);
    }
    return out;
  }

  const n = repeatEveryOf(r);
  const anchor = anchorOf(r);
  const horizon = addDays(f, HORIZON_DAYS[kind]);

  if (kind === 'daily' || kind === 'weekly') {
    const step = n * (kind === 'weekly' ? 7 : 1);
    const delta = diffDays(anchor, f);
    const k0 = delta <= 0 ? 0 : Math.ceil(delta / step);
    for (let k = k0; out.length < max; k++) {
      const d = addDays(anchor, k * step);
      if (d > horizon) break;
      out.push(d);
    }
    return out;
  }

  // monthly
  const a = partsOf(anchor, cal);
  const baseIdx = a.y * 12 + (a.m - 1);
  const fromP = partsOf(f, cal);
  const fromIdx = fromP.y * 12 + (fromP.m - 1);
  const i0 = Math.max(0, Math.floor((fromIdx - baseIdx) / n) - 1);
  for (let i = i0; out.length < max; i++) {
    const idx = baseIdx + i * n;
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const d = buildDate(cal, y, m, r.day);
    if (d > horizon) break;
    if (d >= f && d >= anchor) out.push(d);
  }
  return out;
}

/** Next occurrence that is not marked done, with the number of days from `today`. */
export function nextOccurrence(r: Reminder, today: Date): { date: Date; days: number } | null {
  for (const d of upcomingOccurrences(r, today, 30)) {
    if (isCompleted(r, d)) continue;
    return { date: d, days: diffDays(startOfDay(today), d) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** "هر سال"، "هر ۲ هفته"، ... or null for a one-time reminder. */
export function describeRepeat(r: Reminder): string | null {
  const kind = repeatOf(r);
  if (kind === 'none') return null;
  const n = repeatEveryOf(r);
  const unit = { daily: 'روز', weekly: 'هفته', monthly: 'ماه', yearly: 'سال' }[kind];
  if (kind === 'yearly' || n === 1) {
    return kind === 'daily' ? 'هر روز' : `هر ${unit}`;
  }
  return `هر ${toPersianDigits(n)} ${unit}`;
}

/** "۸ آبان ۱۴۰۵" in the reminder's own calendar. */
export function formatOccurrence(date: Date, cal: Cal, withYear = true): string {
  const p = partsOf(date, cal);
  const month = cal === 'jalali' ? JALALI_MONTHS[p.m - 1] : GREGORIAN_MONTHS[p.m - 1];
  return `${toPersianDigits(p.d)} ${month}${withYear ? ' ' + toPersianDigits(p.y) : ''}`;
}

export function weekdayName(date: Date): string {
  const j = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return WEEKDAYS_FA[jalaliWeekday(j.jy, j.jm, j.jd)];
}

/** "همان روز" / "۱ روز قبل" */
export function offsetLabel(n: number): string {
  return n === 0 ? 'همان روز' : `${toPersianDigits(n)} روز قبل`;
}
