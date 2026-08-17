/**
 * Re-fetches Playfair Display from Google and rewrites public/fonts as
 * self-hosted files, following the same approach as make-fonts.mjs (Inter).
 *
 * Run this to update the typeface, not on every build — the point of vendoring
 * it is that the app never reaches for a CDN at runtime.
 *
 * Used for var(--serif): the large editorial-style headline treatment, kept
 * separate from Inter (var(--sans)/var(--f)) which remains the font for body
 * copy, navigation and UI chrome.
 */
import { writeFileSync, mkdirSync } from 'fs';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SOURCE =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap';

// Only the subsets this product ships copy in. The rest — cyrillic, greek,
// vietnamese — are another batch of files a browser would only fetch if such
// text appeared, and they are dead weight in the repo.
const SUBSETS = ['latin', 'latin-ext'];
const WEIGHTS = [600, 700, 800];
const OUT = new URL('../public/fonts/', import.meta.url);

const css = await (await fetch(SOURCE, { headers: { 'User-Agent': UA } })).text();
const blocks = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*(@font-face \{.*?\})/gs)];

mkdirSync(OUT, { recursive: true });

const faces = [];
for (const weight of WEIGHTS) {
  for (const subset of SUBSETS) {
    const block = blocks.find(
      ([, name], idx) => name === subset && blocks[idx][2].includes(`font-weight: ${weight};`)
    )?.[2];
    if (!block) throw new Error(`subset ${subset} weight ${weight} missing from upstream css`);

    const url = block.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
    const range = block.match(/unicode-range: ([^;]+);/)?.[1];
    if (!url || !range) throw new Error(`could not parse the ${subset}/${weight} face`);

    const file = `playfair-display-${weight}-${subset}.woff2`;
    const bytes = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
    if (bytes.length < 1000) throw new Error(`${file} came back implausibly small (${bytes.length} bytes)`);
    writeFileSync(new URL(file, OUT), bytes);
    console.log(`${file.padEnd(40)} ${(bytes.length / 1024).toFixed(0)} KB`);

    faces.push(`@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url(/fonts/${file}) format('woff2');
  unicode-range: ${range};
}`);
  }
}

writeFileSync(
  new URL('playfair-display.css', OUT),
  `/* Self-hosted Playfair Display, latin + latin-ext, weights 600/700/800.

   Served from the app's own origin rather than the Google Fonts CDN, for the
   same reason as inter.css: the app never reaches for a third-party host at
   runtime. Used only for var(--serif) headline treatments.

   Regenerate with npm run fonts:display. */

${faces.join('\n\n')}
`
);
console.log('playfair-display.css written');
