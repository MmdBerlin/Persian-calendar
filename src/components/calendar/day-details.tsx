'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Calendar, Info } from 'lucide-react';
import {
  JALALI_MONTHS,
  GREGORIAN_MONTHS,
  WEEKDAYS_FA,
  jalaliWeekday,
  jalaliToGregorian,
  toPersianDigits,
  type JalaliDate,
} from '@/lib/jalali';
import { getEventsForJalaliDate, CATEGORY_STYLES, HOLIDAY_STYLE } from '@/lib/events';
import { occursOnDate, isoOf, isCompleted, describeRepeat, isYearlyReminder } from '@/lib/reminder-schedule';
import { formatNotifyTime } from '@/lib/notification-text';
import { useEventsVersion } from '@/hooks/use-events-version';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import type { Reminder } from '@/hooks/use-reminders';
import type { AppSettings } from '@/hooks/use-settings';
import { REMINDER_TYPE_LABELS, REMINDER_TYPE_COLORS } from '@/lib/reminder-types';

interface DayDetailsProps {
  date: JalaliDate;
  reminders: Reminder[];
  settings: AppSettings;
  /** Mark an occurrence done (one-time reminders are removed) */
  onDone?: (reminderId: string, isoDay: string) => void;
  /** Undo "done" of a repeating reminder's occurrence */
  onUndo?: (reminderId: string, isoDay: string) => void;
}

export function DayDetails({ date, reminders, settings, onDone, onUndo }: DayDetailsProps) {
  const eventsVersion = useEventsVersion(); // re-render when occasion data is updated
  const weekday = jalaliWeekday(date.jy, date.jm, date.jd);
  const gregorian = jalaliToGregorian(date.jy, date.jm, date.jd);
  const gDate = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
  const gWeekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][gDate.getDay()];

  const events = useMemo(
    () => getEventsForJalaliDate(date.jy, date.jm, date.jd, settings),
    [date, settings, eventsVersion]
  );

  const dayReminders = useMemo(
    () => reminders.filter((r) => occursOnDate(r, new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd))),
    [reminders, gregorian.gy, gregorian.gm, gregorian.gd]
  );
  const dayIso = isoOf(new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd));

  // «انجام شد» برای یادآورهای سالانه فقط در روز موعد معنا دارد
  const now = new Date();
  const selectedIsToday =
    gregorian.gy === now.getFullYear() &&
    gregorian.gm === now.getMonth() + 1 &&
    gregorian.gd === now.getDate();
  const [confirmDone, setConfirmDone] = useState<Reminder | null>(null);

  return (
    <Card className="glass-card p-4 border-0 rounded-3xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-bold">این روز چی داره؟</h3>
          <p className="text-xs text-muted-foreground">مناسبت‌ها و یادآورهای همین روز</p>
        </div>
      </div>

      {/* Date display */}
      <div className="rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 p-3 mb-3">
        <div className="text-xs text-muted-foreground mb-1">{WEEKDAYS_FA[weekday]}</div>
        <div className="text-2xl font-bold mb-1">
          {toPersianDigits(date.jd)} {JALALI_MONTHS[date.jm - 1]} {toPersianDigits(date.jy)}
        </div>
        <div className="text-sm text-muted-foreground" dir="ltr">
          {gWeekday}, {GREGORIAN_MONTHS[gregorian.gm - 1]} {gregorian.gd}, {gregorian.gy}
        </div>
      </div>

      {/* Events */}
      {events.length > 0 && (
        <div className="space-y-2 mb-3">
          <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            مناسبت ها
          </div>
          {events.map((e) => {
            const style = CATEGORY_STYLES[e.category];
            return (
              <div key={e.id} className={`rounded-lg bg-background/60 border border-s-4 ${style.accent} p-2.5`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-sm">{e.title}</span>
                  <Badge variant="outline" className={`text-[10px] px-2 py-0 whitespace-nowrap ${style.badge}`}>
                    {style.short}
                  </Badge>
                </div>
                {e.hijriLabel && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {e.hijriLabel}
                    {e.approx && ' • تاریخ این سال تقریبی است'}
                  </p>
                )}
                {e.isHoliday && (
                  <div className="mt-1.5">
                    <Badge variant="outline" className={`text-[10px] px-2 py-0 ${HOLIDAY_STYLE.badge}`}>
                      {HOLIDAY_STYLE.label}
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* User reminders */}
      {dayReminders.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            یادآورهای شما
          </div>
          {dayReminders.map((r) => {
            const done = isCompleted(r, new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd));
            const repeatText = describeRepeat(r);
            // همه یادآورها: «انجام شد» فقط در روز موعد (همان امروز) فعال است
            const yearly = isYearlyReminder(r);
            const dueToday = selectedIsToday;
            return (
            <div key={r.id} className={`rounded-lg bg-background/60 border p-3 ${done ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <span className={`font-semibold text-sm ${done ? 'line-through' : ''}`}>{r.title}</span>
                <Badge variant="outline" className={`text-[10px] px-2 py-0 whitespace-nowrap ${REMINDER_TYPE_COLORS[r.type]}`}>
                  {REMINDER_TYPE_LABELS[r.type]}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                ساعت {toPersianDigits(formatNotifyTime(r))}
                {repeatText && ` • ${repeatText}`}
              </p>
              {r.description && (
                <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
              )}
              {dueToday && (done ? onUndo : onDone) && (
                <button
                  type="button"
                  onClick={() => {
                    if (done) {
                      onUndo?.(r.id, dayIso);
                      return;
                    }
                    if (yearly) setConfirmDone(r); // قبل از ثبت، اطمینان می‌گیریم
                    else onDone?.(r.id, dayIso);
                  }}
                  className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                    done
                      ? 'border-border text-muted-foreground hover:bg-muted'
                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {done ? <RotateCcw className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                  {done ? 'دستم خورد!' : 'انجام شد'}
                </button>
              )}
            </div>
            );
          })}
        </div>
      )}

      {events.length === 0 && dayReminders.length === 0 && (
        <div className="text-center py-6 text-xs text-muted-foreground">
          برای این روز مناسبت یا یادآوری نیست — با دکمه پایین یکی بساز!
        </div>
      )}

      {/* تأیید «انجام شد» برای یادآورهای سالانه (تولد، سالگرد و مانند آن) */}
      <Dialog open={confirmDone !== null} onOpenChange={(v) => !v && setConfirmDone(null)}>
        <DialogContent className="sm:max-w-sm rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg">«انجام شد» ثبت بشه؟</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            «{confirmDone?.title}» برای امسال انجام‌شده ثبت می‌شه و تا سال بعد دیگه یادآوری نمی‌گیری. مطمئنی؟
          </p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirmDone(null)} className="rounded-2xl">
              انصراف
            </Button>
            <Button
              onClick={() => {
                if (confirmDone) onDone?.(confirmDone.id, dayIso);
                setConfirmDone(null);
              }}
              className="rounded-2xl"
            >
              بله، انجام شد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
