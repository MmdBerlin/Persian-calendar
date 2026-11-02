'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * دراپ‌داون ماه — کاملاً درون برنامه ای با استایل خود برنامه
 * (به جای کادر انتخاب اندرویدی که با <select> باز می شد).
 */
export function MonthSelect({
  value,
  onChange,
  months,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  months: readonly string[];
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} dir="rtl">
      <SelectTrigger id={id} className="w-full rounded-xl font-medium" dir="rtl">
        <SelectValue />
      </SelectTrigger>
      <SelectContent dir="rtl" className="max-h-[45vh]">
        {months.map((name, i) => (
          <SelectItem key={i} value={String(i + 1)} className="justify-center">
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
