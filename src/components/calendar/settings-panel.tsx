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
  Palette,
  Check,
  Mail,
  Code2,
} from 'lucide-react';
import { useSettings } from '@/hooks/use-settings';
import { useNotifications } from '@/hooks/use-notifications';
import { CATEGORY_STYLES, getEventCounts, getDataYears, getDataFetchedAt } from '@/lib/events';
import { updateEventsFromInternet, getUpdateState } from '@/lib/events-remote';
import { useEventsVersion } from '@/hooks/use-events-version';
import { toPersianDigits } from '@/lib/jalali';
import { THEMES, type ThemeId } from '@/lib/themes';
import { DateConverter } from '@/components/calendar/date-converter';
import { AgeCalculator } from '@/components/calendar/age-calculator';
import { EventNotificationSettings } from '@/components/calendar/event-notification-settings';

export type SettingsSubPage = 'root' | 'events' | 'converter' | 'age' | 'themes' | 'about';

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
        {page === 'themes' && (
          <motion.div
            key="themes"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <SubPageHeader title="پوسته ها" description="رنگ و ظاهر برنامه رو انتخاب کن" onBack={goBack} />
            <ThemesPage settingsHook={settingsHook} />
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
      page: 'themes',
      icon: <Palette className="h-5 w-5" />,
      iconBox: 'bg-primary/10 text-primary',
      title: 'پوسته ها',
      desc: 'تغییر رنگ و ظاهر برنامه',
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

/* --------------------------------- Themes --------------------------------- */

function ThemesPage({ settingsHook }: { settingsHook: ReturnType<typeof useSettings> }) {
  const { settings, updateSettings } = settingsHook;

  return (
    <div className="space-y-3">
      {THEMES.map((t) => {
        const selected = settings.theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => updateSettings({ theme: t.id as ThemeId })}
            aria-pressed={selected}
            className={`w-full text-right glass-card rounded-3xl p-4 flex items-center gap-4 transition-shadow active:scale-[0.99] ${
              selected ? 'ring-2 ring-primary' : ''
            }`}
          >
            {/* Mini preview painted with the theme's own colours (not the current theme's) */}
            <div
              className="h-16 w-20 rounded-2xl shrink-0 p-2 flex flex-col gap-1.5"
              style={{ backgroundColor: t.bg, border: '1px solid rgba(128, 128, 128, 0.25)' }}
              aria-hidden="true"
            >
              <div className="h-2.5 w-10 rounded-full" style={{ backgroundColor: t.primary }} />
              <div className="flex-1 rounded-lg flex items-end gap-1 p-1" style={{ backgroundColor: t.card }}>
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: t.primary }} />
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: t.secondary ?? t.primary, opacity: t.secondary ? 1 : 0.45 }} />
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: t.primary, opacity: 0.2 }} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">{t.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
            </div>
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 border ${
                selected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
              }`}
            >
              {selected && <Check className="h-4 w-4" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------- About ---------------------------------- */

const APP_FEATURES = [
  'تقویم شمسی همراه با مناسبت های شمسی، قمری و جهانی و تعطیلات رسمی',
  'یادآور تولد، سالگرد، قسط، قبض، قرار ملاقات و کارها، با نوتیفیکیشن',
  'یادداشت های رنگی برای نوشتن هر چیزی که نباید فراموش بشه',
  'تبدیل تاریخ شمسی و میلادی به هم',
  'محاسبه دقیق سن و چند روز مونده تا تولد بعدی',
  'چند پوسته رنگی برای عوض کردن ظاهر برنامه',
];

const DEVELOPER_NAME = 'MmdBerlin';
const CONTACT_EMAIL = 'Mmdberllin@gmail.com';

function AboutPage() {
  return (
    <div className="space-y-4">
      <Card className="glass-card p-6 border-0 rounded-3xl">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt="لوگوی برنامه"
            width={80}
            height={80}
            className="h-20 w-20 mx-auto drop-shadow-lg"
          />
          <h3 className="text-lg font-bold mt-4" dir="ltr">Persian Calendar</h3>
          <p className="text-xs text-muted-foreground mt-1">نسخه ۲.۰</p>
        </div>

        <p className="mt-5 text-sm text-muted-foreground leading-relaxed text-right">
          Persian Calendar یه تقویم ساده و سریع برای استفاده هر روزه است. تاریخ شمسی و میلادی رو کنار هم
          می بینی، مناسبت ها و تعطیلات رسمی روی تقویم مشخص هستن و هر چیزی که نباید فراموش بشه رو می تونی
          به صورت یادآور بسپری به برنامه تا سر وقت بهت خبر بده.
        </p>

        <ul className="mt-4 space-y-2.5">
          {APP_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm leading-relaxed">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Check className="h-3 w-3" />
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="glass-card p-5 border-0 rounded-3xl">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Code2 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold">توسعه دهنده</h4>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              این برنامه رو <span className="font-bold text-foreground" dir="ltr">{DEVELOPER_NAME}</span> ساخته و توسعه می ده.
              اگه پیشنهاد، ایراد یا ایده ای داشتی، خوشحال می شم بشنوم.
            </p>
          </div>
        </div>

        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-4 w-full rounded-2xl bg-muted/60 hover:bg-muted active:scale-[0.99] transition-all flex items-center gap-3 p-3"
        >
          <span className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Mail className="h-4 w-4 text-primary" />
          </span>
          <span className="flex-1 min-w-0 text-right">
            <span className="block text-[11px] text-muted-foreground">راه ارتباطی (ایمیل)</span>
            <span className="block text-sm font-semibold truncate" dir="ltr">{CONTACT_EMAIL}</span>
          </span>
        </a>
      </Card>
    </div>
  );
}
