// Run after `npx cap add android` (and again after every `npx cap sync` if you like; it is idempotent).
// The android/ folder is generated in CI and not committed, so project-specific native tweaks live here:
//   1. copies android-resources/ (notification icon, splash drawable, splash colors) into the project
//   2. removes the default splash.png images so our splash.xml is used
//   3. patches styles.xml: light (never dark/black) window background + branded launch splash
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const resSrc = 'android-resources';
const resDst = 'android/app/src/main/res';

if (!existsSync('android')) {
  console.error('android/ not found. Run `npx cap add android` first.');
  process.exit(1);
}

// 1) resources
mkdirSync(resDst, { recursive: true });
cpSync(resSrc, resDst, { recursive: true });
console.log(`Copied ${resSrc} -> ${resDst}`);

// 2) default splash images (a splash.png next to our splash.xml would be a duplicate resource)
for (const dir of readdirSync(resDst)) {
  if (!dir.startsWith('drawable')) continue;
  const png = join(resDst, dir, 'splash.png');
  if (existsSync(png)) {
    rmSync(png);
    console.log(`Removed ${png}`);
  }
}

// 3) styles.xml
const stylesPath = join(resDst, 'values', 'styles.xml');
if (existsSync(stylesPath)) {
  let s = readFileSync(stylesPath, 'utf8');
  const before = s;

  // DayNight theme turns the window black on phones in dark mode; the app UI is light-only.
  s = s.replace('Theme.AppCompat.DayNight.NoActionBar', 'Theme.AppCompat.Light.NoActionBar');

  if (!s.includes('android:windowBackground')) {
    s = s.replace(
      /(<style name="AppTheme\.NoActionBar"[^>]*>)/,
      '$1\n        <item name="android:windowBackground">@color/splash_background</item>'
    );
  }
  if (!s.includes('windowSplashScreenBackground')) {
    s = s.replace(
      /(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)/,
      '$1\n        <item name="windowSplashScreenBackground">@color/splash_background</item>' +
        '\n        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>'
    );
  }
  if (s !== before) {
    writeFileSync(stylesPath, s);
    console.log('Patched styles.xml (light window background + branded splash)');
  } else {
    console.log('styles.xml already patched');
  }
}

// 4) AndroidManifest: exact alarms, so a reminder set for 09:35 fires at 09:35 and not minutes later.
//    Google Play rules: USE_EXACT_ALARM (Android 13+) is allowed for calendar/alarm apps and is granted
//    automatically; SCHEDULE_EXACT_ALARM is only kept for Android 12 and older (maxSdkVersion=32).
//    The Local Notifications plugin declares SCHEDULE_EXACT_ALARM without that limit, so it is overridden here.
//    POST_NOTIFICATIONS (Android 13+) + boot + wake lock keep notifications alive when the app is closed.
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
if (existsSync(manifestPath)) {
  let m = readFileSync(manifestPath, 'utf8');
  const beforeM = m;
  if (!m.includes('xmlns:tools=')) {
    m = m.replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ');
  }
  const addPerm = (perm) => {
    if (!m.includes(`android.permission.${perm}"`)) {
      m = m.replace('</manifest>', `    <uses-permission android:name="android.permission.${perm}" />\n</manifest>`);
    }
  };
  addPerm('USE_EXACT_ALARM');
  if (!m.includes('android.permission.SCHEDULE_EXACT_ALARM"')) {
    m = m.replace(
      '</manifest>',
      '    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" android:maxSdkVersion="32" tools:node="replace" />\n</manifest>'
    );
  }
  addPerm('POST_NOTIFICATIONS');
  addPerm('RECEIVE_BOOT_COMPLETED');
  addPerm('WAKE_LOCK');
  if (m !== beforeM) {
    writeFileSync(manifestPath, m);
    console.log('Patched AndroidManifest.xml (exact alarms + notification permissions, Play compliant)');
  }
}

// 5) app/build.gradle: stable signing key + increasing version, so a new APK installs OVER the old one.
//    Android only updates an app when the new APK has the SAME signature and a HIGHER versionCode.
//    A CI machine creates a new random debug key on every run, which is why updates failed with
//    "App not installed" and the old version had to be uninstalled first.
//    - signing: set KEYSTORE_FILE / KEYSTORE_PASSWORD / KEY_ALIAS / KEY_PASSWORD (see scripts/make-keystore.sh)
//    - version: versionCode comes from VERSION_CODE / GITHUB_RUN_NUMBER (1, 2, 3 ... on every workflow run)
const gradlePath = 'android/app/build.gradle';
if (existsSync(gradlePath)) {
  let g = readFileSync(gradlePath, 'utf8');
  const beforeG = g;

  if (!g.includes('GITHUB_RUN_NUMBER')) {
    // VERSION_CODE (set by the workflow) wins; otherwise the workflow run number
    g = g.replace(
      /versionCode\s+\d+/,
      'versionCode (System.getenv("VERSION_CODE") ?: System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInteger()'
    );
    g = g.replace(
      /versionName\s+"[^"]*"/,
      'versionName "1.0." + (System.getenv("VERSION_CODE") ?: System.getenv("GITHUB_RUN_NUMBER") ?: "0")'
    );
  }
  if (!g.includes('signingConfigs')) {
    g = g.replace(
      /(\n\s*)buildTypes \{/,
      `$1signingConfigs {
        ci {
            def ksFile = System.getenv("KEYSTORE_FILE")
            if (ksFile) {
                storeFile file(ksFile)
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias System.getenv("KEY_ALIAS")
                keyPassword System.getenv("KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        debug {
            if (System.getenv("KEYSTORE_FILE")) { signingConfig signingConfigs.ci }
        }`
    );
    g = g.replace(
      /(release \{\s*\n)/,
      `$1            if (System.getenv("KEYSTORE_FILE")) { signingConfig signingConfigs.ci }\n`
    );
  }
  if (g !== beforeG) {
    writeFileSync(gradlePath, g);
    console.log('Patched app/build.gradle (stable signing + versionCode from GITHUB_RUN_NUMBER)');
  } else {
    console.log('app/build.gradle already patched');
  }
}
