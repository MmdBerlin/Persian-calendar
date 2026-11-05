# راهنمای ساخت APK اندروید از تقویم شمسی (نسخه آفلاین/محلی)

این راهنما برای استفاده شخصی و آفلاین طراحی شده است. اپ بدون نیاز به اینترنت کار می کند و انتشار در Google Play در نظر گرفته نشده است.

## پیش نیازها

### ۱. نصب Node.js (نسخه ۱۸ یا بالاتر)
- از https://nodejs.org دانلود کنید

### ۲. نصب Android Studio
- از https://developer.android.com/studio دانلود کنید
- شامل Android SDK و JDK است

### ۳. نصب JDK 17
- اگر Android Studio نصب باشد، JDK دارد
- متغیر `JAVA_HOME` را به مسیر JDK تنظیم کنید

---

## نکته مهم: پروژه از قبل آماده Capacitor است

این فایل ها از قبل در سورس وجود دارند و نیازی به ساخت دستی ندارند:

| فایل | نقش |
|---|---|
| `capacitor.config.ts` | پیکربندی Capacitor (webDir: `out`) |
| `next.config.ts` | خروجی `export` استاتیک + `images.unoptimized` + `trailingSlash` |
| `package.json` | شامل `@capacitor/core`، `@capacitor/cli`، `@capacitor/android`، `@capacitor/local-notifications`، `@capacitor/status-bar` و اسکریپت `build` ساده (فقط `next build`) |
| `src/lib/notifications.ts` | لایه نوتیفیکیشن چندسکویی — در APK از پلاگین `LocalNotifications` بومی استفاده می کند، در وب از Service Worker |
| `src/components/capacitor-init.tsx` | راه اندازی StatusBar در اندروید (پس زمینه سفید، بدون overlap) |
| `.github/workflows/build-apk.yml` | GitHub Actions — ساخت خودکار APK |

مسیر `src/app/api/route.ts` حذف شده چون با خروجی استاتیک سازگار نبود.

---

## روش ۱: ساخت با GitHub Actions (بدون نیاز به کامپیوتر قوی — ساده ترین)

> **کلید امضا از قبل ساخته شده است.** فایل `my-release.keystore` و رمزهایش در `keystore-secrets.txt` (کنار این راهنما) هست.

1. یک ریپازیتوری در GitHub بسازید
2. کل محتوای `source-code/` را push کنید
3. چهار راز امضا را در Settings → Secrets and variables → Actions بگذارید (مقادیر دقیق در `keystore-secrets.txt`):
   - `KEYSTORE_BASE64` ← محتوای کامل فایل `my-release.keystore.base64.txt` (یک خط طولانی)
   - `KEYSTORE_PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD`
4. در تب **Actions**، ورک فلو **Build Android APK + Play bundle** اجرا می‌شود (یا خودتان Run workflow بزنید)
5. پس از اتمام (حدود ۵-۱۰ دقیقه)، از بخش **Artifacts** فایل `persian-calendar-release` را دانلود کنید
6. داخل آن `app-release.apk` را روی گوشی نصب کنید (روی نسخه قبلی نصب می‌شود و داده‌ها می‌مانند)

ورک فلو: Node 20 + JDK 21 + Android SDK → `npm ci` → `next build` → `cap add android` → `node scripts/patch-android.mjs` → `cap sync` → `gradlew assembleRelease bundleRelease` → بررسی امضا با apksigner → آپلود APK و AAB

---

## روش ۲: ساخت لوکال با Capacitor

### گام ۱: نصب وابستگی ها
```bash
cd source-code
npm install
```

### گام ۲: Build استاتیک
```bash
npm run build
```
خروجی در پوشه `out/` ساخته می شود (خودکار).

### گام ۳: اضافه کردن پلتفرم اندروید
```bash
npx cap add android
node scripts/patch-android.mjs
npx cap sync android
```

### گام ۴: باز کردن در Android Studio و گرفتن APK
```bash
npx cap open android
```
در Android Studio: منوی **Build > Build Bundle(s) / APK(s) > Build APK(s)**

### گام ۵: نصب روی گوشی
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```
یا فایل APK را مستقیم روی گوشی کپی و نصب کنید.

---

## روش ۳: ساخت خط فرمان کامل (بدون Android Studio GUI)

اگر Android SDK و JDK 17 را دارید:
```bash
npm install
npm run build
npx cap add android
node scripts/patch-android.mjs
npx cap sync android
cd android && chmod +x gradlew && ./gradlew assembleDebug
```

---

## نوتیفیکیشن در APK چگونه کار می کند

در WebView اندروید، API استاندارد `Notification` وجود ندارد. برای همین:

- **لایه `src/lib/notifications.ts`** به صورت خودکار محیط را تشخیص می دهد:
  1. `capacitor` — اگر پلاگین بومی `LocalNotifications` موجود باشد (داخل APK) → نوتیف بومی اندروید با کانال اعلان «یادآورهای تقویم»، لرزش و نور LED
  2. `serviceworker` — اگر PWA در مرورگر نصب شده باشد → `registration.showNotification`
  3. `webapi` — دسکتاپ → `new Notification`
  4. `unsupported` — هیچ کدام نبود (قبلاً در APK به اشتباه این حالت نمایش داده می شد — الان فیکس شد)
- پلاگین های لازم (`@capacitor/local-notifications` و `@capacitor/status-bar`) در `package.json` هستند و `cap sync` آن ها را به پروژه اندروید اضافه می کند

## مارجین بالای صفحه (نوار وضعیت گوشی)

- `viewport` با `viewportFit: cover` تنظیم شده
- کلاس `safe-top` روی هدر + `--safe-top: env(safe-area-inset-top)` در CSS → محتوا زیر نوار اعلان گوشی نمی رود
- `capacitor-init.tsx` پلاگین StatusBar را طوری تنظیم می کند که نوار وضعیت، WebView را نپوشاند (پس زمینه سفید + آیکون های تیره)

## روش ۴: نصب به صورت PWA (بدون APK)

1. اپ را روی یک هاست اجرا کنید (حتی localhost با IP کامپیوتر)
2. در کروم اندروید باز کنید
3. منوی سه نقطه > **Add to Home screen**

---

## رفع مشکل

| مشکل | راه حل |
|---|---|
| `npx cap` چیزی پیدا نمی کند | `@capacitor/cli` در `package.json` هست؛ `npm install` را اجرا کنید |
| خروجی `next build` با Capacitor جور نیست | `next.config.ts` الان `output: 'export'` دارد — نباید به `standalone` برگردانید |
| `Cannot find Android SDK` | `export ANDROID_HOME=$HOME/Android/Sdk` |
| `Java version mismatch` | JDK 17 نصب کنید |
| نوتیف در APK نمی آید | اول زنگوله بالا سمت چپ را بزنید تا اجازه نوتیف داده شود؛ بعد تنظیمات گوشی: Settings > Apps > Persian Calendar > Notifications را روشن کنید |
| نوتیف ها با تاخیر می آیند (اندروید ۱۲ به بالا) | اجازه «یادآورها و هشدارها» (Alarms & reminders) را بدهید — برنامه بعد از فعال کردن نوتیف، خودش بنر/تُست فعال‌سازی نشان می‌دهد |
| نوتیف می گوید «پشتیبانی نمی شود» | اگر نسخه قدیمی APK را دارید، با سورس جدید دوباره build بگیرید — این باگ فیکس شد |
| محتوا زیر نوار اعلان می رود | هدر کلاس `safe-top` دارد؛ اگر مشکل ادامه داشت مطمئن شوید `cap sync` بعد از تغییرات اجرا شده |
| Prisma/DB خطا می دهد | اپ از localStorage استفاده می کند؛ Prisma فقط در `package.json` مانده و import نمی شود |

---

## مشخصات فنی اپ

| ویژگی | مقدار |
|---|---|
| **نام اپ** | Persian Calendar |
| **Package ID** | `com.persiancalendar.app` |
| **حداقل اندروید** | ۸.۰ (API 26) |
| **اندروید هدف** | ۱۴ (API 34) |
| **جهت** | عمودی (portrait) |
| **تم رنگ** | `#056AFA` |
| **زبان** | فارسی (RTL) |
| **حالت** | آفلاین / محلی |
| **نوتیف** | بومی (Capacitor LocalNotifications) |

---

## خلاصه دستورات (روش لوکال)

```bash
cd source-code
npm install
npm run build          # خروجی در out/
npx cap add android
node scripts/patch-android.mjs
npx cap sync android
cd android && ./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

موفق باشید! 🎉


---

## افزوده ها در این نسخه

### نسخه ۲.۰ — بازطراحی رابط کاربری و نوتیفیکیشن مطمئن

**رابط کاربری:**
- هدر ثابت (دیگه با اسکرول بالا نمی‌ره) + نویگیشن بار پایین صفحه با ۴ تب: تقویم، یادآورها، یادداشت‌ها، تنظیمات
- تب تقویم: کارت «نزدیک‌ترین یادآور» با آیکون دسته و ساعت سررسید، بعدش تقویم، مناسبت‌های روز انتخابی و یه نوار باریک CTA برای افزودن یادآور همون روز
- زنگوله بالا سمت چپ: بار اول زدن → درخواست فعال‌سازی نوتیف؛ بعدش هر بار زدن → روشن/خاموش کردن نوتیف‌ها (کارت تنظیمات نوتیف و نوتیف تستی حذف شد)
- دسته جدید «جلسه» برای یادآورها + آیکون اختصاصی برای همه دسته‌ها (همه‌جا یکسان)
- همه دراپ‌داون‌ها (ماه، نوع، ساعت/دقیقه، یک‌روز‌قبل/همان‌روز) درون‌برنامه‌ای شدن — دیگه کادر اندرویدی باز نمی‌شه
- تب یادداشت‌ها: کارت‌های جمع‌وجورتر، دکمه انتخاب به‌شکل مربع توخالی استروک‌دار، آیکون حذف فقط روی یادداشت‌های انتخاب‌شده
- تنظیمات هاب شد: هر گزینه اول یه ردیفه، بازش می‌کنی می‌ری توی صفحه خودش — مناسبت‌ها (مدیریت + اطلاع‌رسانی)، تبدیل تاریخ، محاسبه سن، درباره ما
- رنگ دسته‌های مناسبت متمایزتر شد (کهربایی/سبز/بنفش/قرمز) و نقطه یادآورها روی تقویم همیشه آبی اصلی برنامه است
- دکمه «امروز» علاوه بر تقویم، روز انتخاب‌شده رو هم برمی‌گردونه به امروز
- متن‌ها خودمونی‌تر شدن، نشانه‌ی اسکرول‌ها مخفی شد، فاصله‌گذاری کارت‌ها بازتر شد
- متن پایین صفحه (تقویم شمسی-میلادی و...) حذف و به «درباره ما» در تنظیمات منتقل شد

**نوتیفیکیشن:**
- یادآورها حتی وقتی اپ بسته‌ست کار می‌کنن (زمان‌بندی بومی AlarmManager + بوت‌ریسیور)
- مجوزهای `USE_EXACT_ALARM` (اندروید ۱۳+) و `SCHEDULE_EXACT_ALARM` (اندروید ۱۲) → نوتیف‌ها دقیقاً سر وقت و بدون تاخیر
- موقع بک‌گراند رفتن اپ هم زمان‌بندی‌ها دوباره مسلح می‌شن؛ جبران عقب‌افتاده‌ها تقریباً فوری (۱.۵ ثانیه)
- اگر اجازه «یادآورها و هشدارها» داده نشده باشه، بنر و تُست فعال‌سازیش نمایش داده می‌شه

**زیرساخت:**
- فایل کلید امضا `my-release.keystore` ساخته شد (alias: `calendar`) — رمزها در `keystore-secrets.txt`
- ورک‌فلو `build-apk.yml` بازنویسی شد: بررسی سالم بودن کلید قبل از بیلد + بررسی امضای APK بعد از بیلد

### قبلی

- بعد از `npx cap add android` حتما `node scripts/patch-android.mjs` اجرا شود (آیکن نوتیف، اسپلش اسکرین، تم روشن و مجوز آلارم دقیق برای نوتیف سر دقیقه). اگر ورک فلو GitHub Actions دارید، این مرحله باید بین `cap add android` و `cap sync` باشد.
- به روزرسانی مناسبت ها پس از هر نوروز: `node scripts/update-events-from-timeir.mjs` (فایل `src/data/events-<سال>.json` و `src/data/index.ts` را می سازد). سال های قبلی حفظ می شوند.

### به روزرسانی خودکار مناسبت ها (بدون ساخت APK جدید)

1. فایل `.github/workflows/update-events.yml` (داخل `source-code/`) هر ماه صفحه سالانه Time.ir را می گیرد و `src/data/events-<سال>.json` را در ریپازیتوری commit می کند. از تب Actions هم می توانید دستی اجرایش کنید.
2. آدرس فایل را در `src/lib/events-config.ts` بگذارید (یا هنگام بیلد متغیر `NEXT_PUBLIC_EVENTS_JSON_URL` را تنظیم کنید):
   `https://raw.githubusercontent.com/<کاربر>/<ریپو>/main/src/data/events-{year}.json`
   (به جای `{year}` خود برنامه سال شمسی را می گذارد.)
3. برنامه وقتی سال جاری را ندارد (یا در بهمن و اسفند برای سال بعد) خودش از اینترنت می گیرد و در تنظیمات هم دکمه «به روزرسانی مناسبت ها از اینترنت» هست. اگر آدرس شما تنظیم نباشد یا در دسترس نباشد، به عنوان راه آخر مستقیم از Time.ir می خواند. داده دریافتی قبل از ذخیره اعتبارسنجی می شود؛ اگر خراب بود، داده داخل برنامه می ماند.

---

## نصب نسخه جدید روی نسخه قبلی (بدون حذف)

اندروید فقط وقتی APK جدید را روی قبلی نصب می کند که **امضای یکسان** و **versionCode بزرگ تر** داشته باشد. ورک فلو GitHub برای هر بیلد یک کلید debug تصادفی می ساخت، برای همین نصب با خطای «App not installed» رد می شد. راه حل:

1. ✅ **انجام شد** — کلید `my-release.keystore` (alias: `calendar`) از قبل ساخته شده و رمزهایش در `keystore-secrets.txt` هست. اگر کلید خودتان را می‌خواهید: `bash scripts/make-keystore.sh` را یک بار روی کامپیوتر خودتان (نیاز به Java) اجرا کنید و رمزها را یادداشت کنید. فایل را نگه دارید و در ریپازیتوری commit نکنید؛ اگر گم شود دیگر نمی توانید برنامه را آپدیت کنید.
2. در GitHub: Settings > Secrets and variables > Actions، چهار Secret بسازید: `KEYSTORE_BASE64` (محتوای `my-release.keystore.base64.txt`)، `KEYSTORE_PASSWORD`، `KEY_ALIAS` (مقدار `calendar`) و `KEY_PASSWORD`. ورک فلو همین پروژه (`build-apk.yml`) از همین نام‌ها استفاده می‌کند و اگر `KEYSTORE_BASE64` نباشد عمدا خطا می‌دهد.
3. این ورک فلو در هر اجرا هم `app-release.apk` (برای نصب مستقیم) و هم `app-release.aab` (برای Google Play) می سازد، با یک کلید و یک versionCode.
4. `scripts/patch-android.mjs` خودش versionCode را از شماره اجرای ورک فلو می گیرد (۱، ۲، ۳ ...) و امضا را از Secretها می خواند.

**فقط اولین بار** باید نسخه فعلی گوشی را حذف کنید (چون با کلید قبلی امضا شده)؛ آن هم یادآورها و یادداشت های داخل برنامه را پاک می کند. از بعد از آن، هر APK جدید روی قبلی نصب می شود و اطلاعات می ماند.


---

## انتشار در Google Play

### یک بار، پیش از اولین انتشار
1. در Play Console حساب توسعه دهنده و برنامه جدید با نام بسته `com.persiancalendar.app` بسازید (بعد از اولین آپلود، نام بسته برای همیشه ثابت می شود).
2. **Play App Signing**: هنگام اولین آپلود فعال بماند. کلید `my-release.keystore` شما «کلید آپلود» است و گوگل کلید نهایی را خودش نگه می دارد؛ اگر کلید آپلود را گم کنید می شود از Play Console ریست کرد.
3. اولین نسخه را باید دستی بسازید: Artifact ورک فلو را دانلود کنید و `app-release.aab` را در Testing > Internal testing آپلود کنید. بعد از آن آپلود خودکار هم ممکن است (مرحله بعد).
4. فرم های Play Console را پر کنید: Data safety (برنامه داده ای از کاربر جمع و ارسال نمی کند؛ همه چیز روی گوشی می ماند و فقط فایل مناسبت ها دانلود می شود)، Content rating، Target audience، آدرس Privacy policy و دسته برنامه.
5. **مجوز آلارم دقیق**: برنامه `USE_EXACT_ALARM` دارد که برای برنامه های «تقویم و یادآور» مجاز است. در بخش App content > Exact alarms کاربرد را «تقویم و یادآوری رویداد» انتخاب کنید. مجوز `SCHEDULE_EXACT_ALARM` فقط برای اندروید ۱۲ و پایین تر نگه داشته شده است (اسکریپت `patch-android.mjs` این را اعمال می کند).
6. مجوز `POST_NOTIFICATIONS` (اندروید ۱۳ به بالا) را برنامه موقع فعال کردن نوتیف از کاربر می پرسد و نیاز به فرم جدا ندارد.

### آپلود خودکار (اختیاری)
1. در Google Cloud یک Service Account بسازید و کلید JSON آن را بگیرید؛ در Play Console > Users and permissions همان ایمیل را با دسترسی Release اضافه کنید.
2. محتوای کامل فایل JSON را در GitHub Secret به نام `PLAY_SERVICE_ACCOUNT_JSON` بگذارید.
3. از این به بعد هر اجرای ورک فلو، AAB را در مسیر `internal` (به صورت draft) آپلود می کند. از Run workflow می توانید مسیر alpha، beta یا production را هم انتخاب کنید.

### به روزرسانی ها
- هر اجرا versionCode را بزرگ تر می کند (شماره اجرای ورک فلو)؛ Play و اندروید فقط عدد بزرگ تر را به عنوان به روزرسانی می پذیرند. هرگز ورک فلو را حذف و دوباره نسازید، چون شمارنده از ۱ شروع می شود و Play نسخه را رد می کند.
- **APK مستقیم و نسخه Play با هم قاطی نمی شوند**: نسخه Play با کلید گوگل امضا می شود و APK شما با کلید آپلود؛ امضاها فرق دارد و یکی روی دیگری نصب نمی شود. روی گوشی یا فقط Play یا فقط APK مستقیم داشته باشید.
- targetSdk برابر ۳۶ است و شرط فعلی Play را پوشش می دهد؛ هر سال شرط جدید ممکن است بیاید، پس Capacitor را به روز نگه دارید.
