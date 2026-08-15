/**
 * Re-fetches Inter from Google and rewrites public/fonts as self-hosted files.
 *
 * Run this to update the typeface, not on every build — the point of vendoring
 * it is that the app never reaches for a CDN at runtime.
 *
 * Google serves one variable woff2 per subset covering the whole weight axis,
 * and returns the same URL for each weight you ask for. Emitting a face per
 * weight would download the same file five times and pin a variable font to a
 * single weight, so the faces are collapsed to one per subset with a range.
 */
import { writeFileSync, mkdirSync } from 'fs';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SOURCE = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&display=swap';

// Only the subsets this product ships copy in. The rest — cyrillic, greek,
// vietnamese — are another ~30 files a browser would only fetch if such text
// appeared, and they are dead weight in the repo.
const SUBSETS = ['latin', 'latin-ext'];
const OUT = new URL('../public/fonts/', import.meta.url);

const css = await (await fetch(SOURCE, { headers: { 'User-Agent': UA } })).text();
const blocks = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*(@font-face \{.*?\})/gs)];

mkdirSync(OUT, { recursive: true });

const faces = [];
for (const subset of SUBSETS) {
  const block = blocks.find(([, name]) => name === subset)?.[2];
  if (!block) throw new Error(`subset ${subset} missing from upstream css`);

  const url = block.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
  const range = block.match(/unicode-range: ([^;]+);/)?.[1];
  if (!url || !range) throw new Error(`could not parse the ${subset} face`);

  const file = `inter-var-${subset}.woff2`;
  const bytes = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  if (bytes.length < 5000) throw new Error(`${file} came back implausibly small (${bytes.length} bytes)`);
  writeFileSync(new URL(file, OUT), bytes);
  console.log(`${file.padEnd(28)} ${(bytes.length / 1024).toFixed(0)} KB`);

  faces.push(`@font-face {
  font-family: 'Inter';
  font-style: normal;
  /* One variable file covers the whole range. Google serves the same file for
     every weight, so declaring each weight separately would have loaded the
     same font five times over and pinned a variable face to a single weight. */
  font-weight: 400 700;
  font-display: swap;
  src: url(/fonts/${file}) format('woff2');
  unicode-range: ${range};
}`);
}

writeFileSync(
  new URL('inter.css', OUT),
  `/* Self-hosted Inter, latin + latin-ext.

   Served from the app's own origin rather than the Google Fonts CDN. That CDN
   is a third-party connection on every cold start, and a blocked or slow one is
   exactly what already broke the bundled PDF worker behind a VPN — the text
   would silently fall back to a system font mid-load.

   Regenerate with npm run fonts. */

${faces.join('\n\n')}
`
);
console.log('inter.css written');
