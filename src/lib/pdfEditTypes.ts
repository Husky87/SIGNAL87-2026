/**
 * Signal87 AI — manual PDF editing.
 *
 * Edits are non-destructive: nothing here ever rewrites the bytes held in
 * Storage. A `PdfEditOverlay` is a plain-JSON description of pending changes,
 * stored in Firestore against the document id, and applied to the bytes only
 * at export time.
 *
 * This module is types only, so it can be imported from anywhere (pure
 * helpers, the pdf-lib engine, React components) without dragging pdf-lib or
 * pdf.js into the importing module's bundle graph.
 */

/** Clockwise quarter turns, the only rotations a PDF page dictionary allows. */
export type PdfPageRotation = 0 | 90 | 180 | 270;

/**
 * Source id for pages belonging to the document being edited, as opposed to
 * pages pulled in from another PDF. Reserved — an inserted source may never
 * claim it.
 */
export const ORIGINAL_SOURCE_ID = 'original';

/**
 * One page in the pending output, in output order.
 *
 * `id` is per-instance rather than per-source-page, because duplicating a page
 * produces two instances that share `sourceId`/`sourceIndex` and must still be
 * addressable (and rotatable) apart from one another.
 */
export interface PdfPageInstance {
  id: string;
  /** `ORIGINAL_SOURCE_ID`, or the id of an inserted source. */
  sourceId: string;
  /** 0-based page index within that source. */
  sourceIndex: number;
  /** Applied on top of the page's own /Rotate, not in place of it. */
  rotation: PdfPageRotation;
}

/** Field kinds this editor can render an input for. */
export type PdfEditableFieldKind = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'optionlist';

/**
 * Every kind pdf-lib can report. Buttons and signature fields are listed so
 * the UI can say why they aren't editable, rather than omitting them and
 * leaving a visible gap in the form with no explanation.
 */
export type PdfFieldKind = PdfEditableFieldKind | 'button' | 'signature';

/** A field's pending value. The `kind` tag keeps the union safe to persist. */
export type PdfFormFieldValue =
  | { kind: 'text'; value: string }
  | { kind: 'checkbox'; value: boolean }
  | { kind: 'radio'; value: string }
  | { kind: 'dropdown'; value: string }
  | { kind: 'optionlist'; value: string[] };

/** A widget rectangle in PDF user space (origin bottom-left). */
export interface PdfWidgetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One on-page appearance of a field. A single field can have several — a radio
 * group has one per option, and a field repeated across pages has one per page.
 */
export interface PdfFieldWidget {
  /** Index into the *original* document's pages. */
  pageIndex: number;
  rect: PdfWidgetRect;
  /** For radio widgets, the on-state this particular button selects. */
  exportValue?: string;
}

/** A form field as read out of the document. Runtime only — never persisted. */
export interface PdfFieldInfo {
  name: string;
  kind: PdfFieldKind;
  readOnly: boolean;
  required: boolean;
  multiline: boolean;
  /** Choices for dropdown/optionlist/radio; empty otherwise. */
  options: string[];
  widgets: PdfFieldWidget[];
  /** The value already in the document. Absent for button/signature fields. */
  initial?: PdfFormFieldValue;
}

/** Metadata for a PDF whose pages have been inserted or merged in.
 *
 * The bytes are deliberately not here: they live in IndexedDB on the device
 * that added them, so that the overlay stays small enough for Firestore and no
 * document is ever uploaded anywhere for processing.
 */
export interface PdfEditSourceMeta {
  id: string;
  fileName: string;
  pageCount: number;
  sizeBytes: number;
  addedAt: string;
}

/** The complete pending-edit description for one document. */
export interface PdfEditOverlay {
  docId: string;
  schemaVersion: 1;
  /** Output page order. The source of truth for order, rotation and deletion. */
  pages: PdfPageInstance[];
  /**
   * Original page indices no longer present in `pages`. Derived from `pages`
   * and recomputed on every mutation — stored because a deleted-page set is
   * far easier to read back than to infer from an order array.
   */
  deletedOriginalPages: number[];
  formValues: Record<string, PdfFormFieldValue>;
  sources: PdfEditSourceMeta[];
  /** Bake field values into the page content, dropping interactivity. */
  flattenOnExport: boolean;
  updatedAt: string;
}

/** Why a PDF could not be opened for editing. */
export type PdfEditBlocker =
  /** Password-protected or otherwise encrypted. */
  | { kind: 'encrypted' }
  /** An XFA form. pdf-lib cannot read these, so we refuse rather than show an empty form. */
  | { kind: 'xfa' }
  /** Not a PDF, or damaged past parsing. */
  | { kind: 'corrupt'; message: string }
  /** The bytes themselves could not be obtained (offline, no stored file, CORS). */
  | { kind: 'unavailable'; message: string };

/** What the engine reports about a document it managed to open. */
export interface PdfInspection {
  pageCount: number;
  pageSizes: { width: number; height: number; rotation: number }[];
  fields: PdfFieldInfo[];
  hasAcroForm: boolean;
}

/** A contiguous run of output pages destined for its own file on split. */
export interface PdfSplitSegment {
  /** Inclusive, 0-based index into the overlay's `pages`. */
  start: number;
  /** Inclusive. */
  end: number;
}
