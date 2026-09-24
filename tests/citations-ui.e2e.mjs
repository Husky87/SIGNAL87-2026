/**
 * Citations in Ask answers: hidden numbers by default, sources traceable by
 * hovering or tapping a chip or a sentence, and numbers back on via the setting.
 * Mounts the real AssistantAnswer (tests/citations-ui.harness.tsx).
 * Set CITATIONS_SHOTS=<dir> to save light/dark, desktop/phone screenshots.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const PORT = 5191;
const PREINSTALLED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync(PREINSTALLED) ? PREINSTALLED : undefined);
const SHOTS = process.env.CITATIONS_SHOTS;
const URL = `http://localhost:${PORT}/tests/citations-ui.harness.html`;

// The --teal-soft token as the app resolves it in the current theme.
const SOFT_ACCENT = () => {
  const probe = document.createElement('span');
  probe.style.backgroundColor = 'var(--teal-soft)';
  document.querySelector('.s87-app').appendChild(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
};

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
  browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), args: ['--no-sandbox'] });
  const pageErrors = [];

  // ---------- desktop ----------
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('.s87-cited');

  const answerText = () => page.evaluate(() => document.querySelector('[data-export-message-id]').innerText);
  const highlighted = () => page.evaluate(() => Array.from(document.querySelectorAll('.s87-cited[data-hl="true"]')).map((el) => el.textContent.replace(/\[\d\]/g, '')));
  const chip = (i) => page.locator('[data-source-chip]').nth(i);

  const text = await answerText();
  check('no [1] or [2] is shown by default', !/\[\d\]/.test(text), text);
  check('the prose has no stray " ." where markers were', !/ \./.test(text), text);
  check('three sentences are cited', (await page.locator('.s87-cited').count()) === 3);
  check('the uncited sentence is plain text', !(await page.evaluate(() => Array.from(document.querySelectorAll('.s87-cited')).some((el) => el.textContent.includes('Bridge loans')))));

  const ids = await page.evaluate(() => Array.from(document.querySelectorAll('.s87-cited')).map((el) => el.id));
  check('the first chip controls exactly its two sentences', (await chip(0).getAttribute('aria-controls')) === `${ids[0]} ${ids[1]}`, await chip(0).getAttribute('aria-controls'));
  check('the second chip controls its one sentence', (await chip(1).getAttribute('aria-controls')) === ids[2], await chip(1).getAttribute('aria-controls'));

  await chip(0).hover();
  await page.waitForTimeout(250);
  const hl = await highlighted();
  check('hovering the first chip highlights exactly its sentences', hl.length === 2 && hl[0].startsWith('The loan is') && hl[1].startsWith('The rate is fixed'), JSON.stringify(hl));
  const lightBg = await page.evaluate(() => getComputedStyle(document.querySelector('.s87-cited[data-hl="true"]')).backgroundColor);
  const lightToken = await page.evaluate(SOFT_ACCENT);
  check('the highlight uses the soft accent in light mode', lightBg === lightToken && lightBg !== 'rgba(0, 0, 0, 0)', `${lightBg} vs ${lightToken}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-light-chip.png` });
  await page.mouse.move(5, 890);
  await page.waitForTimeout(250);
  check('moving away clears the highlight', (await highlighted()).length === 0);

  // Hovering a cited sentence lists its file, with versions and snippet; clicking opens it with a search.
  await page.locator('.s87-cited').first().hover();
  await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
  const pop = await page.locator('[role="dialog"]').innerText();
  check('hovering a cited sentence shows its source', pop.includes('Term sheet.pdf') && pop.includes('2 versions'), pop);
  check('the popover shows the snippet', pop.includes('Mount Horeb Lodge bridge loan'), pop);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-light-popover.png` });
  await page.locator('[role="dialog"] button').first().click();
  const opened = await page.evaluate(() => window.__opened);
  check('clicking the file opens it', opened.length === 1 && opened[0].id === 'loan', JSON.stringify(opened));
  check('the viewer search is pre-filled with a phrase from the file', opened[0] && opened[0].search.length >= 4 && 'Borrower: Mount Horeb Lodge #10. Loan amount: $4,250,000. Rate: 9.5% fixed for the term.'.includes(opened[0].search), JSON.stringify(opened[0]));

  await page.mouse.move(5, 890);
  await page.mouse.click(5, 890);
  await page.waitForTimeout(300);
  await page.locator('text=Bridge loans like this').hover();
  await page.waitForTimeout(400);
  check('an uncited sentence has no popover', (await page.locator('[role="dialog"]').count()) === 0);

  // Keyboard: Enter opens the popover and moves focus into it; Escape closes and returns focus.
  await page.evaluate(() => document.querySelectorAll('.s87-cited')[2].focus());
  await page.keyboard.press('Enter');
  await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
  check('Enter opens the sources of a focused sentence', (await page.locator('[role="dialog"]').innerText()).includes('Lender letter.pdf'));
  check('focus moves into the popover', await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  check('Escape closes it', (await page.locator('[role="dialog"]').count()) === 0);
  check('focus returns to the sentence', await page.evaluate(() => document.activeElement === document.querySelectorAll('.s87-cited')[2]));

  // Dark mode uses the dark soft accent.
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await chip(1).hover();
  await page.waitForTimeout(250);
  const darkBg = await page.evaluate(() => getComputedStyle(document.querySelector('.s87-cited[data-hl="true"]')).backgroundColor);
  const darkPage = await page.evaluate(() => getComputedStyle(document.querySelector('.s87-app')).backgroundColor);
  check('the highlight shows in dark mode, in a dark tone', darkBg !== lightBg && darkBg !== darkPage && darkBg !== 'rgba(0, 0, 0, 0)', `${darkBg} on ${darkPage}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-dark-chip.png` });
  await page.mouse.move(5, 890);

  // Setting on: the numbers come back, and hover still works.
  await page.evaluate(() => window.__setNumbers(true));
  await page.waitForTimeout(100);
  const withNumbers = await answerText();
  check('the setting shows [1] and [2]', withNumbers.includes('[1]') && withNumbers.includes('[2]'), withNumbers);
  await chip(0).hover();
  await page.waitForTimeout(250);
  check('hover still highlights with numbers on', (await highlighted()).length === 2);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-dark-numbers.png` });
  await page.evaluate(() => window.__setNumbers(false));
  await page.close();

  // ---------- phone (touch) ----------
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const phone = await ctx.newPage();
  phone.on('pageerror', (e) => pageErrors.push(String(e)));
  await phone.goto(URL, { waitUntil: 'load' });
  await phone.waitForSelector('.s87-cited');
  const phoneChip = phone.locator('[data-source-chip]').first();
  await phoneChip.tap();
  await phone.waitForTimeout(250);
  const tapHl = await phone.evaluate(() => document.querySelectorAll('.s87-cited[data-hl="true"]').length);
  check('tapping a chip highlights its sentences', tapHl === 2, String(tapHl));
  check('the first tap does not open the file', (await phone.evaluate(() => window.__opened.length)) === 0);
  if (SHOTS) await phone.screenshot({ path: `${SHOTS}/phone-light-chip.png` });
  await phoneChip.tap();
  await phone.waitForTimeout(100);
  check('a second tap opens it', (await phone.evaluate(() => window.__opened.map((o) => o.id).join())) === 'loan');

  await phone.locator('.s87-cited').nth(2).tap();
  await phone.waitForSelector('[role="dialog"]', { timeout: 3000 });
  const box = await phone.locator('[role="dialog"]').boundingBox();
  check('tapping a sentence shows its source, inside the screen', box && box.x >= 0 && box.x + box.width <= 390, JSON.stringify(box));
  await phone.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  if (SHOTS) await phone.screenshot({ path: `${SHOTS}/phone-dark-popover.png` });
  check('no horizontal scroll at phone width', await phone.evaluate(() => document.documentElement.scrollWidth <= 390));
  await phone.touchscreen.tap(20, 800);
  await phone.waitForTimeout(150);
  check('tapping elsewhere closes it', (await phone.locator('[role="dialog"]').count()) === 0);
  await ctx.close();

  check('no page errors', pageErrors.length === 0, pageErrors.join('\n'));
} catch (error) {
  failed++;
  results.push(`FAIL  test crashed\n        -> ${error && error.stack ? error.stack : error}`);
} finally {
  if (browser) await browser.close();
  await vite.close();
}

console.log(results.join('\n'));
console.log(`\ncitations ui: ${failed === 0 ? `all ${results.length} checks passed` : `${failed} of ${results.length} checks failed`}`);
process.exit(failed === 0 ? 0 : 1);
