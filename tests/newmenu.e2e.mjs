/**
 * Drives the sidebar's New menu in a browser.
 *
 * The button used to fire one hidden action, so notes and folders were not
 * reachable from it at all. These checks click the real menu and assert each
 * item lands somewhere — a menu whose items look right but go nowhere is the
 * failure worth catching.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';

const PORT = 5178;
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Render the Sidebar directly: the app gates on Firebase auth, and the menu's
  // behaviour is a property of the component, not of being signed in.
  await page.goto(`http://localhost:${PORT}/tests/newmenu.harness.html`, { waitUntil: 'load' });
  await page.waitForSelector('button[aria-haspopup="menu"]', { timeout: 30000 });

  const trigger = page.locator('button[aria-haspopup="menu"]:visible');
  const menu = page.locator('[role="menu"]:visible');

  check('the menu is closed until New is clicked', (await menu.count()) === 0);
  check('New renders once per nav copy, not more', (await page.locator('button[aria-haspopup="menu"]').count()) === 2);

  await trigger.click();
  await menu.waitFor({ state: 'visible', timeout: 5000 });
  check('clicking New opens a menu', await menu.isVisible());

  const labels = await page.locator('[role="menuitem"]:visible .font-medium').allTextContents();
  check('the menu offers asking a question', labels.includes('Ask a question'), labels.join(' | '));
  check('the menu offers creating a note', labels.includes('New note'), labels.join(' | '));
  check('the menu offers creating a folder', labels.includes('New folder'), labels.join(' | '));
  check('the menu offers uploading', labels.includes('Upload files'), labels.join(' | '));

  // Escape and click-away are how a menu is expected to close.
  await page.keyboard.press('Escape');
  check('Escape closes the menu', (await menu.count()) === 0);

  await trigger.click();
  await menu.waitFor({ state: 'visible' });
  await page.mouse.click(1200, 800);
  await page.waitForTimeout(150);
  check('clicking away closes the menu', (await menu.count()) === 0);

  // Each item must do something, and must close the menu behind it.
  for (const [label, expected] of [
    ['Ask a question', 'newSession+tab:research'],
    ['New note', 'newNote'],
    ['New folder', 'newFolder'],
    ['Upload files', 'upload']
  ]) {
    await page.evaluate(() => (window.__calls = []));
    await trigger.click();
    await menu.waitFor({ state: 'visible' });
    await page.locator('[role="menuitem"]:visible', { hasText: label }).click();
    await page.waitForTimeout(120);

    const calls = await page.evaluate(() => window.__calls);
    check(`"${label}" triggers ${expected}`, calls.join('+') === expected, `got ${JSON.stringify(calls)}`);
    check(`"${label}" closes the menu behind it`, (await menu.count()) === 0);
  }
} finally {
  await browser?.close();
  await vite.close();
}

console.log(results.join('\n'));
console.log(failed === 0 ? `\nnew menu: all ${results.length} checks passed` : `\nnew menu: ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
