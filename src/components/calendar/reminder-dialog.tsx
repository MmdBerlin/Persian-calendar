'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { CalendarDays, X, Plus, Minus } from 'lucide-react';
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

/**
 * یادآور جدید/ویرایش — به‌جای فرم بلند یک‌تکه، یک شیت پایینِ صفحه (نیم‌صفحه)
 * با سه مرحله: ۱) نوع و عنوان ۲) زمان و تکرار ۳) یادآوری و توضیحات.
 * منطق ذخیره دقیقاً مثل قبل است؛ فقط چیدمان مرحله‌ای شده.
 */

const STEPS = [
  { title: 'نوع و عنوان', hint: 'اول بگو چی می‌خوای یادت بمونه' },
  { title: 'زمان و تکرار', hint: 'کی و چند بار یک بار اتفاق می‌افته؟' },
  { title: 'یادآوری', hint: 'کی‌ها و چه ساعتی خبرت کنیم؟' },
];

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
  const birthLikeInitial = (editingReminder?.type || 'birthday') === 'birthday' || editingReminder?.type === 'anniversary';
  // Existing Gregorian reminders are converted once when opened for editing; all new/edit UI is Jalali.
  const sourceYear = editingReminder?.year ?? (editingReminder?.calendar === 'gregorian' ? todayG.gy : today.jy);
  const editDateParts = editingReminder
    ? partsOf(buildDate(editingReminder.calendar || 'jalali', sourceYear, editingReminder.month, editingReminder.day), 'jalali')
    : startDate;

  const [title, setTitle] = useState(editingReminder?.title || '');
  const [description, setDescription] = useState(editingReminder?.description || '');
  const [type, setType] = useState<ReminderType>(editingReminder?.type || 'birthday');
  const calendar: 'jalali' = 'jalali';
  // Birth year (birthday) / first year (anniversary): optional, used for age / number of years
  const [year, setYear] = useState<string>(editingReminder && birthLikeInitial && editingReminder.year ? String(editDateParts.y) : '');
  // Year of the (first) date for events, tasks and notes
  const [startYear, setStartYear] = useState<string>(
    editingReminder && !birthLikeInitial
      ? editingReminder.year ? String(editDateParts.y) : ''
      : String(startDate.jy)
  );
  const [month, setMonth] = useState<string>(String(editDateParts.m));
  const [day, setDay] = useState<string>(String(editDateParts.d));
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

  // ---- wizard state ----
  const [step, setStep] = useState(0);
  const [stepDir, setStepDir] = useState<1 | -1>(1);
  const reduceMotion = useReducedMotion() ?? false;

  // Reset a new-reminder form after every close, whether it was saved or abandoned.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open && !editingReminder) {
      setTitle('');
      setDescription('');
      setType('birthday');
      setYear('');
      setStartYear(String((defaultDate ?? todayJalali()).jy));
      setMonth(String((defaultDate ?? todayJalali()).jm));
      setDay(String((defaultDate ?? todayJalali()).jd));
      setRepeat('yearly');
      setRepeatEvery('1');
      setOffsets([0]);
      setCustomOffset('');
      setNotifyTime('09:00');
      setStep(0);
      repeatTouched.current = false;
      offsetsTouched.current = false;
    }
    wasOpen.current = open;
  }, [open, editingReminder, defaultDate]);


  const goToStep = (s: number) => {
    setStepDir(s > step ? 1 : -1);
    setStep(s);
  };
  const goNext = () => goToStep(Math.min(STEPS.length - 1, step + 1));
  const goBack = () => {
    if (step === 0) onOpenChange(false);
    else goToStep(step - 1);
  };

  // Catch the physical Android back button while this multi-step drawer is open.
  const dialogBackRef = useRef(goBack);
  dialogBackRef.current = goBack;
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const state = { reminderDialogBack: true };
    window.history.pushState(state, '');
    const handleBack = (event: PopStateEvent) => {
      event.stopImmediatePropagation();
      dialogBackRef.current();
      window.history.pushState(state, '');
    };
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, [open]);

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
  const slide = reduceMotion ? 0 : 20;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent dir="rtl" className="mx-auto sm:max-w-md rounded-t-3xl h-[80dvh] max-h-[80dvh]">
        <DrawerHeader className="pb-1 text-right">
          <DrawerTitle className="text-lg text-right">
            {editingReminder ? 'ویرایش یادآور' : 'یادآور جدید'}
          </DrawerTitle>
          <DrawerDescription className="text-right text-xs">{STEPS[step].hint}</DrawerDescription>

          {/* مرحله‌ها: سه بخش با نوار پیشرفت */}
          <div className="flex items-start gap-1.5 mt-3">
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                type="button"
                onClick={() => (i < step || (i === step + 1 && step === 0 && title.trim()) ? goToStep(i) : undefined)}
                className="flex-1 text-right"
                aria-current={i === step ? 'step' : undefined}
              >
                <div
                  className={`h-1.5 rounded-full transition-colors duration-300 ${
                    i <= step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
                <span
                  className={`block text-[10px] mt-1 leading-tight transition-colors ${
                    i === step ? 'text-primary font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  {s.title}
                </span>
              </button>
            ))}
          </div>
        </DrawerHeader>

        <div
          className="px-4 pb-2 overflow-y-auto no-scrollbar flex-1 min-h-0"
          data-vaul-no-drag
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: stepDir * slide }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: stepDir * -slide }}
              transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* ---------- مرحله ۱: نوع و عنوان ---------- */}
              {step === 0 && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>نوع یادآور</Label>
                    <div className="space-y-2.5">
                      {REMINDER_TYPE_GROUPS.map((g) => (
                        <div key={g.label}>
                          <p className="text-[10px] text-muted-foreground mb-1.5">{g.label}</p>
                          <div className="grid grid-cols-4 gap-1.5">
                            {g.types.map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => changeType(t)}
                                aria-pressed={type === t}
                                className={`flex flex-col items-center gap-1 rounded-2xl py-2 px-1 border transition-all active:scale-95 ${
                                  type === t
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                                    : 'border-border/60 hover:bg-muted/50'
                                }`}
                              >
                                <span className={`h-8 w-8 rounded-xl flex items-center justify-center ${REMINDER_TYPE_ICON_BOX[t]}`}>
                                  <ReminderTypeIcon type={t} className="h-4 w-4" />
                                </span>
                                <span
                                  className={`text-[10px] leading-tight ${
                                    type === t ? 'text-primary font-semibold' : 'text-muted-foreground'
                                  }`}
                                >
                                  {REMINDER_TYPE_LABELS[t]}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">{hints.titleLabel}</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={hints.titlePlaceholder}
                      className="rounded-xl"
                    />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{hints.titleHelp}</p>
                  </div>
                </div>
              )}

              {/* ---------- مرحله ۲: زمان و تکرار ---------- */}
              {step === 1 && (
                <div className="space-y-4 pt-2">
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


                  {hints.yearLabel && (
                    <div className="space-y-2">
                      <Label htmlFor="year">{hints.yearLabel}</Label>
                      <Input
                        id="year"
                        value={year}
                        onChange={(e) => setYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                        placeholder={calendar === 'jalali' ? 'مثلاً ۱۳۷۰' : 'e.g. 1990'}
                        className="rounded-xl"
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
                          className="rounded-xl text-center"
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
                        className="rounded-xl text-center"
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
                          className="rounded-xl text-center w-20"
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
                </div>
              )}

              {/* ---------- مرحله ۳: یادآوری و توضیحات ---------- */}
              {step === 2 && (
                <div className="space-y-4 pt-2">
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
                    <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground">تعداد روز دلخواه</span>
                      <div className="flex items-center gap-3" dir="ltr">
                        <button type="button" aria-label="کم کردن روز" onClick={() => setCustomOffset(String(Math.max(0, (parseInt(customOffset, 10) || 0) - 1)))} className="h-8 w-8 rounded-lg bg-background text-muted-foreground flex items-center justify-center"><Minus className="h-4 w-4" /></button>
                        <span className="min-w-7 text-center text-sm font-semibold">{toPersianDigits(parseInt(customOffset, 10) || 0)}</span>
                        <button type="button" aria-label="افزودن روز" onClick={() => setCustomOffset(String(Math.min(365, (parseInt(customOffset, 10) || 0) + 1)))} className="h-8 w-8 rounded-lg bg-background text-primary flex items-center justify-center"><Plus className="h-4 w-4" /></button>
                        <Button type="button" size="sm" className="rounded-xl h-8" onClick={addCustomOffset}>اعمال</Button>
                      </div>
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
                      className="rounded-xl resize-none"
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
                      «انجام شد» فقط در روز موعد و فقط یک بار قابل زدن است؛
                      {effectiveRepeat === 'none'
                        ? ' با «انجام شد»، یادآور یک‌باره حذف می‌شه.'
                        : ' با «انجام شد» همین سررسید رد می‌شه و سری بعدی سر وقت خودش یادآوری می‌شه.'}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 p-4 pt-2 border-t border-border/50 bg-background">
          <Button variant="outline" onClick={goBack} className="rounded-2xl flex-1">
            {step === 0 ? 'انصراف' : 'قبلی'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={goNext} disabled={step === 0 && !title.trim()} className="rounded-2xl flex-1">
              بعدی
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={!title.trim()} className="rounded-2xl flex-1">
              {editingReminder ? 'ذخیره' : 'ثبت یادآور'}
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
