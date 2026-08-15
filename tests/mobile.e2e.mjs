/**
 * Mobile quality checks, at phone size with touch emulation on.
 *
 * These assert the properties that decide whether an installed app looks like
 * an app: it has an identity to install under, it does not zoom when you type,
 * it does not flash grey when you tap, and nothing runs off the side or under
 * the status bar.
 */
import { createServer } from 'vite';
import { chromium, devices } from 'playwright';
import { readFileSync } from 'fs';

const PORT = 5180;
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const results = [];
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  results.push(`${ok ? 'PASS  ' : 'FAIL  '}${name}${ok ? '' : '\n        -> ' + detail}`);
};

// --- the manifest, read as a device would parse it ---
const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
check('the app has a name to install under', manifest.name === 'Signal87 AI' && manifest.short_name.length <= 12, manifest.short_name);
check('it opens without browser chrome', manifest.display === 'standalone', manifest.display);
check('it declares a start url and scope', manifest.start_url === '/' && manifest.scope === '/');
check('its background matches the app, so the launch is not a white flash', manifest.background_color === '#1E2020', manifest.background_color);
check('it ships a maskable icon for Android', manifest.icons.some((i) => i.purpose === 'maskable'));
check('it ships a 512px icon for the store listing and splash', manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any'));

const vite = await createServer({ server: { port: PORT }, logLevel: 'error' });
await vite.listen();

let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  // --- identity is actually wired into the document ---
  const head = await page.evaluate(() => ({
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
    appleIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content'),
    statusBar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content'),
    title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content'),
    viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content')
  }));

  check('the manifest is linked', head.manifest === '/manifest.webmanifest', String(head.manifest));
  check('there is a real PNG home-screen icon', head.appleIcon === '/icons/icon-180.png', String(head.appleIcon));
  check('the status bar is themed to the app', head.themeColor === '#1E2020', String(head.themeColor));
  check('iOS is told it can run standalone', head.capable === 'yes', String(head.capable));
  check('the status bar is translucent, not an opaque strip', head.statusBar === 'black-translucent', String(head.statusBar));
  check('the home-screen label is short enough not to truncate', (head.title || '').length <= 12, String(head.title));
  check('the viewport extends under the notch', /viewport-fit=cover/.test(head.viewport || ''), String(head.viewport));
  check('pinch zoom is not disabled', !/user-scalable\s*=\s*no|maximum-scale/.test(head.viewport || ''), String(head.viewport));

  // --- the assets the manifest promises actually exist ---
  for (const path of ['/manifest.webmanifest', '/icons/icon-180.png', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png']) {
    const status = await page.evaluate(async (p) => (await fetch(p)).status, path);
    check(`${path} is served`, status === 200, `HTTP ${status}`);
  }

  // --- typing must not zoom the page ---
  const smallFields = await page.evaluate(() =>
    [...document.querySelectorAll('input, textarea, select')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ ph: el.getAttribute('placeholder') || el.type, px: parseFloat(getComputedStyle(el).fontSize) }))
      .filter((f) => f.px < 16)
  );
  check('no visible field is small enough to trigger iOS zoom', smallFields.length === 0, JSON.stringify(smallFields));

  // --- taps should not flash grey ---
  const tap = await page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return { highlight: s.webkitTapHighlightColor, adjust: s.webkitTextSizeAdjust };
  });
  check('tapping does not paint the browser grey flash', /rgba\(0, 0, 0, 0\)|transparent/.test(tap.highlight || ''), String(tap.highlight));
  check('rotating to landscape does not resize text', tap.adjust === '100%', String(tap.adjust));

  const btnTouch = await page.evaluate(() => {
    const b = document.querySelector('button');
    return b ? getComputedStyle(b).touchAction : null;
  });
  check('taps register without the double-tap-zoom delay', btnTouch === 'manipulation', String(btnTouch));

  // --- a tap must be acknowledged ---
  const press = await page.evaluate(() => {
    const b = document.querySelector('button');
    if (!b) return null;
    const rules = [...document.styleSheets].flatMap((sheet) => {
      try { return [...sheet.cssRules]; } catch { return []; }
    });
    const hasPressed = rules.some(
      (r) => r.conditionText === '(hover: none)' &&
        [...(r.cssRules || [])].some((inner) => /:active/.test(inner.selectorText || '') && /opacity/.test(inner.style?.cssText || ''))
    );
    return { hasPressed, transition: getComputedStyle(b).transitionProperty };
  });
  check('tapping a control gives a pressed state, since hover cannot fire on touch', press?.hasPressed === true, JSON.stringify(press));

  // --- nothing runs off the side ---
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth
  }));
  check('the page does not scroll sideways on a phone', overflow.doc <= overflow.win + 1, `${overflow.doc} > ${overflow.win}`);

  // --- every tap target is big enough to hit ---
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, a[href], [role="button"]')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((t) => t.w > 0 && (t.w < 44 || t.h < 44))
  );
  check('every visible control is at least 44px', small.length === 0, JSON.stringify(small));
} finally {
  await browser?.close();
  await vite.close();
}

console.log(results.join('\n'));
console.log(failed === 0 ? `\nmobile: all ${results.length} checks passed` : `\nmobile: ${failed} FAILED of ${results.length}`);
process.exit(failed === 0 ? 0 : 1);
