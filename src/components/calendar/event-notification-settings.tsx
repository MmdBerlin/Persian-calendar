'use client';

import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { BellRing } from 'lucide-react';
import type { useSettings } from '@/hooks/use-settings';
import type { useNotifications } from '@/hooks/use-notifications';
import type { EventNotifyPrefs } from '@/lib/event-notify-prefs';
import { TimePicker } from '@/components/calendar/time-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  settingsHook: ReturnType<typeof useSettings>;
  notificationsHook: ReturnType<typeof useNotifications>;
}

/** Compact toggle chips; the color of the active chip is the category color used everywhere else. */
const CHIPS: { key: 'holidays' | 'shamsi' | 'qamari' | 'global'; label: string; on: string }[] = [
  { key: 'holidays', label: 'تعطیل رسمی', on: 'bg-rose-600 text-white border-rose-600' },
  { key: 'shamsi', label: 'شمسی', on: 'bg-amber-500 text-white border-amber-500' },
  { key: 'qamari', label: 'قمری', on: 'bg-emerald-600 text-white border-emerald-600' },
  { key: 'global', label: 'جهانی', on: 'bg-violet-500 text-white border-violet-500' },
];

export function EventNotificationSettings({ settingsHook, notificationsHook }: Props) {
  const { settings, updateSettings } = settingsHook;
  const prefs = settings.eventNotify;
  const isNative = notificationsHook.channel === 'capacitor';
  const active = notificationsHook.enabled && notificationsHook.permission === 'granted';

  const update = (patch: Partial<EventNotifyPrefs>) => updateSettings({ eventNotify: { ...prefs, ...patch } });

  return (
    <Card className="glass-card p-5 border-0 rounded-3xl">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <BellRing className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-bold">اطلاع‌رسانی مناسبت‌ها</h3>
          <p className="text-xs text-muted-foreground">کدوم مناسبت‌ها نوتیف بدن و کی</p>
        </div>
      </div>

      {!active && (
        <div className="mb-3 p-2.5 rounded-xl bg-muted/50 text-[11px] text-muted-foreground text-center">
          اول زنگوله بالای صفحه رو بزن تا نوتیف‌ها فعال بشن
        </div>
      )}

      <div className={active && isNative ? 'space-y-3' : 'opacity-50 pointer-events-none space-y-3'}>
        {/* Today's date notification */}
        <div className="flex items-center gap-2 py-1.5">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium">تاریخ امروز تو نوار اعلان</div>
            <div className="text-[10px] text-muted-foreground">آیکون نوتیف، عدد روز شمسیه</div>
          </div>
          <Switch
            checked={settings.showTodayNotification}
            onCheckedChange={(v) => updateSettings({ showTodayNotification: v })}
          />
        </div>

        <div className="border-t border-border/40 pt-3">
          <div className="text-xs font-medium mb-2">اعلام مناسبت‌ها</div>
          <div className="flex flex-wrap gap-1.5">
            {CHIPS.map((c) => {
              const on = prefs[c.key];
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => update({ [c.key]: !on } as Partial<EventNotifyPrefs>)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
                    on ? c.on : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Select
              value={String(prefs.daysBefore)}
              onValueChange={(v) => update({ daysBefore: parseInt(v, 10) })}
              dir="rtl"
            >
              <SelectTrigger className="rounded-xl text-xs h-9 w-[7.5rem]" dir="rtl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="1">یک روز قبل</SelectItem>
                <SelectItem value="0">همان روز</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[11px] text-muted-foreground">ساعت</span>
            <TimePicker value={prefs.time} onChange={(v) => update({ time: v })} className="scale-90 origin-right" />
          </div>
        </div>
      </div>
    </Card>
  );
}
