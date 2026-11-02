// این فایل را اسکریپت scripts/update-events-from-timeir.mjs می سازد؛ دستی ویرایش نکنید.
import e1405 from './events-1405.json';

export interface RawEvent {
  b: 0 | 1 | 2; // 0 شمسی، 1 جهانی، 2 قمری
  t: string;
  jm: number;
  jd: number;
  gm: number;
  gd: number;
  hm: number;
  hd: number;
  h: 0 | 1;
}
export interface YearData {
  year: number;
  source: string;
  fetchedAt: string;
  events: RawEvent[];
}

export const EVENT_YEARS: YearData[] = [e1405] as YearData[];
