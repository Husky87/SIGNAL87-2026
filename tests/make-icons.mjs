/**
 * Renders the app mark to PNG at every size an installed app needs.
 *
 * Done in the browser rather than with an image library so the output is the
 * same rasteriser a device would use, and so it stays in step with favicon.svg
 * — re-run it whenever the mark changes.
 *
 * iOS home-screen icons are composited on an opaque tile and get their corner
 * radius applied by the system, so the maskable/apple sizes are drawn square
 * and full-bleed rather than pre-rounded.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');

// rounded: keeps the squircle (browser tabs, Android adaptive foreground).
// square: full-bleed, for iOS which masks its own corners.
const TARGETS = [
  { file: 'icon-180.png', size: 180, square: true },   // apple-touch-icon
  { file: 'icon-192.png', size: 192, square: false },  // android / manifest
  { file: 'icon-512.png', size: 512, square: false },  // manifest, splash
  { file: 'icon-maskable-512.png', size: 512, square: true } // android maskable
];

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true });

for (const { file, size, square } of TARGETS) {
  const dataUrl = await page.evaluate(
    async ({ svg, size, square }) => {
      const canvas = document.getElementById('c');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // The mark's own background only covers the squircle; fill behind it so
      // no transparent corners reach a platform that will not mask them. This
      // has to match the squircle in public/favicon.svg — Chambers ink.
      ctx.fillStyle = '#1C1917';
      ctx.fillRect(0, 0, size, size);

      const source = square ? svg.replace(/rx="24"/, 'rx="0"') : svg;
      const img = new Image();
      const blobUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = blobUrl;
      });
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(blobUrl);
      return canvas.toDataURL('image/png');
    },
    { svg, size, square }
  );

  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  writeFileSync(new URL(`../public/icons/${file}`, import.meta.url), buf);
  console.log(`${file.padEnd(24)} ${size}x${size}  ${(buf.length / 1024).toFixed(1)} KB`);
}

await browser.close();
