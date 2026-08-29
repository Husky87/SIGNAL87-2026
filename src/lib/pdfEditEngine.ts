/**
 * The byte-level half of manual PDF editing: reading a document's structure
 * and form fields, and applying a pending-edit overlay to produce new bytes.
 *
 * Everything here runs in the browser. Nothing is uploaded, and no Cloud
 * Function is involved.
 *
 * The central decision is that export *mutates the loaded original document*
 * rather than copying pages into a freshly created one. The obvious approach —
 * `PDFDocument.create()` plus `copyPages()` — silently drops the AcroForm, so
 * a reordered form would export with its fields gone. Rearranging the existing
 * page tree with the document's own page refs keeps the form intact.
 */

import {
  degrees,
  EncryptedPDFError,
  PDFArray,
  PDFCheckBox,
  PDFDict,
  PDFDocument,
  PDFDropdown,
  PDFName,
  PDFObject,
  PDFOptionList,
  PDFPage,
  PDFRadioGroup,
  PDFRef,
  PDFSignature,
  PDFStream,
  PDFTextField
} from 'pdf-lib';
import {
  ORIGINAL_SOURCE_ID,
  PdfEditBlocker,
  PdfEditOverlay,
  PdfFieldInfo,
  PdfFieldKind,
  PdfFieldWidget,
  PdfFormFieldValue,
  PdfInspection,
  PdfRasterPage,
  PdfRasterResult,
  PdfRasterizer,
  PdfSplitSegment
} from './pdfEditTypes';
import { normalizeRotation } from './pdfEditOverlay';
import { paddedRedactionsByPage, redactedPageIndices } from './pdfRedaction';
import { DocumentItem } from '../types';
import { fileDataCache } from './pdfGenerator';

export type PdfLoadResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; blocker: PdfEditBlocker };

export type PdfInspectResult =
  | { ok: true; inspection: PdfInspection }
  | { ok: false; blocker: PdfEditBlocker };

const PDF_HEADER = '%PDF-';

function looksLikePdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return new TextDecoder().decode(bytes.subarray(0, 5)) === PDF_HEADER;
}

/**
 * Obtains the document's bytes without a server round trip.
 *
 * The upload-time cache is preferred because it needs no network at all; the
 * Storage download URL is the fallback for a document opened in a later
 * session. Firebase's download endpoint is CORS-enabled, but a blocked request
 * still has to become a stated error rather than an empty editor.
 */
export async function resolvePdfBytes(doc: DocumentItem): Promise<PdfLoadResult> {
  const cached = fileDataCache.get(doc.id);
  if (cached) {
    const bytes = new Uint8Array(cached);
    if (looksLikePdf(bytes)) return { ok: true, bytes };
    // Older uploads cached the original DOCX/XLSX bytes under the document id.
    fileDataCache.delete(doc.id);
  }

  if (!doc.fileUrl) {
    return {
      ok: false,
      blocker: {
        kind: 'unavailable',
        message: 'The original file for this document was never stored, so there is nothing to edit.'
      }
    };
  }

  try {
    const response = await fetch(doc.fileUrl);
    if (!response.ok) {
      return {
        ok: false,
        blocker: { kind: 'unavailable', message: `The stored file could not be fetched (HTTP ${response.status}).` }
      };
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (!looksLikePdf(bytes)) {
      return { ok: false, blocker: { kind: 'corrupt', message: 'The stored file is not a PDF.' } };
    }
    fileDataCache.set(doc.id, buffer);
    return { ok: true, bytes };
  } catch (error) {
    return {
      ok: false,
      blocker: {
        kind: 'unavailable',
        message: error instanceof Error ? error.message : 'The stored file could not be fetched.'
      }
    };
  }
}

/**
 * XFA forms are an XML form definition riding inside a PDF shell. pdf-lib
 * reads the AcroForm dictionary only, so an XFA document typically reports
 * zero fields — which would render as an empty, apparently field-less form
 * that silently discards anything typed into it. Detecting the /XFA entry lets
 * the editor say the form type is unsupported instead.
 */
function hasXfaForm(doc: PDFDocument): boolean {
  try {
    const acroForm = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
    if (!acroForm) return false;
    return acroForm.get(PDFName.of('XFA')) !== undefined;
  } catch {
    return false;
  }
}

/**
 * Loads bytes into pdf-lib, mapping the ways it can fail onto stated blockers.
 *
 * `ignoreEncryption` is deliberately left off: a password-protected document
 * decodes to garbage rather than erroring when it is on, and a garbled export
 * is worse than a refusal.
 */
/**
 * Whether a thrown value is pdf-lib reporting an encrypted document.
 *
 * `instanceof EncryptedPDFError` alone is not enough. pdf-lib ships compiled
 * with tslib's __extends downlevelling, and subclassing Error that way breaks
 * the prototype chain — the check silently returns false for the very error it
 * names. Without the fallbacks, every password-protected PDF was reported as
 * merely unreadable instead of as protected.
 */
function isEncryptedError(error: unknown): boolean {
  if (error instanceof EncryptedPDFError) return true;
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { name?: unknown; message?: unknown };
  if (candidate.name === 'EncryptedPDFError') return true;
  return typeof candidate.message === 'string' && /is encrypted/i.test(candidate.message);
}

async function loadForEditing(bytes: Uint8Array): Promise<{ ok: true; doc: PDFDocument } | { ok: false; blocker: PdfEditBlocker }> {
  if (!looksLikePdf(bytes)) {
    return { ok: false, blocker: { kind: 'corrupt', message: 'This file does not begin with a PDF header.' } };
  }
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    if (doc.isEncrypted) return { ok: false, blocker: { kind: 'encrypted' } };
    return { ok: true, doc };
  } catch (error) {
    if (isEncryptedError(error)) return { ok: false, blocker: { kind: 'encrypted' } };
    return {
      ok: false,
      blocker: {
        kind: 'corrupt',
        message: error instanceof Error ? error.message : 'This PDF could not be parsed.'
      }
    };
  }
}

function refKey(ref: PDFRef): string {
  return `${ref.objectNumber}R${ref.generationNumber}`;
}

/**
 * Maps each widget annotation dictionary to the page it sits on.
 *
 * A widget's own /P entry is the direct answer but is optional, and plenty of
 * real-world forms omit it. Walking every page's /Annots array covers those,
 * and pdf-lib's context returns the same object instance for a given ref, so
 * dictionary identity is a sound key.
 */
function buildWidgetPageMap(doc: PDFDocument): { byDict: Map<PDFDict, number>; byRef: Map<string, number> } {
  const byDict = new Map<PDFDict, number>();
  const byRef = new Map<string, number>();
  const pages = doc.getPages();
  pages.forEach((page, pageIndex) => {
    byRef.set(refKey(page.ref), pageIndex);
    const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    if (!annots) return;
    for (let i = 0; i < annots.size(); i++) {
      const entry = annots.get(i);
      if (!(entry instanceof PDFRef)) continue;
      const dict = doc.context.lookupMaybe(entry, PDFDict);
      if (dict) byDict.set(dict, pageIndex);
    }
  });
  return { byDict, byRef };
}

function classifyField(field: unknown): PdfFieldKind {
  if (field instanceof PDFTextField) return 'text';
  if (field instanceof PDFCheckBox) return 'checkbox';
  if (field instanceof PDFRadioGroup) return 'radio';
  if (field instanceof PDFDropdown) return 'dropdown';
  if (field instanceof PDFOptionList) return 'optionlist';
  if (field instanceof PDFSignature) return 'signature';
  return 'button';
}

function readInitialValue(field: unknown, kind: PdfFieldKind): PdfFormFieldValue | undefined {
  try {
    if (kind === 'text' && field instanceof PDFTextField) {
      return { kind: 'text', value: field.getText() ?? '' };
    }
    if (kind === 'checkbox' && field instanceof PDFCheckBox) {
      return { kind: 'checkbox', value: field.isChecked() };
    }
    if (kind === 'radio' && field instanceof PDFRadioGroup) {
      return { kind: 'radio', value: field.getSelected() ?? '' };
    }
    if (kind === 'dropdown' && field instanceof PDFDropdown) {
      return { kind: 'dropdown', value: field.getSelected()[0] ?? '' };
    }
    if (kind === 'optionlist' && field instanceof PDFOptionList) {
      return { kind: 'optionlist', value: field.getSelected() };
    }
  } catch {
    // A malformed field should cost that one field's initial value, not the
    // whole form. It still renders, empty.
  }
  return undefined;
}

function readOptions(field: unknown, kind: PdfFieldKind): string[] {
  try {
    if (kind === 'dropdown' && field instanceof PDFDropdown) return field.getOptions();
    if (kind === 'optionlist' && field instanceof PDFOptionList) return field.getOptions();
    if (kind === 'radio' && field instanceof PDFRadioGroup) return field.getOptions();
  } catch {
    return [];
  }
  return [];
}

/** Reads page geometry and every AcroForm field, with on-page widget rectangles. */
export async function inspectPdf(bytes: Uint8Array): Promise<PdfInspectResult> {
  const loaded = await loadForEditing(bytes);
  if (loaded.ok === false) return { ok: false, blocker: loaded.blocker };
  const { doc } = loaded;

  if (hasXfaForm(doc)) return { ok: false, blocker: { kind: 'xfa' } };

  const pages = doc.getPages();
  if (pages.length === 0) {
    return { ok: false, blocker: { kind: 'corrupt', message: 'This PDF contains no pages.' } };
  }

  const pageSizes = pages.map((page) => {
    const size = page.getSize();
    return { width: size.width, height: size.height, rotation: normalizeRotation(page.getRotation().angle) };
  });

  const { byDict, byRef } = buildWidgetPageMap(doc);
  const fields: PdfFieldInfo[] = [];
  let hasAcroForm = false;

  try {
    const form = doc.getForm();
    const formFields = form.getFields();
    hasAcroForm = formFields.length > 0;

    for (const field of formFields) {
      const kind = classifyField(field);
      const widgets: PdfFieldWidget[] = [];

      for (const widget of field.acroField.getWidgets()) {
        const parentRef = widget.P();
        const pageIndex = byDict.get(widget.dict) ?? (parentRef ? byRef.get(refKey(parentRef)) : undefined);
        if (pageIndex === undefined) continue;
        const rect = widget.getRectangle();
        const onValue = kind === 'radio' || kind === 'checkbox' ? widget.getOnValue() : undefined;
        widgets.push({
          pageIndex,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          ...(onValue ? { exportValue: onValue.decodeText() } : {})
        });
      }

      const initial = readInitialValue(field, kind);
      fields.push({
        name: field.getName(),
        kind,
        readOnly: field.isReadOnly(),
        required: field.isRequired(),
        multiline: field instanceof PDFTextField ? field.isMultiline() : false,
        options: readOptions(field, kind),
        widgets,
        ...(initial ? { initial } : {})
      });
    }
  } catch {
    // A form that cannot be enumerated is reported as no form at all; page
    // operations still work, which is most of the feature.
    hasAcroForm = false;
  }

  return { ok: true, inspection: { pageCount: pages.length, pageSizes, fields, hasAcroForm } };
}

/** Writes the overlay's pending values into the document's real form fields. */
function applyFormValues(doc: PDFDocument, overlay: PdfEditOverlay): void {
  const entries = Object.entries(overlay.formValues);
  if (entries.length === 0) return;

  let form;
  try {
    form = doc.getForm();
  } catch {
    return;
  }

  for (const [name, value] of entries) {
    try {
      const field = form.getField(name);
      if (value.kind === 'text' && field instanceof PDFTextField) {
        field.setText(value.value);
      } else if (value.kind === 'checkbox' && field instanceof PDFCheckBox) {
        if (value.value) field.check();
        else field.uncheck();
      } else if (value.kind === 'radio' && field instanceof PDFRadioGroup) {
        if (value.value) field.select(value.value);
        else field.clear();
      } else if (value.kind === 'dropdown' && field instanceof PDFDropdown) {
        if (value.value) field.select(value.value);
        else field.clear();
      } else if (value.kind === 'optionlist' && field instanceof PDFOptionList) {
        if (value.value.length > 0) field.select(value.value);
        else field.clear();
      }
    } catch {
      // The field named in the overlay is gone or is a different type than it
      // was. Skipping it keeps every other value, which beats failing the export.
    }
  }
}

/* ── Redaction ─────────────────────────────────────────────────────────────
   Everything below exists to make one promise true: after an export, content
   inside a redaction rectangle is not in the file. Not covered, not hidden
   behind an opaque shape, not sitting in an unreferenced object — absent.

   Three things have to happen for that to hold, and leaving out any one of
   them produces a document that looks redacted and is not:

     1. The page is replaced by a picture of itself taken after the regions
        were painted out. pdf-lib can rearrange a page tree but cannot reach
        inside a content stream and delete the operators that draw a name, so
        editing the drawing instructions is not on the table. Rasterising is.

     2. The old page's own objects are unlinked — its content streams, its
        resources, its annotations — and the document-wide structures that
        quote page text (the tagged-PDF structure tree, the outline, XMP) go
        with them.

     3. The file is swept for anything now unreachable, and those objects are
        deleted from the context. Without this step the export still contains
        the original content stream verbatim: pdf-lib's writer serialises every
        object it is holding, referenced or not. Unlinking alone is exactly the
        "looks like redaction without being redaction" failure.               */

/** Whether the form has a widget sitting on any of these pages. */
function formWidgetsTouchPages(doc: PDFDocument, pageIndices: Set<number>): boolean {
  if (pageIndices.size === 0) return false;
  let form;
  try {
    form = doc.getForm();
  } catch {
    return false;
  }

  const { byDict, byRef } = buildWidgetPageMap(doc);
  try {
    for (const field of form.getFields()) {
      for (const widget of field.acroField.getWidgets()) {
        const parentRef = widget.P();
        const pageIndex = byDict.get(widget.dict) ?? (parentRef ? byRef.get(refKey(parentRef)) : undefined);
        if (pageIndex !== undefined && pageIndices.has(pageIndex)) return true;
      }
    }
  } catch {
    // A form that cannot be enumerated is treated as touching the page, because
    // flattening a form we cannot read is safer than rasterising around it.
    return true;
  }
  return false;
}

/**
 * Removes the document-wide structures that can hold a copy of page text.
 *
 * A tagged PDF carries the reading order — and, through /ActualText, literal
 * strings — in a structure tree hanging off the catalog. Bookmarks quote
 * headings. XMP packets carry descriptions. None of these are visible on the
 * page, and all of them survive rasterising the page they describe.
 *
 * Named destinations are kept: they are page references, not text, and losing
 * them would break every internal link in the document.
 */
function sanitizeCatalogForRedaction(doc: PDFDocument): void {
  const catalog = doc.catalog;
  for (const key of ['StructTreeRoot', 'MarkInfo', 'Metadata', 'Outlines', 'PageLabels', 'SpiderInfo']) {
    catalog.delete(PDFName.of(key));
  }
  // Attachments and document-level scripts can carry the source material the
  // redaction is meant to remove, so they go; /Dests stays.
  const names = catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
  if (names) {
    names.delete(PDFName.of('EmbeddedFiles'));
    names.delete(PDFName.of('JavaScript'));
  }
}

/**
 * Replaces a page's entire content with the supplied raster.
 *
 * The page object itself is kept rather than swapped for a new one, so that
 * every reference to it — the page tree, and the plan resolution that runs
 * afterwards — stays valid.
 *
 * The page's boxes are collapsed onto the raster's box. A renderer draws the
 * CropBox, so that is what the image shows; leaving a larger MediaBox in place
 * would put the image in the wrong part of a larger page.
 */
async function replacePageWithRaster(doc: PDFDocument, raster: PdfRasterPage): Promise<void> {
  const page = doc.getPages()[raster.pageIndex];
  if (!page) {
    // Silently skipping would hand back a file the user believes is redacted.
    throw new PdfExportError('A redacted page could not be found in the document, so nothing was removed.');
  }
  const leaf = page.node;
  const context = doc.context;

  // Unlink first, then install empty containers. Anything that survives this
  // is caught by the sweep at the end of the export.
  for (const key of [
    'Contents',
    'Annots',
    'Resources',
    'Group',
    'StructParents',
    'PieceInfo',
    'Metadata',
    'Thumb',
    'AA',
    'B',
    'Trans'
  ]) {
    leaf.delete(PDFName.of(key));
  }
  leaf.set(PDFName.of('Contents'), context.obj([]));
  leaf.set(PDFName.of('Resources'), context.obj({}));
  leaf.set(PDFName.of('Annots'), context.obj([]));

  const { x, y, width, height } = raster.box;
  leaf.set(PDFName.of('MediaBox'), context.obj([x, y, x + width, y + height]));
  for (const key of ['CropBox', 'BleedBox', 'TrimBox', 'ArtBox']) {
    leaf.delete(PDFName.of(key));
  }

  const image = await doc.embedPng(raster.png);
  page.drawImage(image, { x, y, width, height });
}

/**
 * Deletes every indirect object the catalog can no longer reach.
 *
 * pdf-lib's writer emits `context.enumerateIndirectObjects()` in full, so an
 * object that has merely been unlinked is still written into the output file.
 * For a redacted page that means the original content stream — with the text
 * intact — travels along inside the "redacted" PDF. This walk is what makes
 * removal actually removal.
 *
 * The traversal only has to understand containers, because a reference can
 * only appear as an array entry or a dictionary value; a stream's references
 * all live in its dictionary, never in its (already encoded) bytes.
 */
function collectGarbage(doc: PDFDocument): number {
  const context = doc.context;
  const live = new Set<string>();
  const queue: PDFRef[] = [];

  const enqueue = (ref: PDFRef): void => {
    const key = refKey(ref);
    if (live.has(key)) return;
    live.add(key);
    queue.push(ref);
  };

  const visit = (object: PDFObject | undefined): void => {
    if (!object) return;
    if (object instanceof PDFRef) {
      enqueue(object);
      return;
    }
    if (object instanceof PDFStream) {
      visit(object.dict);
      return;
    }
    if (object instanceof PDFArray) {
      for (let i = 0; i < object.size(); i++) visit(object.get(i));
      return;
    }
    if (object instanceof PDFDict) {
      for (const value of object.values()) visit(value);
    }
  };

  // The trailer names every root the file has: the catalog, the info
  // dictionary, and — on a document we refused to open, so never here — the
  // encryption dictionary.
  const { Root, Info, Encrypt } = context.trailerInfo as Record<string, unknown>;
  for (const root of [Root, Info, Encrypt]) {
    if (root instanceof PDFRef) enqueue(root);
  }

  while (queue.length > 0) {
    const ref = queue.pop();
    if (!ref) break;
    visit(context.lookup(ref));
  }

  let deleted = 0;
  for (const [ref] of context.enumerateIndirectObjects()) {
    if (live.has(refKey(ref))) continue;
    context.delete(ref);
    deleted++;
  }
  return deleted;
}

export class PdfExportError extends Error {}

/** Options for one application of an overlay. */
export interface PdfApplyOptions {
  /**
   * Indices into `overlay.pages` to keep. This is how split produces one file
   * per segment through the same path.
   */
  pageSubset?: number[];
  /**
   * Supplies the rendered replacements for redacted pages. Required whenever
   * the overlay carries a redaction — the engine refuses rather than exporting
   * a document it cannot make the removal promise about.
   */
  rasterizer?: PdfRasterizer;
  /**
   * An already-computed render, so a split does not re-render the same pages
   * once per segment. Carries the bytes it was rendered from as well as the
   * result: the replacement images belong on *that* document, not on the
   * original, which has not had its form values written into it yet.
   */
  prerendered?: PdfPreparedRaster;
}

/** A completed render, and the document state it was taken from. */
export interface PdfPreparedRaster {
  result: PdfRasterResult;
  bytes: Uint8Array;
}

export interface PdfApplyResult {
  bytes: Uint8Array;
  /**
   * The document's text with every run touching a redaction dropped, or null
   * when nothing was redacted.
   *
   * A caller holding a separate copy of the document's text — the assistant's
   * index — must write this back. Redacting the file and leaving that copy
   * alone would take the content off the page and leave it quotable.
   */
  redactedText: string | null;
  /** How many pages were replaced by a raster because they carried a mark. */
  pagesRedacted: number;
}

/**
 * Applies an overlay to the original bytes and returns the edited PDF.
 *
 * Ordering matters and is deliberate: *  1. form values are written, then flattened if asked — so a duplicated page
 *     carries the filled appearance rather than a second live copy of a field;
 *  2. every page object needed by the plan is obtained *before* the page tree
 *     is torn down, because copyPages addresses pages by index;
 *  3. the tree is rebuilt in plan order from those objects.
 *
 * `pageSubset` selects indices into `overlay.pages`, which is how split
 * produces one file per segment through this same path.
 */
export async function applyOverlayToPdf(
  originalBytes: Uint8Array,
  overlay: PdfEditOverlay,
  sourceBytes: Map<string, Uint8Array>,
  options: PdfApplyOptions = {}
): Promise<PdfApplyResult> {
  const redactedPages = redactedPageIndices(overlay).filter((index) => index >= 0);
  const redacting = redactedPages.length > 0;

  const { doc, redactedText, pagesRedacted } = await prepareDocument(
    originalBytes,
    overlay,
    redactedPages,
    options
  );

  const plan = options.pageSubset
    ? options.pageSubset.map((i) => overlay.pages[i]).filter((page) => page !== undefined)
    : overlay.pages;
  if (plan.length === 0) throw new PdfExportError('An exported PDF must contain at least one page.');

  // Foreign sources, loaded once each.
  const foreignDocs = new Map<string, PDFDocument>();
  for (const instance of plan) {
    if (instance.sourceId === ORIGINAL_SOURCE_ID || foreignDocs.has(instance.sourceId)) continue;
    const bytes = sourceBytes.get(instance.sourceId);
    if (!bytes) {
      const meta = overlay.sources.find((source) => source.id === instance.sourceId);
      throw new PdfExportError(
        `The pages inserted from ${meta?.fileName ?? 'another PDF'} are not available on this device. ` +
          'Re-attach that file, or remove those pages, before exporting.'
      );
    }
    const foreign = await loadForEditing(bytes);
    if (foreign.ok === false) {
      const meta = overlay.sources.find((source) => source.id === instance.sourceId);
      throw new PdfExportError(`${meta?.fileName ?? 'An inserted PDF'} could not be read.`);
    }
    foreignDocs.set(instance.sourceId, foreign.doc);
  }

  // Resolve every plan entry to a concrete page object while the original tree
  // is still intact. The first use of an original page reuses that page; any
  // repeat is a self-copy, so duplicates stay independently rotatable — and,
  // because redaction has already replaced the page, a duplicate of a redacted
  // page is redacted too.
  const originalPages = doc.getPages();
  const usedOriginals = new Set<number>();
  const resolved: PDFPage[] = [];

  for (const instance of plan) {
    if (instance.sourceId === ORIGINAL_SOURCE_ID) {
      if (!usedOriginals.has(instance.sourceIndex)) {
        usedOriginals.add(instance.sourceIndex);
        resolved.push(originalPages[instance.sourceIndex]);
      } else {
        const [copy] = await doc.copyPages(doc, [instance.sourceIndex]);
        resolved.push(copy);
      }
    } else {
      const foreignDoc = foreignDocs.get(instance.sourceId);
      if (!foreignDoc) throw new PdfExportError('An inserted PDF could not be read.');
      const [copy] = await doc.copyPages(foreignDoc, [instance.sourceIndex]);
      resolved.push(copy);
    }
  }

  // Rebuild the page tree in plan order.
  for (let i = doc.getPageCount() - 1; i >= 0; i--) doc.removePage(i);
  resolved.forEach((page, index) => {
    doc.insertPage(index, page);
  });

  // Rotation is a delta on top of whatever the page already carried.
  resolved.forEach((page, index) => {
    const delta = plan[index].rotation;
    if (delta === 0) return;
    page.setRotation(degrees(normalizeRotation(page.getRotation().angle + delta)));
  });

  // Sweep whenever the export was supposed to take something away. A page
  // dropped from the plan is only unlinked from the page tree, so without this
  // its content would still be written into the file — the same trap as an
  // unlinked redacted page, and just as surprising to someone who deleted a
  // page in order to withhold it.
  const droppedOriginalPages = usedOriginals.size < originalPages.length;
  if (redacting || droppedOriginalPages) {
    // Pending images and fonts are materialised first, so the sweep judges the
    // finished object graph rather than one still missing them.
    await doc.flush();
    collectGarbage(doc);
  }

  return { bytes: await doc.save(), redactedText, pagesRedacted };
}

/**
 * Everything that has to happen to the document before its pages are
 * rearranged: form values, flattening, and — when there are redactions — the
 * render-and-replace round trip.
 */
async function prepareDocument(
  originalBytes: Uint8Array,
  overlay: PdfEditOverlay,
  redactedPages: number[],
  options: PdfApplyOptions
): Promise<{ doc: PDFDocument; redactedText: string | null; pagesRedacted: number }> {
  const loaded = await loadForEditing(originalBytes);
  if (loaded.ok === false) {
    throw new PdfExportError(
      loaded.blocker.kind === 'encrypted'
        ? 'This PDF is password-protected and cannot be edited.'
        : 'This PDF could not be parsed.'
    );
  }
  let doc = loaded.doc;

  applyFormValues(doc, overlay);

  // A field sitting on a page that is about to become a picture has to be
  // baked in first. A renderer draws page content, not widget annotations, so
  // rasterising around a live field would quietly drop whatever was typed into
  // it — and the field itself, holding that value, would survive the redaction
  // as a free-floating annotation.
  const onRedactedPages = formWidgetsTouchPages(doc, new Set(redactedPages));
  if (overlay.flattenOnExport || onRedactedPages) {
    flattenForm(doc);
  }

  if (redactedPages.length === 0) return { doc, redactedText: null, pagesRedacted: 0 };

  const raster = options.prerendered ?? (await renderRedactions(doc, overlay, options.rasterizer));

  // The rasteriser was given the document as it stands, so the replacement
  // pages have to be applied to that same state rather than to the original.
  const reloaded = await loadForEditing(raster.bytes);
  if (reloaded.ok === false) {
    throw new PdfExportError('The redacted pages could not be written back into the document.');
  }
  doc = reloaded.doc;

  for (const page of raster.result.pages) {
    await replacePageWithRaster(doc, page);
  }
  sanitizeCatalogForRedaction(doc);

  return { doc, redactedText: raster.result.text, pagesRedacted: raster.result.pages.length };
}

function flattenForm(doc: PDFDocument): void {
  try {
    doc.getForm().flatten();
  } catch {
    // Fields missing appearance streams can defeat appearance regeneration.
    // Flattening without it still bakes the values in.
    try {
      doc.getForm().flatten({ updateFieldAppearances: false });
    } catch {
      throw new PdfExportError('This form could not be flattened. Export again with flattening turned off.');
    }
  }
}

/**
 * Hands the document to the rasteriser and returns what came back, along with
 * the bytes it was rendered from.
 *
 * The bytes matter: the caller has to reload *these*, not the original, or the
 * replacement images would be pasted onto a document that never had its form
 * values written into it.
 */
async function renderRedactions(
  doc: PDFDocument,
  overlay: PdfEditOverlay,
  rasterizer: PdfRasterizer | undefined
): Promise<PdfPreparedRaster> {
  if (!rasterizer) {
    throw new PdfExportError(
      'Redaction needs the page renderer, which is not available here. Reload the page and try again.'
    );
  }
  const bytes = await doc.save();
  const redactionsByPage = paddedRedactionsByPage(overlay);
  const result = await rasterizer({ bytes, redactionsByPage });

  // Every marked page must come back. A renderer that quietly dropped one —
  // an oversized page, a canvas the browser refused to allocate — would
  // otherwise produce an export that is redacted everywhere except the page
  // nobody was told about.
  const returned = new Set(result.pages.map((page) => page.pageIndex));
  const missing = [...redactionsByPage.keys()].filter((pageIndex) => !returned.has(pageIndex));
  if (missing.length > 0) {
    throw new PdfExportError(
      `Page ${missing.map((pageIndex) => pageIndex + 1).join(', ')} could not be rendered, so the marked ` +
        'content was not removed. Nothing was exported.'
    );
  }
  return { result, bytes };
}

/** One output file per segment, produced through the same apply path. */
export async function splitPdf(
  originalBytes: Uint8Array,
  overlay: PdfEditOverlay,
  sourceBytes: Map<string, Uint8Array>,
  segments: PdfSplitSegment[],
  options: PdfApplyOptions = {}
): Promise<{ segment: PdfSplitSegment; bytes: Uint8Array }[]> {
  // Redacted pages are rendered once and reused across every segment. Letting
  // each segment render for itself would rasterise the same page as many times
  // as there are output files, for identical pixels.
  let prerendered = options.prerendered;
  if (!prerendered && redactedPageIndices(overlay).length > 0) {
    prerendered = await prerenderRedactions(originalBytes, overlay, options.rasterizer);
  }

  const results: { segment: PdfSplitSegment; bytes: Uint8Array }[] = [];
  for (const segment of segments) {
    const indices: number[] = [];
    for (let i = segment.start; i <= segment.end; i++) indices.push(i);
    // Each segment is applied to a fresh parse of the original: pdf-lib mutates
    // the document it loads, so reusing one across segments would compound the
    // previous segment's page removals.
    const applied = await applyOverlayToPdf(originalBytes, overlay, sourceBytes, {
      ...options,
      pageSubset: indices,
      prerendered
    });
    results.push({ segment, bytes: applied.bytes });
  }
  return results;
}

/**
 * Runs the render half of redaction on its own, so its cost can be paid once
 * and its result handed to several applications of the same overlay.
 */
export async function prerenderRedactions(
  originalBytes: Uint8Array,
  overlay: PdfEditOverlay,
  rasterizer: PdfRasterizer | undefined
): Promise<PdfPreparedRaster> {
  const loaded = await loadForEditing(originalBytes);
  if (loaded.ok === false) {
    throw new PdfExportError(
      loaded.blocker.kind === 'encrypted'
        ? 'This PDF is password-protected and cannot be edited.'
        : 'This PDF could not be parsed.'
    );
  }
  const doc = loaded.doc;
  applyFormValues(doc, overlay);
  if (overlay.flattenOnExport || formWidgetsTouchPages(doc, new Set(redactedPageIndices(overlay)))) {
    flattenForm(doc);
  }
  return renderRedactions(doc, overlay, rasterizer);
}

/** Page count of an arbitrary PDF, for validating an inserted source. */
export async function readPageCount(bytes: Uint8Array): Promise<{ ok: true; pageCount: number } | { ok: false; blocker: PdfEditBlocker }> {
  const loaded = await loadForEditing(bytes);
  if (loaded.ok === false) return { ok: false, blocker: loaded.blocker };
  const pageCount = loaded.doc.getPageCount();
  if (pageCount === 0) {
    return { ok: false, blocker: { kind: 'corrupt', message: 'That PDF contains no pages.' } };
  }
  return { ok: true, pageCount };
}
