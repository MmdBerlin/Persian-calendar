'use client';

import { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CalendarDays } from 'lucide-react';
import {
  JALALI_MONTHS,
  GREGORIAN_MONTHS,
  WEEKDAYS_FA,
  toPersianDigits,
  todayJalali,
  jalaliToGregorian,
  jalaliWeekday,
  isJalaliLeap,
  type JalaliDate,
} from '@/lib/jalali';
import type { Reminder, ReminderType } from '@/hooks/use-reminders';
import {
  REMINDER_TYPE_LABELS,
  REMINDER_TYPE_GROUPS,
  REMINDER_TYPE_DEFAULTS,
  REMINDER_TYPE_HINTS,
  REMINDER_TYPE_ICON_BOX,
} from '@/lib/reminder-types';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MonthSelect } from '@/components/calendar/month-select';
import { TimePicker } from '@/components/calendar/time-picker';
import { ReminderTypeIcon } from '@/components/calendar/reminder-type-icon';
import { buildReminderMessage, formatNotifyTime } from '@/lib/notification-text';
import {
  OFFSET_PRESETS,
  REPEAT_LABELS,
  buildDate,
  formatOccurrence,
  offsetLabel,
  offsetsOf,
  partsOf,
  repeatEveryOf,
  repeatOf,
  startOfDay,
  upcomingOccurrences,
  weekdayName,
  type RepeatKind,
} from '@/lib/reminder-schedule';
import { X } from 'lucide-react';

/** "HH:MM" from <input type="time"> -> hour/minute (falls back to 09:00). */
function parseTimeInput(value: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})/.exec(value || '');
  if (!m) return { hour: 9, minute: 0 };
  return {
    hour: Math.min(23, Math.max(0, parseInt(m[1], 10))),
    minute: Math.min(59, Math.max(0, parseInt(m[2], 10))),
  };
}

export interface ReminderDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingReminder: Reminder | null;
  onSave: (data: Omit<Reminder, 'id' | 'createdAt'>) => void;
  /** New reminder: start on this (Jalali) day, e.g. the day selected in the calendar. */
  defaultDate?: JalaliDate;
}

export function ReminderDialog({ open, onOpenChange, editingReminder, onSave, defaultDate }: ReminderDialogProps) {
  const today = todayJalali();
  const todayG = jalaliToGregorian(today.jy, today.jm, today.jd);
  const startDate = defaultDate ?? today;

  const [title, setTitle] = useState(editingReminder?.title || '');
  const [description, setDescription] = useState(editingReminder?.description || '');
  const [type, setType] = useState<ReminderType>(editingReminder?.type || 'birthday');
  const [calendar, setCalendar] = useState<'jalali' | 'gregorian'>(editingReminder?.calendar || 'jalali');
  const birthLikeInitial = (editingReminder?.type || 'birthday') === 'birthday' || editingReminder?.type === 'anniversary';
  // Birth year (birthday) / first year (anniversary): optional, used for age / number of years
  const [year, setYear] = useState<string>(editingReminder && birthLikeInitial && editingReminder.year ? String(editingReminder.year) : '');
  // Year of the (first) date for events, tasks and notes
  const [startYear, setStartYear] = useState<string>(
    editingReminder && !birthLikeInitial
      ? editingReminder.year ? String(editingReminder.year) : ''
      : String(startDate.jy)
  );
  const [month, setMonth] = useState<string>(String(editingReminder?.month ?? startDate.jm));
  const [day, setDay] = useState<string>(String(editingReminder?.day ?? startDate.jd));
  const [repeat, setRepeat] = useState<RepeatKind>(
    editingReminder ? repeatOf(editingReminder) : 'yearly'
  );
  const repeatTouched = useRef(!!editingReminder);
  const offsetsTouched = useRef(!!editingReminder);
  const [repeatEvery, setRepeatEvery] = useState<string>(String(editingReminder ? repeatEveryOf(editingReminder) : 1));
  const [offsets, setOffsets] = useState<number[]>(editingReminder ? offsetsOf(editingReminder) : [0]);
  const [customOffset, setCustomOffset] = useState('');
  // Notification time as "HH:MM" (hour and minute)
  const [notifyTime, setNotifyTime] = useState<string>(
    editingReminder ? formatNotifyTime(editingReminder) : '09:00'
  );

  const hints = REMINDER_TYPE_HINTS[type];
  const birthLike = type === 'birthday' || type === 'anniversary';
  const effectiveRepeat: RepeatKind = birthLike && repeat !== 'none' ? 'yearly' : repeat;
  const everyNum = Math.min(365, Math.max(1, parseInt(repeatEvery, 10) || 1));
  const subYearly = effectiveRepeat === 'daily' || effectiveRepeat === 'weekly' || effectiveRepeat === 'monthly';
  const showStartYear = !birthLike && effectiveRepeat !== 'yearly';
  const sortedOffsets = [...offsets].sort((a, b) => b - a);

  const changeType = (t: ReminderType) => {
    setType(t);
    const def = REMINDER_TYPE_DEFAULTS[t];
    const isBirth = t === 'birthday' || t === 'anniversary';
    // Each type starts with sensible repeat / lead times (monthly + 3 days before for loan installments, ...)
    if (!repeatTouched.current) {
      setRepeat(def.repeat);
      setRepeatEvery('1');
    } else if (isBirth && repeat !== 'none') {
      setRepeat('yearly');
    }
    if (!offsetsTouched.current) setOffsets(def.offsets);
  };

  const chooseRepeat = (k: RepeatKind) => {
    repeatTouched.current = true;
    setRepeat(k);
  };

  // Switching calendar converts the date instead of re-reading the same numbers in the other calendar
  const changeCalendar = (next: 'jalali' | 'gregorian') => {
    if (next === calendar) return;
    const m = parseInt(month, 10) || 1;
    const d = parseInt(day, 10) || 1;
    const convert = (yStr: string, fallbackYear: number) => {
      const y = yStr ? parseInt(yStr, 10) : fallbackYear;
      const parts = partsOf(buildDate(calendar, y, m, d), next);
      return parts;
    };
    const ref = convert(birthLike ? year : startYear, calendar === 'jalali' ? today.jy : todayG.gy);
    setMonth(String(ref.m));
    setDay(String(ref.d));
    if (birthLike && year) setYear(String(ref.y));
    if (!birthLike && startYear) setStartYear(String(ref.y));
    setCalendar(next);
  };

  const toggleOffset = (n: number) => {
    offsetsTouched.current = true;
    setOffsets((cur) => {
      if (cur.includes(n)) return cur.length > 1 ? cur.filter((x) => x !== n) : cur; // keep at least one
      return [...cur, n];
    });
  };
  const addCustomOffset = () => {
    offsetsTouched.current = true;
    const n = parseInt(customOffset, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 365 && !offsets.includes(n)) setOffsets((cur) => [...cur, n]);
    setCustomOffset('');
  };

  const effectiveYearStr = birthLike ? year : startYear;
  const maxDay = useMemo(() => {
    const m = parseInt(month, 10);
    if (calendar === 'jalali') {
      if (m <= 6) return 31;
      if (m <= 11) return 30;
      const y = effectiveYearStr ? parseInt(effectiveYearStr, 10) : today.jy;
      return isJalaliLeap(y) ? 30 : 29;
    } else {
      const y = effectiveYearStr ? parseInt(effectiveYearStr, 10) : todayG.gy;
      return new Date(y, m, 0).getDate();
    }
  }, [calendar, month, effectiveYearStr, today.jy, todayG.gy]);

  const dayNum = parseInt(day, 10);
  const safeDay = isNaN(dayNum) || dayNum < 1 ? 1 : Math.min(dayNum, maxDay);

  const handleDayChange = (val: string) => {
    // Allow empty while typing so user can clear and retype (e.g. 18 → clear → 8)
    setDay(val.replace(/[^\d]/g, '').slice(0, 2));
  };
  const handleDayBlur = () => setDay(String(safeDay));

  // The reminder as it would be saved (also used for the preview)
  const draft = useMemo((): Omit<Reminder, 'id' | 'createdAt'> => {
    const parsedTime = parseTimeInput(notifyTime);
    const defaultYear = calendar === 'jalali' ? today.jy : todayG.gy;
    let y: number | undefined;
    if (birthLike) y = year ? parseInt(year, 10) : undefined;
    else if (effectiveRepeat === 'yearly') y = undefined;
    else y = startYear ? parseInt(startYear, 10) : subYearly ? defaultYear : undefined;
    return {
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      calendar,
      year: y,
      month: parseInt(month, 10) || 1,
      day: safeDay,
      annual: effectiveRepeat === 'yearly',
      repeat: effectiveRepeat,
      repeatEvery: subYearly ? everyNum : undefined,
      notifyDaysBefore: Math.max(...sortedOffsets),
      notifyOffsets: sortedOffsets,
      notifyHour: parsedTime.hour,
      notifyMinute: parsedTime.minute,
    };
  }, [title, description, type, calendar, year, startYear, month, safeDay, effectiveRepeat, subYearly, everyNum, sortedOffsets, notifyTime, birthLike, today.jy, todayG.gy]);

  // Next dates of this reminder, shown under the repeat options
  const nextDates = useMemo(() => {
    const probe = { ...draft, id: 'preview', createdAt: Date.now() } as Reminder;
    return upcomingOccurrences(probe, startOfDay(new Date()), 3);
  }, [draft]);

  // Live preview of the notification text for the chosen type
  const previewOffsets = sortedOffsets.length > 1 ? [sortedOffsets[0], sortedOffsets[sortedOffsets.length - 1]] : sortedOffsets;
  const previews = useMemo(
    () =>
      previewOffsets.map((off) =>
        buildReminderMessage(
          { title: title.trim() || hints.sampleTitle, type, description: description.trim() || undefined },
          off,
          year && birthLike ? 30 : null
        )
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, type, description, sortedOffsets.join(','), year, hints.sampleTitle, birthLike]
  );

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(draft);
  };

  const monthsList = calendar === 'jalali' ? JALALI_MONTHS : GREGORIAN_MONTHS;
  const repeatOptions: RepeatKind[] = birthLike ? ['none', 'yearly'] : ['none', 'daily', 'weekly', 'monthly', 'yearly'];
  const unitLabel = effectiveRepeat === 'daily' ? 'روز' : effectiveRepeat === 'weekly' ? 'هفته' : 'ماه';
  const offsetChoices = [...new Set([...OFFSET_PRESETS, ...offsets])].sort((a, b) => a - b);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {editingReminder ? 'ویرایش یادآور' : 'یادآور جدید'}
          </DialogTitle>
        </DialogHeader>

        {defaultDate && !editingReminder && (
          <div className="flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2 text-xs text-primary">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span>
              برای روز {WEEKDAYS_FA[jalaliWeekday(defaultDate.jy, defaultDate.jm, defaultDate.jd)]}{' '}
              {toPersianDigits(defaultDate.jd)} {JALALI_MONTHS[defaultDate.jm - 1]} {toPersianDigits(defaultDate.jy)}
              <span className="text-muted-foreground"> (در صورت نیاز تغییر دهید)</span>
            </span>
          </div>
        )}

        <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar px-1">
          <div className="space-y-2">
            <Label>نوع یادآور</Label>
            <Select value={type} onValueChange={(v) => changeType(v as ReminderType)} dir="rtl">
              <SelectTrigger className="w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl" className="max-h-[50vh]">
                {REMINDER_TYPE_GROUPS.map((g) => (
                  <SelectGroup key={g.label}>
                    <SelectLabel className="text-[11px]">{g.label}</SelectLabel>
                    {g.types.map((t) => (
                      <SelectItem key={t} value={t}>
                        <span className="flex items-center gap-2">
                          <span className={`h-6 w-6 rounded-lg flex items-center justify-center ${REMINDER_TYPE_ICON_BOX[t]}`}>
                            <ReminderTypeIcon type={t} className="h-3.5 w-3.5" />
                          </span>
                          {REMINDER_TYPE_LABELS[t]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">{hints.titleLabel}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={hints.titlePlaceholder}
              className="rounded-lg"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">{hints.titleHelp}</p>
          </div>

          <div className="space-y-2">
            <Label>نوع تقویم</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['jalali', 'gregorian'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => changeCalendar(c)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    calendar === c
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {c === 'jalali' ? 'شمسی' : 'میلادی'}
                </button>
              ))}
            </div>
          </div>

          {hints.yearLabel && (
            <div className="space-y-2">
              <Label htmlFor="year">{hints.yearLabel}</Label>
              <Input
                id="year"
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                placeholder={calendar === 'jalali' ? 'مثلاً ۱۳۷۰' : 'e.g. 1990'}
                className="rounded-lg"
                dir="ltr"
                inputMode="numeric"
              />
              <p className="text-[11px] text-muted-foreground">{hints.yearHelp}</p>
            </div>
          )}

          <div className={`grid gap-3 ${showStartYear ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {showStartYear && (
              <div className="space-y-2">
                <Label htmlFor="startYear">{subYearly ? 'سال شروع' : 'سال'}</Label>
                <Input
                  id="startYear"
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                  className="rounded-lg text-center"
                  dir="ltr"
                  inputMode="numeric"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>ماه</Label>
              <MonthSelect value={month} onChange={setMonth} months={monthsList} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="day">روز</Label>
              <Input
                id="day"
                value={day}
                onChange={(e) => handleDayChange(e.target.value)}
                onBlur={handleDayBlur}
                className="rounded-lg text-center"
                dir="ltr"
                inputMode="numeric"
                placeholder="۱"
                maxLength={2}
              />
            </div>
          </div>

          {/* Repeat */}
          <div className="space-y-2">
            <Label>تکرار</Label>
            <div className={`grid gap-1.5 ${birthLike ? 'grid-cols-2' : 'grid-cols-5'}`}>
              {repeatOptions.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => chooseRepeat(k)}
                  className={`px-1 py-2 rounded-xl text-[11px] font-medium transition-all ${
                    effectiveRepeat === k
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {k === 'none' ? (birthLike ? 'یک بار' : 'ندارد') : k === 'yearly' && birthLike ? 'هر سال' : REPEAT_LABELS[k]}
                </button>
              ))}
            </div>
            {subYearly && (
              <div className="flex items-center gap-2 text-sm">
                <span>هر</span>
                <Input
                  value={repeatEvery}
                  onChange={(e) => setRepeatEvery(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                  onBlur={() => setRepeatEvery(String(everyNum))}
                  className="rounded-lg text-center w-20"
                  dir="ltr"
                  inputMode="numeric"
                />
                <span>{unitLabel}</span>
                {effectiveRepeat === 'weekly' && (
                  <span className="text-[11px] text-muted-foreground">
                    (روز {nextDates[0] ? weekdayName(nextDates[0]) : ''})
                  </span>
                )}
              </div>
            )}
            {nextDates.length > 0 && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                سررسید بعدی:{' '}
                {nextDates.map((d) => `${weekdayName(d)} ${formatOccurrence(d, calendar)}`).join(' • ')}
              </p>
            )}
            {effectiveRepeat === 'monthly' && safeDay > 28 && (
              <p className="text-[11px] text-amber-600">در ماه هایی که این روز را ندارند، آخرین روز ماه اعلام می شود.</p>
            )}
          </div>

          {/* Several notification times */}
          <div className="space-y-2">
            <Label>کی‌ها یادت بندازیم؟</Label>
            <div className="flex flex-wrap gap-1.5">
              {offsetChoices.map((n) => {
                const on = offsets.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleOffset(n)}
                    className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
                      on
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted'
                    }`}
                  >
                    {offsetLabel(n)}
                    {on && !OFFSET_PRESETS.includes(n) && <X className="inline h-3 w-3 mr-1" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={customOffset}
                onChange={(e) => setCustomOffset(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                onKeyDown={(e) => e.key === 'Enter' && addCustomOffset()}
                placeholder="تعداد روز دلخواه"
                className="rounded-lg h-9 text-center"
                dir="ltr"
                inputMode="numeric"
              />
              <Button type="button" variant="outline" size="sm" className="rounded-lg h-9" onClick={addCustomOffset}>
                افزودن
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              می‌تونی مثلا «۳ روز قبل» و «۱ روز قبل» و «همان روز» رو با هم انتخاب کنی. حداقل یکی لازمه.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notifyTime">ساعت و دقیقه نوتیف</Label>
            <TimePicker
              id="notifyTime"
              value={notifyTime}
              onChange={setNotifyTime}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">توضیحات (اختیاری)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={hints.descriptionPlaceholder}
              className="rounded-lg resize-none"
              rows={2}
            />
          </div>

          <div className="rounded-xl border border-dashed bg-muted/30 p-3 space-y-2">
            <p className="text-[10px] text-muted-foreground">پیش‌نمایش نوتیف</p>
            {previews.map((p, i) => (
              <div key={i}>
                <p className="text-sm font-semibold">{p.title}</p>
                <p className="text-xs text-muted-foreground whitespace-pre-line mt-0.5">{p.body}</p>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground">
              زیر هر نوتیف دکمه‌های «انجام شد»، «۱۰ دقیقه بعد» و «۱ ساعت بعد» هست.
              {effectiveRepeat === 'none' ? ' با «انجام شد»، یادآور حذف می‌شه.' : ' با «انجام شد» فقط همین سررسید رد می‌شه.'}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-2xl">
            انصراف
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()} className="rounded-2xl">
            {editingReminder ? 'ذخیره' : 'افزودن'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
