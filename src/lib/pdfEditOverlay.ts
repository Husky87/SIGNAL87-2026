/**
 * Pure helpers over `PdfEditOverlay`.
 *
 * Every function here is total and side-effect free: it takes an overlay and
 * returns a new one, never mutating its argument. No pdf-lib, no pdf.js, no
 * Firestore — this module is the one place the editing rules live, so they can
 * be reasoned about (and tested) without a document in hand.
 */

import {
  ORIGINAL_SOURCE_ID,
  PdfEditOverlay,
  PdfEditSourceMeta,
  PdfFormFieldValue,
  PdfPageInstance,
  PdfPageRotation
} from './pdfEditTypes';

const ROTATIONS: PdfPageRotation[] = [0, 90, 180, 270];

/**
 * crypto.randomUUID() needs a secure context; it is absent on plain http and
 * in some embedded webviews. Ids only have to be unique within one overlay, so
 * the fallback is good enough and keeps the editor working there too.
 */
export function newId(prefix: string): string {
  const globalCrypto = typeof crypto !== 'undefined' ? crypto : undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return `${prefix}_${globalCrypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isRotation(value: unknown): value is PdfPageRotation {
  return ROTATIONS.some((r) => r === value);
}

/** Normalises any quarter-turn count, positive or negative, into 0/90/180/270. */
export function normalizeRotation(degrees: number): PdfPageRotation {
  const wrapped = ((Math.round(degrees / 90) * 90) % 360 + 360) % 360;
  return isRotation(wrapped) ? wrapped : 0;
}

/** Original pages, in order, with no edits applied. */
export function createIdentityOverlay(docId: string, pageCount: number): PdfEditOverlay {
  const pages: PdfPageInstance[] = [];
  for (let i = 0; i < pageCount; i++) {
    pages.push({ id: newId('pg'), sourceId: ORIGINAL_SOURCE_ID, sourceIndex: i, rotation: 0 });
  }
  return {
    docId,
    schemaVersion: 1,
    pages,
    deletedOriginalPages: [],
    formValues: {},
    sources: [],
    flattenOnExport: false,
    updatedAt: nowIso()
  };
}

/** Original page indices that no longer appear in the output. */
function computeDeletedOriginals(pages: PdfPageInstance[], originalPageCount: number): number[] {
  const present = new Set<number>();
  for (const page of pages) {
    if (page.sourceId === ORIGINAL_SOURCE_ID) present.add(page.sourceIndex);
  }
  const deleted: number[] = [];
  for (let i = 0; i < originalPageCount; i++) {
    if (!present.has(i)) deleted.push(i);
  }
  return deleted;
}

/**
 * Rebuilds the derived fields and stamps the time. Every mutation below funnels
 * through this, so `deletedOriginalPages` can never drift from `pages`.
 */
function commit(overlay: PdfEditOverlay, pages: PdfPageInstance[], originalPageCount: number): PdfEditOverlay {
  return {
    ...overlay,
    pages,
    deletedOriginalPages: computeDeletedOriginals(pages, originalPageCount),
    updatedAt: nowIso()
  };
}

/* ── Reading a stored overlay back ─────────────────────────────────────── */

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readFormValue(raw: unknown): PdfFormFieldValue | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const kind = record.kind;
  const value = record.value;
  if (kind === 'text' && typeof value === 'string') return { kind, value };
  if (kind === 'checkbox' && typeof value === 'boolean') return { kind, value };
  if (kind === 'radio' && typeof value === 'string') return { kind, value };
  if (kind === 'dropdown' && typeof value === 'string') return { kind, value };
  if (kind === 'optionlist' && Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    return { kind, value: value as string[] };
  }
  return null;
}

function readSource(raw: unknown): PdfEditSourceMeta | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const id = readString(record.id);
  const fileName = readString(record.fileName);
  if (!id || id === ORIGINAL_SOURCE_ID || !fileName) return null;
  const pageCount = typeof record.pageCount === 'number' ? record.pageCount : 0;
  if (!Number.isInteger(pageCount) || pageCount <= 0) return null;
  return {
    id,
    fileName,
    pageCount,
    sizeBytes: typeof record.sizeBytes === 'number' ? record.sizeBytes : 0,
    addedAt: readString(record.addedAt) || nowIso()
  };
}

/**
 * Turns whatever Firestore handed back into a usable overlay.
 *
 * Stored data can be stale in ways that matter: the underlying PDF may have
 * had pages since a page plan referencing index 40 was written, and a source
 * entry can be malformed. Anything that does not describe a page we can
 * actually produce is dropped rather than trusted, because an out-of-range
 * index would otherwise surface as an export-time crash.
 *
 * Returns the identity overlay when nothing salvageable is left, so the editor
 * always opens on the real document instead of an error.
 */
export function normalizeOverlay(raw: unknown, docId: string, originalPageCount: number): PdfEditOverlay {
  const identity = createIdentityOverlay(docId, originalPageCount);
  if (typeof raw !== 'object' || raw === null) return identity;
  const record = raw as Record<string, unknown>;

  const sources: PdfEditSourceMeta[] = Array.isArray(record.sources)
    ? record.sources.map(readSource).filter((s): s is PdfEditSourceMeta => s !== null)
    : [];
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const rawPages = Array.isArray(record.pages) ? record.pages : [];
  const seenIds = new Set<string>();
  const pages: PdfPageInstance[] = [];
  for (const entry of rawPages) {
    if (typeof entry !== 'object' || entry === null) continue;
    const page = entry as Record<string, unknown>;
    const sourceId = readString(page.sourceId);
    const sourceIndex = page.sourceIndex;
    if (!sourceId || typeof sourceIndex !== 'number' || !Number.isInteger(sourceIndex) || sourceIndex < 0) continue;

    const limit = sourceId === ORIGINAL_SOURCE_ID ? originalPageCount : sourceById.get(sourceId)?.pageCount ?? -1;
    if (sourceIndex >= limit) continue;

    // A duplicated id would make the two instances indistinguishable to every
    // handler below, so the collision is resolved rather than carried forward.
    let id = readString(page.id) || newId('pg');
    if (seenIds.has(id)) id = newId('pg');
    seenIds.add(id);

    pages.push({
      id,
      sourceId,
      sourceIndex,
      rotation: isRotation(page.rotation) ? page.rotation : 0
    });
  }

  if (pages.length === 0) return { ...identity, sources: [] };

  const formValues: Record<string, PdfFormFieldValue> = {};
  if (typeof record.formValues === 'object' && record.formValues !== null) {
    for (const [name, value] of Object.entries(record.formValues as Record<string, unknown>)) {
      const parsed = readFormValue(value);
      if (parsed) formValues[name] = parsed;
    }
  }

  // Only keep sources some surviving page actually refers to.
  const usedSourceIds = new Set(pages.map((p) => p.sourceId));

  return {
    docId,
    schemaVersion: 1,
    pages,
    deletedOriginalPages: computeDeletedOriginals(pages, originalPageCount),
    formValues,
    sources: sources.filter((s) => usedSourceIds.has(s.id)),
    flattenOnExport: record.flattenOnExport === true,
    updatedAt: readString(record.updatedAt) || nowIso()
  };
}

/* ── Page operations ───────────────────────────────────────────────────── */

/** Moves the page at `from` so that it sits at `to` in the new order. */
export function movePage(overlay: PdfEditOverlay, from: number, to: number, originalPageCount: number): PdfEditOverlay {
  const { pages } = overlay;
  if (from < 0 || from >= pages.length) return overlay;
  const target = Math.max(0, Math.min(pages.length - 1, to));
  if (target === from) return overlay;
  const next = pages.slice();
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return commit(overlay, next, originalPageCount);
}

/** Adds `delta` degrees to one page's rotation, wrapping at 360. */
export function rotatePage(
  overlay: PdfEditOverlay,
  instanceId: string,
  delta: number,
  originalPageCount: number
): PdfEditOverlay {
  const next = overlay.pages.map((page) =>
    page.id === instanceId ? { ...page, rotation: normalizeRotation(page.rotation + delta) } : page
  );
  return commit(overlay, next, originalPageCount);
}

/** Rotates every page at once. */
export function rotateAllPages(overlay: PdfEditOverlay, delta: number, originalPageCount: number): PdfEditOverlay {
  const next = overlay.pages.map((page) => ({ ...page, rotation: normalizeRotation(page.rotation + delta) }));
  return commit(overlay, next, originalPageCount);
}

/**
 * Removes a page from the output. Refuses to remove the last one — an
 * empty PDF cannot be written, and a document with no pages is not a state the
 * editor should be able to reach.
 */
export function deletePage(overlay: PdfEditOverlay, instanceId: string, originalPageCount: number): PdfEditOverlay {
  if (overlay.pages.length <= 1) return overlay;
  const next = overlay.pages.filter((page) => page.id !== instanceId);
  if (next.length === overlay.pages.length) return overlay;
  const pruned = pruneUnusedSources({ ...overlay, pages: next });
  return commit(pruned, next, originalPageCount);
}

/** Inserts a copy of a page directly after it. */
export function duplicatePage(overlay: PdfEditOverlay, instanceId: string, originalPageCount: number): PdfEditOverlay {
  const index = overlay.pages.findIndex((page) => page.id === instanceId);
  if (index === -1) return overlay;
  const source = overlay.pages[index];
  const copy: PdfPageInstance = { ...source, id: newId('pg') };
  const next = overlay.pages.slice();
  next.splice(index + 1, 0, copy);
  return commit(overlay, next, originalPageCount);
}

/** Drops source records nothing refers to any more. */
function pruneUnusedSources(overlay: PdfEditOverlay): PdfEditOverlay {
  const used = new Set(overlay.pages.map((page) => page.sourceId));
  const sources = overlay.sources.filter((source) => used.has(source.id));
  return sources.length === overlay.sources.length ? overlay : { ...overlay, sources };
}

/**
 * Inserts pages from another PDF at `atIndex`.
 *
 * Used for both "insert pages" (a chosen range, at a chosen position) and
 * "merge" (every page, at the end) — they are the same operation with
 * different arguments, so they cannot drift apart.
 */
export function insertPagesFromSource(
  overlay: PdfEditOverlay,
  source: PdfEditSourceMeta,
  sourceIndices: number[],
  atIndex: number,
  originalPageCount: number
): PdfEditOverlay {
  const valid = sourceIndices.filter((i) => Number.isInteger(i) && i >= 0 && i < source.pageCount);
  if (valid.length === 0) return overlay;

  const inserted: PdfPageInstance[] = valid.map((sourceIndex) => ({
    id: newId('pg'),
    sourceId: source.id,
    sourceIndex,
    rotation: 0
  }));

  const position = Math.max(0, Math.min(overlay.pages.length, atIndex));
  const next = overlay.pages.slice();
  next.splice(position, 0, ...inserted);

  const sources = overlay.sources.some((s) => s.id === source.id)
    ? overlay.sources
    : [...overlay.sources, source];

  return commit({ ...overlay, sources }, next, originalPageCount);
}

/** Removes an inserted source and every page that came from it. */
export function removeSource(overlay: PdfEditOverlay, sourceId: string, originalPageCount: number): PdfEditOverlay {
  if (sourceId === ORIGINAL_SOURCE_ID) return overlay;
  const next = overlay.pages.filter((page) => page.sourceId !== sourceId);
  if (next.length === 0) return overlay;
  const sources = overlay.sources.filter((source) => source.id !== sourceId);
  return commit({ ...overlay, sources }, next, originalPageCount);
}

/* ── Form values ───────────────────────────────────────────────────────── */

export function setFormValue(
  overlay: PdfEditOverlay,
  name: string,
  value: PdfFormFieldValue
): PdfEditOverlay {
  return {
    ...overlay,
    formValues: { ...overlay.formValues, [name]: value },
    updatedAt: nowIso()
  };
}

/** Clears a pending value, letting the document's own value stand again. */
export function clearFormValue(overlay: PdfEditOverlay, name: string): PdfEditOverlay {
  if (!(name in overlay.formValues)) return overlay;
  const formValues = { ...overlay.formValues };
  delete formValues[name];
  return { ...overlay, formValues, updatedAt: nowIso() };
}

export function setFlattenOnExport(overlay: PdfEditOverlay, flatten: boolean): PdfEditOverlay {
  if (overlay.flattenOnExport === flatten) return overlay;
  return { ...overlay, flattenOnExport: flatten, updatedAt: nowIso() };
}

/* ── Queries ───────────────────────────────────────────────────────────── */

/** True when the page plan is exactly the original pages, in order, unrotated. */
export function hasIdentityPagePlan(overlay: PdfEditOverlay, originalPageCount: number): boolean {
  if (overlay.pages.length !== originalPageCount) return false;
  return overlay.pages.every(
    (page, i) => page.sourceId === ORIGINAL_SOURCE_ID && page.sourceIndex === i && page.rotation === 0
  );
}

/** True when the overlay would change the exported bytes in any way. */
export function hasPendingEdits(overlay: PdfEditOverlay, originalPageCount: number): boolean {
  return (
    !hasIdentityPagePlan(overlay, originalPageCount) ||
    Object.keys(overlay.formValues).length > 0 ||
    overlay.flattenOnExport
  );
}

/**
 * Source ids the overlay needs but the device cannot supply.
 *
 * Inserted pages keep their bytes in IndexedDB on the machine that added them,
 * so opening the same document elsewhere finds the plan without the pages. The
 * editor surfaces these by name instead of exporting a document that is
 * quietly missing pages.
 */
export function missingSourceIds(overlay: PdfEditOverlay, availableSourceIds: Iterable<string>): string[] {
  const available = new Set(availableSourceIds);
  const needed = new Set(overlay.pages.map((page) => page.sourceId).filter((id) => id !== ORIGINAL_SOURCE_ID));
  return [...needed].filter((id) => !available.has(id));
}

/** Contiguous segments the split UI starts from: one segment per page break. */
export function segmentsFromBreaks(breakAfterIndices: Iterable<number>, pageCount: number) {
  const breaks = [...new Set(breakAfterIndices)].filter((i) => i >= 0 && i < pageCount - 1).sort((a, b) => a - b);
  const segments: { start: number; end: number }[] = [];
  let start = 0;
  for (const breakAfter of breaks) {
    segments.push({ start, end: breakAfter });
    start = breakAfter + 1;
  }
  if (start < pageCount) segments.push({ start, end: pageCount - 1 });
  return segments;
}
