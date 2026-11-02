'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Globe,
  Moon,
  Info,
  Heart,
  ArrowRightLeft,
  Cake,
  ChevronLeft,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { useSettings } from '@/hooks/use-settings';
import { useNotifications } from '@/hooks/use-notifications';
import { CATEGORY_STYLES, getEventCounts, getDataYears, getDataFetchedAt } from '@/lib/events';
import { updateEventsFromInternet, getUpdateState } from '@/lib/events-remote';
import { useEventsVersion } from '@/hooks/use-events-version';
import { toPersianDigits } from '@/lib/jalali';
import { DateConverter } from '@/components/calendar/date-converter';
import { AgeCalculator } from '@/components/calendar/age-calculator';
import { EventNotificationSettings } from '@/components/calendar/event-notification-settings';

export type SettingsSubPage = 'root' | 'events' | 'converter' | 'age' | 'about';

interface SettingsPanelProps {
  settingsHook: ReturnType<typeof useSettings>;
  notificationsHook: ReturnType<typeof useNotifications>;
  /** Which inner page is open (state lives in the parent so it survives tab switches) */
  page: SettingsSubPage;
  onNavigate: (page: SettingsSubPage) => void;
}

export function SettingsPanel({ settingsHook, notificationsHook, page, onNavigate }: SettingsPanelProps) {
  const goBack = () => onNavigate('root');

  return (
    <div className="max-w-xl mx-auto">
      <AnimatePresence mode="wait" initial={false}>
        {page === 'root' && (
          <motion.div
            key="root"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <SettingsRoot onNavigate={onNavigate} />
          </motion.div>
        )}
        {page === 'events' && (
          <motion.div
            key="events"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <SubPageHeader title="مناسبت‌ها" description="مدیریت و اطلاع‌رسانی مناسبت‌ها" onBack={goBack} />
            <EventsPage settingsHook={settingsHook} notificationsHook={notificationsHook} />
          </motion.div>
        )}
        {page === 'converter' && (
          <motion.div
            key="converter"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <SubPageHeader title="تبدیل تاریخ" description="شمسی ↔ میلادی، فقط با یه کلیک" onBack={goBack} />
            <div className="grid sm:grid-cols-2 gap-5">
              <DateConverter />
            </div>
          </motion.div>
        )}
        {page === 'age' && (
          <motion.div
            key="age"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <SubPageHeader title="محاسبه سن" description="سن دقیق و روزهای تولد بعدی" onBack={goBack} />
            <div className="grid sm:grid-cols-2 gap-5">
              <AgeCalculator />
            </div>
          </motion.div>
        )}
        {page === 'about' && (
          <motion.div
            key="about"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <SubPageHeader title="درباره ما" description="خودمون رو بیشتر بشناس" onBack={goBack} />
            <AboutPage />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------- Root (hub) ------------------------------- */

function SettingsRoot({ onNavigate }: { onNavigate: (p: SettingsSubPage) => void }) {
  const entries: { page: SettingsSubPage; icon: React.ReactNode; iconBox: string; title: string; desc: string }[] = [
    {
      page: 'events',
      icon: <Heart className="h-5 w-5" />,
      iconBox: 'bg-amber-100 text-amber-600',
      title: 'مناسبت‌ها',
      desc: 'مدیریت مناسبت‌ها و اطلاع‌رسانی‌شون',
    },
    {
      page: 'converter',
      icon: <ArrowRightLeft className="h-5 w-5" />,
      iconBox: 'bg-sky-100 text-sky-600',
      title: 'تبدیل تاریخ',
      desc: 'شمسی به میلادی و برعکس',
    },
    {
      page: 'age',
      icon: <Cake className="h-5 w-5" />,
      iconBox: 'bg-pink-100 text-pink-600',
      title: 'محاسبه سن',
      desc: 'سن دقیقت و چند روز تا تولد بعدی',
    },
    {
      page: 'about',
      icon: <Info className="h-5 w-5" />,
      iconBox: 'bg-violet-100 text-violet-600',
      title: 'درباره ما',
      desc: 'نسخه اپ، حریم خصوصی و...',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h2 className="text-xl font-bold">تنظیمات</h2>
        <p className="text-xs text-muted-foreground mt-1">هر بخش که خواستی رو باز کن</p>
      </div>
      <Card className="glass-card p-2 border-0 rounded-3xl">
        <div className="divide-y divide-border/50">
          {entries.map((e) => (
            <button
              key={e.page}
              type="button"
              onClick={() => onNavigate(e.page)}
              className="w-full flex items-center gap-3 p-3.5 text-right hover:bg-accent/40 rounded-2xl transition-colors"
            >
              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${e.iconBox}`}>
                {e.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">{e.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{e.desc}</div>
              </div>
              <ChevronLeft className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ Sub-page header ---------------------------- */

function SubPageHeader({ title, description, onBack }: { title: string; description: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 px-1">
      <button
        type="button"
        onClick={onBack}
        className="h-10 w-10 rounded-2xl bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors active:scale-95"
        aria-label="برگشت"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div>
        <h2 className="text-lg font-bold leading-tight">{title}</h2>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{description}</p>
      </div>
    </div>
  );
}

/* --------------------------------- Events --------------------------------- */

function EventsPage({
  settingsHook,
  notificationsHook,
}: {
  settingsHook: ReturnType<typeof useSettings>;
  notificationsHook: ReturnType<typeof useNotifications>;
}) {
  return (
    <div className="space-y-4">
      <EventsManager settingsHook={settingsHook} />
      <EventNotificationSettings settingsHook={settingsHook} notificationsHook={notificationsHook} />
    </div>
  );
}

function EventsManager({ settingsHook }: { settingsHook: ReturnType<typeof useSettings> }) {
  const { settings, updateSettings } = settingsHook;
  useEventsVersion(); // re-render after an update
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const counts = getEventCounts();
  const years = getDataYears();
  const fetchedAt = getDataFetchedAt();

  const categoryConfig: {
    key: 'showShamsiEvents' | 'showQamariEvents' | 'showGlobalEvents';
    category: 'shamsi' | 'qamari' | 'global';
    icon: React.ReactNode;
    count: number;
  }[] = [
    {
      key: 'showShamsiEvents',
      category: 'shamsi',
      icon: <Calendar className="h-4 w-4" />,
      count: counts.shamsi,
    },
    {
      key: 'showQamariEvents',
      category: 'qamari',
      icon: <Moon className="h-4 w-4" />,
      count: counts.qamari,
    },
    {
      key: 'showGlobalEvents',
      category: 'global',
      icon: <Globe className="h-4 w-4" />,
      count: counts.global,
    },
  ];

  return (
    <Card className="glass-card p-5 border-0 rounded-3xl">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center">
          <Calendar className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-base font-bold">مدیریت مناسبت‌ها</h3>
          <p className="text-xs text-muted-foreground">کدوم دسته‌ها روی تقویم نمایش داده بشن</p>
        </div>
      </div>

      <div className="space-y-3">
        {categoryConfig.map(({ key, category, icon, count }) => (
          <div
            key={key}
            className="flex items-center gap-3 p-3 rounded-2xl bg-background/60 border"
          >
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${CATEGORY_STYLES[category].iconBox}`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{CATEGORY_STYLES[category].label}</div>
              <div className="text-xs text-muted-foreground">
                {toPersianDigits(count)} مناسبت
              </div>
            </div>
            <Switch
              className={CATEGORY_STYLES[category].switchOn}
              checked={settings[key]}
              onCheckedChange={(checked) => updateSettings({ [key]: checked } as Partial<typeof settings>)}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-border/40">
        <Button
          variant="outline"
          size="sm"
          disabled={updating}
          className="rounded-xl gap-1.5 w-full"
          onClick={async () => {
            setUpdating(true);
            setUpdateMsg(null);
            try {
              const r = await updateEventsFromInternet(true);
              setUpdateMsg(r.message);
            } catch {
              setUpdateMsg('به‌روزرسانی انجام نشد؛ اینترنتت رو چک کن.');
            } finally {
              setUpdating(false);
            }
          }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${updating ? 'animate-spin' : ''}`} />
          {updating ? 'داره می‌گیره...' : 'به‌روزرسانی مناسبت‌ها از اینترنت'}
        </Button>
        {(updateMsg || getUpdateState()?.lastMessage) && (
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            {updateMsg ?? getUpdateState()?.lastMessage}
          </p>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
        منبع مناسبت‌ها: Time.ir
        {years.length > 0 && ` (سال ${years.map((y) => toPersianDigits(y)).join('، ')})`}
        {fetchedAt && ` • دریافت شده در ${fetchedAt}`}
        . تاریخ مناسبت‌های قمری برای سال‌های دارای داده دقیقه و برای بقیه سال‌ها تقریبی نشون داده می‌شه.
      </p>
    </Card>
  );
}

/* --------------------------------- About ---------------------------------- */

function AboutPage() {
  return (
    <div className="space-y-4">
      <Card className="glass-card p-6 border-0 rounded-3xl text-center">
        <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto shadow-lg shadow-primary/25">
          <Sparkles className="h-7 w-7 text-primary-foreground" />
        </div>
        <h3 className="text-lg font-bold mt-4">تقویم شمسی</h3>
        <p className="text-xs text-muted-foreground mt-1">نسخه ۲.۰</p>

        <div className="mt-5 space-y-3 text-sm text-muted-foreground text-right leading-relaxed">
          <p>
            تقویم شمسی و میلادی با یادآور مناسبت‌ها و تولدها، محاسبه سن و تبدیل تاریخ —
            همه‌چی آفلاین و روی گوشی خودت.
          </p>
        </div>
      </Card>

      <Card className="glass-card p-5 border-0 rounded-3xl">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h4 className="text-sm font-bold">حریم خصوصیت طلاسته 💚</h4>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              تمام داده‌ها (یادآورها، یادداشت‌ها و تنظیمات) به صورت محلی روی گوشی خودت ذخیره می‌شن
              و هیچ اطلاعاتی به هیچ سروری ارسال نمی‌شه. اپ کاملاً آفلاین کار می‌کنه؛
              فقط برای به‌روزرسانی مناسبت‌های سال جدید به اینترنت وصل می‌شه.
            </p>
          </div>
        </div>
      </Card>

      <Card className="glass-card p-5 border-0 rounded-3xl">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-sky-100 flex items-center justify-center shrink-0">
            <Wifi className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <h4 className="text-sm font-bold">نوتیفیکیشن‌ها حتی وقتی اپ بسته‌ست</h4>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              یادآورها از قبل روی خود اندروید زمان‌بندی می‌شن؛ برای همین حتی وقتی برنامه بسته باشه
              یا گوشی ری‌استارت شده باشه، سر وقت نوتیف می‌گیری.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
