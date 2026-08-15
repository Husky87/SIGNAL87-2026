/**
 * Back must close the overlay on top, and only that overlay — and closing from
 * the UI must leave the history stack where it found it. If it does not, back
 * needs pressing once per overlay ever opened before it does anything visible.
 */
import { createServer } from 'vite';
import { chromium, devices } from 'playwright';

const PORT = 5181;
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const results = [];
let failed = 0;
const check = (n, ok, d = '') => { if (!ok) failed++; results.push(`${ok ? 'PASS  ' : 'FAIL  '}${n}${ok ? '' : '\n        -> ' + d}`); };

const vite = await createServer({ server: { port: PORT }, logLevel: 'error' });
await vite.listen();
let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/tests/backdismiss.harness.html`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="open-drawer"]');

  const state = () => page.evaluate(() => window.__state());
  const settle = () => page.waitForTimeout(180);

  // 1. Back closes a single overlay instead of leaving the page.
  await page.click('[data-testid="open-drawer"]'); await settle();
  check('opening an overlay leaves it open', (await state()).drawer);
  await page.goBack(); await settle();
  check('back closes the overlay', !(await state()).drawer);
  check('back did not leave the app', page.url().includes('backdismiss.harness.html'), page.url());

  // 2. Closing from the UI must not leak a history entry.
  await page.click('[data-testid="open-drawer"]'); await settle();
  await page.click('[data-testid="close-drawer"]'); await settle();
  check('and the overlay is closed', !(await state()).drawer);

  // After a clean close, back should leave the page — nothing is stacked up.
  await page.goBack(); await settle();
  check('with nothing open, back leaves the page as normal', !page.url().includes('backdismiss.harness.html'), page.url());

  await page.goto(`http://localhost:${PORT}/tests/backdismiss.harness.html`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="open-drawer"]');

  // 3. Nested overlays unwind one at a time, newest first.
  await page.click('[data-testid="open-drawer"]'); await settle();
  await page.click('[data-testid="open-modal"]'); await settle();
  check('both overlays are open', (await state()).drawer && (await state()).modal);
  await page.goBack(); await settle();
  let s = await state();
  check('back closes the newest overlay only', !s.modal && s.drawer, JSON.stringify(s));
  await page.goBack(); await settle();
  s = await state();
  check('a second back closes the one beneath it', !s.drawer && !s.modal, JSON.stringify(s));

  // 4. Repeated open/close cycles must not accumulate entries. Measured by
  //    behaviour: after three clean closes, a single back still leaves the page.
  //    A leak would mean back had to be pressed once per cycle first.
  for (let i = 0; i < 3; i++) {
    await page.click('[data-testid="open-modal"]'); await settle();
    await page.click('[data-testid="close-modal"]'); await settle();
  }
  check('three open/close cycles left nothing open', !(await state()).modal && !(await state()).drawer);
  await page.goBack(); await settle();
  check('and one back still leaves the page, so nothing leaked', !page.url().includes('backdismiss.harness.html'), page.url());
} finally {
  await browser?.close();
  await vite.close();
}
console.log(results.join('\n'));
console.log(failed === 0 ? `\nback gesture: all ${results.length} checks passed` : `\nback gesture: ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
