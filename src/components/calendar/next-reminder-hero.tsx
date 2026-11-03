'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Clock3, CalendarDays } from 'lucide-react';
import type { Reminder } from '@/hooks/use-reminders';
import {
  JALALI_MONTHS,
  WEEKDAYS_FA,
  toPersianDigits,
  gregorianToJalali,
  jalaliWeekday,
} from '@/lib/jalali';
import { nextOccurrence, startOfDay } from '@/lib/reminder-schedule';
import { formatNotifyTime } from '@/lib/notification-text';
import { ReminderTypeIcon } from '@/components/calendar/reminder-type-icon';

/**
 * کارت «نزدیک‌ترین یادآور» بالای تب تقویم:
 * آیکون دسته، عنوان، روز سررسید و ساعتش — با یه نگاه معلوم می شه چی در راهه.
 */
export function NextReminderHero({
  reminders,
  onAdd,
}: {
  reminders: Reminder[];
  onAdd: () => void;
}) {
  const next = useMemo(() => {
    const today = startOfDay(new Date());
    const items = reminders
      .map((r) => ({ r, occ: nextOccurrence(r, today) }))
      .filter((x) => x.occ !== null)
      .sort((a, b) => a.occ!.days - b.occ!.days);
    return items[0] ?? null;
  }, [reminders]);

  if (!next) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="w-full rounded-3xl bg-gradient-to-l from-primary to-primary/80 text-primary-foreground p-4 flex items-center gap-3 shadow-lg shadow-primary/25 active:scale-[0.99] transition-transform"
      >
        <div className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
          <Plus className="h-5 w-5" />
        </div>
        <div className="text-right">
          <div className="text-sm font-bold">هنوز یادآوری نداری!</div>
          <div className="text-xs text-primary-foreground/80 mt-0.5">بزن تا اولین یادآورت رو اضافه کنی</div>
        </div>
      </button>
    );
  }

  const { r, occ } = next;
  const j = gregorianToJalali(occ!.date.getFullYear(), occ!.date.getMonth() + 1, occ!.date.getDate());
  const days = occ!.days;
  const time = formatNotifyTime(r);
  const isToday = days === 0;
  const isTomorrow = days === 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-3xl bg-gradient-to-l from-primary to-primary/85 text-primary-foreground p-4 shadow-lg shadow-primary/25"
    >
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
          <ReminderTypeIcon type={r.type} className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0 text-right">
          <div className="text-[10px] font-medium text-primary-foreground/75 flex items-center gap-1">
            <Clock3 className="h-3 w-3" />
            نزدیک‌ترین یادآورت
          </div>
          <div className="text-base font-bold truncate mt-0.5">{r.title}</div>
          <div className="text-[10px] text-primary-foreground/85 mt-0.5 flex items-center gap-1 min-w-0 whitespace-nowrap">
            <CalendarDays className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">
              {WEEKDAYS_FA[jalaliWeekday(j.jy, j.jm, j.jd)]} {toPersianDigits(j.jd)} {JALALI_MONTHS[j.jm - 1]}
              {' • '}
              ساعت {toPersianDigits(time)}
            </span>
          </div>
        </div>
        <div
          className={`shrink-0 rounded-2xl px-3 py-2 text-center font-bold ${
            isToday ? 'bg-rose-500' : 'bg-white/20'
          }`}
        >
          <div className="text-sm leading-tight">
            {isToday ? 'امروز!' : isTomorrow ? 'فردا' : `${toPersianDigits(days)} روز`}
          </div>
          {!isToday && !isTomorrow && (
            <div className="text-[9px] font-normal text-primary-foreground/80 leading-tight">دیگه</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
