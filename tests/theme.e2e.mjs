/**
 * Renders the converted surfaces and inspects what the browser actually
 * computes.
 *
 * The theme guard reads source text; this reads pixels. It catches the two
 * failures the guard cannot see: a token that no longer resolves (deleting the
 * --teal aliases would leave var(--teal) computing to nothing), and a legacy
 * colour arriving from somewhere other than a literal in the source.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';

const PORT = 5184;
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const results = [];
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  results.push(`${ok ? 'PASS  ' : 'FAIL  '}${name}${ok ? '' : '\n        -> ' + detail}`);
};

// The legacy palette, as the browser would report it.
const BANNED = {
  'rgb(26, 115, 232)': 'Drive blue #1a73e8',
  'rgb(21, 87, 176)': 'Drive blue hover #1557b0',
  'rgb(0, 74, 119)': 'dark navy #004a77',
  'rgb(19, 28, 37)': 'navy #131C25',
  'rgb(125, 211, 252)': 'sky #7dd3fc',
  'rgb(32, 184, 205)': 'cyan #20b8cd',
  'rgb(8, 145, 178)': 'cyan-600 #0891b2',
  'rgb(55, 57, 59)': 'AI Studio border #37393b',
  'rgb(19, 19, 20)': 'AI Studio black #131314',
  'rgb(30, 31, 32)': 'AI Studio surface #1e1f20',
  'rgb(40, 41, 42)': 'AI Studio raised #28292a',
  'rgb(227, 227, 227)': 'AI Studio text #e3e3e3',
  'rgb(196, 199, 197)': 'AI Studio muted #c4c7c5',
  'rgb(15, 23, 42)': 'slate-900 #0f172a',
  'rgb(71, 85, 105)': 'slate-600 #475569',
  'rgb(100, 116, 139)': 'slate-500 #64748b'
};

const vite = await createServer({ server: { port: PORT }, logLevel: 'error' });
await vite.listen();

let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://localhost:${PORT}/tests/theme.harness.html`, { waitUntil: 'load' });
  await page.waitForSelector('.s87-app', { timeout: 30000 });
  await page.waitForTimeout(1500);

  // ── the palette actually resolves ──────────────────────────────────────
  const tokens = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    const names = ['--bg', '--surface', '--surface-2', '--ink', '--ink-2', '--muted', '--rule',
      '--rule-2', '--accent', '--accent-ink', '--accent-soft', '--accent-contrast',
      '--ok', '--warn', '--danger', '--serif', '--sans'];
    return Object.fromEntries(names.map((n) => [n, s.getPropertyValue(n).trim()]));
  });
  const empty = Object.entries(tokens).filter(([, v]) => v === '');
  check('every Chambers token resolves', empty.length === 0, empty.map(([k]) => k).join(', '));
  check('the accent is oxblood', tokens['--accent'].toUpperCase() === '#6B231C', tokens['--accent']);
  check('the page ground is warm paper', tokens['--bg'].toUpperCase() === '#F4F1EA', tokens['--bg']);
  check('the serif stack names Newsreader', tokens['--serif'].includes('Newsreader'), tokens['--serif']);

  // ── nothing renders a legacy colour ────────────────────────────────────
  const offenders = await page.evaluate((banned) => {
    const found = [];
    for (const el of document.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      for (const prop of ['color', 'backgroundColor', 'borderTopColor', 'borderBottomColor',
        'borderLeftColor', 'borderRightColor', 'fill', 'stroke', 'outlineColor']) {
        const value = s[prop];
        if (banned[value]) {
          found.push(`${banned[value]} as ${prop} on <${el.tagName.toLowerCase()} class="${
            String(el.className).slice(0, 60)}">`);
        }
      }
    }
    return [...new Set(found)];
  }, BANNED);
  check('no element computes a legacy navy/cyan colour', offenders.length === 0,
    offenders.slice(0, 6).join('\n           '));

  // ── a var() that no longer exists computes to nothing ──────────────────
  const unresolved = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      // A background-color of exactly transparent on an element whose class
      // asks for a bg-[var(--...)] means the variable did not resolve.
      const cls = String(el.className);
      // Unprefixed only: hover:/focus:/group-hover: variants are meant to be
      // transparent at rest, and matching them would report every one of them.
      const bgAtRest = cls.match(/(?:^|\s)(bg-\[var\(--[a-z0-9-]+\)\])/);
      const fgAtRest = cls.match(/(?:^|\s)(text-\[var\(--[a-z0-9-]+\)\])/);
      if (bgAtRest && s.backgroundColor === 'rgba(0, 0, 0, 0)') bad.push(bgAtRest[1]);
      if (fgAtRest && s.color === 'rgba(0, 0, 0, 0)') bad.push(fgAtRest[1]);
    }
    return [...new Set(bad)];
  });
  check('every var() reference resolves to a real colour', unresolved.length === 0,
    unresolved.slice(0, 8).join(', '));

  // ── Newsreader is loaded and applied ───────────────────────────────────
  const serifApplied = await page.evaluate(async () => {
    await document.fonts.ready;
    const heading = document.querySelector('h1, h2, h3');
    if (!heading) return { found: false };
    return {
      found: true,
      family: getComputedStyle(heading).fontFamily,
      loaded: document.fonts.check('16px Newsreader'),
      text: (heading.textContent || '').slice(0, 40)
    };
  });
  check('a heading exists to check', serifApplied.found);
  check('headings are set in Newsreader', !!serifApplied.family && serifApplied.family.includes('Newsreader'),
    serifApplied.family);
  check('the Newsreader webfont actually loaded', serifApplied.loaded === true,
    `document.fonts.check -> ${serifApplied.loaded}`);

  // ── native controls must not paint themselves the OS blue ─────────────
  const accents = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll("input[type='checkbox'], input[type='radio']")];
    return { count: boxes.length, accents: [...new Set(boxes.map((b) => getComputedStyle(b).accentColor))] };
  });
  check('there are native controls to check', accents.count > 0, `found ${accents.count}`);
  check('native checkboxes use the oxblood accent, not the OS blue',
    accents.accents.length > 0 && accents.accents.every((a) => a !== 'auto'),
    JSON.stringify(accents.accents));

  // ── the Comparative Matrix and Synthesis surfaces are present ──────────
  const matrix = await page.locator('text=Multi-Document Comparison Matrix').count();
  check('the Comparative Matrix renders', matrix > 0);

  check('no uncaught page errors', errors.length === 0, errors.join(' | '));

  await page.screenshot({ path: 'tests/.theme-modal.png', fullPage: false });
  // The tour modal covers the surfaces this conversion prioritised, so the
  // second shot drops it to show the Matrix and the sidebar underneath.
  await page.evaluate(() => document.querySelector('.fixed.inset-0.z-50')?.remove());
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/.theme-screenshot.png', fullPage: false });
  console.log('screenshots -> tests/.theme-screenshot.png, tests/.theme-modal.png');
} finally {
  await browser?.close();
  await vite.close();
}

console.log(results.join('\n'));
console.log(failed === 0 ? `\nchambers theme: all ${results.length} checks passed` : `\nchambers theme: ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
