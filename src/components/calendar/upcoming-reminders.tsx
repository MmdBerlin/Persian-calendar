'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Clock, Plus } from 'lucide-react';
import {
  JALALI_MONTHS,
  GREGORIAN_MONTHS,
  toPersianDigits,
  todayJalali,
  gregorianToJalali,
  type JalaliDate,
} from '@/lib/jalali';
import type { Reminder } from '@/hooks/use-reminders';
import { nextOccurrence, startOfDay } from '@/lib/reminder-schedule';
import { REMINDER_TYPE_COLORS, REMINDER_TYPE_LABELS } from '@/lib/reminder-types';
import { Badge } from '@/components/ui/badge';

interface UpcomingRemindersProps {
  reminders: Reminder[];
  limit?: number;
  /** When set, shows a + button at the bottom to add a new reminder */
  onAdd?: () => void;
  /** Text of the + button (default: افزودن یادآور جدید) */
  addLabel?: string;
}

export function UpcomingReminders({ reminders, limit = 5, onAdd, addLabel }: UpcomingRemindersProps) {
  const today = todayJalali();

  const upcoming = useMemo(() => {
    const todayDate = startOfDay(new Date());
    return reminders
      .map((r) => {
        const next = nextOccurrence(r, todayDate);
        if (!next) return null; // finished one-time reminders are not "upcoming"
        const j = gregorianToJalali(next.date.getFullYear(), next.date.getMonth() + 1, next.date.getDate());
        return { reminder: r, days: next.days, date: j as JalaliDate };
      })
      .filter((x): x is { reminder: Reminder; days: number; date: JalaliDate } => x !== null)
      .sort((a, b) => a.days - b.days)
      .slice(0, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminders, today.jy, today.jm, today.jd, limit]);

  return (
    <Card className="glass-card p-5 border-0 rounded-3xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
          <Clock className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold">یادآورهای پیش رو</h3>
          <p className="text-xs text-muted-foreground">نزدیک ترین مناسبت ها</p>
        </div>
      </div>

      {upcoming.length === 0 ? (
        <div className="text-center py-6">
          <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground mb-3">یادآوری وجود ندارد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {upcoming.map(({ reminder: r, days, date }) => {
            const isToday = days === 0;
            return (
              <div
                key={r.id}
                className={`flex items-center gap-3 p-2.5 rounded-xl ${
                  isToday ? 'bg-rose-50' : 'bg-background/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold truncate">{r.title}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${REMINDER_TYPE_COLORS[r.type]}`}>
                      {REMINDER_TYPE_LABELS[r.type]}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {toPersianDigits(date.jd)} {JALALI_MONTHS[date.jm - 1]}
                    {r.calendar === 'gregorian' && ` • ${GREGORIAN_MONTHS[r.month - 1]} ${r.day}`}
                  </div>
                </div>
                <div className={`text-xs font-medium whitespace-nowrap ${isToday ? 'text-rose-600' : 'text-muted-foreground'}`}>
                  {isToday ? 'امروز' : `${toPersianDigits(days)} روز`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {onAdd && (
        <Button
          variant="outline"
          className="w-full mt-4 rounded-2xl h-11 gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" />
          {addLabel ?? 'افزودن یادآور جدید'}
        </Button>
      )}
    </Card>
  );
}
