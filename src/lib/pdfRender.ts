/**
 * pdf.js rendering for the PDF editor: page thumbnails for the organizer and
 * full-size page canvases for the form filler.
 *
 * pdf-lib reads and writes PDF structure but cannot rasterise a page, so the
 * editor uses pdf.js for every pixel it shows and pdf-lib for every byte it
 * writes. This module owns the pdf.js side.
 */

import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PageViewport } from 'pdfjs-dist';
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
