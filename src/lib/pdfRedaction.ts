/**
 * Pure rules for redaction.
 *
 * The distinction this module exists to protect is the one between *hiding*
 * and *removing*. A rectangle stored here is an instruction to destroy what is
 * underneath it; nothing in the app ever draws one onto a page and calls it
 * done. The destroying happens in `pdfEditEngine.ts`, which rasterises the
 * page and then sweeps the file for anything the old page left behind.
 *
 * Like `pdfEditOverlay.ts`, everything here is total and side-effect free, and
 * imports neither pdf-lib nor pdf.js.
 */

import { PdfEditOverlay, PdfRedaction, PdfWidgetRect } from './pdfEditTypes';
import { newId } from './ids';

/**
 * Rectangles are grown by this many points on every side before they are
 * painted out.
 *
 * Glyph boxes reported by a text extractor are the advance width and the font
 * size, which is not the same as the ink: accents rise above it and descenders
 * fall below it, and an italic face leans past the trailing edge. Under-
 * covering a redaction by half a point is a failure of the whole feature,
 * while over-covering by two points costs a little of the neighbouring
 * whitespace. The asymmetry decides the default.
 */
export const REDACTION_PADDING_PT = 2;

function nowIso(): string {
  return new Date().toISOString();
}

/** A rectangle with non-negative width and height, whatever order it was dragged in. */
export function normalizeRect(rect: PdfWidgetRect): PdfWidgetRect {
  return {
    x: rect.width < 0 ? rect.x + rect.width : rect.x,
    y: rect.height < 0 ? rect.y + rect.height : rect.y,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height)
  };
}

/** Grows a rectangle on every side. */
export function padRect(rect: PdfWidgetRect, padding = REDACTION_PADDING_PT): PdfWidgetRect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2
  };
}

/** Whether two rectangles share any area. Edge contact does not count. */
export function rectsOverlap(a: PdfWidgetRect, b: PdfWidgetRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Whether a rectangle is large enough to be a deliberate act rather than a stray click. */
export function isMeaningfulRect(rect: PdfWidgetRect): boolean {
  return rect.width >= 2 && rect.height >= 2;
}

/* ── Overlay operations ────────────────────────────────────────────────── */

export function addRedaction(
  overlay: PdfEditOverlay,
  pageIndex: number,
  rect: PdfWidgetRect,
  origin: PdfRedaction['origin'] = 'manual'
): PdfEditOverlay {
  const normalized = normalizeRect(rect);
  if (!isMeaningfulRect(normalized)) return overlay;
  const redaction: PdfRedaction = { id: newId('rdx'), pageIndex, rect: normalized, origin };
  return { ...overlay, redactions: [...overlay.redactions, redaction], updatedAt: nowIso() };
}

/**
 * Adds several at once, skipping any that merely repeat one already queued.
 *
 * Searching for the same term twice is an ordinary thing to do, and it should
 * not leave the page carrying two stacked copies of every match.
 */
export function addRedactions(
  overlay: PdfEditOverlay,
  candidates: { pageIndex: number; rect: PdfWidgetRect }[],
  origin: PdfRedaction['origin'] = 'search'
): PdfEditOverlay {
  const added: PdfRedaction[] = [];
  const existing = overlay.redactions.slice();

  for (const candidate of candidates) {
    const rect = normalizeRect(candidate.rect);
    if (!isMeaningfulRect(rect)) continue;
    const duplicate = existing.some(
      (other) => other.pageIndex === candidate.pageIndex && nearlyEqual(other.rect, rect)
    );
    if (duplicate) continue;
    const redaction: PdfRedaction = { id: newId('rdx'), pageIndex: candidate.pageIndex, rect, origin };
    existing.push(redaction);
    added.push(redaction);
  }

  if (added.length === 0) return overlay;
  return { ...overlay, redactions: [...overlay.redactions, ...added], updatedAt: nowIso() };
}

function nearlyEqual(a: PdfWidgetRect, b: PdfWidgetRect): boolean {
  const tolerance = 0.5;
  return (
    Math.abs(a.x - b.x) < tolerance &&
    Math.abs(a.y - b.y) < tolerance &&
    Math.abs(a.width - b.width) < tolerance &&
    Math.abs(a.height - b.height) < tolerance
  );
}

export function removeRedaction(overlay: PdfEditOverlay, id: string): PdfEditOverlay {
  const redactions = overlay.redactions.filter((redaction) => redaction.id !== id);
  if (redactions.length === overlay.redactions.length) return overlay;
  return { ...overlay, redactions, updatedAt: nowIso() };
}

export function clearRedactionsOnPage(overlay: PdfEditOverlay, pageIndex: number): PdfEditOverlay {
  const redactions = overlay.redactions.filter((redaction) => redaction.pageIndex !== pageIndex);
  if (redactions.length === overlay.redactions.length) return overlay;
  return { ...overlay, redactions, updatedAt: nowIso() };
}

export function clearAllRedactions(overlay: PdfEditOverlay): PdfEditOverlay {
  if (overlay.redactions.length === 0) return overlay;
  return { ...overlay, redactions: [], updatedAt: nowIso() };
}

/* ── Queries ───────────────────────────────────────────────────────────── */

export function hasRedactions(overlay: PdfEditOverlay): boolean {
  return overlay.redactions.length > 0;
}

export function redactionsOnPage(overlay: PdfEditOverlay, pageIndex: number): PdfRedaction[] {
  return overlay.redactions.filter((redaction) => redaction.pageIndex === pageIndex);
}

/** Original page indices carrying at least one redaction, ascending. */
export function redactedPageIndices(overlay: PdfEditOverlay): number[] {
  return [...new Set(overlay.redactions.map((redaction) => redaction.pageIndex))].sort((a, b) => a - b);
}

/**
 * Redactions grouped by page and grown by the safety padding.
 *
 * This is the shape the engine and the rasteriser both work in, and padding is
 * applied here rather than at the point a rectangle is stored so that the
 * rectangle the user sees on screen is the one they drew.
 */
export function paddedRedactionsByPage(overlay: PdfEditOverlay): Map<number, PdfWidgetRect[]> {
  const byPage = new Map<number, PdfWidgetRect[]>();
  for (const redaction of overlay.redactions) {
    const list = byPage.get(redaction.pageIndex);
    const padded = padRect(redaction.rect);
    if (list) list.push(padded);
    else byPage.set(redaction.pageIndex, [padded]);
  }
  return byPage;
}

/* ── Reading stored redactions back ────────────────────────────────────── */

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Validates redactions read back from Firestore against the document in hand.
 *
 * A rectangle on a page the document no longer has cannot be applied, and
 * carrying it forward would mean an export that silently redacts nothing while
 * the UI counts it. Dropping it is the only honest option, and the editor
 * shows the surviving count so the discrepancy is visible.
 */
export function normalizeRedactions(raw: unknown, pageCount: number): PdfRedaction[] {
  if (!Array.isArray(raw)) return [];
  const redactions: PdfRedaction[] = [];
  const seenIds = new Set<string>();

  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;

    const pageIndex = readNumber(record.pageIndex);
    if (pageIndex === null || !Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pageCount) continue;

    const rawRect = record.rect;
    if (typeof rawRect !== 'object' || rawRect === null) continue;
    const rectRecord = rawRect as Record<string, unknown>;
    const x = readNumber(rectRecord.x);
    const y = readNumber(rectRecord.y);
    const width = readNumber(rectRecord.width);
    const height = readNumber(rectRecord.height);
    if (x === null || y === null || width === null || height === null) continue;

    const rect = normalizeRect({ x, y, width, height });
    if (!isMeaningfulRect(rect)) continue;

    let id = typeof record.id === 'string' && record.id ? record.id : newId('rdx');
    if (seenIds.has(id)) id = newId('rdx');
    seenIds.add(id);

    redactions.push({
      id,
      pageIndex,
      rect,
      origin: record.origin === 'search' ? 'search' : 'manual'
    });
  }

  return redactions;
}
