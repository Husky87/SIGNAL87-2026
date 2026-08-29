/**
 * Fails the build if the legacy navy/cyan theme is reintroduced.
 *
 * The app was converted from a dark navy/cyan palette to Chambers, and the
 * whole point of that work is that colour now lives in exactly one place. This
 * guard enforces that: a hex value or a Tailwind palette class anywhere outside
 * the palette files is a regression, not a style choice.
 *
 * Run directly (npm run lint:theme) or as the first step of npm run build.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

/* ── where colour is allowed to be spelled out ─────────────────────────── */

// The palette itself, and its generated mirror for the standalone pages.
const PALETTE_FILES = new Set(['src/index.css', 'public/chambers.css']);

// Values that are not app chrome: a sheet of paper inside a document
// thumbnail, and the page pdf.js paints under a rendered PDF. Both stand for
// real paper and stay literal however the app is themed.
//
// Redaction black belongs to the same category and is deliberately not a
// token. It is painted into an exported PDF that will be read outside this
// app, and it is the mark a reader recognises as withheld content; tying it to
// the theme would make a legal document's redactions change colour with a
// design decision.
const ALLOWED_LITERALS = {
  'src/components/DocumentThumbnail.tsx': new Set(['#FFFFFF', '#57534E', '#8F8880']),
  'src/lib/pdfRender.ts': new Set(['#FFFFFF', '#000000']),
  // <meta name="theme-color"> tints the browser's own chrome and cannot
  // reference a CSS variable, so this one has to repeat --bg literally.
  'index.html': new Set(['#F4F1EA']),
  // Assets served standalone, outside any document that defines the tokens:
  // the favicon, the PWA manifest, and the icon generator that has to match
  // the favicon's squircle. Each may carry only its own Chambers value.
  'public/favicon.svg': new Set(['#1C1917', '#8C2F27']),
  'public/manifest.webmanifest': new Set(['#F4F1EA']),
  'tests/make-icons.mjs': new Set(['#1C1917']),
  'tests/mobile.e2e.mjs': new Set(['#F4F1EA'])
};

// The two files whose job is to name the banned values. Scanning them would
// report every entry in the list below as a violation of itself.
const SELF_REFERENTIAL = new Set(['tests/theme-guard.mjs', 'tests/theme.e2e.mjs']);

/* ── what is banned ───────────────────────────────────────────────────── */

// Named so a failure says which theme is creeping back in.
const LEGACY_HEX = {
  '#131314': 'AI Studio page black', '#1e1f20': 'AI Studio surface',
  '#28292a': 'AI Studio raised', '#37393b': 'AI Studio border',
  '#e3e3e3': 'AI Studio primary text', '#c4c7c5': 'AI Studio secondary text',
  '#8e918f': 'AI Studio muted', '#9aa0a6': 'Google grey', '#5f6368': 'Google grey',
  '#3c4043': 'Google grey', '#1a73e8': 'Drive blue', '#1557b0': 'Drive blue (hover)',
  '#004a77': 'dark navy', '#131c25': 'navy', '#3d4b58': 'navy-grey',
  '#6e7c89': 'navy-grey', '#d3d9de': 'navy-grey rule', '#edeff2': 'navy-grey hairline',
  '#7dd3fc': 'sky/cyan accent', '#20b8cd': 'cyan accent', '#0891b2': 'cyan-600',
  '#06b6d4': 'cyan-500', '#0e7490': 'cyan-700', '#0369a1': 'sky-700',
  '#0c4a6e': 'sky-900', '#bae6fd': 'sky-200', '#0f172a': 'slate-900',
  '#1e293b': 'slate-800', '#334155': 'slate-700', '#475569': 'slate-600',
  '#64748b': 'slate-500', '#94a3b8': 'slate-400', '#cbd5e1': 'slate-300',
  '#e2e8f0': 'slate-200', '#f1f5f9': 'slate-100', '#f8fafc': 'slate-50',
  '#0f9d58': 'Drive green', '#f4b400': 'Drive yellow', '#ea4335': 'Drive red',
  '#a142f4': 'Drive purple', '#d93025': 'Drive red', '#18181b': 'zinc-900',
  '#0f6e66': 'legacy teal', '#f0b429': 'legacy gold', '#e8f2f0': 'legacy teal tint'
};

const PALETTE_FAMILIES =
  'slate|sky|cyan|zinc|neutral|blue|indigo|gray|grey|stone|violet|fuchsia|lime|teal';
const PROPS = 'bg|text|border|from|to|via|ring|divide|placeholder|decoration|outline|accent|caret|fill|stroke';

const CHECKS = [
  {
    // Tailwind palette classes in the banned families.
    re: new RegExp(`\\b(?:[a-z-]+:)*(?:${PROPS})-(?:${PALETTE_FAMILIES})-\\d{2,3}(?:/\\d+)?\\b`, 'g'),
    label: 'legacy Tailwind palette class'
  },
  {
    // Literal white/black utilities. The theme has tokens for both grounds.
    re: new RegExp(`\\b(?:[a-z-]+:)*(?:${PROPS})-(?:white|black)(?:/\\d+)?\\b`, 'g'),
    label: 'literal white/black utility — use a token'
  },
  {
    // The teal era's token names.
    re: /var\(--teal[a-z-]*\)/g,
    label: 'retired --teal token'
  }
];

const ANY_HEX = /#[0-9a-fA-F]{3,8}\b/g;

// rgb()/rgba() with numeric channels. The hex scan cannot see these, which is
// how the cyan composer glows (rgba(32,184,205,...)) and the old teal PDF
// field tint (rgba(14,124,140,...)) survived the conversion. Pure black and
// pure white are exempt: those are shadows and scrims, not theme colours.
const ANY_RGB = /\brgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/g;
function isNeutral(r, g, b) {
  const n = [r, g, b].map(Number);
  return n.every((v) => v === 0) || n.every((v) => v === 255);
}
// .mjs, .svg and .webmanifest are included deliberately: the icon generator,
// the favicon and the PWA manifest were all still carrying the dark theme,
// and none of them would have been caught by scanning source files alone.
const EXTENSIONS = ['.tsx', '.ts', '.mjs', '.css', '.html', '.svg', '.webmanifest'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.netlify', '.firebase', 'build', 'coverage']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

const failures = [];
function fail(file, line, detail) {
  failures.push(`${file}:${line}  ${detail}`);
}

for (const full of walk(ROOT)) {
  const file = relative(ROOT, full);
  if (file.startsWith('public/fonts/')) continue;
  if (SELF_REFERENTIAL.has(file)) continue;

  const lines = readFileSync(full, 'utf8').split('\n');
  const isPalette = PALETTE_FILES.has(file);
  const allowed = ALLOWED_LITERALS[file] || new Set();

  lines.forEach((text, i) => {
    const line = i + 1;

    for (const { re, label } of CHECKS) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) fail(file, line, `${label}: ${m[0]}`);
    }

    if (isPalette) return;

    for (const m of text.matchAll(ANY_RGB)) {
      if (isNeutral(m[1], m[2], m[3])) continue;
      fail(file, line, `hardcoded rgb() colour: ${m[0]}) — use a token, or rgb(var(--accent-rgb) / <alpha>)`);
    }

    for (const m of text.matchAll(ANY_HEX)) {
      const hex = m[0];
      if (allowed.has(hex.toUpperCase()) || allowed.has(hex)) continue;
      const named = LEGACY_HEX[hex.toLowerCase()];
      fail(file, line, named ? `legacy ${named}: ${hex}` : `hardcoded colour: ${hex} — use a token from src/index.css`);
    }
  });
}

/* ── the generated mirror must not drift from the source ──────────────── */
const appCss = readFileSync(join(ROOT, 'src/index.css'), 'utf8');
const mirror = readFileSync(join(ROOT, 'public/chambers.css'), 'utf8');
const block = appCss.match(/:root\{[^}]*--bg:[^}]*\}/s);
if (!block) {
  failures.push('src/index.css: the Chambers :root block is missing');
} else if (!mirror.includes(block[0])) {
  failures.push('public/chambers.css is stale — run `npm run tokens` after changing the palette');
}

if (failures.length > 0) {
  console.error(`\ntheme guard: ${failures.length} violation${failures.length === 1 ? '' : 's'}\n`);
  for (const f of failures) console.error('  ' + f);
  console.error(
    '\nColour belongs in src/index.css. Use a token — var(--ink), var(--accent),\n' +
      'var(--rule) and so on — rather than a hex value or a Tailwind palette class.\n'
  );
  process.exit(1);
}

console.log('theme guard: clean — no legacy navy/cyan values, and the token mirror is current');
