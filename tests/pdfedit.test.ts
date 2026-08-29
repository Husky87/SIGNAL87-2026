/**
 * Exercises the PDF editing engine and overlay rules against real PDF bytes,
 * without a browser.
 *
 * The cases worth pinning down are the ones that fail quietly rather than
 * loudly: an overlay written against a document that has since lost pages, a
 * form that survives (or does not survive) a page reorder, and the two blocked
 * states — encrypted and XFA — which must be reported as themselves rather
 * than as a generic parse failure.
 */
import { PDFDocument, PDFName, PDFRawStream, PDFString, PDFRef, StandardFonts, degrees, rgb } from 'pdf-lib';
import zlib from 'node:zlib';
import { inspectPdf, applyOverlayToPdf, splitPdf, readPageCount } from '../src/lib/pdfEditEngine';
import {
  createIdentityOverlay,
  deletePage,
  duplicatePage,
  insertPagesFromSource,
  movePage,
  normalizeOverlay,
  parsePageRange,
  rotatePage,
  segmentsFromBreaks,
  setFlattenOnExport,
  setFormValue,
  hasPendingEdits,
  missingSourceIds
} from '../src/lib/pdfEditOverlay';
import {
  addRedaction,
  addRedactions,
  clearAllRedactions,
  clearRedactionsOnPage,
  normalizeRedactions,
  paddedRedactionsByPage,
  redactedPageIndices,
  removeRedaction
} from '../src/lib/pdfRedaction';
import { PdfEditSourceMeta, PdfRasterizer } from '../src/lib/pdfEditTypes';

const results: string[] = [];
let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS  ' : 'FAIL  '}${name}${ok ? '' : '\n        -> ' + detail}`);
}

/** Five pages, a field of every editable kind, and one pre-rotated page. */
async function buildFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const form = doc.getForm();
  for (let i = 0; i < 5; i++) {
    const page = doc.addPage([400, 600]);
    page.drawText(`MAIN ${i + 1}`, { x: 40, y: 550, size: 24, font, color: rgb(0, 0, 0) });
  }
  const pages = doc.getPages();
  pages[3].setRotation(degrees(90));

  const name = form.createTextField('applicant.name');
  name.setText('original');
  name.addToPage(pages[0], { x: 40, y: 400, width: 200, height: 24 });
  const agree = form.createCheckBox('agree');
  agree.addToPage(pages[0], { x: 40, y: 350, width: 16, height: 16 });
  const state = form.createDropdown('state');
  state.addOptions(['NY', 'CA', 'TX']);
  state.addToPage(pages[2], { x: 40, y: 300, width: 120, height: 24 });
  const tier = form.createRadioGroup('tier');
  tier.addOptionToPage('gold', pages[2], { x: 40, y: 250, width: 16, height: 16 });
  tier.addOptionToPage('silver', pages[2], { x: 80, y: 250, width: 16, height: 16 });
  const langs = form.createOptionList('langs');
  langs.addOptions(['en', 'fr', 'de']);
  langs.addToPage(pages[1], { x: 40, y: 200, width: 120, height: 60 });

  return doc.save();
}

async function buildPlainPdf(pageCount: number, label: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([400, 600]);
    page.drawText(`${label} ${i + 1}`, { x: 40, y: 500, size: 20, font, color: rgb(0.6, 0, 0) });
  }
  return doc.save();
}

/* ── Redaction ───────────────────────────────────────────────────────────
   The one claim in this feature that is worth proving rather than trusting is
   that redacted content is *gone*. Everything else about redaction — the
   rectangles, the counts, the UI — is cosmetic if the string is still sitting
   in the file, and the failure is invisible: the page looks right, and the
   text comes back out of any PDF library a reader points at it.

   So these checks read the exported bytes rather than the exported document.
   Content streams are deflated, so every stream is inflated before it is
   searched, and both the literal form and the hex form of the string are
   looked for, because pdf-lib writes text drawn with a standard font as a hex
   string rather than as characters.                                        */

/** A 1×1 opaque PNG, standing in for a rendered page. */
const STUB_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Stands in for the browser renderer.
 *
 * The engine is deliberately given the renderer rather than reaching for one,
 * precisely so this can run: pdf.js needs a canvas, and the property being
 * tested is a property of the bytes, not of the pixels.
 */
function stubRasterizer(pageSize: { width: number; height: number }): PdfRasterizer {
  return async ({ redactionsByPage }) => ({
    pages: [...redactionsByPage.keys()].map((pageIndex) => ({
      pageIndex,
      png: new Uint8Array(STUB_PNG),
      box: { x: 0, y: 0, width: pageSize.width, height: pageSize.height }
    })),
    text: 'SURVIVING TEXT'
  });
}

/** Every object in the file whose bytes contain the needle, in any encoding. */
async function streamsContaining(bytes: Uint8Array, needle: string): Promise<string[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const hex = Buffer.from(needle, 'latin1').toString('hex').toUpperCase();
  const hits: string[] = [];
  for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    let contents = Buffer.from(object.contents);
    try {
      contents = zlib.inflateSync(contents);
    } catch {
      // Not deflated, or deflated with a filter chain this scan does not
      // unwrap. Searched as it stands rather than skipped.
    }
    const text = contents.toString('latin1');
    if (text.includes(needle) || text.toUpperCase().includes(hex)) hits.push(ref.toString());
  }
  return hits;
}

async function buildSecretPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const first = doc.addPage([400, 600]);
  first.drawText('CONFIDENTIAL-9E1F', { x: 40, y: 500, size: 18, font, color: rgb(0, 0, 0) });
  const second = doc.addPage([400, 600]);
  second.drawText('PUBLIC-RECORD', { x: 40, y: 500, size: 18, font, color: rgb(0, 0, 0) });
  // An object nothing points at. Real documents accumulate these — a revision
  // history, an orphaned appearance stream — and they are exactly what a
  // redaction that merely unlinks a page leaves the content sitting in.
  doc.context.register(
    PDFRawStream.of(doc.context.obj({}), new Uint8Array(Buffer.from('ORPHAN-TRACE-77', 'latin1')))
  );
  return doc.save();
}

async function runRedactionChecks() {
  const secret = await buildSecretPdf();
  const rasterizer = stubRasterizer({ width: 400, height: 600 });

  check('the fixture really does contain the string being redacted',
    (await streamsContaining(secret, 'CONFIDENTIAL-9E1F')).length > 0);

  let overlay = createIdentityOverlay('secret', 2);
  overlay = addRedaction(overlay, 0, { x: 30, y: 480, width: 260, height: 50 });
  check('a marked document reports pending edits', hasPendingEdits(overlay, 2));
  check('the marked page is the one reported', redactedPageIndices(overlay).join(',') === '0');

  const redacted = await applyOverlayToPdf(secret, overlay, new Map(), { rasterizer });

  // The whole point. Not "the text is covered" — the text is not in the file.
  check('the redacted string is absent from every stream in the exported file',
    (await streamsContaining(redacted.bytes, 'CONFIDENTIAL-9E1F')).length === 0,
    (await streamsContaining(redacted.bytes, 'CONFIDENTIAL-9E1F')).join(','));
  check('an unmarked page keeps its text',
    (await streamsContaining(redacted.bytes, 'PUBLIC-RECORD')).length > 0);
  check('redaction does not change the page count',
    (await PDFDocument.load(redacted.bytes)).getPageCount() === 2);
  check('the export reports how many pages it replaced', redacted.pagesRedacted === 1);
  check('the export hands back the text to re-index with', redacted.redactedText === 'SURVIVING TEXT');

  // Unlinking the page's content without sweeping the file is the failure this
  // whole design exists to avoid, and it is invisible from the rendered page.
  // The unreachable object planted in the fixture makes the sweep observable
  // on its own, rather than only through the string it is there to remove.
  const untouched = await applyOverlayToPdf(secret, createIdentityOverlay('secret', 2), new Map());
  check('an ordinary export leaves unreachable objects where they are',
    (await streamsContaining(untouched.bytes, 'ORPHAN-TRACE-77')).length > 0);
  check('redacting sweeps unreachable objects out of the file',
    (await streamsContaining(redacted.bytes, 'ORPHAN-TRACE-77')).length === 0);

  /* A duplicate of a redacted page must be redacted too — the redaction is
     applied before the page plan is resolved, so the copy is a copy of the
     replaced page rather than of the original. */
  let duplicated = createIdentityOverlay('secret', 2);
  duplicated = addRedaction(duplicated, 0, { x: 30, y: 480, width: 260, height: 50 });
  duplicated = duplicatePage(duplicated, duplicated.pages[0].id, 2);
  const withDuplicate = await applyOverlayToPdf(secret, duplicated, new Map(), { rasterizer });
  check('duplicating a redacted page does not resurrect its content',
    (await streamsContaining(withDuplicate.bytes, 'CONFIDENTIAL-9E1F')).length === 0);
  check('the duplicate is still produced',
    (await PDFDocument.load(withDuplicate.bytes)).getPageCount() === 3);

  /* Deleting a page has always unlinked it from the page tree; the sweep is
     what makes it actually leave the file. */
  let deleted = createIdentityOverlay('secret', 2);
  deleted = deletePage(deleted, deleted.pages[0].id, 2);
  const withoutFirst = await applyOverlayToPdf(secret, deleted, new Map());
  check('a deleted page takes its content out of the file too',
    (await streamsContaining(withoutFirst.bytes, 'CONFIDENTIAL-9E1F')).length === 0);

  /* Refusing is the right answer when the removal cannot be carried out. An
     export that quietly skipped the redaction would be the worst outcome
     available: a file the user believes is redacted and is not. */
  let refused = '';
  try {
    await applyOverlayToPdf(secret, overlay, new Map());
  } catch (error) {
    refused = error instanceof Error ? error.message : String(error);
  }
  check('exporting without a renderer refuses rather than dropping the redaction',
    refused.includes('renderer'), refused);

  /* A renderer that comes back short must stop the export. The page would
     otherwise be exported unredacted while every other page was redacted, and
     nothing on screen would say which one. */
  const shortRasterizer: PdfRasterizer = async () => ({ pages: [], text: '' });
  let shortMessage = '';
  try {
    await applyOverlayToPdf(secret, overlay, new Map(), { rasterizer: shortRasterizer });
  } catch (error) {
    shortMessage = error instanceof Error ? error.message : String(error);
  }
  check('a renderer that skips a marked page fails the export by page number',
    shortMessage.includes('Page 1') && shortMessage.includes('not removed'), shortMessage);

  /* Split carries redactions into every segment. */
  const splitParts = await splitPdf(secret, overlay, new Map(), segmentsFromBreaks([0], 2), { rasterizer });
  check('split produces a file per segment when redacting', splitParts.length === 2);
  let leakedInSplit = 0;
  for (const part of splitParts) {
    leakedInSplit += (await streamsContaining(part.bytes, 'CONFIDENTIAL-9E1F')).length;
  }
  check('no split segment carries the redacted content', leakedInSplit === 0);

  /* A form field on a redacted page has to be flattened away, or its value
     survives as a free-floating annotation on a page that is now a picture. */
  const formDoc = await PDFDocument.create();
  const formFont = await formDoc.embedFont(StandardFonts.Helvetica);
  const formPage = formDoc.addPage([400, 600]);
  formPage.drawText('HEADER', { x: 40, y: 560, size: 14, font: formFont });
  const ssn = formDoc.getForm().createTextField('ssn');
  ssn.setText('SSN-4417-XX');
  ssn.addToPage(formPage, { x: 40, y: 400, width: 200, height: 24 });
  const formBytes = await formDoc.save();
  check('the form fixture really does hold the value being redacted',
    (await streamsContaining(formBytes, 'SSN-4417-XX')).length > 0 ||
      Buffer.from(formBytes).includes('SSN-4417-XX'));

  let formOverlay = createIdentityOverlay('form', 1);
  formOverlay = addRedaction(formOverlay, 0, { x: 30, y: 390, width: 230, height: 44 });
  const redactedForm = await applyOverlayToPdf(formBytes, formOverlay, new Map(), { rasterizer });
  const redactedFormDoc = await PDFDocument.load(redactedForm.bytes);
  check('a field on a redacted page is flattened away',
    redactedFormDoc.getForm().getFields().length === 0,
    redactedFormDoc.getForm().getFields().map((f) => f.getName()).join(','));
  check('the field value does not survive the redaction',
    (await streamsContaining(redactedForm.bytes, 'SSN-4417-XX')).length === 0 &&
      !Buffer.from(redactedForm.bytes).includes('SSN-4417-XX'));

  /* ── The pure rules ──────────────────────────────────────────────── */
  let rules = createIdentityOverlay('r', 3);
  rules = addRedaction(rules, 1, { x: 10, y: 10, width: 50, height: 20 });
  check('a mark lands on the page it was made on', rules.redactions[0].pageIndex === 1);

  const dragged = addRedaction(rules, 2, { x: 60, y: 60, width: -40, height: -20 });
  check('a rectangle dragged up and to the left is stored the right way round',
    dragged.redactions[1].rect.x === 20 && dragged.redactions[1].rect.y === 40 &&
      dragged.redactions[1].rect.width === 40 && dragged.redactions[1].rect.height === 20,
    JSON.stringify(dragged.redactions[1].rect));

  check('a stray click is not a redaction',
    addRedaction(rules, 0, { x: 5, y: 5, width: 1, height: 1 }) === rules);

  const searched = addRedactions(rules, [
    { pageIndex: 0, rect: { x: 1, y: 1, width: 30, height: 10 } },
    { pageIndex: 0, rect: { x: 1, y: 1, width: 30, height: 10 } }
  ]);
  check('searching twice for the same term does not stack marks',
    searched.redactions.length === rules.redactions.length + 1,
    `${searched.redactions.length} vs ${rules.redactions.length + 1}`);

  check('a mark can be removed', removeRedaction(rules, rules.redactions[0].id).redactions.length === 0);
  check('a page can be cleared', clearRedactionsOnPage(rules, 1).redactions.length === 0);
  check('every mark can be cleared', clearAllRedactions(searched).redactions.length === 0);

  const padded = paddedRedactionsByPage(rules).get(1);
  check('marks are grown before they are painted out, never shrunk',
    !!padded && padded[0].width > rules.redactions[0].rect.width &&
      padded[0].height > rules.redactions[0].rect.height);
  check('the mark the user sees is the one they drew',
    rules.redactions[0].rect.width === 50 && rules.redactions[0].rect.height === 20);

  /* Stored marks are read back against the document in hand: one naming a page
     the document no longer has cannot be applied, and keeping it would mean an
     export that redacts nothing while the count says otherwise. */
  const stored = [
    { id: 'a', pageIndex: 0, rect: { x: 1, y: 1, width: 10, height: 10 }, origin: 'manual' },
    { id: 'b', pageIndex: 9, rect: { x: 1, y: 1, width: 10, height: 10 }, origin: 'search' },
    { id: 'c', pageIndex: 1, rect: { x: 1, y: 1, width: 0, height: 0 }, origin: 'manual' },
    { id: 'd', pageIndex: 1, rect: 'not a rectangle', origin: 'manual' },
    { id: 'a', pageIndex: 1, rect: { x: 2, y: 2, width: 10, height: 10 }, origin: 'manual' }
  ];
  const read = normalizeRedactions(stored, 3);
  check('a mark on a page the document no longer has is dropped', read.every((r) => r.pageIndex < 3));
  check('a malformed stored mark is dropped', read.length === 2, JSON.stringify(read));
  check('a duplicated stored id is resolved rather than carried forward',
    read[0].id !== read[1].id);
  check('marks from garbage read back as none', normalizeRedactions('nope', 3).length === 0);

  const roundTripped = normalizeOverlay(
    JSON.parse(JSON.stringify(addRedaction(createIdentityOverlay('rt', 2), 0, { x: 5, y: 5, width: 40, height: 12 }))),
    'rt',
    2
  );
  check('a mark survives a round trip through storage', roundTripped.redactions.length === 1);
  check('an overlay with only a mark still counts as pending', hasPendingEdits(roundTripped, 2));
}

async function run() {
  const main = await buildFormPdf();
  const exhibit = await buildPlainPdf(3, 'EXHIBIT');
  const N = 5;

  /* ── Inspection ──────────────────────────────────────────────────── */
  const inspected = await inspectPdf(main);
  check('a form PDF inspects successfully', inspected.ok === true);
  if (inspected.ok === true) {
    const { inspection } = inspected;
    check('every page is reported', inspection.pageCount === 5, `got ${inspection.pageCount}`);
    check("a page's own rotation is read", inspection.pageSizes[3].rotation === 90, `got ${inspection.pageSizes[3].rotation}`);
    check('every field is found', inspection.fields.length === 5,
      inspection.fields.map((f) => f.name).join(','));
    check('field kinds are classified',
      inspection.fields.map((f) => f.kind).sort().join(',') === 'checkbox,dropdown,optionlist,radio,text',
      inspection.fields.map((f) => `${f.name}:${f.kind}`).join(' '));
    check('widgets are located on the right pages',
      inspection.fields.every((f) => f.widgets.every((w) => w.pageIndex >= 0 && w.pageIndex < 5)),
      JSON.stringify(inspection.fields.map((f) => f.widgets.map((w) => w.pageIndex))));
    const radio = inspection.fields.find((f) => f.name === 'tier');
    check('a radio group reports one widget per option',
      !!radio && radio.widgets.length === radio.options.length,
      `${radio?.widgets.length} widgets vs ${radio?.options.length} options`);
  }

  /* ── Blocked states ──────────────────────────────────────────────── */
  {
    const doc = await PDFDocument.create();
    doc.addPage([300, 300]);
    // getForm() strips /XFA, so the dictionary is built by hand and appearance
    // updates are skipped on save for the same reason.
    const acro = doc.context.obj({ Fields: [], XFA: [PDFString.of('xdp:xdp')] });
    doc.catalog.set(PDFName.of('AcroForm'), doc.context.register(acro));
    const bytes = await doc.save({ updateFieldAppearances: false });
    const result = await inspectPdf(bytes);
    check('an XFA form is reported as unsupported, not as an empty form',
      result.ok === false && result.blocker.kind === 'xfa',
      JSON.stringify(result.ok === false ? result.blocker : 'not blocked'));
  }
  {
    const doc = await PDFDocument.create();
    doc.addPage([300, 300]);
    const encrypt = doc.context.obj({
      Filter: PDFName.of('Standard'), V: 1, R: 2,
      O: PDFString.of('x'.repeat(32)), U: PDFString.of('y'.repeat(32)), P: -1
    });
    const ref: PDFRef = doc.context.register(encrypt);
    doc.context.trailerInfo.Encrypt = ref;
    const bytes = await doc.save({ updateFieldAppearances: false });
    const result = await inspectPdf(bytes);
    // pdf-lib is compiled with tslib __extends, which breaks instanceof for its
    // Error subclasses; detection must not rest on instanceof alone.
    check('an encrypted PDF is reported as encrypted, not as corrupt',
      result.ok === false && result.blocker.kind === 'encrypted',
      JSON.stringify(result.ok === false ? result.blocker : 'not blocked'));
  }
  {
    const result = await inspectPdf(new Uint8Array([1, 2, 3, 4]));
    check('non-PDF bytes are reported as corrupt',
      result.ok === false && result.blocker.kind === 'corrupt');
  }

  /* ── Export ──────────────────────────────────────────────────────── */
  let overlay = createIdentityOverlay('doc1', N);
  check('a fresh overlay reports no pending edits', !hasPendingEdits(overlay, N));

  overlay = movePage(overlay, 0, 4, N);
  overlay = rotatePage(overlay, overlay.pages[0].id, 90, N);
  overlay = duplicatePage(overlay, overlay.pages[1].id, N);
  const source: PdfEditSourceMeta = {
    id: 'src_a', fileName: 'exhibit.pdf', pageCount: 3,
    sizeBytes: exhibit.byteLength, addedAt: new Date().toISOString()
  };
  overlay = insertPagesFromSource(overlay, source, [0, 2], 2, N);
  overlay = deletePage(overlay, overlay.pages[overlay.pages.length - 1].id, N);
  overlay = setFormValue(overlay, 'applicant.name', { kind: 'text', value: 'Jane Q. Public' });
  overlay = setFormValue(overlay, 'agree', { kind: 'checkbox', value: true });
  overlay = setFormValue(overlay, 'state', { kind: 'dropdown', value: 'CA' });
  overlay = setFormValue(overlay, 'tier', { kind: 'radio', value: 'silver' });
  overlay = setFormValue(overlay, 'langs', { kind: 'optionlist', value: ['fr', 'de'] });
  // A field that no longer exists must not take the whole export down with it.
  overlay = setFormValue(overlay, 'field.that.was.removed', { kind: 'text', value: 'x' });

  check('the overlay now reports pending edits', hasPendingEdits(overlay, N));

  const sources = new Map([['src_a', exhibit]]);
  const exported = await applyOverlayToPdf(main, overlay, sources);
  const reloaded = await PDFDocument.load(exported.bytes);
  check('an export with no redaction reports no scrubbed text', exported.redactedText === null);

  check('the export has the planned page count',
    reloaded.getPageCount() === overlay.pages.length,
    `${reloaded.getPageCount()} vs ${overlay.pages.length}`);
  check('reordering and inserting leave the form interactive',
    reloaded.getForm().getFields().length === 5,
    reloaded.getForm().getFields().map((f) => f.getName()).join(','));
  check('text reaches the exported bytes',
    reloaded.getForm().getTextField('applicant.name').getText() === 'Jane Q. Public');
  check('a checkbox reaches the exported bytes', reloaded.getForm().getCheckBox('agree').isChecked());
  check('a dropdown reaches the exported bytes',
    reloaded.getForm().getDropdown('state').getSelected().join(',') === 'CA');
  check('a radio choice reaches the exported bytes',
    reloaded.getForm().getRadioGroup('tier').getSelected() === 'silver');
  check('an option list reaches the exported bytes',
    reloaded.getForm().getOptionList('langs').getSelected().join(',') === 'fr,de');
  check('a rotation reaches the exported bytes',
    reloaded.getPages().some((p) => p.getRotation().angle !== 0),
    reloaded.getPages().map((p) => p.getRotation().angle).join(','));

  /* ── Flatten ─────────────────────────────────────────────────────── */
  const flattened = await PDFDocument.load(
    (await applyOverlayToPdf(main, setFlattenOnExport(overlay, true), sources)).bytes
  );
  check('flattening removes every field', flattened.getForm().getFields().length === 0);
  check('flattening keeps the page count', flattened.getPageCount() === overlay.pages.length);

  /* ── Missing inserted source ─────────────────────────────────────── */
  check('a source missing from the device is detected',
    missingSourceIds(overlay, []).join(',') === 'src_a');
  let missingSourceMessage = '';
  try {
    await applyOverlayToPdf(main, overlay, new Map());
  } catch (error) {
    missingSourceMessage = error instanceof Error ? error.message : String(error);
  }
  check('exporting without an inserted source fails by name rather than silently dropping pages',
    missingSourceMessage.includes('exhibit.pdf'), missingSourceMessage);

  /* ── Split ───────────────────────────────────────────────────────── */
  const segments = segmentsFromBreaks([1, 4], overlay.pages.length);
  const parts = await splitPdf(main, overlay, sources, segments);
  check('split produces one file per segment', parts.length === segments.length);
  const partCounts: number[] = [];
  for (const part of parts) partCounts.push((await PDFDocument.load(part.bytes)).getPageCount());
  const expectedCounts = segments.map((s) => s.end - s.start + 1);
  check('each split file has its segment\'s pages',
    partCounts.join(',') === expectedCounts.join(','),
    `got ${partCounts.join(',')} expected ${expectedCounts.join(',')}`);
  check('the split files account for every page',
    partCounts.reduce((a, b) => a + b, 0) === overlay.pages.length);

  /* ── Stored overlay read back against a changed document ─────────── */
  const stale = normalizeOverlay(JSON.parse(JSON.stringify(overlay)), 'doc1', 2);
  check('a plan referencing pages the document no longer has is clamped',
    stale.pages.filter((p) => p.sourceId === 'original').every((p) => p.sourceIndex < 2),
    JSON.stringify(stale.pages.map((p) => `${p.sourceId}:${p.sourceIndex}`)));
  const staleExport = await PDFDocument.load(
    (await applyOverlayToPdf(await buildPlainPdf(2, 'SHRUNK'), stale, sources)).bytes
  );
  check('a clamped plan still exports', staleExport.getPageCount() === stale.pages.length,
    `${staleExport.getPageCount()} vs ${stale.pages.length}`);

  check('garbage from storage falls back to the identity plan',
    normalizeOverlay({ pages: 'nope' }, 'doc1', N).pages.length === N);
  check('a null stored overlay falls back to the identity plan',
    normalizeOverlay(null, 'doc1', N).pages.length === N);

  /* ── Misc ────────────────────────────────────────────────────────── */
  check('page ranges parse the way people write them',
    parsePageRange('1-3, 7, 9-12', 10).join(',') === '0,1,2,6,8,9',
    parsePageRange('1-3, 7, 9-12', 10).join(','));
  check('a reversed range still selects those pages',
    parsePageRange('3-1', 10).join(',') === '0,1,2');
  const counted = await readPageCount(exhibit);
  check('an inserted PDF reports its page count', counted.ok === true && counted.pageCount === 3);

  const single = createIdentityOverlay('d', 1);
  check('the last page cannot be deleted', deletePage(single, single.pages[0].id, 1) === single);

  await runRedactionChecks();

  console.log(results.join('\n'));
  console.log(failures === 0 ? `\npdf editing: all ${results.length} checks passed` : `\npdf editing: ${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((error) => {
  console.error('harness error:', error);
  process.exit(1);
});
