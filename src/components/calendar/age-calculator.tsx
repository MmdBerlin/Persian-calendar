'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Cake, Sparkles, Calendar, Trash2, History } from 'lucide-react';
import {
  JALALI_MONTHS,
  GREGORIAN_MONTHS,
  gregorianToJalali,
  jalaliToGregorian,
  calculateAgeFromJalali,
  calculateAgeFromGregorian,
  formatJalali,
  formatGregorian,
  toPersianDigits,
  todayJalali,
  todayGregorian,
  type Age,
  type JalaliDate,
} from '@/lib/jalali';
import { useSettings } from '@/hooks/use-settings';
import { useToast } from '@/hooks/use-toast';
import { MonthSelect } from '@/components/calendar/month-select';

export function AgeCalculator() {
  const { settings, setLastAge, clearLastAge } = useSettings();
  const { toast } = useToast();
  const today = todayJalali();
  const todayG = todayGregorian();

  // Jalali birth date
  const [jy, setJy] = useState<string>(String(today.jy - 30));
  const [jm, setJm] = useState<string>('1');
  const [jd, setJd] = useState<string>('1');
  const [jAge, setJAge] = useState<Age | null>(null);

  // Gregorian birth date
  const [gy, setGy] = useState<string>(String(todayG.gy - 30));
  const [gm, setGm] = useState<string>('1');
  const [gd, setGd] = useState<string>('1');
  const [gAge, setGAge] = useState<Age | null>(null);

  const persistAge = (age: Age, birthLabel: string) => {
    setLastAge({
      years: age.years,
      months: age.months,
      days: age.days,
      totalDays: age.totalDays,
      totalWeeks: age.totalWeeks,
      totalMonths: age.totalMonths,
      nextBirthdayJalali: age.nextBirthdayJalali,
      daysUntilNextBirthday: age.daysUntilNextBirthday,
      birthLabel,
      calculatedAt: Date.now(),
    });
  };

  const calcJAge = () => {
    try {
      const y = parseInt(jy, 10);
      const m = parseInt(jm, 10);
      const d = parseInt(jd, 10);
      if (isNaN(y) || isNaN(m) || isNaN(d)) return;
      const age = calculateAgeFromJalali(y, m, d);
      setJAge(age);
      persistAge(age, `${toPersianDigits(y)}/${toPersianDigits(m)}/${toPersianDigits(d)} (شمسی)`);
    } catch {
      setJAge(null);
    }
  };

  const calcGAge = () => {
    try {
      const y = parseInt(gy, 10);
      const m = parseInt(gm, 10);
      const d = parseInt(gd, 10);
      if (isNaN(y) || isNaN(m) || isNaN(d)) return;
      const age = calculateAgeFromGregorian(y, m, d);
      setGAge(age);
      persistAge(age, `${y}/${m}/${d} (میلادی)`);
    } catch {
      setGAge(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Last saved age */}
      {settings.lastAge && (
        <Card className="glass-card p-5 border-0 rounded-3xl bg-gradient-to-br from-pink-50/80 to-purple-50/80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-pink-600" />
              <span className="text-xs font-semibold text-pink-700">آخرین سن محاسبه شده</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-muted-foreground hover:text-destructive"
              onClick={clearLastAge}
              aria-label="حذف ذخیره"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-4xl font-bold text-foreground">{toPersianDigits(settings.lastAge.years)}</span>
            <span className="text-base text-muted-foreground">سال</span>
            <span className="text-2xl font-bold text-foreground mx-1">{toPersianDigits(settings.lastAge.months)}</span>
            <span className="text-sm text-muted-foreground">ماه</span>
            <span className="text-2xl font-bold text-foreground mx-1">{toPersianDigits(settings.lastAge.days)}</span>
            <span className="text-sm text-muted-foreground">روز</span>
          </div>
          <div className="text-xs text-muted-foreground text-center mt-2">
            {settings.lastAge.birthLabel}
          </div>
        </Card>
      )}

      <Card className="glass-card p-6 border-0 rounded-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-pink-100 flex items-center justify-center">
            <Cake className="h-5 w-5 text-pink-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold">محاسبه سن</h3>
            <p className="text-sm text-muted-foreground">محاسبه دقیق سن و روزهای گذشته</p>
          </div>
        </div>

        <Tabs defaultValue="jalali" dir="rtl">
        <TabsList className="grid w-full grid-cols-2 mb-4 rounded-2xl">
          <TabsTrigger value="jalali" className="rounded-2xl">تاریخ شمسی</TabsTrigger>
          <TabsTrigger value="gregorian" className="rounded-2xl">تاریخ میلادی</TabsTrigger>
        </TabsList>

        <TabsContent value="jalali" className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">سال تولد</Label>
              <Input
                value={jy}
                onChange={(e) => setJy(e.target.value)}
                className="rounded-lg text-center font-semibold"
                dir="ltr"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">ماه</Label>
              <MonthSelect value={jm} onChange={setJm} months={JALALI_MONTHS} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">روز</Label>
              <Input
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                className="rounded-lg text-center font-semibold"
                dir="ltr"
                inputMode="numeric"
              />
            </div>
          </div>
          <Button onClick={calcJAge} className="w-full rounded-2xl h-11">
            محاسبه سن
          </Button>
          {jAge && (
            <AgeResult
              age={jAge}
              birthJalali={{ jy: parseInt(jy), jm: parseInt(jm), jd: parseInt(jd) }}
            />
          )}
        </TabsContent>

        <TabsContent value="gregorian" className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Birth Year</Label>
              <Input
                value={gy}
                onChange={(e) => setGy(e.target.value)}
                className="rounded-lg text-center font-semibold"
                dir="ltr"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">ماه</Label>
              <MonthSelect value={gm} onChange={setGm} months={GREGORIAN_MONTHS} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Day</Label>
              <Input
                value={gd}
                onChange={(e) => setGd(e.target.value)}
                className="rounded-lg text-center font-semibold"
                dir="ltr"
                inputMode="numeric"
              />
            </div>
          </div>
          <Button onClick={calcGAge} className="w-full rounded-2xl h-11">
            محاسبه سن
          </Button>
          {gAge && (
            <AgeResult
              age={gAge}
              birthGregorian={{ gy: parseInt(gy), gm: parseInt(gm), gd: parseInt(gd) }}
            />
          )}
        </TabsContent>
      </Tabs>
    </Card>
    </div>
  );
}

function AgeResult({ age, birthJalali, birthGregorian }: {
  age: Age;
  birthJalali?: JalaliDate;
  birthGregorian?: { gy: number; gm: number; gd: number };
}) {
  const birthJ = birthJalali || (birthGregorian ? gregorianToJalali(birthGregorian.gy, birthGregorian.gm, birthGregorian.gd) : null);
  const birthG = birthGregorian || (birthJalali ? jalaliToGregorian(birthJalali.jy, birthJalali.jm, birthJalali.jd) : null);

  if (!birthJ || !birthG) return null;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Main age display */}
      <div className="rounded-2xl bg-gradient-to-br from-pink-50 to-purple-50 p-5 text-center">
        <div className="flex items-center justify-center gap-1 text-pink-600 mb-2">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-medium">سن شما</span>
        </div>
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-5xl font-bold text-foreground">{toPersianDigits(age.years)}</span>
          <span className="text-lg text-muted-foreground">سال</span>
          <span className="text-3xl font-bold text-foreground mx-2">{toPersianDigits(age.months)}</span>
          <span className="text-sm text-muted-foreground">ماه</span>
          <span className="text-3xl font-bold text-foreground mx-2">{toPersianDigits(age.days)}</span>
          <span className="text-sm text-muted-foreground">روز</span>
        </div>
      </div>

      {/* Detailed stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="مجموع روزها" value={toPersianDigits(age.totalDays)} />
        <StatCard label="مجموع هفته ها" value={toPersianDigits(age.totalWeeks)} />
        <StatCard label="مجموع ماه ها" value={toPersianDigits(age.totalMonths)} />
      </div>

      {/* Birth dates */}
      <div className="rounded-2xl bg-muted/40 p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          تاریخ تولد
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground text-xs">شمسی: </span>
            <span className="font-semibold">{toPersianDigits(birthJ.jd)} {JALALI_MONTHS[birthJ.jm - 1]} {toPersianDigits(birthJ.jy)}</span>
          </div>
          <div className="text-sm" dir="ltr">
            <span className="text-muted-foreground text-xs">Gregorian: </span>
            <span className="font-semibold">{GREGORIAN_MONTHS[birthG.gm - 1]} {birthG.gd}, {birthG.gy}</span>
          </div>
        </div>
      </div>

      {/* Next birthday */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-amber-700 font-medium">تولد بعدی</div>
          <div className="text-sm font-bold mt-1">
            {toPersianDigits(age.nextBirthdayJalali.jd)} {JALALI_MONTHS[age.nextBirthdayJalali.jm - 1]} {toPersianDigits(age.nextBirthdayJalali.jy)}
          </div>
        </div>
        <div className="text-left">
          <div className="text-2xl font-bold text-amber-700">{toPersianDigits(age.daysUntilNextBirthday)}</div>
          <div className="text-xs text-amber-600">روز مانده</div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/80 p-3 text-center border">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
