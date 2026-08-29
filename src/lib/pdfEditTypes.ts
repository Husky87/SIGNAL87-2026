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

/**
 * One rectangle whose content is to be destroyed, in PDF user space on a page
 * of the *original* document.
 *
 * Deliberately carries no copy of the text it covers. A redaction record is
 * written to Firestore, and storing the matched string there would leave the
 * very content the user is removing sitting in plain text beside the document
 * — the same class of mistake as drawing a black box over text that is still
 * selectable underneath.
 */
export interface PdfRedaction {
  id: string;
  /** 0-based index into the original document's pages. */
  pageIndex: number;
  /** In PDF user space, origin bottom-left, before any /Rotate is applied. */
  rect: PdfWidgetRect;
  /** Drawn by hand, or produced by a text search. */
  origin: 'manual' | 'search';
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
  /**
   * Regions to destroy on export. Unlike every other entry here, applying
   * these is not reversible from the exported bytes — the content is gone, not
   * hidden. The stored original is still untouched until the user explicitly
   * asks for it to be replaced.
   */
  redactions: PdfRedaction[];
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

/* ── Redaction rasterisation contract ──────────────────────────────────────
   Destroying content means replacing the affected page with a picture of
   itself taken *after* the removed regions were painted out. Only a renderer
   can produce that picture, and the renderer is pdf.js — which needs a canvas,
   and so cannot live in the pdf-lib engine that runs under Node in the tests.

   The engine therefore states what it needs and takes the implementation as an
   argument. `pdfRender.ts` supplies the browser one.                        */

/** What the engine asks a rasteriser to produce. */
export interface PdfRasterRequest {
  /** The document as it stands after form values and flattening were applied. */
  bytes: Uint8Array;
  /** Redaction rectangles, grouped by 0-based page index. */
  redactionsByPage: Map<number, PdfWidgetRect[]>;
}

/** One page, rendered with its redacted regions painted out. */
export interface PdfRasterPage {
  pageIndex: number;
  /** PNG bytes. Lossless, because JPEG ringing around legal text is not acceptable. */
  png: Uint8Array;
  /**
   * The user-space box the image covers. This is the page's visible box (its
   * CropBox where one is set), not necessarily its MediaBox, because that is
   * what a renderer draws.
   */
  box: PdfWidgetRect;
}

/** A rasteriser's answer: the replaced pages, plus the document's surviving text. */
export interface PdfRasterResult {
  pages: PdfRasterPage[];
  /**
   * The whole document's text with every run touching a redaction dropped.
   *
   * The engine hands this back to the caller so the copy of the text held
   * outside the PDF — the search index the assistant reads from — can be
   * rewritten in the same breath. Redacting the file while leaving that copy
   * in place would remove the content from the page and leave it quotable.
   */
  text: string;
}

export type PdfRasterizer = (request: PdfRasterRequest) => Promise<PdfRasterResult>;
