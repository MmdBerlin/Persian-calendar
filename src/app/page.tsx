'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { motion, useAnimationControls, useReducedMotion, AnimatePresence } from 'framer-motion';
import { CalendarView } from '@/components/calendar/calendar-view';
import { RemindersManager } from '@/components/calendar/reminders-manager';
import { DayDetails } from '@/components/calendar/day-details';
import { SettingsPanel } from '@/components/calendar/settings-panel';
import { NotesPanel } from '@/components/calendar/notes-panel';
import { NextReminderHero } from '@/components/calendar/next-reminder-hero';
import { useReminders } from '@/hooks/use-reminders';
import { useNotifications } from '@/hooks/use-notifications';
import { useSettings } from '@/hooks/use-settings';
import { useToast } from '@/hooks/use-toast';
import { todayJalali, toPersianDigits, JALALI_MONTHS, type JalaliDate } from '@/lib/jalali';
import { ReminderDialog } from '@/components/calendar/reminder-dialog';
import { useEventsVersion } from '@/hooks/use-events-version';
import { autoUpdateEventsIfNeeded } from '@/lib/events-remote';
import { checkExactAlarmSetting } from '@/lib/notifications';
import {
  Sparkles,
  Calendar,
  Bell,
  BellOff,
  BellRing,
  Settings as SettingsIcon,
  StickyNote,
  Plus,
  AlarmClock,
} from 'lucide-react';
import { ToastAction } from '@/components/ui/toast';

type Tab = 'calendar' | 'reminders' | 'notes' | 'settings';

const TAB_IDS: Tab[] = ['calendar', 'reminders', 'notes', 'settings'];

/** Smooth ease-out curve: quick start, soft landing. */
const ENTER_EASE = [0.22, 1, 0.36, 1] as const;

/**
 * One tab panel. All panels stay mounted (no re-mount lag, inputs and scroll state are kept),
 * and the panel that becomes active plays a short fade + slide in the direction of travel.
 */
function TabPanel({
  active,
  dir,
  reduceMotion,
  children,
}: {
  active: boolean;
  /** +1: slide in from the right, -1: from the left */
  dir: 1 | -1;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const controls = useAnimationControls();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!active) return;
    if (reduceMotion) {
      controls.set({ opacity: 1, x: 0, scale: 1 });
      return;
    }
    controls.start({
      opacity: [0, 1],
      x: [dir * 28, 0],
      scale: [0.985, 1],
      transition: { duration: 0.3, ease: ENTER_EASE },
    });
  }, [active, dir, reduceMotion, controls]);

  return (
    <motion.div
      aria-hidden={!active}
      animate={controls}
      className={active ? 'block' : 'hidden'}
      style={{ willChange: active ? 'transform, opacity' : undefined }}
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  const remindersHook = useReminders();
  const settingsHook = useSettings();
  const { toast } = useToast();
  const eventsVersion = useEventsVersion();
  const notificationsHook = useNotifications(remindersHook.reminders, {
    eventPrefs: settingsHook.settings.eventNotify,
    eventsVersion,
    showToday: settingsHook.settings.showTodayNotification,
    onReminderDone: remindersHook.completeOccurrence, // "انجام شد" button on a notification
  });

  // New Persian year published? Download it quietly (only when the app lacks the current year).
  useEffect(() => {
    const t = setTimeout(() => {
      autoUpdateEventsIfNeeded().catch(() => {
        /* offline or source unavailable: keep bundled data */
      });
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  const [selectedDate, setSelectedDate] = useState<JalaliDate>(() => todayJalali());
  // "+" under the calendar: add a reminder for the selected day without leaving the calendar tab
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [dayDialogKey, setDayDialogKey] = useState(0);
  const openDayDialog = useCallback(() => {
    setDayDialogKey((k) => k + 1); // fresh form (and fresh default date) every time
    setDayDialogOpen(true);
  }, []);

  const [tab, setTab] = useState<Tab>('calendar');
  const [dir, setDir] = useState<1 | -1>(1);
  const reduceMotion = useReducedMotion() ?? false;

  // Settings sub-page (the settings tab is a hub; each entry opens its own page)
  const [settingsPage, setSettingsPage] = useState<'root' | 'events' | 'converter' | 'age' | 'about'>('root');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (!t) return;
    // deferred one tick so the first render matches the server HTML (no hydration mismatch)
    const id = setTimeout(() => {
      if (t === 'reminders' || t === 'notes' || t === 'settings' || t === 'calendar') {
        setTab(t as Tab);
      } else if (t === 'converter') {
        setTab('settings');
        setSettingsPage('converter');
      } else if (t === 'age') {
        setTab('settings');
        setSettingsPage('age');
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const today = todayJalali();
  const todayFaDigits = `${toPersianDigits(today.jd)} ${JALALI_MONTHS[today.jm - 1]} ${toPersianDigits(today.jy)}`;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'calendar', label: 'تقویم', icon: <Calendar className="h-5 w-5" /> },
    { id: 'reminders', label: 'یادآورها', icon: <Bell className="h-5 w-5" /> },
    { id: 'notes', label: 'یادداشت‌ها', icon: <StickyNote className="h-5 w-5" /> },
    { id: 'settings', label: 'تنظیمات', icon: <SettingsIcon className="h-5 w-5" /> },
  ];

  const tabRef = useRef<Tab>(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  const switchTab = useCallback((id: Tab) => {
    const current = tabRef.current;
    if (current === id) return;
    // The page is RTL: later tabs are further left, so their content arrives from the left.
    setDir(TAB_IDS.indexOf(id) > TAB_IDS.indexOf(current) ? -1 : 1);
    tabRef.current = id;
    setTab(id);
  }, []);

  // Keep current navigation values available to the single system-back listener.
  const backNavRef = useRef({ dayDialogOpen, tab, settingsPage, switchTab });
  backNavRef.current = { dayDialogOpen, tab, settingsPage, switchTab };

  // Android/system Back: unwind the app's navigation stack before leaving the app.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const backState = { pcBackTrap: true };
    window.history.pushState(backState, '');
    const handlePopState = () => {
      const current = backNavRef.current;
      // Let the active child screen consume Back first (open dialog, selection mode,
      // expanded reminder). Only then unwind tabs/settings or leave from home.
      const detail = { handled: false };
      window.dispatchEvent(new CustomEvent('app-back', { detail }));
      if (detail.handled) {
        window.history.pushState(backState, '');
        return;
      }
      const hasPreviousInApp = current.dayDialogOpen || (current.tab === 'settings' && current.settingsPage !== 'root') || current.tab !== 'calendar';
      if (current.dayDialogOpen) {
        setDayDialogOpen(false);
      } else if (current.tab === 'settings' && current.settingsPage !== 'root') {
        setSettingsPage('root');
      } else if (current.tab !== 'calendar') {
        current.switchTab('calendar');
      }
      // Keep a trap only while returning to an in-app destination. On the home screen
      // let the next system Back follow the platform's normal exit behavior.
      if (hasPreviousInApp) window.history.pushState(backState, '');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ---- Bell (top-left): first tap asks for permission, after that each tap toggles on/off ----
  const suggestExactAlarm = useCallback(() => {
    // Android 12+: without the "Alarms & reminders" special access, reminders can fire minutes late
    setTimeout(() => {
      if (notificationsHook.channel !== 'capacitor') return;
      checkExactAlarmSetting()
        .then((state) => {
          if (state !== 'denied') return;
          toast({
            title: 'برای دقت دقیقه‌ای 🕐',
            description: 'اجازه «یادآورها و هشدارها» (Alarms & reminders) رو هم فعال کن تا نوتیف‌ها دقیقاً سر وقت بیان.',
            duration: 10000,
            action: (
              <ToastAction
                altText="فعال کن"
                onClick={() => notificationsHook.openExactAlarmSettings()}
              >
                فعال کن
              </ToastAction>
            ),
          });
        })
        .catch(() => { /* ignore */ });
    }, 1500);
  }, [notificationsHook.channel, toast]);

  const handleBellTap = useCallback(async () => {
    const nh = notificationsHook;
    if (nh.permission === 'unsupported') {
      toast({ title: 'اینجا نمی‌شه نوتیف فرستاد', description: 'این محیط از نوتیفیکیشن پشتیبانی نمی‌کنه' });
      return;
    }
    if (nh.permission === 'denied') {
      toast({
        title: 'نوتیف‌ها بلاک شدن',
        description:
          nh.channel === 'capacitor'
            ? 'از تنظیمات گوشی: Settings > Apps > Persian Calendar > Notifications اجازه بده'
            : 'از تنظیمات مرورگر اجازه نوتیفیکیشن بده و صفحه رو رفرش کن',
      });
      return;
    }
    if (nh.permission === 'default') {
      const ok = await nh.requestPermission();
      if (ok) {
        toast({ title: 'نوتیف‌ها روشن شد ✅', description: 'سر وقت، یادآورها رو بهت یاد می‌دیم' });
        suggestExactAlarm();
      } else {
        toast({ title: 'اجازه نوتیف داده نشد', description: 'هر وقت خواستی دوباره روی همین زنگوله بزن' });
      }
      return;
    }
    // permission already granted: each tap toggles on/off
    if (nh.enabled) {
      nh.disable();
      toast({ title: 'نوتیف‌ها خاموش شد', description: 'یادآورها سر جاشون می‌مونن؛ فقط خبر نمی‌دی' });
    } else {
      nh.enable();
      toast({ title: 'نوتیف‌ها روشن شد ✅' });
      suggestExactAlarm();
    }
  }, [notificationsHook, suggestExactAlarm, toast]);

  const bellVisual =
    notificationsHook.permission === 'default'
      ? 'ask'
      : notificationsHook.permission === 'denied'
      ? 'blocked'
      : notificationsHook.enabled
      ? 'on'
      : 'off';

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-background to-muted/30 overflow-hidden">
      {/* Header — fixed, never scrolls away */}
      <header className="shrink-0 z-50 glass safe-top border-b border-border/40">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/30 shrink-0">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight truncate" dir="ltr">Persian Calendar</h1>
              <p className="text-[10px] text-muted-foreground leading-tight truncate">یادآور، یادداشت و مناسبت‌ها</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="text-left hidden sm:block">
              <div className="text-[10px] text-muted-foreground leading-tight">امروز</div>
              <div className="text-xs font-semibold">{todayFaDigits}</div>
            </div>
            <button
              onClick={handleBellTap}
              className={`relative h-10 w-10 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 ${
                bellVisual === 'on'
                  ? 'bg-emerald-100 text-emerald-600'
                  : bellVisual === 'ask'
                  ? 'bg-primary/10 text-primary ring-2 ring-primary/30'
                  : bellVisual === 'blocked'
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-muted text-muted-foreground'
              }`}
              title={
                bellVisual === 'on'
                  ? 'نوتیف‌ها روشنه — برای خاموش کردن بزن'
                  : bellVisual === 'ask'
                  ? 'فعال‌سازی نوتیف‌ها'
                  : bellVisual === 'blocked'
                  ? 'نوتیف‌ها بلاک شدن — از تنظیمات گوشی اجازه بده'
                  : 'نوتیف‌ها خاموشه — برای روشن کردن بزن'
              }
              aria-label="روشن و خاموش کردن نوتیفیکیشن"
            >
              {bellVisual === 'on' ? (
                <Bell className="h-5 w-5" />
              ) : bellVisual === 'ask' ? (
                <BellRing className="h-5 w-5 animate-pulse" />
              ) : (
                <BellOff className="h-5 w-5" />
              )}
              {bellVisual === 'on' && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable content between the fixed header and the bottom navigation */}
      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar app-scroll">
        {/* pb-24: room for the floating navigation so the last item is never hidden behind it */}
        <div className="max-w-lg mx-auto w-full px-4 pt-5 pb-24">
          <div className="relative min-h-[50vh]">
            {(
              [
                [
                  'calendar',
                  <div key="cal" className="space-y-5">
                    <NextReminderHero reminders={remindersHook.reminders} onAdd={openDayDialog} />
                    <CalendarView
                      reminders={remindersHook.reminders}
                      selectedDate={selectedDate}
                      onSelectDate={setSelectedDate}
                      settings={settingsHook.settings}
                    />
                    <DayDetails
                      date={selectedDate}
                      reminders={remindersHook.reminders}
                      settings={settingsHook.settings}
                      onDone={remindersHook.completeOccurrence}
                      onUndo={(id, iso) => remindersHook.setOccurrenceDone(id, iso, false)}
                    />
                    {/* Thin add-reminder CTA for the selected day */}
                    <button
                      type="button"
                      onClick={openDayDialog}
                      className="w-full min-h-12 rounded-2xl border-0 bg-white hover:bg-slate-50 active:scale-[0.99] transition-all flex items-center justify-between px-4 text-right text-sm font-semibold text-foreground shadow-sm"
                    >
                      <span>یادآور برای {toPersianDigits(selectedDate.jd)}{' '}{JALALI_MONTHS[selectedDate.jm - 1]} اضافه کن</span>
                      <span className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0"><Plus className="h-4 w-4" /></span>
                    </button>
                  </div>,
                ],
                [
                  'reminders',
                  <div key="rem" className="max-w-xl mx-auto space-y-4">
                    <ExactAlarmBanner notificationsHook={notificationsHook} />
                    <RemindersManager remindersHook={remindersHook} />
                  </div>,
                ],
                ['notes', <div key="notes" className="max-w-xl mx-auto"><NotesPanel /></div>],
                [
                  'settings',
                  <SettingsPanel
                    key="settings"
                    settingsHook={settingsHook}
                    notificationsHook={notificationsHook}
                    page={settingsPage}
                    onNavigate={setSettingsPage}
                  />,
                ],
              ] as [Tab, ReactNode][]
            ).map(([id, content]) => (
              <TabPanel key={id} active={tab === id} dir={dir} reduceMotion={reduceMotion}>
                {content}
              </TabPanel>
            ))}
          </div>
          <ReminderDialog
            key={dayDialogKey}
            open={dayDialogOpen}
            onOpenChange={setDayDialogOpen}
            editingReminder={null}
            defaultDate={selectedDate}
            onSave={(data) => {
              remindersHook.addReminder(data);
              setDayDialogOpen(false);
              toast({ title: 'یادآور اضافه شد ✅' });
            }}
          />
        </div>
      </main>

      {/* Floating bottom navigation: a compact icon-only pill with a solid (non-transparent)
          background matching the app's light theme. The active tab is highlighted with the app's blue. */}
      <nav
        aria-label="ناوبری اصلی"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-50 px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <div className="pointer-events-auto mx-auto flex w-max items-center gap-2 rounded-full bg-card border border-border/60 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                aria-label={t.label}
                title={t.label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200 active:scale-95 ${
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    className="absolute inset-0 rounded-full bg-primary/10"
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-center">{t.icon}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/**
 * Android 12+: if the "Alarms & reminders" special access is off, reminders can fire
 * minutes late (or get batched in Doze). This compact banner offers the fix in one tap.
 */
function ExactAlarmBanner({ notificationsHook }: { notificationsHook: ReturnType<typeof useNotifications> }) {
  const show =
    notificationsHook.channel === 'capacitor' &&
    notificationsHook.enabled &&
    notificationsHook.exactAlarm === 'denied';
  if (!show) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 flex items-center gap-3"
      >
        <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <AlarmClock className="h-4.5 w-4.5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-amber-900">یادآورهای دقیق فعال نیست</div>
          <p className="text-[11px] text-amber-800/80 mt-0.5 leading-relaxed">
            بدون اجازه «یادآورها و هشدارها» ممکنه نوتیف‌ها چند دقیقه دیرتر بیان.
          </p>
        </div>
        <button
          type="button"
          onClick={() => notificationsHook.openExactAlarmSettings()}
          className="shrink-0 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 transition-colors"
        >
          فعال کن
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
