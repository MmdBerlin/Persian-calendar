/**
 * Jalali (Shamsi) Date Library
 * Based on the algorithm by Kazimierz M. Borkowski
 * Accurate conversion between Jalali, Gregorian, and Julian Day Number
 */

export interface JalaliDate {
  jy: number; // Jalali year
  jm: number; // Jalali month (1-12)
  jd: number; // Jalali day (1-31)
}

export interface GregorianDate {
  gy: number;
  gm: number; // 1-12
  gd: number; // 1-31
}

// Jalali month names
export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const JALALI_MONTHS_ABBR = [
  'فرو',
  'ارد',
  'خرد',
  'تیر',
  'مرد',
  'شهر',
  'مهر',
  'آبا',
  'آذر',
  'دی',
  'بهم',
  'اسف',
];

export const GREGORIAN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const GREGORIAN_MONTHS_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const WEEKDAYS_FA = ['شنبه', 'یک شنبه', 'دوشنبه', 'سه شنبه', 'چهارشنبه', 'پنج شنبه', 'جمعه'];
export const WEEKDAYS_FA_ABBR = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
export const WEEKDAYS_EN = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const WEEKDAYS_EN_ABBR = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

function mod(a: number, b: number): number {
  return a - Math.trunc(a / b) * b;
}

/**
 * Convert Gregorian Date to Julian Day Number
 */
function g2d(gy: number, gm: number, gd: number): number {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/**
 * Convert Julian Day Number to Gregorian Date
 */
function d2g(jdn: number): GregorianDate {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

/**
 * Convert Jalali Date to Julian Day Number
 */
function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + jd - 1 + (jm - 1) * 31 - div(jm, 7) * (jm - 7);
}

/**
 * Convert Julian Day Number to Jalali Date
 */
function d2j(jdn: number): JalaliDate {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(r.gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      const jm = 1 + div(k, 31);
      const jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    } else {
      k -= 186;
    }
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  const jm = 7 + div(k, 30);
  const jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

/**
 * Determine whether the Jalali year is leap
 */
function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];

  if (jy < jp || jy >= breaks[bl - 1]) {
    throw new Error('Invalid Jalali year ' + jy);
  }

  let jump = 0;
  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

/**
 * Check if a Jalali year is leap
 */
export function isJalaliLeap(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

/**
 * Get number of days in a Jalali month
 */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

/**
 * Convert Gregorian to Jalali
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  return d2j(g2d(gy, gm, gd));
}

/**
 * Convert Jalali to Gregorian
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): GregorianDate {
  return d2g(j2d(jy, jm, jd));
}

/**
 * Get the weekday of a Jalali date (0=Saturday, 6=Friday)
 */
export function jalaliWeekday(jy: number, jm: number, jd: number): number {
  const jdn = j2d(jy, jm, jd);
  // JDN 0 was a Monday. Saturday = 0 in our convention.
  // mod(jdn + 2, 7) gives 0=Saturday...6=Friday
  return mod(jdn + 2, 7);
}

/**
 * Get today's Jalali date
 */
export function todayJalali(): JalaliDate {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Get today's Gregorian date
 */
export function todayGregorian(): GregorianDate {
  const now = new Date();
  return { gy: now.getFullYear(), gm: now.getMonth() + 1, gd: now.getDate() };
}

/**
 * Format Jalali date as a string
 */
export function formatJalali(d: JalaliDate, withWeekday = false): string {
  const parts = [
    `${d.jd} ${JALALI_MONTHS[d.jm - 1]} ${d.jy}`,
  ];
  if (withWeekday) {
    const wd = jalaliWeekday(d.jy, d.jm, d.jd);
    return `${WEEKDAYS_FA[wd]}، ${parts[0]}`;
  }
  return parts[0];
}

/**
 * Format Gregorian date as a string
 */
export function formatGregorian(d: GregorianDate, withWeekday = false): string {
  const parts = [
    `${GREGORIAN_MONTHS_ABBR[d.gm - 1]} ${d.gd}, ${d.gy}`,
  ];
  if (withWeekday) {
    const date = new Date(d.gy, d.gm - 1, d.gd);
    const wd = (date.getDay() + 1) % 7; // Convert to Saturday=0
    return `${WEEKDAYS_EN[wd]}, ${parts[0]}`;
  }
  return parts[0];
}

/**
 * Calculate exact age from a Jalali birthdate
 */
export interface Age {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalWeeks: number;
  totalMonths: number;
  nextBirthdayJalali: JalaliDate;
  daysUntilNextBirthday: number;
}

export function calculateAgeFromJalali(birthJy: number, birthJm: number, birthJd: number): Age {
  const today = todayJalali();
  const birthJDN = j2d(birthJy, birthJm, birthJd);
  const todayJDN = j2d(today.jy, today.jm, today.jd);
  const totalDays = todayJDN - birthJDN;
  const totalWeeks = Math.floor(totalDays / 7);

  // Calculate years, months, days
  let years = today.jy - birthJy;
  let months = today.jm - birthJm;
  let days = today.jd - birthJd;

  if (days < 0) {
    months -= 1;
    // Get days in previous month
    const prevMonth = today.jm === 1 ? 12 : today.jm - 1;
    const prevYear = today.jm === 1 ? today.jy - 1 : today.jy;
    days += jalaliMonthLength(prevYear, prevMonth);
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMonths = years * 12 + months;

  // Calculate next birthday
  let nextBdJy = today.jy;
  let nextBdJm = birthJm;
  let nextBdJd = birthJd;
  // Handle leap year: if birth is on 30 Esfand and current year is not leap, use 29 Esfand
  if (birthJm === 12 && birthJd === 30 && !isJalaliLeap(nextBdJy)) {
    nextBdJd = 29;
  }
  let nextBdJDN = j2d(nextBdJy, nextBdJm, nextBdJd);
  if (nextBdJDN < todayJDN) {
    nextBdJy += 1;
    if (birthJm === 12 && birthJd === 30 && !isJalaliLeap(nextBdJy)) {
      nextBdJd = 29;
    } else {
      nextBdJd = birthJd;
    }
    nextBdJDN = j2d(nextBdJy, nextBdJm, nextBdJd);
  }

  const daysUntilNextBirthday = nextBdJDN - todayJDN;

  return {
    years,
    months,
    days,
    totalDays,
    totalWeeks,
    totalMonths,
    nextBirthdayJalali: { jy: nextBdJy, jm: nextBdJm, jd: nextBdJd },
    daysUntilNextBirthday,
  };
}

/**
 * Calculate age from Gregorian birthdate
 */
export function calculateAgeFromGregorian(birthGy: number, birthGm: number, birthGd: number): Age {
  const jalali = gregorianToJalali(birthGy, birthGm, birthGd);
  return calculateAgeFromJalali(jalali.jy, jalali.jm, jalali.jd);
}

/**
 * Generate calendar grid for a Jalali month
 * Always returns exactly 6 weeks (42 days) so the layout height is consistent
 * across months (no jump between 5-week and 6-week months).
 * Starts from Saturday (Persian week start).
 */
export function generateJalaliMonthGrid(jy: number, jm: number): (JalaliDate | null)[][] {
  const weeks: (JalaliDate | null)[][] = [];
  const firstDayWeekday = jalaliWeekday(jy, jm, 1); // 0=Saturday
  const monthLen = jalaliMonthLength(jy, jm);

  // Compute previous month/year for overflow days at the start
  let prevMonth = jm - 1;
  let prevYear = jy;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const prevMonthLen = jalaliMonthLength(prevYear, prevMonth);

  // Compute next month/year for overflow days at the end
  let nextMonth = jm + 1;
  let nextYear = jy;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  // Build a flat list of 42 days (6 weeks * 7 days)
  // First, fill the leading days from the previous month
  const flatDays: JalaliDate[] = [];
  for (let d = 0; d < firstDayWeekday; d++) {
    const day = prevMonthLen - firstDayWeekday + d + 1;
    flatDays.push({ jy: prevYear, jm: prevMonth, jd: day });
  }
  // Then, fill in the current month
  for (let d = 1; d <= monthLen; d++) {
    flatDays.push({ jy, jm, jd: d });
  }
  // Finally, fill the trailing days from the next month to reach 42
  let nextDay = 1;
  while (flatDays.length < 42) {
    flatDays.push({ jy: nextYear, jm: nextMonth, jd: nextDay });
    nextDay++;
  }

  // Always exactly 6 weeks (42 cells) so every month has the same visual height.
  // The previous version dropped trailing weeks that held only next-month days,
  // which made the card taller/shorter from month to month (e.g. Ordibehesht
  // next to its neighbours). Off-month cells are dimmed by the caller.
  for (let w = 0; w < 6; w++) {
    const week = flatDays.slice(w * 7, (w + 1) * 7);
    weeks.push(week);
  }
  return weeks;
}

/**
 * Convert Persian/Arabic digits to English digits
 */
export function toEnglishDigits(str: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persian[i], 'g'), String(i));
    result = result.replace(new RegExp(arabic[i], 'g'), String(i));
  }
  return result;
}

/**
 * Convert English digits to Persian digits
 */
export function toPersianDigits(num: number | string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  return String(num).replace(/[0-9]/g, (d) => persian[parseInt(d)]);
}

/**
 * Parse a date string in Jalali format (yyyy/mm/dd or dd/mm/yyyy)
 */
export function parseJalaliString(str: string): JalaliDate | null {
  const cleaned = toEnglishDigits(str).replace(/[\-.\s]/g, '/');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length !== 3) return null;
  const nums = parts.map((p) => parseInt(p, 10));
  if (nums.some((n) => isNaN(n))) return null;

  // Detect format: if first part > 31, it's yyyy/mm/dd
  if (nums[0] > 31) {
    return { jy: nums[0], jm: nums[1], jd: nums[2] };
  }
  // If last part > 31, it's dd/mm/yyyy
  if (nums[2] > 31) {
    return { jy: nums[2], jm: nums[1], jd: nums[0] };
  }
  // Default: yyyy/mm/dd
  return { jy: nums[0], jm: nums[1], jd: nums[2] };
}

/**
 * Parse a date string in Gregorian format (yyyy-mm-dd)
 */
export function parseGregorianString(str: string): GregorianDate | null {
  const cleaned = str.replace(/[\-./\s]/g, '/').trim();
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length !== 3) return null;
  const nums = parts.map((p) => parseInt(p, 10));
  if (nums.some((n) => isNaN(n))) return null;

  if (nums[0] > 31) {
    return { gy: nums[0], gm: nums[1], gd: nums[2] };
  }
  if (nums[2] > 31) {
    return { gy: nums[2], gm: nums[1], gd: nums[0] };
  }
  return { gy: nums[0], gm: nums[1], gd: nums[2] };
}

/**
 * Get number of days between two Jalali dates
 */
export function daysBetweenJalali(d1: JalaliDate, d2: JalaliDate): number {
  return j2d(d2.jy, d2.jm, d2.jd) - j2d(d1.jy, d1.jm, d1.jd);
}

/**
 * Add days to a Jalali date
 */
export function addDaysJalali(d: JalaliDate, days: number): JalaliDate {
  return d2j(j2d(d.jy, d.jm, d.jd) + days);
}

/**
 * Add months to a Jalali date
 */
export function addMonthsJalali(d: JalaliDate, months: number): JalaliDate {
  let totalMonths = d.jy * 12 + (d.jm - 1) + months;
  const jy = Math.floor(totalMonths / 12);
  const jm = (totalMonths % 12) + 1;
  let jd = d.jd;
  const maxDay = jalaliMonthLength(jy, jm);
  if (jd > maxDay) jd = maxDay;
  return { jy, jm, jd };
}
