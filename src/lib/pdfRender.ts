/**
 * pdf.js rendering for the PDF editor: page thumbnails for the organizer and
 * full-size page canvases for the form filler.
 *
 * pdf-lib reads and writes PDF structure but cannot rasterise a page, so the
 * editor uses pdf.js for every pixel it shows and pdf-lib for every byte it
 * writes. This module owns the pdf.js side.
 */

import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PageViewport } from 'pdfjs-dist';
import type { PdfRasterPage, PdfRasterRequest, PdfRasterResult } from './pdfEditTypes';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Same reasoning as PDFViewer.tsx: the worker ships with the app rather than
// being fetched from a CDN, so a blocked host cannot leave a blank pane.
GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

/**
 * Opens bytes with pdf.js.
 *
 * The copy is not optional: pdf.js takes ownership of the buffer it is handed
 * and detaches it, which would leave the caller's copy — the same bytes
 * pdf-lib needs at export time — zero-length.
 */
export function loadPdfJsDocument(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  return getDocument({ data: new Uint8Array(bytes) }).promise;
}

/**
 * Renders one page into a canvas and returns the viewport used.
 *
 * `extraRotation` is the overlay's pending rotation for that page. pdf.js
 * treats `rotation` as absolute rather than additive, so the page's own
 * rotation is added in here — a page already stored at 90° that the user turns
 * another 90° must render at 180°, not 90°.
 */
export async function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
  extraRotation = 0
): Promise<PageViewport> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale, rotation: page.rotate + extraRotation });
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser did not provide a 2D canvas context.');

  // Render at device resolution so pages are not soft on high-DPI screens,
  // while the CSS box stays in layout pixels.
  const ratio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  canvas.width = Math.floor(viewport.width * ratio);
  canvas.height = Math.floor(viewport.height * ratio);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, viewport.width, viewport.height);

  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return viewport;
}

/**
 * Renders a page small, as a data URL, for the page-organizer grid.
 *
 * Returns null rather than throwing: one page that will not rasterise should
 * cost that thumbnail, not the whole grid.
 */
export async function renderPageThumbnail(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  maxWidth: number,
  extraRotation = 0
): Promise<string | null> {
  try {
    const page = await pdf.getPage(pageNumber);
    const rotation = page.rotate + extraRotation;
    const unscaled = page.getViewport({ scale: 1, rotation });
    const scale = Math.min(maxWidth / unscaled.width, 2);
    const viewport = page.getViewport({ scale, rotation });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    // Pages are transparent where nothing is drawn; without this they would
    // render as dark rectangles against the editor's own surface.
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** Page aspect ratios, so the grid can lay out before any thumbnail arrives. */
export async function readPageAspectRatios(pdf: PDFDocumentProxy): Promise<number[]> {
  const ratios: number[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    ratios.push(viewport.width / viewport.height);
  }
  return ratios;
}

/* ── Redaction ─────────────────────────────────────────────────────────────
   The rendering half of redaction. `pdfEditEngine.ts` owns the promise that
   removed content is absent from the exported file; this module owns the two
   things only a renderer can do — turn a page into pixels with the removed
   regions painted out, and read a page's text so the assistant's copy of it
   can be scrubbed to match.                                                 */

/**
 * Dots per inch for a replaced page.
 *
 * A redacted page loses its text layer and becomes an image, so this number is
 * the legibility of the document from then on. 200 is above what a scanner
 * produces for a filed exhibit and below the point where a letter page stops
 * being a reasonable thing to keep in a browser's memory.
 */
const REDACTION_DPI = 200;

/** PDF user space is 72 units to the inch. */
const PDF_UNITS_PER_INCH = 72;

/**
 * No page is rendered larger than this on its long edge. A poster-sized page at
 * 200 DPI would otherwise exceed what browsers will allocate for a canvas, and
 * fail with a blank bitmap rather than an error.
 */
const MAX_RASTER_EDGE = 5000;

function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('This browser could not produce an image of the page.'));
        return;
      }
      blob
        .arrayBuffer()
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(reject);
    }, 'image/png');
  });
}

/** A text run's position on the page, in PDF user space. */
interface TextRunBox {
  /** Index of the run within the page's text content. */
  index: number;
  text: string;
  rect: { x: number; y: number; width: number; height: number };
}

/**
 * Where each text run sits, in PDF user space.
 *
 * A run's transform is a full matrix, so rotated text cannot be measured by
 * taking its width along x and its height along y. The four corners of the run
 * are transformed instead and their bounding box taken, which reduces to the
 * simple answer for ordinary horizontal text and stays correct for the rest.
 *
 * The box is grown below the baseline and above the cap height, because the
 * reported height is the font size rather than the ink: descenders fall below
 * it and accents rise above it.
 */
function textRunBoxes(items: TextItemLike[]): TextRunBox[] {
  const boxes: TextRunBox[] = [];

  items.forEach((item, index) => {
    if (!('str' in item) || typeof item.str !== 'string' || item.str.length === 0) return;
    const transform = item.transform;
    if (!Array.isArray(transform) || transform.length < 6) return;

    const [a, b, c, d, e, f] = transform as number[];
    const advance = typeof item.width === 'number' ? item.width : 0;
    const size = Math.hypot(c, d) || (typeof item.height === 'number' ? item.height : 0);
    if (size === 0 && advance === 0) return;

    const alongLength = Math.hypot(a, b) || 1;
    const ax = a / alongLength;
    const ay = b / alongLength;
    const upLength = Math.hypot(c, d) || 1;
    const ux = c / upLength;
    const uy = d / upLength;

    const descent = size * 0.28;
    const ascent = size * 1.12;

    const corners: [number, number][] = [
      [e - ux * descent, f - uy * descent],
      [e + ax * advance - ux * descent, f + ay * advance - uy * descent],
      [e + ax * advance + ux * ascent, f + ay * advance + uy * ascent],
      [e + ux * ascent, f + uy * ascent]
    ];

    const xs = corners.map((corner) => corner[0]);
    const ys = corners.map((corner) => corner[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    boxes.push({
      index,
      text: item.str,
      rect: { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
    });
  });

  return boxes;
}

/** The shape of a pdf.js text item, without depending on its exported type. */
interface TextItemLike {
  str?: unknown;
  transform?: unknown;
  width?: unknown;
  height?: unknown;
  hasEOL?: unknown;
}

async function pageTextRuns(pdf: PDFDocumentProxy, pageNumber: number): Promise<TextItemLike[]> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  return content.items as TextItemLike[];
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Renders the redacted pages and reads back the text that survives.
 *
 * Two things happen in one pass over the document because they must agree with
 * each other: the pixels that are painted out and the text that is dropped
 * come from the same rectangles, so a run cannot be blacked out on the page
 * and left in the index.
 *
 * A run that touches a rectangle is dropped whole rather than sliced at the
 * character. Slicing would keep the harmless half of a line, at the cost of
 * having to be right about where inside a run a match falls — and being wrong
 * there means leaving part of the redacted string in the index. Losing the
 * rest of the line is the cheaper error.
 */
export async function rasterizeRedactions(request: PdfRasterRequest): Promise<PdfRasterResult> {
  const pdf = await loadPdfJsDocument(request.bytes);
  try {
    const pages: PdfRasterPage[] = [];
    const textByPage: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const pageIndex = pageNumber - 1;
      const redactions = request.redactionsByPage.get(pageIndex) ?? [];
      const runs = textRunBoxes(await pageTextRuns(pdf, pageNumber));

      const surviving = redactions.length === 0
        ? runs
        : runs.filter((run) => !redactions.some((redaction) => rectsOverlap(run.rect, redaction)));
      textByPage.push(surviving.map((run) => run.text).join(' ').replace(/\s+/g, ' ').trim());

      if (redactions.length === 0) continue;

      const page = await pdf.getPage(pageNumber);
      // Rendered unrotated: the replacement image is put back into the page's
      // own user space, and the page keeps its /Rotate so a viewer turns the
      // picture exactly as it turned the page.
      const unscaled = page.getViewport({ scale: 1, rotation: 0 });
      const longEdge = Math.max(unscaled.width, unscaled.height);
      const scale = Math.min(REDACTION_DPI / PDF_UNITS_PER_INCH, MAX_RASTER_EDGE / Math.max(longEdge, 1));
      const viewport = page.getViewport({ scale, rotation: 0 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser did not provide a 2D canvas context.');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      // Pages are transparent where nothing is drawn, and the replacement is
      // an opaque image, so the paper has to be painted first.
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, canvasContext: context, viewport }).promise;

      // Painted after the render, over the finished pixels. This is the moment
      // the content stops existing: the canvas holds one value per pixel, and
      // filling overwrites what was there rather than stacking on top of it.
      context.fillStyle = '#000000';
      for (const redaction of redactions) {
        const corners = viewport.convertToViewportRectangle([
          redaction.x,
          redaction.y,
          redaction.x + redaction.width,
          redaction.y + redaction.height
        ]) as number[];
        const left = Math.min(corners[0], corners[2]);
        const top = Math.min(corners[1], corners[3]);
        context.fillRect(left, top, Math.abs(corners[2] - corners[0]), Math.abs(corners[3] - corners[1]));
      }

      const view = page.view;
      pages.push({
        pageIndex,
        png: await canvasToPng(canvas),
        box: { x: view[0], y: view[1], width: view[2] - view[0], height: view[3] - view[1] }
      });
    }

    return { pages, text: textByPage.filter((text) => text.length > 0).join('\n\n') };
  } finally {
    pdf.destroy();
  }
}

/** One place a search term was found, ready to become a redaction. */
export interface PdfTextMatch {
  pageIndex: number;
  rect: { x: number; y: number; width: number; height: number };
}

/**
 * Finds every occurrence of a term and returns a rectangle for each.
 *
 * The page's runs are joined into one string before searching, because a
 * renderer splits a line wherever the font changes: a name in a document that
 * bolds the surname arrives as two runs, and searching them separately would
 * miss it. A newline is inserted where the extractor reports a line ending, so
 * a match cannot run off the end of one line and into the start of the next.
 *
 * Every run a match touches gets its own rectangle. That covers a little more
 * than the term itself when the term is part of a longer run — the safe
 * direction, and the same choice the scrubbing pass makes.
 */
export async function findTextMatches(
  pdf: PDFDocumentProxy,
  query: string,
  pageIndices?: number[]
): Promise<PdfTextMatch[]> {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];

  const pagesToSearch = pageIndices ?? Array.from({ length: pdf.numPages }, (_, i) => i);
  const matches: PdfTextMatch[] = [];

  for (const pageIndex of pagesToSearch) {
    if (pageIndex < 0 || pageIndex >= pdf.numPages) continue;
    const items = await pageTextRuns(pdf, pageIndex + 1);
    const boxes = textRunBoxes(items);
    if (boxes.length === 0) continue;

    // One haystack per page, with a note of which run each character came from.
    let haystack = '';
    const owners: number[] = [];
    boxes.forEach((box, position) => {
      for (const character of box.text) {
        haystack += character;
        owners.push(position);
      }
      const item = items[box.index];
      // A separator so two runs never fuse into a word that is not on the page.
      // -1 marks a character no run owns.
      haystack += item && item.hasEOL === true ? '\n' : ' ';
      owners.push(-1);
    });

    const lowered = haystack.toLowerCase();
    let from = 0;
    while (from <= lowered.length - needle.length) {
      const at = lowered.indexOf(needle, from);
      if (at === -1) break;
      const touched = new Set<number>();
      for (let i = at; i < at + needle.length; i++) {
        const owner = owners[i];
        if (owner !== undefined && owner >= 0) touched.add(owner);
      }
      for (const position of touched) {
        matches.push({ pageIndex, rect: boxes[position].rect });
      }
      from = at + Math.max(1, needle.length);
    }
  }

  return matches;
}
