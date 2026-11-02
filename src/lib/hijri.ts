/**
 * تبدیل تاریخ میلادی/شمسی به قمری (تقریبی)
 *
 * تقویم رسمی ایران بر اساس رؤیت هلال است و ممکن است تا یک روز با محاسبه فرق کند.
 * پس این تابع فقط برای سال هایی استفاده می شود که تاریخ دقیق مناسبت های قمری آن ها از
 * Time.ir در برنامه نیست. برای سال های دارای داده Time.ir، تاریخ ها دقیقا از خود Time.ir آمده اند.
 */

import { jalaliToGregorian } from '@/lib/jalali';

export interface HijriDate {
  hy: number;
  hm: number; // 1-12
  hd: number; // 1-30
}

export const HIJRI_MONTHS = [
  'محرم',
  'صفر',
  'ربیع الاول',
  'ربیع الثانی',
  'جمادی الاول',
  'جمادی الثانیه',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذوالقعده',
  'ذوالحجه',
];

let _fmt: Intl.DateTimeFormat | null | undefined;

function getFormatter(): Intl.DateTimeFormat | null {
  if (_fmt !== undefined) return _fmt;
  try {
    _fmt = new Intl.DateTimeFormat('en-u-ca-islamic-nu-latn', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
    // مطمئن شویم تقویم قمری واقعا پشتیبانی می شود (سال قمری حدود ۱۴۰۰ تا ۱۵۰۰)
    const y = Number(_fmt.formatToParts(new Date(Date.UTC(2026, 0, 1))).find((p) => p.type === 'year')?.value);
    if (!(y > 1300 && y < 1600)) _fmt = null;
  } catch {
    _fmt = null;
  }
  return _fmt;
}

/** الگوریتم حسابی (کویتی) به عنوان پشتیبان وقتی Intl تقویم قمری ندارد */
function arithmeticHijri(gy: number, gm: number, gd: number): HijriDate {
  const a = Math.floor((14 - gm) / 12);
  const y = gy + 4800 - a;
  const m = gm + 12 * a - 3;
  let jd =
    gd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;
  jd = jd - 1948440 + 10632;
  const n = Math.floor((jd - 1) / 10631);
  jd = jd - 10631 * n + 354;
  const j =
    Math.floor((10985 - jd) / 5316) * Math.floor((50 * jd) / 17719) +
    Math.floor(jd / 5670) * Math.floor((43 * jd) / 15238);
  jd =
    jd -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  return {
    hy: Math.max(1, 30 * n + j - 30),
    hm: Math.min(12, Math.max(1, Math.floor((24 * jd) / 709))),
    hd: Math.min(30, Math.max(1, jd - Math.floor((709 * Math.floor((24 * jd) / 709)) / 24))),
  };
}

/** میلادی به قمری (تقریبی؛ ایران معمولا یک روز عقب تر از محاسبه نجومی است) */
export function gregorianToHijri(gy: number, gm: number, gd: number): HijriDate {
  const fmt = getFormatter();
  if (fmt) {
    try {
      const parts = fmt.formatToParts(new Date(Date.UTC(gy, gm - 1, gd - 1)));
      const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
      const r = { hy: get('year'), hm: get('month'), hd: get('day') };
      if (r.hy && r.hm && r.hd) return r;
    } catch {
      // به الگوریتم حسابی برمی گردیم
    }
  }
  return arithmeticHijri(gy, gm, gd);
}

/** شمسی به قمری (از طریق میلادی) */
export function jalaliToHijri(jy: number, jm: number, jd: number): HijriDate {
  const g = jalaliToGregorian(jy, jm, jd);
  return gregorianToHijri(g.gy, g.gm, g.gd);
}

export function todayHijri(): HijriDate {
  const now = new Date();
  return gregorianToHijri(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
