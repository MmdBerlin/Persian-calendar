#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ساخت کلید امضای APK — فقط یک بار روی کامپیوتر خودتان اجرا کنید (نیازمند keytool جاوا).
# این کلید هر APK را امضا می‌کند؛ اگر گمش کنید دیگر نمی‌توانید روی نسخه قبلی آپدیت بدهید.
# فایل my-release.keystore و رمزها را جای امن نگه دارید!
#
# اجرای تعاملی (خودتان رمز می‌زنید):
#   ./scripts/make-keystore.sh
#
# اجرای غیرتعاملی (برای اسکریپت‌ها):
#   KEYSTORE_PASSWORD='رمز' ./scripts/make-keystore.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

KEYSTORE="${KEYSTORE_NAME:-my-release.keystore}"
ALIAS="${KEY_ALIAS:-calendar}"

if [ -n "$KEYSTORE_PASSWORD" ]; then
  # غیرتعاملی
  keytool -genkeypair -v -keystore "$KEYSTORE" -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 36500 \
    -storepass "$KEYSTORE_PASSWORD" -keypass "$KEYSTORE_PASSWORD" \
    -dname "CN=Persian Calendar, OU=Mobile, O=PersianCalendar, L=Tehran, ST=Tehran, C=IR"
else
  # تعاملی
  keytool -genkeypair -v -keystore "$KEYSTORE" -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 36500
fi

echo
echo "✅ کلید ساخته شد: $KEYSTORE (alias: $ALIAS)"
echo
echo "حالا این ۴ راز را در GitHub بگذارید: Settings > Secrets and variables > Actions > New repository secret"
echo "  KEYSTORE_BASE64   = $(base64 -w0 "$KEYSTORE" 2>/dev/null | cut -c1-20)...  (کل رشته: base64 -w0 "$KEYSTORE")"
echo "  KEYSTORE_PASSWORD = رمزی که برای keystore زدید"
echo "  KEY_ALIAS         = $ALIAS"
echo "  KEY_PASSWORD      = رمزی که برای کلید زدید (اگر Enter زدید، همان رمز keystore)"
echo
echo "⚠️  فایل $KEYSTORE را در گیت کامیت نکنید."
