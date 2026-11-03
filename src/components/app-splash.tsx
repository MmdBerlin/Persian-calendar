/**
 * Start-up splash screen (shown by plain HTML + CSS, before React is ready).
 *
 * - It is part of the static HTML, so the WebView paints it immediately instead of an empty page.
 * - `CapacitorInit` fades it out once the app has mounted (see hideAppSplash).
 * - Design: the app's own blue as a soft gradient, a frosted minimal icon tile,
 *   the app name and a slim loading bar.
 */

export const SPLASH_ID = 'app-splash';

/** App blue = the light theme's primary (oklch(0.55 0.22 264) ≈ #2B62EF). */
const BLUE = '#2B62EF';
const BLUE_DEEP = '#1B4DD1';
/** The app's own light page background — same as the previous version's body
 *  colour (#F7F8FA ≈ --background oklch(0.985 0.002 240)), so the app keeps
 *  its original look once the splash is gone. */
const PAGE_BG = '#F7F8FA';

export const SPLASH_CSS = `
/* Startup safety net ONLY: html is blue so the very first paint (before any
   bundle) matches the launch splash. Do NOT paint body blue here — this
   inline style is unlayered, so it would override the Tailwind bg-background
   utility on body (cascade layers: unlayered wins over layered), and the blue
   would then leak through the page's semi-transparent bottom gradient and
   change the app's background colour. The splash element itself is
   position:fixed inset:0 and covers the blue html at first paint; body is
   opaque and position:fixed inset:0, so it covers the blue permanently after. */
html{background-color:${BLUE}}
body{background-color:${PAGE_BG}}
#${SPLASH_ID}{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(165deg,${BLUE} 0%,${BLUE_DEEP} 100%);opacity:1;transition:opacity .35s ease,visibility .35s ease;overflow:hidden}
#${SPLASH_ID}.splash-hide{opacity:0;visibility:hidden;pointer-events:none}
#${SPLASH_ID} .splash-glow{position:absolute;top:50%;left:50%;width:360px;height:360px;margin:-180px 0 0 -180px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.16) 0%,rgba(255,255,255,0) 70%);pointer-events:none}
#${SPLASH_ID} .splash-logo{position:relative;width:92px;height:92px;border-radius:28px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.30);display:flex;align-items:center;justify-content:center;box-shadow:0 18px 44px rgba(13,32,94,.35);animation:splash-pop .6s cubic-bezier(.22,1,.36,1) both}
#${SPLASH_ID} .splash-title{position:relative;margin-top:22px;font-family:'Segoe UI',Tahoma,-apple-system,sans-serif;font-size:21px;font-weight:700;letter-spacing:.01em;color:#fff;animation:splash-rise .6s .12s cubic-bezier(.22,1,.36,1) both}
#${SPLASH_ID} .splash-sub{position:relative;margin-top:7px;font-family:'Segoe UI',Tahoma,sans-serif;font-size:12px;color:rgba(255,255,255,.75);animation:splash-rise .6s .2s cubic-bezier(.22,1,.36,1) both}
#${SPLASH_ID} .splash-bar{position:relative;margin-top:28px;width:132px;height:3px;border-radius:3px;background:rgba(255,255,255,.18);overflow:hidden;animation:splash-rise .6s .28s cubic-bezier(.22,1,.36,1) both}
#${SPLASH_ID} .splash-bar i{position:absolute;top:0;right:0;bottom:0;width:0;border-radius:3px;background:#fff;animation:splash-fill 1.75s .15s cubic-bezier(.3,.1,.25,1) forwards}
@keyframes splash-pop{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}
@keyframes splash-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes splash-fill{from{width:0}to{width:100%}}
@media (prefers-reduced-motion:reduce){#${SPLASH_ID} *{animation:none!important}#${SPLASH_ID} .splash-bar i{width:100%}#${SPLASH_ID}{transition:none}}
`;

export function AppSplash() {
  return (
    <div id={SPLASH_ID} aria-hidden="true">
      <div className="splash-glow" />
      <div className="splash-logo">
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4.5" width="18" height="16" rx="3.5" />
          <path d="M3 9.5h18M8 2.8v3.4M16 2.8v3.4" />
          <circle cx="12" cy="15" r="1.3" fill="#fff" stroke="none" />
        </svg>
      </div>
      <div className="splash-title" dir="ltr">Persian Calendar</div>
      <div className="splash-sub">تقویم شمسی و میلادی</div>
      <div className="splash-bar">
        <i />
      </div>
    </div>
  );
}

/** Fade the splash out. The element stays in the DOM (React owns it); it is just hidden. */
export function hideAppSplash() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(SPLASH_ID);
  if (el) el.classList.add('splash-hide');
}
