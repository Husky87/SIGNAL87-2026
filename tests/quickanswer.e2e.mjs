/**
 * Checks that a question handed to the assistant is actually asked, with the
 * library attached — the pathway the mobile search box now feeds.
 *
 * Also asserts the App source wires the search field to that pathway, since the
 * header markup itself lives inside a component that needs Firebase auth to
 * mount. Rendering a copy of the header here would only test the copy.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const PORT = 5179;
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const results = [];
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  results.push(`${ok ? 'PASS  ' : 'FAIL  '}${name}${ok ? '' : '\n        -> ' + detail}`);
};

// --- the wiring in App, read from source ---
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
check('the search field submits instead of only filtering', /onSubmit=\{\(e\) => \{\s*e\.preventDefault\(\);\s*handleAskFromSearch\(\);/.test(app));
check('submitting hands the text to the assistant pathway', /const handleAskFromSearch = \(\) => \{[\s\S]*?handleAskFromHome\(trimmed\);/.test(app));
check('that pathway starts a session and sets the pending query', /const handleAskFromHome[\s\S]*?handleCreateNewSession\(\);\s*setPendingHomeQuery\(trimmed\);/.test(app));
check('the assistant receives it as initialQuery', /initialQuery=\{pendingHomeQuery\}/.test(app));
check('the phone keyboard offers a search action', /enterKeyHint="search"/.test(app));
check('an empty box does not fire a question', /const trimmed = searchQuery\.trim\(\);\s*if \(!trimmed\) return;/.test(app));

const vite = await createServer({ server: { port: PORT }, logLevel: 'error' });
await vite.listen();

let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  // A phone-sized viewport, since this is the mobile pathway.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto(`http://localhost:${PORT}/tests/quickanswer.harness.html`, { waitUntil: 'load' });
  await page.waitForFunction('window.__requests && window.__requests.length > 0', null, { timeout: 30000 });
  await page.waitForTimeout(400);

  const requests = await page.evaluate(() => window.__requests);
  const consumed = await page.evaluate(() => window.__consumed === true);
  const req = requests[0];

  check('a handed-off question is sent without the user pressing anything', requests.length >= 1);
  check('it goes to the chat endpoint', req.url.includes('/api/chat'), req.url);
  check('the question itself is sent', req.body.prompt === 'What is the start date?', JSON.stringify(req.body.prompt));
  check('the library travels with it', JSON.stringify(req.body.documents || []).includes('08/12/2026'), JSON.stringify(req.body.documents || []).slice(0, 200));
  check('the query is marked consumed so it does not re-fire', consumed);
  check('it is asked exactly once', requests.length === 1, `${requests.length} requests`);

  const body = await page.textContent('body');
  check('the answer is rendered back to the user', body.includes('08/12/2026'), body.slice(0, 200));
  check('no page errors', pageErrors.length === 0, pageErrors.join('\n'));
} finally {
  await browser?.close();
  await vite.close();
}

console.log(results.join('\n'));
console.log(failed === 0 ? `\nquick answers: all ${results.length} checks passed` : `\nquick answers: ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
