/**
 * مناسبت ها
 *
 * منبع داده: Time.ir (صفحه تقویم سالانه). فایل های src/data/events-<سال>.json را
 * اسکریپت scripts/update-events-from-timeir.mjs می سازد.
 *
 * - شمسی و جهانی: تاریخ ثابت دارند (روز و ماه شمسی / میلادی) و برای همه سال ها نمایش داده می شوند.
 * - قمری: تاریخ شمسی دقیق هر مناسبت قمری فقط برای سال هایی که داده Time.ir دارند معتبر است.
 *   برای سال های دیگر، تاریخ از روی تقویم قمری حدود محاسبه می شود و علامت «تقریبی» می گیرد
 *   (ممکن است یک روز اختلاف داشته باشد).
 */

import { EVENT_YEARS, type RawEvent, type YearData } from '@/data';
import { jalaliToGregorian } from '@/lib/jalali';
import { jalaliToHijri, HIJRI_MONTHS } from '@/lib/hijri';
import { toPersianDigits } from '@/lib/jalali';

export type EventCategory = 'shamsi' | 'qamari' | 'global';

export interface CalendarEvent {
  id: string;
  title: string;
  category: EventCategory;
  /** تعطیل رسمی */
  isHoliday: boolean;
  /** برای مناسبت های قمری، مثلا «۱ شوال» */
  hijriLabel?: string;
  /** تاریخ شمسی این مناسبت قمری تقریبی است (سال بدون داده Time.ir) */
  approx?: boolean;
}

export interface CategoryFilter {
  showShamsiEvents: boolean;
  showQamariEvents: boolean;
  showGlobalEvents: boolean;
}

// ---------------------------------------------------------------------------
// رنگ هر دسته. کلاس ها کامل نوشته شده اند تا Tailwind آن ها را پیدا کند.
// ---------------------------------------------------------------------------

export interface CategoryStyle {
  label: string;
  short: string;
  /** نقطه روی تقویم و راهنما */
  dot: string;
  /** برچسب (badge) */
  badge: string;
  /** جعبه آیکون */
  iconBox: string;
  /** نوار رنگی کنار کارت */
  accent: string;
  /** رنگ کلید روشن در تنظیمات */
  switchOn: string;
}

export const CATEGORY_STYLES: Record<EventCategory, CategoryStyle> = {
  shamsi: {
    label: 'شمسی (ایرانی)',
    short: 'شمسی',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    iconBox: 'bg-amber-100 text-amber-700',
    accent: 'border-s-amber-400',
    switchOn: 'data-[state=checked]:bg-amber-500',
  },
  qamari: {
    label: 'قمری (مذهبی)',
    short: 'قمری',
    dot: 'bg-emerald-600',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    iconBox: 'bg-emerald-100 text-emerald-700',
    accent: 'border-s-emerald-500',
    switchOn: 'data-[state=checked]:bg-emerald-600',
  },
  global: {
    label: 'جهانی (میلادی)',
    short: 'جهانی',
    dot: 'bg-violet-500',
    badge: 'bg-violet-100 text-violet-800 border-violet-300',
    iconBox: 'bg-violet-100 text-violet-700',
    accent: 'border-s-violet-400',
    switchOn: 'data-[state=checked]:bg-violet-500',
  },
};

export const HOLIDAY_STYLE = {
  label: 'تعطیل رسمی',
  dot: 'bg-rose-600',
  badge: 'bg-rose-100 text-rose-800 border-rose-300',
};

/** رنگ نقطه یادآورهای کاربر روی تقویم: همیشه آبی اصلی برنامه */
export const REMINDER_DOT_CLASS = 'bg-primary';

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  shamsi: CATEGORY_STYLES.shamsi.label,
  qamari: CATEGORY_STYLES.qamari.label,
  global: CATEGORY_STYLES.global.label,
};

export const CATEGORY_ORDER: EventCategory[] = ['shamsi', 'qamari', 'global'];

// ---------------------------------------------------------------------------
// ساخت نمایه ها (یک بار، تنبل)
// ---------------------------------------------------------------------------

const k = (m: number, d: number) => m * 100 + d;

function pushTo<T>(map: Map<number, T[]>, key: number, item: T) {
  const arr = map.get(key);
  if (arr) arr.push(item);
  else map.set(key, [item]);
}

function toEvent(e: RawEvent, category: EventCategory, id: string): CalendarEvent {
  const ev: CalendarEvent = { id, title: e.t, category, isHoliday: e.h === 1 };
  if (category === 'qamari') ev.hijriLabel = `${toPersianDigits(e.hd)} ${HIJRI_MONTHS[e.hm - 1] ?? ''}`.trim();
  return ev;
}

interface Index {
  solar: Map<number, CalendarEvent[]>;
  global: Map<number, CalendarEvent[]>;
  /** سال شمسی -> (ماه*100+روز شمسی) -> مناسبت های قمری */
  lunarExact: Map<number, Map<number, CalendarEvent[]>>;
  /** (ماه*100+روز قمری) -> مناسبت قمری برای محاسبه تقریبی */
  lunarByHijri: Map<number, CalendarEvent[]>;
  counts: Record<EventCategory, number>;
}

let _index: Index | null = null;

// ---------------------------------------------------------------------------
// Years downloaded from the internet (stored on the phone, override bundled data)
// ---------------------------------------------------------------------------

const REMOTE_KEY = 'persian-calendar-events-remote-v1';
let _remote: YearData[] | null = null;
let _version = 0;
const _listeners = new Set<() => void>();

function loadRemote(): YearData[] {
  if (_remote) return _remote;
  _remote = [];
  if (typeof window === 'undefined') return _remote;
  try {
    const raw = localStorage.getItem(REMOTE_KEY);
    if (raw) {
      const list = JSON.parse(raw) as YearData[];
      if (Array.isArray(list)) _remote = list.filter(isValidYearData);
    }
  } catch {
    _remote = [];
  }
  return _remote;
}

/** Sanity check for data that did not ship with the app. */
export function isValidYearData(yd: unknown): yd is YearData {
  const d = yd as YearData;
  if (!d || typeof d !== 'object' || !Number.isInteger(d.year) || d.year < 1300 || d.year > 1600) return false;
  if (!Array.isArray(d.events) || d.events.length < 100 || d.events.length > 2000) return false;
  return d.events.every(
    (e) =>
      e &&
      (e.b === 0 || e.b === 1 || e.b === 2) &&
      typeof e.t === 'string' &&
      e.t.length > 0 &&
      e.t.length < 300 &&
      [e.jm, e.jd, e.gm, e.gd, e.hm, e.hd].every((n) => Number.isInteger(n) && n >= 0 && n <= 31)
  );
}

/** Bundled years + downloaded years (a downloaded year replaces the bundled one). */
function allYears(): YearData[] {
  const map = new Map<number, YearData>();
  for (const y of EVENT_YEARS) map.set(y.year, y);
  for (const y of loadRemote()) map.set(y.year, y);
  return [...map.values()];
}

/** Store a downloaded year and refresh everything that shows occasions. */
export function setRemoteYear(yd: YearData): boolean {
  if (!isValidYearData(yd)) return false;
  const list = loadRemote().filter((y) => y.year !== yd.year);
  list.push(yd);
  list.sort((a, b) => a.year - b.year);
  _remote = list.slice(-4);
  try {
    localStorage.setItem(REMOTE_KEY, JSON.stringify(_remote));
  } catch {
    // storage full: still use it for this session
  }
  _index = null;
  _version++;
  _listeners.forEach((l) => l());
  return true;
}

export function subscribeEvents(cb: () => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}
/** Changes every time occasion data is replaced (use as a dependency / re-render trigger). */
export function getEventsVersion(): number {
  return _version;
}

function newestYear(): YearData | null {
  const years = allYears();
  if (years.length === 0) return null;
  return years.reduce((a, b) => (b.year > a.year ? b : a));
}

function build(): Index {
  const idx: Index = {
    solar: new Map(),
    global: new Map(),
    lunarExact: new Map(),
    lunarByHijri: new Map(),
    counts: { shamsi: 0, qamari: 0, global: 0 },
  };
  const base = newestYear();
  if (!base) return idx;

  // شمسی و جهانی ثابت اند: از جدیدترین سال داده استفاده می کنیم
  base.events.forEach((e, i) => {
    if (e.b === 0) {
      pushTo(idx.solar, k(e.jm, e.jd), toEvent(e, 'shamsi', `s-${e.jm}-${e.jd}-${i}`));
      idx.counts.shamsi++;
    } else if (e.b === 1) {
      pushTo(idx.global, k(e.gm, e.gd), toEvent(e, 'global', `g-${e.gm}-${e.gd}-${i}`));
      idx.counts.global++;
    }
  });

  // قمری: دقیق برای هر سال داده، و الگوی تقریبی برای بقیه سال ها
  const templateSeen = new Set<string>();
  for (const yd of allYears()) {
    const m = new Map<number, CalendarEvent[]>();
    yd.events.forEach((e, i) => {
      if (e.b !== 2) return;
      pushTo(m, k(e.jm, e.jd), toEvent(e, 'qamari', `q-${yd.year}-${e.jm}-${e.jd}-${i}`));
    });
    idx.lunarExact.set(yd.year, m);
  }
  base.events.forEach((e, i) => {
    if (e.b !== 2) return;
    idx.counts.qamari++;
    const tk = `${e.hm}-${e.hd}-${e.t}`;
    if (templateSeen.has(tk)) return;
    templateSeen.add(tk);
    const ev = toEvent(e, 'qamari', `qa-${e.hm}-${e.hd}-${i}`);
    ev.approx = true;
    pushTo(idx.lunarByHijri, k(e.hm, e.hd), ev);
  });
  return idx;
}

function index(): Index {
  if (!_index) _index = build();
  return _index;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const CATEGORY_RANK: Record<EventCategory, number> = { shamsi: 0, qamari: 1, global: 2 };

/** مناسبت های یک روز شمسی، بر اساس دسته های فعال. تعطیل ها اول می آیند. */
export function getEventsForJalaliDate(
  jy: number,
  jm: number,
  jd: number,
  filter: CategoryFilter
): CalendarEvent[] {
  const idx = index();
  const out: CalendarEvent[] = [];

  if (filter.showShamsiEvents) {
    const a = idx.solar.get(k(jm, jd));
    if (a) out.push(...a);
  }

  if (filter.showQamariEvents) {
    const exact = idx.lunarExact.get(jy);
    if (exact) {
      const a = exact.get(k(jm, jd));
      if (a) out.push(...a);
    } else if (idx.lunarByHijri.size > 0) {
      const h = jalaliToHijri(jy, jm, jd);
      const a = idx.lunarByHijri.get(k(h.hm, h.hd));
      if (a) out.push(...a);
    }
  }

  if (filter.showGlobalEvents) {
    const g = jalaliToGregorian(jy, jm, jd);
    const a = idx.global.get(k(g.gm, g.gd));
    if (a) out.push(...a);
  }

  return out.sort(
    (x, y) =>
      Number(y.isHoliday) - Number(x.isHoliday) || CATEGORY_RANK[x.category] - CATEGORY_RANK[y.category]
  );
}

/** تعداد مناسبت های هر دسته (برای صفحه تنظیمات) */
export function getEventCounts(): Record<EventCategory, number> {
  return index().counts;
}

/** سال هایی که داده دقیق Time.ir دارند */
export function getDataYears(): number[] {
  return allYears().map((y) => y.year).sort((a, b) => a - b);
}

export function getDataFetchedAt(): string | null {
  return newestYear()?.fetchedAt ?? null;
}

/** آیا برای این سال، تاریخ مناسبت های قمری دقیق (از Time.ir) داریم؟ */
export function hasExactLunarYear(jy: number): boolean {
  return index().lunarExact.has(jy);
}
