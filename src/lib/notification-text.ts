/**
 * متن نوتیفیکیشن بر اساس نوع یادآور (تولد، سالگرد، مناسبت، کار، یادداشت)
 * و اینکه چند روز تا موعد مانده است.
 */

import type { Reminder } from '@/hooks/use-reminders';
import {
  gregorianToJalali,
  toPersianDigits,
  JALALI_MONTHS,
  WEEKDAYS_FA,
  jalaliWeekday,
} from '@/lib/jalali';
import type { CalendarEvent } from '@/lib/events';

export interface NotificationMessage {
  title: string;
  body: string;
}

function whenPhrase(daysUntil: number): string {
  if (daysUntil <= 0) return 'امروز';
  if (daysUntil === 1) return 'فردا';
  return `${toPersianDigits(daysUntil)} روز دیگر`;
}

/**
 * @param age سنی که فرد در همین تولد کامل می کند، یا تعداد سال های سالگرد (اگر سال شروع معلوم باشد)
 */
export function buildReminderMessage(
  r: Pick<Reminder, 'title' | 'type' | 'description'>,
  daysUntil: number,
  age?: number | null
): NotificationMessage {
  const when = whenPhrase(daysUntil);
  // "تولد علی" typed in full still reads well: drop a duplicated prefix
  const PREFIX: Partial<Record<Reminder['type'], RegExp>> = {
    birthday: /^تولد\s+/,
    anniversary: /^سالگرد\s+/,
    installment: /^قسط\s+/,
    bill: /^قبض\s+/,
    rent: /^اجاره\s+/,
    check: /^چک\s+/,
    insurance: /^بیمه\s+/,
    appointment: /^قرار\s+/,
    meeting: /^جلسه\s+/,
  };
  const name = r.title.trim().replace(PREFIX[r.type] ?? /^$/, '');
  const note = r.description?.trim();
  const hasAge = typeof age === 'number' && age > 0 && age < 150;
  const withNote = (text: string) => (note ? `${text}\n${note}` : text);

  switch (r.type) {
    case 'birthday': {
      const title = `🎂 تولد ${name}`;
      if (daysUntil <= 0) {
        return {
          title,
          body: withNote(
            hasAge
              ? `امروز تولد ${name} است؛ ${toPersianDigits(age!)} ساله می شود. تبریک بگویید!`
              : `امروز تولد ${name} است. تبریک بگویید!`
          ),
        };
      }
      return {
        title,
        body: withNote(
          hasAge
            ? `${when} تولد ${name} است و ${toPersianDigits(age!)} ساله می شود.`
            : `${when} تولد ${name} است.`
        ),
      };
    }

    case 'anniversary': {
      const title = `💍 سالگرد ${name}`;
      const years = hasAge ? ` (${toPersianDigits(age!)} سال)` : '';
      return {
        title,
        body: withNote(
          daysUntil <= 0 ? `امروز سالگرد ${name} است${years}.` : `${when} سالگرد ${name} است${years}.`
        ),
      };
    }

    case 'event': {
      const title = `📅 ${name}`;
      return {
        title,
        body: withNote(daysUntil <= 0 ? `امروز: ${name}` : `${when}: ${name}`),
      };
    }

    case 'task': {
      const title = `✅ کار: ${name}`;
      return {
        title,
        body: withNote(
          daysUntil <= 0 ? `موعد انجام «${name}» امروز است.` : `${when} موعد انجام «${name}» است.`
        ),
      };
    }

    case 'appointment':
      return {
        title: `🩺 قرار ${name}`,
        body: withNote(daysUntil <= 0 ? `امروز قرار ${name} دارید.` : `${when} قرار ${name} دارید.`),
      };

    case 'meeting':
      return {
        title: `👥 جلسه ${name}`,
        body: withNote(daysUntil <= 0 ? `جلسه ${name} امروز است.` : `${when} جلسه ${name} دارید.`),
      };

    case 'medicine':
      return {
        title: `💊 ${name}`,
        body: withNote(daysUntil <= 0 ? `وقت مصرف ${name} است.` : `${when} باید ${name} مصرف کنید.`),
      };

    case 'installment':
      return {
        title: `💳 قسط ${name}`,
        body: withNote(
          daysUntil <= 0 ? `امروز موعد پرداخت قسط ${name} است.` : `${when} موعد پرداخت قسط ${name} است.`
        ),
      };

    case 'bill':
      return {
        title: `🧾 قبض ${name}`,
        body: withNote(
          daysUntil <= 0 ? `امروز موعد پرداخت قبض ${name} است.` : `${when} موعد پرداخت قبض ${name} است.`
        ),
      };

    case 'rent':
      return {
        title: `🏠 اجاره ${name}`,
        body: withNote(
          daysUntil <= 0 ? `امروز موعد پرداخت اجاره ${name} است.` : `${when} موعد پرداخت اجاره ${name} است.`
        ),
      };

    case 'check':
      return {
        title: `📄 چک ${name}`,
        body: withNote(daysUntil <= 0 ? `امروز سررسید چک ${name} است.` : `${when} سررسید چک ${name} است.`),
      };

    case 'insurance':
      return {
        title: `🛡️ بیمه ${name}`,
        body: withNote(
          daysUntil <= 0 ? `امروز سررسید بیمه ${name} است.` : `${when} سررسید بیمه ${name} است.`
        ),
      };

    case 'note':
    default: {
      const title = `📝 ${name}`;
      return {
        title,
        body: withNote(daysUntil <= 0 ? 'یادداشت امروز شما' : `یادداشت شما برای ${when}`),
      };
    }
  }
}

/** Local notification time of a reminder (hour 0-23, minute 0-59). Defaults to 09:00. */
export function notifyTimeOf(r: Pick<Reminder, 'notifyHour' | 'notifyMinute'>): { hour: number; minute: number } {
  const hour =
    typeof r.notifyHour === 'number' && r.notifyHour >= 0 && r.notifyHour <= 23 ? Math.floor(r.notifyHour) : 9;
  const minute =
    typeof r.notifyMinute === 'number' && r.notifyMinute >= 0 && r.notifyMinute <= 59
      ? Math.floor(r.notifyMinute)
      : 0;
  return { hour, minute };
}

/** "09:05" */
export function formatNotifyTime(r: Pick<Reminder, 'notifyHour' | 'notifyMinute'>): string {
  const { hour, minute } = notifyTimeOf(r);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Age (birthday) or number of years (anniversary) reached on the occurrence `day`,
 * when the reminder has a start year. Otherwise null.
 */
export function occurrenceAge(
  r: Pick<Reminder, 'type' | 'year' | 'calendar'>,
  day: Date
): number | null {
  if (!r.year || (r.type !== 'birthday' && r.type !== 'anniversary')) return null;
  const occYear =
    r.calendar === 'jalali'
      ? gregorianToJalali(day.getFullYear(), day.getMonth() + 1, day.getDate()).jy
      : day.getFullYear();
  const n = occYear - r.year;
  return n > 0 ? n : null;
}

const CATEGORY_EMOJI: Record<CalendarEvent['category'], string> = { shamsi: '📅', qamari: '🕌', global: '🌍' };

/**
 * One notification for all official occasions of a day.
 * "فردا تعطیل رسمی است" when a holiday is among them, otherwise "فردا: <occasion>".
 */
export function buildEventMessage(events: CalendarEvent[], daysUntil: number): NotificationMessage {
  const when = whenPhrase(daysUntil);
  const holiday = events.some((e) => e.isHoliday);
  const lines = events.map((e) => (e.approx ? `${e.title} (تاریخ تقریبی)` : e.title));
  if (holiday) {
    return { title: `🏖️ ${when} تعطیل رسمی است`, body: lines.join('\n') };
  }
  const first = events[0];
  return {
    title: `${CATEGORY_EMOJI[first.category]} ${when}: ${first.title}`,
    body: events.length > 1 ? lines.slice(1).join('\n') : first.hijriLabel ? first.hijriLabel : 'مناسبت تقویم',
  };
}

const GREGORIAN_MONTHS_FA = [
  'ژانویه',
  'فوریه',
  'مارس',
  'آوریل',
  'مه',
  'ژوئن',
  'ژوئیه',
  'اوت',
  'سپتامبر',
  'اکتبر',
  'نوامبر',
  'دسامبر',
];

export interface TodayMessage extends NotificationMessage {
  /** Expanded text (shown when the notification is pulled open) */
  largeBody: string;
  /** Jalali day of month 1-31: picks the status-bar icon ic_day_<n> */
  dayNumber: number;
}

/** The always-visible "today" notification. */
export function buildTodayMessage(
  day: Date,
  events: CalendarEvent[],
  reminderCount: number
): TodayMessage {
  const j = gregorianToJalali(day.getFullYear(), day.getMonth() + 1, day.getDate());
  const weekday = WEEKDAYS_FA[jalaliWeekday(j.jy, j.jm, j.jd)];
  const jalaliText = `${weekday} ${toPersianDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${toPersianDigits(j.jy)}`;
  const gregorianText = `${toPersianDigits(day.getDate())} ${GREGORIAN_MONTHS_FA[day.getMonth()]} ${toPersianDigits(day.getFullYear())}`;
  const holiday = events.some((e) => e.isHoliday);

  const lines: string[] = [gregorianText];
  for (const e of events.slice(0, 5)) lines.push(`${e.isHoliday ? '🏖️' : '•'} ${e.title}`);
  if (events.length > 5) lines.push(`و ${toPersianDigits(events.length - 5)} مناسبت دیگر`);
  if (reminderCount > 0) lines.push(`🔔 ${toPersianDigits(reminderCount)} یادآور برای امروز`);

  const shortParts = [gregorianText];
  if (holiday) shortParts.push('تعطیل رسمی');
  else if (events[0]) shortParts.push(events[0].title);
  if (reminderCount > 0) shortParts.push(`${toPersianDigits(reminderCount)} یادآور`);

  return {
    title: jalaliText,
    body: shortParts.join(' • '),
    largeBody: lines.join('\n'),
    dayNumber: j.jd,
  };
}
