/**
 * Asking about specific files: choosing files in Ask (or "Ask about this file"
 * in the viewer) limits the question to them; "Search all files" goes back to
 * the whole workspace.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const PORT = 5191;
const PREINSTALLED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync(PREINSTALLED) ? PREINSTALLED : undefined);
const results = [];
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; results.push(`${ok ? 'PASS  ' : 'FAIL  '}${name}${ok ? '' : '\n        -> ' + detail}`); };

const vite = await createServer({ server: { port: PORT }, logLevel: 'error' });
await vite.listen();
let browser;
try {
  browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), args: ['--no-sandbox'] });
  const errors = [];
  const ask = async (page, text) => {
    const before = await page.evaluate(() => window.__requests.length);
    await page.getByRole('textbox', { name: 'Ask Signal87' }).fill(text);
    await page.keyboard.press('Enter');
    await page.waitForFunction((n) => window.__requests.length > n, before, { timeout: 15000 });
    return page.evaluate(() => window.__requests[window.__requests.length - 1]);
  };
  const ids = (body) => (body.documents || []).map((d) => d.id).sort().join(',');

  // 1. Desktop: choose a file from the composer, ask, then go back to all files.
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/tests/askscope.harness.html`);
  await page.getByRole('button', { name: 'Choose files to search' }).waitFor();
  check('the composer shows which files it searches ("All files")', await page.getByRole('button', { name: 'Choose files to search' }).isVisible());
  let body = await ask(page, 'What is the rent escalator?');
  check('by default the whole workspace is searched', ids(body) === 'doc-bio,doc-lease,doc-loan', ids(body));

  await page.getByRole('button', { name: 'Choose files to search' }).click();
  await page.getByText('Choose files to search', { exact: true }).waitFor();
  await page.getByRole('button', { name: /ROK_Loan_Term_Sheet\.pdf/ }).first().click();
  await page.getByRole('button', { name: 'Search this file' }).click();
  await page.getByRole('button', { name: /^Done/ }).click();
  await page.waitForTimeout(200);
  check('the picker marks the chosen file', await page.getByText('Only searching').isVisible());
  body = await ask(page, 'What is the loan amount?');
  check('a chosen file limits the question to that file', ids(body) === 'doc-loan', ids(body));
  check('the chosen file is not also sent as an attachment', (body.ingestedFilesData || []).length === 0, JSON.stringify(body.ingestedFilesData));
  body = await ask(page, 'And the lender?');
  check('the choice stays for follow-up questions', ids(body) === 'doc-loan', ids(body));
  await page.getByRole('button', { name: 'Search all files' }).click();
  body = await ask(page, 'Who founded Signal87?');
  check('"Search all files" goes back to the whole workspace', ids(body) === 'doc-bio,doc-lease,doc-loan', ids(body));

  // 2. "Ask about this file" from the viewer (scopeRequest).
  const viewer = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  viewer.on('pageerror', (e) => errors.push(String(e)));
  await viewer.goto(`http://localhost:${PORT}/tests/askscope.harness.html?scope=doc-lease`);
  await viewer.getByText('Only searching').waitFor();
  body = await ask(viewer, 'How long is the term?');
  check('"Ask about this file" opens Ask limited to that file', ids(body) === 'doc-lease', ids(body));

  // 3. Phone: the scope control is reachable.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  phone.on('pageerror', (e) => errors.push(String(e)));
  await phone.goto(`http://localhost:${PORT}/tests/askscope.harness.html?scope=doc-bio`);
  await phone.getByText('Only searching').waitFor();
  // The scope row sits under the composer; "Search all files" is its control.
  const box = await phone.getByRole('button', { name: 'Search all files' }).boundingBox();
  check('on a phone the scope control is on screen and tappable', !!box && box.x >= 0 && box.x + box.width <= 390 && box.height >= 32, JSON.stringify(box));

  check('no page errors', errors.length === 0, errors.join('\n'));
} finally {
  if (browser) await browser.close();
  await vite.close();
}
console.log(results.join('\n'));
console.log(failed ? `\nask scope: ${failed} FAILED of ${results.length}` : `\nask scope: all ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
