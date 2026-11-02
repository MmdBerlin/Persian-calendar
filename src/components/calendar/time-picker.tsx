'use client';

import { Clock3 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toPersianDigits } from '@/lib/jalali';

/**
 * انتخاب ساعت و دقیقه — کاملاً درون برنامه ای (بدون دیالوگ اندروید).
 * مقدار به شکل "HH:MM" (لاتین) نگه داشته می شود تا با schedule هماهنگ بماند.
 */
export function TimePicker({
  value,
  onChange,
  id,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  className?: string;
}) {
  const [hStr, mStr] = (value || '09:00').split(':');
  const hour = Math.min(23, Math.max(0, parseInt(hStr, 10) || 0));
  const minute = Math.min(59, Math.max(0, parseInt(mStr, 10) || 0));

  const setHour = (h: number) => onChange(`${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  const setMinute = (m: number) => onChange(`${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

  return (
    <div id={id} className={`flex items-center gap-2 ${className ?? ''}`} dir="ltr">
      <Select value={String(hour)} onValueChange={(v) => setHour(parseInt(v, 10))}>
        <SelectTrigger className="w-[4.5rem] rounded-xl text-center font-semibold" dir="ltr" aria-label="ساعت">
          <SelectValue />
        </SelectTrigger>
        <SelectContent dir="ltr" className="max-h-[45vh]">
          {Array.from({ length: 24 }, (_, i) => i).map((h) => (
            <SelectItem key={h} value={String(h)} className="justify-center">
              {toPersianDigits(String(h).padStart(2, '0'))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="font-bold text-muted-foreground">:</span>
      <Select value={String(minute)} onValueChange={(v) => setMinute(parseInt(v, 10))}>
        <SelectTrigger className="w-[4.5rem] rounded-xl text-center font-semibold" dir="ltr" aria-label="دقیقه">
          <SelectValue />
        </SelectTrigger>
        <SelectContent dir="ltr" className="max-h-[45vh]">
          {Array.from({ length: 60 }, (_, i) => i).map((m) => (
            <SelectItem key={m} value={String(m)} className="justify-center">
              {toPersianDigits(String(m).padStart(2, '0'))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Clock3 className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}
