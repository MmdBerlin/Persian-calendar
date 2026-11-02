// به روزرسانی مناسبت ها از Time.ir
//
// استفاده:
//   node scripts/update-events-from-timeir.mjs            # صفحه سالانه Time.ir را می گیرد
//   node scripts/update-events-from-timeir.mjs page.html  # از فایل HTML ذخیره شده می خواند
//
// خروجی: src/data/events-<سال>.json و بازنویسی src/data/index.ts
// صفحه https://www.time.ir/event-year همیشه مناسبت های «سال جاری شمسی» را نشان می دهد،
// پس این اسکریپت را یک بار بعد از هر نوروز اجرا کنید تا تاریخ دقیق مناسبت های قمری
// همان سال اضافه شود. سال های قبلی در پوشه data می مانند.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'src', 'data');
const URL_ = 'https://www.time.ir/event-year';

const cleanTitle = (t) =>
  t
    .replace(/[\u200c\u200b]/g, ' ') // نیم فاصله ممنوع است؛ فاصله معمولی
    .replace(/\s+/g, ' ')
    .replace(/\s*\[\s*(.*?)\s*\]/g, ' [$1]')
    .trim();

export function parseEvents(html) {
  // داده های صفحه داخل رشته های escape شده Next.js هستند؛ همه بک اسلش ها را برمی داریم
  const s = html.replace(/\\/g, '');
  const re =
    /\{"id":(\d+),"title":"(.*?)","body":"(.*?)","reoccur":(true|false),"base":(\d+),"gregorian_year":(\d+),"gregorian_month":(\d+),"gregorian_day":(\d+),.*?"jalali_year":(\d+),"jalali_month":(\d+),"jalali_day":(\d+),.*?"hijri_year":(\d+),"hijri_month":(\d+),"hijri_day":(\d+),.*?"is_holiday":(true|false),/g;
  const seen = new Set();
  const events = [];
  let year = 0;
  for (const m of s.matchAll(re)) {
    const [, id, title, , , base, gy, gm, gd, jy, jm, jd, , hm, hd, hol] = m;
    const key = `${id}|${gy}|${gm}|${gd}`;
    if (seen.has(key)) continue;
    seen.add(key);
    year = Number(jy);
    events.push({
      b: Number(base), // 0 شمسی، 1 جهانی، 2 قمری
      t: cleanTitle(title),
      jm: Number(jm),
      jd: Number(jd),
      gm: Number(gm),
      gd: Number(gd),
      hm: Number(hm),
      hd: Number(hd),
      h: hol === 'true' ? 1 : 0,
    });
  }
  events.sort((a, b) => a.jm - b.jm || a.jd - b.jd || a.b - b.b);
  return { year, events };
}

async function main() {
  const arg = process.argv[2];
  let html;
  if (arg) {
    html = readFileSync(arg, 'utf8');
  } else {
    const res = await fetch(URL_, { headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'fa' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  }
  const { year, events } = parseEvents(html);
  if (!year || events.length < 100) {
    throw new Error(`داده کافی پیدا نشد (${events.length} مناسبت). ساختار صفحه Time.ir عوض شده؟`);
  }
  mkdirSync(DATA_DIR, { recursive: true });
  // Nothing changed since the last run: leave the file alone (keeps git history and the monthly workflow quiet)
  const file = join(DATA_DIR, `events-${year}.json`);
  if (existsSync(file)) {
    try {
      const old = JSON.parse(readFileSync(file, 'utf8'));
      if (JSON.stringify(old.events) === JSON.stringify(events)) {
        console.log(`سال ${year}: بدون تغییر (${events.length} مناسبت)`);
        return;
      }
    } catch {
      // unreadable old file: overwrite it
    }
  }
  const out = { year, source: 'time.ir', fetchedAt: new Date().toISOString().slice(0, 10), events };
  writeFileSync(join(DATA_DIR, `events-${year}.json`), JSON.stringify(out) + '\n');

  // index.ts را از روی فایل های موجود می سازیم
  const years = readdirSync(DATA_DIR)
    .map((f) => /^events-(\d{4})\.json$/.exec(f)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((a, b) => a - b);
  const lines = [
    '// این فایل را اسکریپت scripts/update-events-from-timeir.mjs می سازد؛ دستی ویرایش نکنید.',
    ...years.map((y) => `import e${y} from './events-${y}.json';`),
    '',
    'export interface RawEvent {',
    '  b: 0 | 1 | 2; // 0 شمسی، 1 جهانی، 2 قمری',
    '  t: string;',
    '  jm: number;',
    '  jd: number;',
    '  gm: number;',
    '  gd: number;',
    '  hm: number;',
    '  hd: number;',
    '  h: 0 | 1;',
    '}',
    'export interface YearData {',
    '  year: number;',
    '  source: string;',
    '  fetchedAt: string;',
    '  events: RawEvent[];',
    '}',
    '',
    `export const EVENT_YEARS: YearData[] = [${years.map((y) => `e${y}`).join(', ')}] as YearData[];`,
    '',
  ];
  writeFileSync(join(DATA_DIR, 'index.ts'), lines.join('\n'));
  const by = (b) => events.filter((e) => e.b === b).length;
  console.log(`سال ${year}: ${events.length} مناسبت (شمسی ${by(0)}، جهانی ${by(1)}، قمری ${by(2)})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error('خطا:', e.message);
    process.exit(1);
  });
}
