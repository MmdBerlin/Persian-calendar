'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowRightLeft, Calendar } from 'lucide-react';
import {
  JALALI_MONTHS,
  GREGORIAN_MONTHS,
  gregorianToJalali,
  jalaliToGregorian,
  formatJalali,
  formatGregorian,
  jalaliWeekday,
  toPersianDigits,
  parseJalaliString,
  parseGregorianString,
  todayJalali,
  todayGregorian,
  type JalaliDate,
  type GregorianDate,
} from '@/lib/jalali';
import { MonthSelect } from '@/components/calendar/month-select';

export function DateConverter() {
  const today = todayJalali();
  const todayG = todayGregorian();

  // Jalali -> Gregorian state
  const [jy, setJy] = useState<string>(String(today.jy));
  const [jm, setJm] = useState<string>(String(today.jm));
  const [jd, setJd] = useState<string>(String(today.jd));
  const [gResult, setGResult] = useState<GregorianDate | null>(null);

  // Gregorian -> Jalali state
  const [gy, setGy] = useState<string>(String(todayG.gy));
  const [gm, setGm] = useState<string>(String(todayG.gm));
  const [gd, setGd] = useState<string>(String(todayG.gd));
  const [jResult, setJResult] = useState<JalaliDate | null>(null);

  const convertJToG = () => {
    try {
      const y = parseInt(jy, 10);
      const m = parseInt(jm, 10);
      const d = parseInt(jd, 10);
      if (isNaN(y) || isNaN(m) || isNaN(d)) return;
      const result = jalaliToGregorian(y, m, d);
      setGResult(result);
    } catch (e) {
      setGResult(null);
    }
  };

  const convertGToJ = () => {
    try {
      const y = parseInt(gy, 10);
      const m = parseInt(gm, 10);
      const d = parseInt(gd, 10);
      if (isNaN(y) || isNaN(m) || isNaN(d)) return;
      const result = gregorianToJalali(y, m, d);
      setJResult(result);
    } catch (e) {
      setJResult(null);
    }
  };

  return (
    <Card className="glass-card p-6 border-0 rounded-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ArrowRightLeft className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-bold">تبدیل تاریخ</h3>
          <p className="text-sm text-muted-foreground">تبدیل بین شمسی و میلادی</p>
        </div>
      </div>

      <Tabs defaultValue="j2g" dir="rtl">
        <TabsList className="grid w-full grid-cols-2 mb-4 rounded-2xl">
          <TabsTrigger value="j2g" className="rounded-2xl"><span dir="ltr">شمسی → میلادی</span></TabsTrigger>
          <TabsTrigger value="g2j" className="rounded-2xl"><span dir="ltr">میلادی → شمسی</span></TabsTrigger>
        </TabsList>

        <TabsContent value="j2g" className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="jy" className="text-xs text-muted-foreground">سال</Label>
              <Input
                id="jy"
                value={jy}
                onChange={(e) => setJy(e.target.value)}
                className="rounded-lg text-center font-semibold"
                dir="ltr"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jm" className="text-xs text-muted-foreground">ماه</Label>
              <MonthSelect id="jm" value={jm} onChange={setJm} months={JALALI_MONTHS} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jd" className="text-xs text-muted-foreground">روز</Label>
              <Input
                id="jd"
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                className="rounded-lg text-center font-semibold"
                dir="ltr"
                inputMode="numeric"
              />
            </div>
          </div>
          <Button onClick={convertJToG} className="w-full rounded-2xl h-11">
            تبدیل کن
          </Button>
          {gResult && (
            <ResultCard
              jalali={{ jy: parseInt(jy), jm: parseInt(jm), jd: parseInt(jd) }}
              gregorian={gResult}
            />
          )}
        </TabsContent>

        <TabsContent value="g2j" className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="gy" className="text-xs text-muted-foreground">Year</Label>
              <Input
                id="gy"
                value={gy}
                onChange={(e) => setGy(e.target.value)}
                className="rounded-lg text-center font-semibold"
                dir="ltr"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gm" className="text-xs text-muted-foreground">ماه</Label>
              <MonthSelect id="gm" value={gm} onChange={setGm} months={GREGORIAN_MONTHS} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gd" className="text-xs text-muted-foreground">Day</Label>
              <Input
                id="gd"
                value={gd}
                onChange={(e) => setGd(e.target.value)}
                className="rounded-lg text-center font-semibold"
                dir="ltr"
                inputMode="numeric"
              />
            </div>
          </div>
          <Button onClick={convertGToJ} className="w-full rounded-2xl h-11">
            تبدیل کن
          </Button>
          {jResult && (
            <ResultCard
              jalali={jResult}
              gregorian={{ gy: parseInt(gy), gm: parseInt(gm), gd: parseInt(gd) }}
            />
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function ResultCard({ jalali, gregorian }: { jalali: JalaliDate; gregorian: GregorianDate }) {
  const weekday = jalaliWeekday(jalali.jy, jalali.jm, jalali.jd);
  const weekdays = ['شنبه', 'یک شنبه', 'دوشنبه', 'سه شنبه', 'چهارشنبه', 'پنج شنبه', 'جمعه'];
  const gDate = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
  const gWeekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][gDate.getDay()];

  return (
    <div className="rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 p-5 space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        نتیجه تبدیل
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-background/80 p-3">
          <div className="text-[10px] text-muted-foreground mb-1">شمسی</div>
          <div className="font-bold text-base">
            {toPersianDigits(jalali.jd)} {JALALI_MONTHS[jalali.jm - 1]} {toPersianDigits(jalali.jy)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{weekdays[weekday]}</div>
        </div>
        <div className="rounded-lg bg-background/80 p-3">
          <div className="text-[10px] text-muted-foreground mb-1">میلادی</div>
          <div className="font-bold text-base" dir="ltr">
            {GREGORIAN_MONTHS[gregorian.gm - 1]} {gregorian.gd}, {gregorian.gy}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{gWeekday}</div>
        </div>
      </div>
    </div>
  );
}
