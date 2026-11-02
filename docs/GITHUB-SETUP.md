# راه‌اندازی GitHub و گرفتن APK

## ۱) آپلود روی GitHub (با گیت، نه با drag & drop)
```bash
cd persian-calendar
git init -b main
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<USER>/<REPO>.git
git push -u origin main
```
> آپلود از وب‌سایت حداکثر ۱۰۰ فایل در هر بار می‌گیرد و این پروژه بیش از ۲۸۰ فایل دارد؛ پس از git استفاده کنید.

## ۲) ساخت ۴ Secret
Settings → Secrets and variables → Actions → New repository secret

| نام | مقدار |
|---|---|
| `KEYSTORE_BASE64` | خروجی `base64 -w0 my-release.keystore` |
| `KEYSTORE_PASSWORD` | رمز keystore |
| `KEY_ALIAS` | `calendar` |
| `KEY_PASSWORD` | رمز کلید |

اگر keystore ندارید: `./scripts/make-keystore.sh` (نیاز به Java). این فایل را گم نکنید و هرگز کامیت نکنید.

## ۳) بیلد
با هر push به `main` خودکار اجرا می‌شود (یا Actions → Build Android APK → Run workflow).
خروجی: Actions → اجرای موردنظر → Artifacts → `persian-calendar-release` (شامل `app-release.apk` و `app-release.aab`).
