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
  PDFOptionList,
  PDFPage,
  PDFRadioGroup,
  PDFRef,
  PDFSignature,
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
  PdfSplitSegment
} from './pdfEditTypes';
import { normalizeRotation } from './pdfEditOverlay';
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
async function loadForEditing(bytes: Uint8Array): Promise<{ ok: true; doc: PDFDocument } | { ok: false; blocker: PdfEditBlocker }> {
  if (!looksLikePdf(bytes)) {
    return { ok: false, blocker: { kind: 'corrupt', message: 'This file does not begin with a PDF header.' } };
  }
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    if (doc.isEncrypted) return { ok: false, blocker: { kind: 'encrypted' } };
    return { ok: true, doc };
  } catch (error) {
    if (error instanceof EncryptedPDFError) return { ok: false, blocker: { kind: 'encrypted' } };
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

export class PdfExportError extends Error {}

/**
 * Applies an overlay to the original bytes and returns the edited PDF.
 *
 * Ordering matters and is deliberate:
 *  1. form values are written, then flattened if asked — so a duplicated page
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
  pageSubset?: number[]
): Promise<Uint8Array> {
  const loaded = await loadForEditing(originalBytes);
  if (loaded.ok === false) {
    throw new PdfExportError(
      loaded.blocker.kind === 'encrypted'
        ? 'This PDF is password-protected and cannot be edited.'
        : 'This PDF could not be parsed.'
    );
  }
  const { doc } = loaded;

  applyFormValues(doc, overlay);

  if (overlay.flattenOnExport) {
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

  const plan = pageSubset ? pageSubset.map((i) => overlay.pages[i]).filter((page) => page !== undefined) : overlay.pages;
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
  // repeat is a self-copy, so duplicates stay independently rotatable.
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

  return doc.save();
}

/** One output file per segment, produced through the same apply path. */
export async function splitPdf(
  originalBytes: Uint8Array,
  overlay: PdfEditOverlay,
  sourceBytes: Map<string, Uint8Array>,
  segments: PdfSplitSegment[]
): Promise<{ segment: PdfSplitSegment; bytes: Uint8Array }[]> {
  const results: { segment: PdfSplitSegment; bytes: Uint8Array }[] = [];
  for (const segment of segments) {
    const indices: number[] = [];
    for (let i = segment.start; i <= segment.end; i++) indices.push(i);
    // Each segment is applied to a fresh parse of the original: pdf-lib mutates
    // the document it loads, so reusing one across segments would compound the
    // previous segment's page removals.
    const bytes = await applyOverlayToPdf(originalBytes, overlay, sourceBytes, indices);
    results.push({ segment, bytes });
  }
  return results;
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
