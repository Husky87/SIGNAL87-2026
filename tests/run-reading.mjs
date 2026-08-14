/**
 * Drives the reading suite in a real browser.
 *
 * Starts its own Vite server so the suite is self-contained — the parser depends
 * on a bundled pdf.js worker and on browser File/FileReader APIs, so it has to
 * run where the app runs rather than under a Node shim.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const PORT = 5177;

// The image the environment ships may not match the build Playwright expects.
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const vite = await createServer({ server: { port: PORT }, logLevel: 'error' });
await vite.listen();

let browser;
let exitCode = 1;
try {
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://localhost:${PORT}/tests/reading.e2e.html`, { waitUntil: 'load' });
  await page.waitForFunction('window.__done === true', null, { timeout: 120000 });

  const data = JSON.parse(await page.textContent('#out'));
  if (data.fatal) throw new Error(`harness died: ${data.fatal}`);

  // Handed to the answering suite, so it works from text a real parse produced.
  writeFileSync(new URL('./.parsed.json', import.meta.url), JSON.stringify(data.parsed));

  let failed = 0;
  for (const c of data.checks) {
    if (!c.ok) failed++;
    console.log(`${c.ok ? 'PASS  ' : 'FAIL  '}${c.name}${c.ok ? '' : '\n        -> ' + c.detail}`);
  }
  if (errors.length) console.log('\npage errors:\n' + errors.join('\n'));
  console.log(failed === 0 ? `\nreading: all ${data.checks.length} checks passed` : `\nreading: ${failed} FAILED`);
  exitCode = failed === 0 ? 0 : 1;
} finally {
  await browser?.close();
  await vite.close();
}

process.exit(exitCode);
