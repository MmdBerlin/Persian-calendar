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
    <Card className="glass-card p-4 sm:p-6 border-0 rounded-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{headerInfo.primary}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{headerInfo.secondary}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUseJalali(!useJalali)}
            className="rounded-xl text-xs px-3 h-9"
          >
            {useJalali ? 'میلادی' : 'شمسی'}
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday} className="rounded-xl text-xs px-3 h-9">
            امروز
          </Button>
          <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="rounded-xl h-9 w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={goToNextMonth} className="rounded-xl h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {WEEKDAYS_FA_ABBR.map((day, idx) => (
          <div
            key={day}
            className={`text-center text-xs font-medium py-2 ${
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
          className="grid grid-cols-7 gap-1"
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
                  relative aspect-square rounded-xl p-1.5 sm:p-2 text-right transition-all duration-200
                  hover:bg-accent/60 active:scale-95
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
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-semibold">
                      {toPersianDigits(d.jd)}
                    </span>
                    <span className={`text-[10px] leading-none ${
                      today_ ? 'text-primary-foreground/70' :
                      selected_ ? 'text-primary/70' :
                      'text-muted-foreground/60'
                    }`}>
                      {gregorianDate.gd}
                    </span>
                  </div>
                  {/* Event/reminder indicators */}
                  <div className="flex flex-wrap gap-0.5 mt-auto">
                    {CATEGORY_ORDER.filter((c) => events.some((e) => e.category === c)).map((c) => (
                      <span
                        key={c}
                        className={`h-1.5 w-1.5 rounded-full ${
                          today_ ? 'bg-primary-foreground' : CATEGORY_STYLES[c].dot
                        }`}
                      />
                    ))}
                    {dayReminders.slice(0, 2).map((r, i) => (
                      <span
                        key={`r${i}`}
                        className={`h-1.5 w-1.5 rounded-full ${
                          today_ ? 'bg-primary-foreground ring-1 ring-primary-foreground/60' : REMINDER_DOT_CLASS
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Legend */}
      <div className="mt-5 pt-4 border-t flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
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

