/**
 * The three things that still read as a web page: losing your place, an empty
 * state shown while loading, and a font fetched from someone else's server.
 */
import { createServer } from 'vite';
import { chromium, devices } from 'playwright';
import { readFileSync, statSync } from 'fs';

const PORT = 5182;
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const results = [];
let failed = 0;
const check = (n, ok, d = '') => { if (!ok) failed++; results.push(`${ok ? 'PASS  ' : 'FAIL  '}${n}${ok ? '' : '\n        -> ' + d}`); };

// --- fonts are ours now ---
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
check('no stylesheet is fetched from the Google Fonts CDN', !/fonts\.googleapis\.com/.test(html));
check('no connection is opened to the font CDN', !/fonts\.gstatic\.com/.test(html));
check('the font is served from this origin', /href="\/fonts\/inter\.css"/.test(html));
check('the font file is preloaded, not discovered after the stylesheet', /rel="preload"[^>]*inter-var-latin\.woff2/s.test(html));

const fontCss = readFileSync(new URL('../public/fonts/inter.css', import.meta.url), 'utf8');
check('the variable font declares a weight range, not one weight', /font-weight: 400 700/.test(fontCss));
check('it swaps rather than blocking paint', /font-display: swap/.test(fontCss));
check('only latin subsets ship', (fontCss.match(/@font-face/g) || []).length === 2, `${(fontCss.match(/@font-face/g) || []).length} faces`);
const kb = statSync(new URL('../public/fonts/inter-var-latin.woff2', import.meta.url)).size / 1024;
check('the latin file is a sensible size', kb > 10 && kb < 120, `${kb.toFixed(0)} KB`);

const vite = await createServer({ server: { port: PORT }, logLevel: 'error' });
await vite.listen();

let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();

  // Anything leaving this origin for a font would show up here.
  const external = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(`http://localhost:${PORT}`) && !u.startsWith('data:')) external.push(u);
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForTimeout(900);

  check('the page loads without contacting a font CDN', !external.some((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), external.join('\n'));

  const fontUsed = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.family === 'Inter').map((f) => f.status);
  });
  check('Inter actually loads', fontUsed.includes('loaded'), JSON.stringify(fontUsed));

  // --- scroll memory ---
  await page.goto(`http://localhost:${PORT}/tests/polish.harness.html`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="scroller"]');

  await page.evaluate(() => { document.querySelector('[data-testid="scroller"]').scrollTop = 900; });
  await page.waitForTimeout(120);
  check('the list scrolls', (await page.evaluate(() => window.__scrollTop())) === 900);

  await page.click('[data-testid="to-b"]');
  await page.waitForSelector('[data-testid="other"]');
  await page.click('[data-testid="to-a"]');
  await page.waitForSelector('[data-testid="scroller"]');
  await page.waitForTimeout(200);
  check('coming back to the tab keeps your place', (await page.evaluate(() => window.__scrollTop())) === 900, String(await page.evaluate(() => window.__scrollTop())));

  // The case a naive restore gets wrong: content arriving after the first frame.
  await page.click('[data-testid="to-b"]');
  await page.waitForSelector('[data-testid="other"]');
  await page.click('[data-testid="slow-on"]');
  await page.click('[data-testid="to-a"]');
  await page.waitForTimeout(700);
  check('the place is kept even when the list arrives late', (await page.evaluate(() => window.__scrollTop())) === 900, String(await page.evaluate(() => window.__scrollTop())));

  // --- skeletons ---
  const skeleton = readFileSync(new URL('../src/components/DocumentSkeleton.tsx', import.meta.url), 'utf8');
  check('placeholders exist for both list and grid', /DocumentListSkeleton/.test(skeleton) && /DocumentGridSkeleton/.test(skeleton));
  check('a screen reader hears one message, not a dozen empty rows', /aria-hidden="true"/.test(skeleton) && /role="status"/.test(skeleton));

  const library = readFileSync(new URL('../src/components/DocumentLibraryView.tsx', import.meta.url), 'utf8');
  check('loading is checked before the empty state', /\{loading && \(/.test(library) && /\{!loading && filteredDocs\.length === 0 && \(/.test(library));

  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  // --- scroll memory reaches every scrolling view, not just Files ---
  for (const tab of ['dashboard', 'compare', 'team', 'organization', 'admin', 'privacy', 'terms']) {
    check(`the ${tab} tab remembers its place`, app.includes(`<ScrollArea id="tab:${tab}"`), 'not wrapped');
  }
  check('no tab scroller was left unwrapped', !/\{currentTab === '[a-z]+' && \(\s*\n\s*<div className="[^"]*overflow-y-auto/.test(app));

  const saved = readFileSync(new URL('../src/components/SavedView.tsx', import.meta.url), 'utf8');
  check('the saved list remembers its place', /<ScrollArea id="saved:list"/.test(saved));
  check('the note editor deliberately does not, so a new note opens at its top', !/ScrollArea id="saved:editor"/.test(saved));

  const library2 = readFileSync(new URL('../src/components/DocumentLibraryView.tsx', import.meta.url), 'utf8');
  check('each file list keeps its own place, not one shared position', /useScrollMemory<HTMLDivElement>\(`files:\$\{filesView\}:\$\{activeFolderId \?\? 'root'\}`\)/.test(library2));
  check('loading is cleared even if the fetch throws', /\} finally \{[\s\S]*?setDocumentsLoading\(false\)/.test(app));
  check('placeholders only show when there is nothing to show yet', /loading=\{documentsLoading && myDocuments\.length === 0\}/.test(app));
  check('the tab-change scroll reset no longer fights the memory', !/mainScrollRef\.current\.scrollTop = 0/.test(app));
} finally {
  await browser?.close();
  await vite.close();
}

console.log(results.join('\n'));
console.log(failed === 0 ? `\npolish: all ${results.length} checks passed` : `\npolish: ${failed} FAILED of ${results.length}`);
process.exit(failed === 0 ? 0 : 1);
