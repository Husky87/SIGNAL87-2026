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
import { PDFDocument, PDFName, PDFString, PDFRef, StandardFonts, degrees, rgb } from 'pdf-lib';
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
import { PdfEditSourceMeta } from '../src/lib/pdfEditTypes';

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
  const reloaded = await PDFDocument.load(exported);

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
  const flattened = await PDFDocument.load(await applyOverlayToPdf(main, setFlattenOnExport(overlay, true), sources));
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
    await applyOverlayToPdf(await buildPlainPdf(2, 'SHRUNK'), stale, sources)
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

  console.log(results.join('\n'));
  console.log(failures === 0 ? `\npdf editing: all ${results.length} checks passed` : `\npdf editing: ${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((error) => {
  console.error('harness error:', error);
  process.exit(1);
});
