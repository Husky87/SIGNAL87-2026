/**
 * The app's own surfaces at phone size.
 *
 * tests/mobile.e2e.mjs covers the install identity and the landing page; this
 * one drives the signed-in surfaces — the compare matrix, the file library and
 * the Ask composer — inside the real mobile shell, because that is where the
 * layout actually has to survive a 390px viewport.
 *
 * The check that matters is horizontal overflow. The app shell sets
 * overflow-hidden, so an element wider than the viewport is not a scrollbar
 * you would notice in review: it is silently clipped, which is how the Ask
 * composer shipped with its send button cut off the right edge.
 */
import { createServer } from 'vite';
import { chromium, devices } from 'playwright';

const PORT = 5195;
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const results = [];
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  results.push(`${ok ? 'PASS  ' : 'FAIL  '}${name}${ok ? '' : '\n        -> ' + detail}`);
};

const vite = await createServer({ server: { port: PORT }, logLevel: 'error' });
await vite.listen();

let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));

  for (const view of ['compare', 'library', 'ask']) {
    await page.goto(`http://localhost:${PORT}/tests/mobileview.harness.html?view=${view}`, { waitUntil: 'load' });
    await page.waitForSelector('.s87-app', { timeout: 30000 });
    await page.waitForTimeout(1400);

    const geo = await page.evaluate(() => {
      const vw = window.innerWidth;
      const over = [];
      for (const el of document.querySelectorAll('*')) {
        // A blurred, non-interactive glow is drawn deliberately outside its
        // box; it cannot swallow a control, so it is not overflow.
        if (String(el.className).includes('pointer-events-none')) continue;
        const b = el.getBoundingClientRect();
        if (b.width > 0 && b.right > vw + 1) {
          over.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(b.right)}`);
        }
      }
      // Straddling the right edge only. The closed navigation drawer parks its
      // whole contents at left:-256 by design, and that is not clipping —
      // clipping is a control the reader can half see but not reach.
      const clipped = [...document.querySelectorAll('button, a, input, textarea, select')]
        .filter((el) => {
          const b = el.getBoundingClientRect();
          return b.width > 0 && b.left < vw && b.right > vw + 1;
        })
        .map((el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 24));
      return { vw, scrollW: document.documentElement.scrollWidth, over: [...new Set(over)].slice(0, 4), clipped };
    });

    check(`${view}: nothing is wider than the viewport`, geo.over.length === 0, geo.over.join('\n           '));
    check(`${view}: no control is clipped off-screen`, geo.clipped.length === 0, geo.clipped.join(', '));
    check(`${view}: the page does not scroll sideways`, geo.scrollW <= geo.vw, `${geo.scrollW} > ${geo.vw}`);
  }

  // The composer glow is the one colour a hex scan cannot reach, because it is
  // written as rgb() channels inside a gradient.
  const glow = await page.evaluate(() =>
    [...document.querySelectorAll('[class*="pointer-events-none"]')]
      .map((el) => getComputedStyle(el).backgroundImage)
      .find((v) => v && v.includes('gradient')) || ''
  );
  check('the Ask composer glow is oxblood, not cyan',
    glow.includes('140, 47, 39') && !glow.includes('32, 184, 205'), glow.slice(0, 90));

  // The drawer is the only navigation on a phone.
  await page.goto(`http://localhost:${PORT}/tests/mobileview.harness.html?drawer=1`, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const drawer = await page.evaluate(() => {
    const panel = document.querySelector('.md\\:hidden.fixed.inset-y-0');
    if (!panel) return null;
    const r = panel.getBoundingClientRect();
    return { left: Math.round(r.left), width: Math.round(r.width), bg: getComputedStyle(panel).backgroundColor };
  });
  check('the navigation drawer opens on screen', !!drawer && drawer.left >= -1 && drawer.width > 200,
    JSON.stringify(drawer));

  check('no uncaught page errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser?.close();
  await vite.close();
}

console.log(results.join('\n'));
console.log(failed === 0 ? `\nmobile surfaces: all ${results.length} checks passed` : `\nmobile surfaces: ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
