/**
 * Choosing files for a question happens on the Files page: clicking a file
 * selects it (doesn't open it), a bar shows the count, and confirming hands the
 * chosen ids back to Ask. The keyboard can't delete files in this mode.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const PORT = 5193;
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
  for (const [label, width, height] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://localhost:${PORT}/tests/filepick.harness.html`);
    const bar = page.getByRole('region', { name: 'Choose files to ask about' });
    await bar.waitFor();
    check(`${label}: the bar starts from the files already chosen in Ask`, (await bar.innerText()).includes('1 file selected'), await bar.innerText());
    await page.getByText('Harbor_Lease.pdf', { exact: true }).first().click();
    check(`${label}: clicking a file selects it`, (await bar.innerText()).includes('2 files selected'), await bar.innerText());
    check(`${label}: clicking a file does not open it`, (await page.evaluate(() => window.__opened.length)) === 0);
    await page.keyboard.press('Delete');
    await page.keyboard.press('Backspace');
    check(`${label}: Delete/Backspace never delete files in this mode`, (await page.evaluate(() => window.__deleted.length)) === 0);
    const box = await bar.boundingBox();
    check(`${label}: the bar is fully on screen`, !!box && box.x >= 0 && box.x + box.width <= width && box.y + box.height <= height, JSON.stringify(box));
    await page.getByRole('button', { name: 'Ask about 2 files' }).click();
    const confirmed = await page.evaluate(() => window.__confirmed);
    check(`${label}: confirming hands the chosen files back to Ask`, JSON.stringify([...(confirmed || [])].sort()) === '["doc-lease","doc-loan"]', JSON.stringify(confirmed));
    await page.getByRole('button', { name: 'Cancel' }).click();
    check(`${label}: Cancel goes back without changing anything`, await page.evaluate(() => window.__cancelled === true));
    check(`${label}: no page errors`, errors.length === 0, errors.join('\n'));
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  await vite.close();
}
console.log(results.join('\n'));
console.log(failed ? `\nfile pick: ${failed} FAILED of ${results.length}` : `\nfile pick: all ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
