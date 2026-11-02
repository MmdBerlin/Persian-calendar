/**
 * Start-up splash screen (shown by plain HTML + CSS, before React is ready).
 *
 * - It is part of the static HTML, so the WebView paints it immediately instead of an empty page.
 * - `CapacitorInit` fades it out once the app has mounted (see hideAppSplash).
 * - Colors are fixed light values (same as the app theme) so a dark phone theme never flashes black.
 */

export const SPLASH_ID = 'app-splash';

export const SPLASH_CSS = `
html{background-color:#f7f8fa}
body{background-color:#f7f8fa}
#${SPLASH_ID}{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:linear-gradient(180deg,#ffffff 0%,#eef0fb 100%);opacity:1;transition:opacity .35s ease,visibility .35s ease}
#${SPLASH_ID}.splash-hide{opacity:0;visibility:hidden;pointer-events:none}
#${SPLASH_ID} .splash-logo{width:84px;height:84px;border-radius:26px;background:linear-gradient(135deg,#5856d6,#7f7de8);display:flex;align-items:center;justify-content:center;box-shadow:0 12px 32px rgba(88,86,214,.35);animation:splash-pop .6s cubic-bezier(.22,1,.36,1) both}
#${SPLASH_ID} .splash-title{font-family:Tahoma,'Segoe UI',sans-serif;font-size:20px;font-weight:700;color:#1c1c28;animation:splash-rise .6s .1s cubic-bezier(.22,1,.36,1) both}
#${SPLASH_ID} .splash-dots{display:flex;gap:6px;animation:splash-rise .6s .2s cubic-bezier(.22,1,.36,1) both}
#${SPLASH_ID} .splash-dots i{width:7px;height:7px;border-radius:50%;background:#5856d6;opacity:.25;animation:splash-dot 1s infinite ease-in-out}
#${SPLASH_ID} .splash-dots i:nth-child(2){animation-delay:.15s}
#${SPLASH_ID} .splash-dots i:nth-child(3){animation-delay:.3s}
@keyframes splash-pop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
@keyframes splash-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes splash-dot{0%,80%,100%{opacity:.25;transform:scale(1)}40%{opacity:1;transform:scale(1.25)}}
@media (prefers-reduced-motion:reduce){#${SPLASH_ID} *{animation:none!important}#${SPLASH_ID}{transition:none}}
`;

export function AppSplash() {
  return (
    <div id={SPLASH_ID} aria-hidden="true">
      <div className="splash-logo">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4.5" width="18" height="16" rx="3.5" />
          <path d="M3 9.5h18M8 2.8v3.4M16 2.8v3.4" />
          <circle cx="12" cy="15" r="1.4" fill="#fff" stroke="none" />
        </svg>
      </div>
      <div className="splash-title">تقویم شمسی</div>
      <div className="splash-dots">
        <i />
        <i />
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
