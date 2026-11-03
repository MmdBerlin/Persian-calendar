'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import {
  JALALI_MONTHS,
  GREGORIAN_MONTHS,
  WEEKDAYS_FA_ABBR,
  jalaliWeekday,
  generateJalaliMonthGrid,
  jalaliToGregorian,
  gregorianToJalali,
  todayJalali,
  toPersianDigits,
  type JalaliDate,
} from '@/lib/jalali';
import { occursOnDate } from '@/lib/reminder-schedule';
import { useEventsVersion } from '@/hooks/use-events-version';
import {
  getEventsForJalaliDate,
  CATEGORY_STYLES,
  CATEGORY_ORDER,
  HOLIDAY_STYLE,
  REMINDER_DOT_CLASS,
  type CalendarEvent,
} from '@/lib/events';
import type { Reminder } from '@/hooks/use-reminders';
import type { AppSettings } from '@/hooks/use-settings';

interface CalendarViewProps {
  reminders: Reminder[];
  selectedDate?: JalaliDate;
  onSelectDate?: (date: JalaliDate) => void;
  settings: AppSettings;
}

export function CalendarView({ reminders, selectedDate, onSelectDate, settings }: CalendarViewProps) {
  useEventsVersion(); // re-render when occasion data is updated
  const today = todayJalali();
  const [viewYear, setViewYear] = useState(today.jy);
  const [viewMonth, setViewMonth] = useState(today.jm);
  const [useJalali, setUseJalali] = useState(true);

  const grid = useMemo(() => {
    if (useJalali) {
      return generateJalaliMonthGrid(viewYear, viewMonth);
    } else {
      const j = gregorianToJalali(viewYear, viewMonth, 1);
      return generateJalaliMonthGrid(j.jy, j.jm);
    }
  }, [viewYear, viewMonth, useJalali]);

  const headerInfo = useMemo(() => {
    if (useJalali) {
      const g = jalaliToGregorian(viewYear, viewMonth, 1);
      return {
        primary: `${JALALI_MONTHS[viewMonth - 1]} ${toPersianDigits(viewYear)}`,
        secondary: `${GREGORIAN_MONTHS[g.gm - 1]} ${g.gy}`,
      };
    } else {
      const j = gregorianToJalali(viewYear, viewMonth, 1);
      return {
        primary: `${GREGORIAN_MONTHS[viewMonth - 1]} ${viewYear}`,
        secondary: `${JALALI_MONTHS[j.jm - 1]} ${toPersianDigits(j.jy)}`,
      };
    }
  }, [viewYear, viewMonth, useJalali]);

  const goToPrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setViewYear(today.jy);
    setViewMonth(today.jm);
    setUseJalali(true);
    // «امروز» روز انتخاب‌شده رو هم برمی‌گردونه به امروز
    onSelectDate?.(today);
  };

  // Get filtered events and reminders for a given Jalali date
  const getDayData = (d: JalaliDate) => {
    const events: CalendarEvent[] = getEventsForJalaliDate(d.jy, d.jm, d.jd, settings);
    const g = jalaliToGregorian(d.jy, d.jm, d.jd);

    const gDate = new Date(g.gy, g.gm - 1, g.gd);
    const dayReminders = reminders.filter((r) => occursOnDate(r, gDate));

    return { events, reminders: dayReminders, gregorianDate: g };
  };

  const isToday = (d: JalaliDate) =>
    d.jy === today.jy && d.jm === today.jm && d.jd === today.jd;

  const isSelected = (d: JalaliDate) =>
    !!selectedDate && d.jy === selectedDate.jy && d.jm === selectedDate.jm && d.jd === selectedDate.jd;

  const isCurrentMonth = (d: JalaliDate) =>
    d.jm === viewMonth && d.jy === viewYear;

  return (
    <Card className="glass-card p-5 border-0 rounded-3xl">
      {/* Header: arrows on both sides, month name centered */}
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <Button
          variant="outline"
          size="icon"
          onClick={goToPrevMonth}
          className="h-9 w-9 shrink-0 rounded-xl border-border bg-transparent shadow-none"
          aria-label="ماه قبل"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0 text-center">
          <h2 className="text-lg font-bold tracking-tight leading-tight">{headerInfo.primary}</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">{headerInfo.secondary}</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={goToNextMonth}
          className="h-9 w-9 shrink-0 rounded-xl border-border bg-transparent shadow-none"
          aria-label="ماه بعد"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick actions */}
      <div className="flex items-center justify-center gap-1 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setUseJalali(!useJalali)}
          className="rounded-lg text-[11px] px-3 h-7 text-muted-foreground"
        >
          {useJalali ? 'میلادی' : 'شمسی'}
        </Button>
        <span className="h-3 w-px bg-border" />
        <Button
          variant="ghost"
          size="sm"
          onClick={goToToday}
          className="rounded-lg text-[11px] px-3 h-7 text-muted-foreground"
        >
          امروز
        </Button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 pb-2 mb-2 border-b border-border/60">
        {WEEKDAYS_FA_ABBR.map((day, idx) => (
          <div
            key={day}
            className={`text-center text-[11px] font-normal py-1 ${
              idx === 6 ? 'text-rose-500' : 'text-muted-foreground'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${viewYear}-${viewMonth}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          className="grid grid-cols-7 gap-x-1 gap-y-1.5"
        >
          {grid.flat().map((d, idx) => {
            const { events, reminders: dayReminders, gregorianDate } = getDayData(d);
            const today_ = isToday(d);
            const selected_ = isSelected(d);
            const inMonth = isCurrentMonth(d);
            const isFriday = jalaliWeekday(d.jy, d.jm, d.jd) === 6;
            const hasHoliday = events.some((e) => e.isHoliday);

            return (
              <button
                key={idx}
                onClick={() => onSelectDate?.(d)}
                className={`
                  relative aspect-square rounded-xl flex flex-col items-center justify-center gap-1
                  transition-all duration-200 hover:bg-accent/60 active:scale-95
                  ${!inMonth ? 'opacity-30' : ''}
                  ${today_ ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30' : ''}
                  ${selected_ && !today_ ? 'ring-2 ring-primary bg-primary/5 text-primary font-semibold' : ''}
                  ${hasHoliday && !today_ && !selected_ ? 'bg-rose-50 text-rose-600' : ''}
                  ${isFriday && !today_ && !selected_ && !hasHoliday ? 'text-rose-600' : ''}
                `}
                aria-label={`${toPersianDigits(d.jd)} ${JALALI_MONTHS[d.jm - 1]}`}
                aria-current={today_ ? 'date' : undefined}
                aria-pressed={selected_}
              >
                {/* Gregorian day: tiny, faint, in the corner */}
                <span
                  className={`absolute top-1 left-1.5 text-[8px] leading-none font-normal ${
                    today_ ? 'text-primary-foreground/70' :
                    selected_ ? 'text-primary/70' :
                    'text-muted-foreground/60'
                  }`}
                >
                  {gregorianDate.gd}
                </span>
                <span className="text-sm font-medium leading-none">{toPersianDigits(d.jd)}</span>
                {/* Event/reminder dots, centered under the number */}
                <div className="flex items-center justify-center gap-[3px] h-1">
                  {CATEGORY_ORDER.filter((c) => events.some((e) => e.category === c)).map((c) => (
                    <span
                      key={c}
                      className={`h-1 w-1 rounded-full ${
                        today_ ? 'bg-primary-foreground' : CATEGORY_STYLES[c].dot
                      }`}
                    />
                  ))}
                  {dayReminders.slice(0, 2).map((r, i) => (
                    <span
                      key={`r${i}`}
                      className={`h-1 w-1 rounded-full ${
                        today_ ? 'bg-primary-foreground ring-1 ring-primary-foreground/60' : REMINDER_DOT_CLASS
                      }`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Legend */}
      <div className="mt-5 pt-4 border-t flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        {CATEGORY_ORDER.filter((c) =>
          c === 'shamsi' ? settings.showShamsiEvents : c === 'qamari' ? settings.showQamariEvents : settings.showGlobalEvents
        ).map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${CATEGORY_STYLES[c].dot}`} /> {CATEGORY_STYLES[c].short}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${HOLIDAY_STYLE.dot}`} /> {HOLIDAY_STYLE.label}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${REMINDER_DOT_CLASS}`} /> یادآور
        </span>
      </div>
    </Card>
  );
}

