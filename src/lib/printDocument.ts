import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * Printing only the document, not the app around it.
 *
 * window.print() prints the whole page: sidebar, toolbars and whatever sits
 * behind the viewer. Instead the document is written into a hidden, same-origin
 * iframe that contains nothing else, and that iframe is printed. PDFs are
 * rasterised page by page with the pdf.js document the viewer already loaded,
 * which prints the same in every browser (handing a PDF blob to an iframe
 * depends on each browser's built-in viewer, and Safari's does not print it).
 */

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Roughly 150 dpi on a letter page: sharp on paper without huge images. */
const PRINT_SCALE = 2;

/** Clears the previous print frame if a browser never reported afterprint for it. */
let pendingCleanup: (() => void) | null = null;

function printHtml(html: string, onDone: () => void): Promise<void> {
  pendingCleanup?.();
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    // Zero-sized rather than display:none, which some browsers refuse to print.
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', opacity: '0' });
    document.body.appendChild(frame);

    const win = frame.contentWindow;
    const frameDoc = frame.contentDocument;
    if (!win || !frameDoc) {
      frame.remove();
      onDone();
      resolve();
      return;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (pendingCleanup === cleanup) pendingCleanup = null;
      frame.remove();
      onDone();
    };
    pendingCleanup = cleanup;

    const images = Array.from(frameDoc.images);
    void Promise.all(images.map((img) => img.decode().catch(() => undefined))).then(() => {
      win.addEventListener('afterprint', () => setTimeout(cleanup, 0), { once: true });
      win.focus();
      win.print();
      resolve();
    });
  });
}

export async function printPdfDocument(pdf: PDFDocumentProxy, title: string): Promise<void> {
  const urls: string[] = [];
  const canvas = document.createElement('canvas');
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: PRINT_SCALE });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available for printing.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.92));
    if (!blob) throw new Error('A page could not be prepared for printing.');
    urls.push(URL.createObjectURL(blob));
  }
  canvas.width = 0;
  canvas.height = 0;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  img { display: block; width: 100%; height: auto; break-after: page; }
  img:last-child { break-after: auto; }
</style></head><body>${urls.map((url, i) => `<img src="${url}" alt="Page ${i + 1}">`).join('')}</body></html>`;

  await printHtml(html, () => urls.forEach((url) => URL.revokeObjectURL(url)));
}

export async function printTextDocument(title: string, text: string): Promise<void> {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 18mm; }
  body { margin: 0; color: #111; font: 11pt/1.55 Inter, system-ui, -apple-system, sans-serif; }
  h1 { font-size: 15pt; margin: 0 0 12pt; }
  pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; font: inherit; }
</style></head><body><h1>${escapeHtml(title)}</h1><pre>${escapeHtml(text)}</pre></body></html>`;

  await printHtml(html, () => {});
}

export async function printSheetsDocument(
  title: string,
  sheets: { name: string; headers: string[]; rows: string[][] }[]
): Promise<void> {
  const tables = sheets
    .map((sheet) => {
      const head = sheet.headers.length
        ? `<thead><tr>${sheet.headers.map((h, i) => `<th>${escapeHtml(h || `Column ${i + 1}`)}</th>`).join('')}</tr></thead>`
        : '';
      const body = sheet.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
      const caption = sheets.length > 1 ? `<h2>${escapeHtml(sheet.name)}</h2>` : '';
      return `${caption}<table>${head}<tbody>${body}</tbody></table>`;
    })
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 12mm; }
  body { margin: 0; color: #111; font: 9pt/1.4 Inter, system-ui, -apple-system, sans-serif; }
  h1 { font-size: 14pt; margin: 0 0 10pt; }
  h2 { font-size: 11pt; margin: 14pt 0 6pt; }
  table { border-collapse: collapse; width: 100%; }
  thead { display: table-header-group; }
  th, td { border: 1px solid #ccc; padding: 3pt 5pt; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; }
  tr { break-inside: avoid; }
</style></head><body><h1>${escapeHtml(title)}</h1>${tables}</body></html>`;

  await printHtml(html, () => {});
}
