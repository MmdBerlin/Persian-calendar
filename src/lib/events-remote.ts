/**
 * Download newer occasion data (a new Persian year) from the internet.
 *
 * Sources, in order:
 *  1. Your own JSON file (EVENTS_JSON_URL, see events-config.ts): stable, recommended.
 *  2. The yearly page of Time.ir: parsed like scripts/update-events-from-timeir.mjs does.
 *     This depends on Time.ir's page structure, so it is only a fallback.
 *
 * Nothing is replaced unless the downloaded data passes validation, so a failed or changed
 * source can never break the calendar: the bundled data stays in use.
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { RawEvent, YearData } from '@/data';
import { EVENTS_JSON_URL, TIMEIR_PAGE_URL } from '@/lib/events-config';
import { getDataYears, isValidYearData, setRemoteYear } from '@/lib/events';
import { todayJalali, toPersianDigits } from '@/lib/jalali';

const STATE_KEY = 'persian-calendar-events-update-state';
const MIN_AUTO_INTERVAL_MS = 12 * 60 * 60 * 1000;

export interface UpdateResult {
  ok: boolean;
  /** Years that were downloaded and stored */
  years: number[];
  message: string;
}

interface UpdateState {
  lastAttempt: number;
  lastSuccess?: number;
  lastMessage?: string;
}

export function getUpdateState(): UpdateState | null {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || 'null') as UpdateState | null;
  } catch {
    return null;
  }
}
function saveState(patch: Partial<UpdateState>) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({ ...(getUpdateState() ?? { lastAttempt: 0 }), ...patch }));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// HTTP (native HTTP inside the APK: no browser CORS limits)
// ---------------------------------------------------------------------------

async function httpGetText(url: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url,
      responseType: 'text',
      headers: { Accept: 'application/json,text/html;q=0.9,*/*;q=0.5', 'Accept-Language': 'fa,en;q=0.5' },
      connectTimeout: 15000,
      readTimeout: 25000,
    });
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Time.ir page parser (same logic as scripts/update-events-from-timeir.mjs)
// ---------------------------------------------------------------------------

const cleanTitle = (t: string) =>
  t
    .replace(/[\u200c\u200b]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\[\s*(.*?)\s*\]/g, ' [$1]')
    .trim();

export function parseTimeIrPage(html: string): YearData | null {
  const s = html.replace(/\\/g, '');
  const re =
    /\{"id":(\d+),"title":"(.*?)","body":"(.*?)","reoccur":(true|false),"base":(\d+),"gregorian_year":(\d+),"gregorian_month":(\d+),"gregorian_day":(\d+),.*?"jalali_year":(\d+),"jalali_month":(\d+),"jalali_day":(\d+),.*?"hijri_year":(\d+),"hijri_month":(\d+),"hijri_day":(\d+),.*?"is_holiday":(true|false),/g;
  const seen = new Set<string>();
  const events: RawEvent[] = [];
  let year = 0;
  for (const m of s.matchAll(re)) {
    const [, id, title, , , base, gy, gm, gd, jy, jm, jd, , hm, hd, hol] = m;
    const key = `${id}|${gy}|${gm}|${gd}`;
    if (seen.has(key)) continue;
    seen.add(key);
    year = Number(jy);
    events.push({
      b: Number(base) as 0 | 1 | 2,
      t: cleanTitle(title),
      jm: Number(jm),
      jd: Number(jd),
      gm: Number(gm),
      gd: Number(gd),
      hm: Number(hm),
      hd: Number(hd),
      h: hol === 'true' ? 1 : 0,
    });
  }
  if (!year) return null;
  events.sort((a, b) => a.jm - b.jm || a.jd - b.jd || a.b - b.b);
  const yd: YearData = { year, source: 'time.ir', fetchedAt: new Date().toISOString().slice(0, 10), events };
  return isValidYearData(yd) ? yd : null;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

async function fetchYearFromJson(year: number): Promise<YearData | null> {
  if (!EVENTS_JSON_URL) return null;
  const url = EVENTS_JSON_URL.replace('{year}', String(year));
  try {
    const text = await httpGetText(url);
    const data = JSON.parse(text) as YearData;
    return isValidYearData(data) && data.year === year ? data : null;
  } catch {
    return null;
  }
}

async function fetchFromTimeIr(): Promise<YearData | null> {
  try {
    return parseTimeIrPage(await httpGetText(TIMEIR_PAGE_URL));
  } catch {
    return null;
  }
}

/**
 * Download the current Persian year (and next year when it is already published).
 * `force`: manual update, also refreshes years the app already has.
 */
export async function updateEventsFromInternet(force = false): Promise<UpdateResult> {
  saveState({ lastAttempt: Date.now() });
  const jy = todayJalali().jy;
  const have = new Set(getDataYears());
  const wanted = force ? [jy, jy + 1] : [jy, jy + 1].filter((y) => !have.has(y));
  const stored: number[] = [];

  for (const y of wanted) {
    let yd = await fetchYearFromJson(y);
    if (!yd && y === jy) {
      const t = await fetchFromTimeIr();
      if (t && t.year === y) yd = t;
    }
    if (yd && setRemoteYear(yd)) stored.push(yd.year);
  }

  let result: UpdateResult;
  if (stored.length > 0) {
    result = {
      ok: true,
      years: stored,
      message: `مناسبت های سال ${stored.map((y) => toPersianDigits(y)).join(' و ')} به روز شد.`,
    };
    saveState({ lastSuccess: Date.now(), lastMessage: result.message });
  } else if (!force && wanted.length === 0) {
    result = { ok: true, years: [], message: 'داده این سال از قبل در برنامه هست.' };
  } else {
    result = {
      ok: false,
      years: [],
      message: EVENTS_JSON_URL
        ? 'دریافت انجام نشد. اینترنت را بررسی کنید یا بعدا دوباره تلاش کنید.'
        : 'دریافت از Time.ir انجام نشد (اینترنت قطع است یا ساختار سایت عوض شده). برای پایداری بیشتر، آدرس فایل JSON خودتان را در events-config.ts بگذارید.',
    };
    saveState({ lastMessage: result.message });
  }
  return result;
}

/**
 * Automatic check on app start: only when the current Persian year is missing
 * (or next year, near the end of the year), at most every 12 hours.
 */
export async function autoUpdateEventsIfNeeded(): Promise<UpdateResult | null> {
  const last = getUpdateState();
  if (last && Date.now() - last.lastAttempt < MIN_AUTO_INTERVAL_MS) return null;
  const t = todayJalali();
  const have = new Set(getDataYears());
  const needCurrent = !have.has(t.jy);
  const needNext = t.jm >= 11 && !have.has(t.jy + 1);
  if (!needCurrent && !needNext) return null;
  return updateEventsFromInternet(false);
}
