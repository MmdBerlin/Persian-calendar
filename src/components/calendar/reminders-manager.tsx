'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Pencil,
  Trash2,
  Bell,
  CheckCircle2,
  SquareCheck,
  RotateCcw,
} from 'lucide-react';
import {
  JALALI_MONTHS,
  GREGORIAN_MONTHS,
  toPersianDigits,
  todayJalali,
  daysBetweenJalali,
  jalaliToGregorian,
  gregorianToJalali,
  isJalaliLeap,
  type JalaliDate,
} from '@/lib/jalali';
import {
  useReminders,
  type Reminder,
  type ReminderType,
} from '@/hooks/use-reminders';
import {
  REMINDER_TYPE_LABELS,
  REMINDER_TYPE_COLORS,
} from '@/lib/reminder-types';
import { formatNotifyTime } from '@/lib/notification-text';
import { nextOccurrence, describeRepeat, isoOf, isCompleted, offsetsOf, offsetLabel, formatOccurrence, startOfDay, isYearlyReminder } from '@/lib/reminder-schedule';
import { ReminderDialog } from '@/components/calendar/reminder-dialog';
import { ReminderTypeIcon } from '@/components/calendar/reminder-type-icon';

interface RemindersManagerProps {
  remindersHook: ReturnType<typeof useReminders>;
}

export function RemindersManager({ remindersHook }: RemindersManagerProps) {
  const { reminders, addReminder, updateReminder, deleteReminder, deleteMultiple, completeOccurrence, setOccurrenceDone, lastCompletionUndo, undoLastCompletion } = remindersHook;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const backStateRef = useRef({ dialogOpen, selectionMode });
  useEffect(() => {
    backStateRef.current = { dialogOpen, selectionMode };
  }, [dialogOpen, selectionMode]);
  useEffect(() => {
    const onAppBack = (event: Event) => {
      const custom = event as CustomEvent<{ handled: boolean }>;
      if (!custom.detail || custom.detail.handled) return;
      const current = backStateRef.current;
      // While the reminder form is open it handles Back itself (one wizard step back, or close on
      // the first step). Handling it here too would close the whole form on the first press.
      if (current.dialogOpen) return;
      if (current.selectionMode) {
        custom.detail.handled = true;
        setSelectionMode(false);
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('app-back', onAppBack);
    return () => window.removeEventListener('app-back', onAppBack);
  }, []);

  const sortedReminders = useMemo(() => {
    const today = startOfDay(new Date());
    const daysOf = (r: Reminder) => nextOccurrence(r, today)?.days ?? Number.MAX_SAFE_INTEGER; // finished ones last
    return [...reminders].sort((a, b) => daysOf(a) - daysOf(b));
  }, [reminders]);

  // به‌جای یه لیست بلند و دراز، یادآورها دسته‌بندی می‌شن: امروز / این هفته / بعداً / تمام‌شده
  const groups = useMemo(() => {
    const today = startOfDay(new Date());
    const defs: { key: string; label: string; dot: string; items: Reminder[] }[] = [
      { key: 'today', label: 'امروز', dot: 'bg-rose-500', items: [] },
      { key: 'week', label: 'این هفته', dot: 'bg-amber-500', items: [] },
      { key: 'later', label: 'بعداً', dot: 'bg-primary', items: [] },
      { key: 'done', label: 'انجام‌شده یا گذشته', dot: 'bg-muted-foreground/40', items: [] },
    ];
    for (const r of sortedReminders) {
      const days = nextOccurrence(r, today)?.days ?? null;
      if (days === null) defs[3].items.push(r);
      else if (days === 0) defs[0].items.push(r);
      else if (days <= 7) defs[1].items.push(r);
      else defs[2].items.push(r);
    }
    return defs.filter((g) => g.items.length > 0);
  }, [sortedReminders]);

  const openNewDialog = () => {
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEditDialog = (id: string) => {
    if (selectionMode) {
      toggleSelect(id);
      return;
    }
    setEditingId(id);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setTimeout(() => setEditingId(null), 200);
  };

  const handleSave = (data: Omit<Reminder, 'id' | 'createdAt'>) => {
    if (editingId) {
      updateReminder(editingId, data);
    } else {
      addReminder(data);
    }
    handleClose();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    deleteMultiple([...selectedIds]);
    exitSelectionMode();
  };

  const editingReminder = editingId ? (reminders.find((r) => r.id === editingId) ?? null) : null;

  return (
    <Card className="glass-card p-5 border-0 rounded-3xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold">یادآورها</h3>
            <p className="text-xs text-muted-foreground whitespace-nowrap truncate">
              {selectionMode
                ? `${toPersianDigits(selectedIds.size)} تا انتخاب شده`
                : 'تولد، جلسه و کارهای مهم'}
            </p>
          </div>
        </div>
        {selectionMode ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={exitSelectionMode}
              className="rounded-xl text-xs h-9"
            >
              لغو
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              className="rounded-xl text-xs h-9 gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              حذف ({toPersianDigits(selectedIds.size)})
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {reminders.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setSelectionMode(true)}
                className="rounded-2xl h-9 w-9 p-0"
                aria-label="انتخاب یادآورها"
                title="انتخاب یادآورها"
              >
                <SquareCheck className="h-4.5 w-4.5" />
              </Button>
            )}
            <Button
              onClick={openNewDialog}
              className="rounded-2xl h-9 w-9 p-0"
              aria-label="افزودن یادآور"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {selectionMode && (
        <div className="mb-3 p-2 rounded-xl bg-primary/5 text-xs text-muted-foreground text-center">
          برای انتخاب، روی یادآورها ضربه بزن
        </div>
      )}

      {sortedReminders.length === 0 ? (
        <div className="text-center py-12">
          <div className="h-16 w-16 rounded-3xl bg-muted mx-auto flex items-center justify-center mb-4">
            <Bell className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            هنوز یادآوری نساختی
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            روی + بزن تا اولین یادآورت رو اضافه کنی
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[520px] overflow-y-auto no-scrollbar pr-0.5">
          {groups.map((g) => (
            <div key={g.key} className="space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${g.dot}`} />
                  <span className="text-[11px] font-bold text-muted-foreground">{g.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {toPersianDigits(g.items.length)}
                </span>
              </div>
              <div className="space-y-2">
                {g.items.map((r) => (
                  <ReminderItem
                    key={r.id}
                    reminder={r}
                    onEdit={() => openEditDialog(r.id)}
                    onDelete={() => {
                      if (typeof window !== 'undefined' && window.confirm(`«${r.title}» حذف شود؟`)) {
                        deleteReminder(r.id);
                      }
                    }}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(r.id)}
                    onDone={(iso) => completeOccurrence(r.id, iso)}
                    onUndo={(iso) => setOccurrenceDone(r.id, iso, false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ReminderDialog
        key={editingId || 'new'}
        open={dialogOpen}
        onOpenChange={(v) => { if (!v) handleClose(); }}
        editingReminder={editingReminder}
        onSave={handleSave}
      />
    </Card>
  );
}

function ReminderItem({
  reminder,
  onEdit,
  onDelete,
  selectionMode,
  isSelected,
  onDone,
  onUndo,
}: {
  reminder: Reminder;
  onEdit: () => void;
  onDelete: () => void;
  selectionMode: boolean;
  isSelected: boolean;
  /** "انجام شد": a one-time reminder is removed, a repeating one skips this occurrence */
  onDone: (isoDay: string) => void;
  onUndo: (isoDay: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const today = todayJalali();
  const next = nextOccurrence(reminder, startOfDay(new Date()));
  const days = next ? next.days : Number.MAX_SAFE_INTEGER;
  const finished = !next; // one-time reminder that is done (or already past)
  const latestCompletedIso = [...(reminder.completed ?? [])].sort().at(-1) ?? null;
  const isToday = days === 0;
  const isSoon = days > 0 && days <= 7;
  const repeatText = describeRepeat(reminder);
  const offsets = offsetsOf(reminder);
  // همه یادآورها: «انجام شد» فقط در روز موعد؛ سالانه‌ها (تولد/سالگرد) با تأیید ثبت می‌شن
  const yearly = isYearlyReminder(reminder);

  let ageInfo: string | null = null;
  if (reminder.type === 'birthday' && reminder.year) {
    const birthJ = reminder.calendar === 'jalali'
      ? { jy: reminder.year, jm: reminder.month, jd: reminder.day }
      : gregorianToJalali(reminder.year, reminder.month, reminder.day);
    const ageYears = today.jy - birthJ.jy;
    if (ageYears >= 0) {
      ageInfo = ` (${toPersianDigits(ageYears + 1)} سالگی)`;
    }
  }

  const timeLabel = formatNotifyTime(reminder);

  const handleCardClick = () => {
    if (selectionMode) {
      onEdit();
      return;
    }
    setExpanded((v) => !v);
  };
  useEffect(() => {
    const onAppBack = (event: Event) => {
      const custom = event as CustomEvent<{ handled: boolean }>;
      if (custom.detail?.handled || !expanded || selectionMode) return;
      custom.detail.handled = true;
      setExpanded(false);
    };
    window.addEventListener('app-back', onAppBack);
    return () => window.removeEventListener('app-back', onAppBack);
  }, [expanded, selectionMode]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-colors duration-200 ${
        isToday
          ? 'bg-rose-50 border-rose-200'
          : isSoon
          ? 'bg-amber-50/50 border-amber-200'
          : 'bg-background/60 border-border'
      } ${expanded ? 'shadow-md' : 'hover:shadow-sm'}`}
    >
      {/* وقتی انتخاب شده: یه لایه آبی با شفافیت ۵۰٪ روی کل کارت */}
      {isSelected && (
        <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-primary/50" aria-hidden="true" />
      )}
      <button
        type="button"
        className="w-full flex items-center gap-3 p-3 text-right"
        onClick={handleCardClick}
        aria-expanded={expanded}
      >
        <ReminderTypeIcon type={reminder.type} boxed />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{reminder.title}</span>
            <Badge variant="outline" className={`text-[10px] px-2 py-0 ${REMINDER_TYPE_COLORS[reminder.type]}`}>
              {REMINDER_TYPE_LABELS[reminder.type]}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {next
              ? formatOccurrence(next.date, reminder.calendar, repeatText !== 'هر سال')
              : `${toPersianDigits(reminder.day)} ${reminder.calendar === 'jalali' ? JALALI_MONTHS[reminder.month - 1] : GREGORIAN_MONTHS[reminder.month - 1]}`}
            {reminder.calendar === 'gregorian' && ' (میلادی)'}
            {repeatText && ` • ${repeatText}`}
            {ageInfo}
            {' • '}
            ساعت {toPersianDigits(timeLabel)}
          </div>
          {finished && (
            <div className="text-xs text-emerald-600 font-medium mt-0.5">انجام شده یا گذشته</div>
          )}
          {isToday && (
            <div className="text-xs text-rose-600 font-medium mt-0.5">امروز!</div>
          )}
          {!isToday && isSoon && (
            <div className="text-xs text-amber-600 font-medium mt-0.5">{toPersianDigits(days)} روز دیگه</div>
          )}
        </div>
      </button>

      {expanded && !selectionMode && (
        <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/50 mt-0 animate-in fade-in duration-200">
          {reminder.description && (
            <p className="text-xs text-muted-foreground pt-2">{reminder.description}</p>
          )}
          <p className="text-[11px] text-muted-foreground pt-2">
            یادآوری: {offsets.map((n) => offsetLabel(n)).join('، ')}
          </p>
          {next && !isToday && (
            <p className="text-[11px] text-muted-foreground pt-1">
              «انجام شد» فقط در روز موعدش فعال می‌شه.
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {latestCompletedIso && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 flex-1 border-primary/20 text-primary hover:bg-primary/5"
                onClick={(e) => {
                  e.stopPropagation();
                  onUndo(latestCompletedIso);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                دستم خورد!
              </Button>
            )}
            {next && isToday && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={(e) => {
                  e.stopPropagation();
                  if (yearly) {
                    setConfirmDone(true); // قبل از ثبت، اطمینان می‌گیریم
                    return;
                  }
                  onDone(isoOf(next.date));
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                انجام شد
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5 flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              ویرایش
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full rounded-xl text-destructive hover:text-destructive hover:bg-rose-50 gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            حذف یادآور
          </Button>
        </div>
      )}

      {/* تأیید «انجام شد» برای یادآورهای سالانه (تولد، سالگرد و مانند آن) */}
      <Dialog open={confirmDone} onOpenChange={setConfirmDone}>
        <DialogContent className="sm:max-w-sm rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg">«انجام شد» ثبت بشه؟</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            «{reminder.title}» برای امسال انجام‌شده ثبت می‌شه و تا سال بعد دیگه یادآوری نمی‌گیری. مطمئنی؟
          </p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirmDone(false)} className="rounded-2xl">
              انصراف
            </Button>
            <Button
              onClick={() => {
                setConfirmDone(false);
                if (next) onDone(isoOf(next.date));
              }}
              className="rounded-2xl"
            >
              بله، انجام شد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
