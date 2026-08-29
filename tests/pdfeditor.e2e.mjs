/**
 * Drives the real PDF editor in a browser.
 *
 * Type-checking cannot tell whether a thumbnail actually rasterises, whether a
 * form input lands on top of the field it belongs to, or whether reordering
 * survives a round trip through pdf-lib. These checks run the component the
 * way a user does and assert on what ends up on screen.
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import zlib from 'node:zlib';

const PORT = 5183;
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const results = [];
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  results.push(`${ok ? 'PASS  ' : 'FAIL  '}${name}${ok ? '' : '\n        -> ' + detail}`);
};

const vite = await createServer({ server: { port: PORT }, logLevel: 'error' });
await vite.listen();

let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });
  const failedRequests = [];
  page.on('requestfailed', (request) => failedRequests.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`http://localhost:${PORT}/tests/pdfeditor.harness.html`, { waitUntil: 'load' });

  // ── Opening ────────────────────────────────────────────────────────────
  await page.waitForSelector('text=Edit · Harness Agreement.pdf', { timeout: 60000 });
  check('the editor opens on a PDF held only in the byte cache', true);

  const thumbs = page.locator('img[alt^="Page "]');
  await thumbs.first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(900);
  check('every page rasterises a thumbnail', (await thumbs.count()) === 4, `got ${await thumbs.count()}`);

  const headerCount = await page.locator('text=/^4 pages$/').count();
  check('the header reports the page count', headerCount === 1);

  // ── Reorder ────────────────────────────────────────────────────────────
  const labelsBefore = await page.locator('div.w-\\[168px\\] span.truncate').allTextContents();
  await page.locator('button[aria-label="Move page 1 later"]').click();
  await page.waitForTimeout(500);
  const labelsAfter = await page.locator('div.w-\\[168px\\] span.truncate').allTextContents();
  check(
    'moving a page later reorders the grid',
    labelsBefore.join('|') !== labelsAfter.join('|'),
    `before ${JSON.stringify(labelsBefore)} after ${JSON.stringify(labelsAfter)}`
  );
  check(
    'a moved page still shows which page it is',
    labelsAfter.some((label) => label.includes('p.1')),
    JSON.stringify(labelsAfter)
  );

  // ── Rotate ─────────────────────────────────────────────────────────────
  await page.locator('button[aria-label="Rotate page 1"]').click();
  await page.waitForTimeout(700);
  const rotatedLabel = (await page.locator('div.w-\\[168px\\] span.truncate').first().textContent()) || '';
  check('rotating a page records the angle on its tile', rotatedLabel.includes('90°'), `label was "${rotatedLabel}"`);

  // ── Duplicate and delete ───────────────────────────────────────────────
  await page.locator('button[aria-label="Duplicate page 1"]').click();
  await page.waitForTimeout(600);
  check('duplicating adds a page', (await page.locator('div.w-\\[168px\\]').count()) === 5,
    `got ${await page.locator('div.w-\\[168px\\]').count()}`);

  await page.locator('button[aria-label="Delete page 2"]').click();
  await page.waitForTimeout(600);
  check('deleting removes a page', (await page.locator('div.w-\\[168px\\]').count()) === 4,
    `got ${await page.locator('div.w-\\[168px\\]').count()}`);

  // ── Split points ───────────────────────────────────────────────────────
  await page.locator('button[aria-label="Toggle split after page 1"]').click();
  await page.waitForTimeout(250);
  check('a split point can be marked', await page.locator('button[aria-label="Toggle split after page 1"]').getAttribute('aria-pressed') === 'true');

  // ── Form filling ───────────────────────────────────────────────────────
  await page.locator('button:has-text("Form")').click();
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(1200);

  const nameInput = page.locator('input[aria-label="applicant.name"]');
  check('a text field is rendered over the page', (await nameInput.count()) === 1);

  // The input must sit on top of the rendered page, not beside it.
  const box = await nameInput.boundingBox();
  const canvasBox = await page.locator('canvas').boundingBox();
  const inside =
    box && canvasBox &&
    box.x >= canvasBox.x - 2 && box.y >= canvasBox.y - 2 &&
    box.x + box.width <= canvasBox.x + canvasBox.width + 2 &&
    box.y + box.height <= canvasBox.y + canvasBox.height + 2;
  check('the field is positioned within the page canvas', !!inside,
    `field ${JSON.stringify(box)} canvas ${JSON.stringify(canvasBox)}`);

  await nameInput.fill('Jane Q. Public');
  await page.waitForTimeout(200);
  check('typing into a field is retained', (await nameInput.inputValue()) === 'Jane Q. Public');

  const checkbox = page.locator('input[aria-label="agree"]');
  await checkbox.check();
  check('a checkbox can be ticked', await checkbox.isChecked());

  // Page 2 of the fixture carries the dropdown and the radio group.
  await page.locator('button[aria-label="Next page"]').click();
  await page.waitForTimeout(1200);
  check('the dropdown renders on its own page', (await page.locator('select[aria-label="state"]').count()) === 1);
  const radios = page.locator('input[type="radio"]');
  check('both radio buttons render', (await radios.count()) === 2, `got ${await radios.count()}`);
  await radios.nth(1).check();
  check('a radio option can be selected', await radios.nth(1).isChecked());

  // ── Export dialog ──────────────────────────────────────────────────────
  await page.locator('button:has-text("Export")').first().click();
  await page.waitForTimeout(400);
  check('the export dialog offers a flatten choice', (await page.locator('text=Flatten the form').count()) === 1);
  check('the export dialog offers the split it was told about',
    (await page.locator('button:has-text("Split into 2 files")').count()) === 1);

  // ── Actually export, and confirm real bytes come out ───────────────────
  const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  await page.locator('button:has-text("Export one PDF")').click();
  const download = await downloadPromise;

  check('exporting produces a downloaded file', !!download, 'no download event fired');
  if (download) {
    check(
      'the exported file is named after the document',
      download.suggestedFilename() === 'Harness Agreement-edited.pdf',
      download.suggestedFilename()
    );
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const bytes = Buffer.concat(chunks);
    check('the exported file is a real PDF', bytes.subarray(0, 5).toString() === '%PDF-', bytes.subarray(0, 8).toString());
    check('the exported file is not empty', bytes.length > 500, `${bytes.length} bytes`);

    // Close the loop: the clicks above must show up in the bytes, not just on
    // screen. The grid ended on 4 pages after a move, a rotate, a duplicate
    // and a delete, and three fields were filled in.
    const exported = await PDFDocument.load(new Uint8Array(bytes));
    check('the exported PDF has the edited page count', exported.getPageCount() === 4,
      `got ${exported.getPageCount()}`);

    const exportedForm = exported.getForm();
    check('the exported PDF kept its form interactive',
      exportedForm.getFields().length === 4,
      `fields: ${exportedForm.getFields().map((f) => f.getName()).join(',')}`);
    check('the typed text reached the exported bytes',
      exportedForm.getTextField('applicant.name').getText() === 'Jane Q. Public',
      JSON.stringify(exportedForm.getTextField('applicant.name').getText()));
    check('the ticked checkbox reached the exported bytes',
      exportedForm.getCheckBox('agree').isChecked());
    check('the selected radio option reached the exported bytes',
      exportedForm.getRadioGroup('tier').getSelected() === 'silver',
      String(exportedForm.getRadioGroup('tier').getSelected()));
    check('a rotation reached the exported bytes',
      exported.getPages().some((p) => p.getRotation().angle !== 0),
      exported.getPages().map((p) => p.getRotation().angle).join(','));
  }

  // ── Redaction ──────────────────────────────────────────────────────────
  // A fresh load, because the checks above left the document reordered and the
  // question here is about a document as it stands.
  await page.goto(`http://localhost:${PORT}/tests/pdfeditor.harness.html`, { waitUntil: 'load' });
  await page.waitForSelector('text=Edit · Harness Agreement.pdf', { timeout: 60000 });

  await page.locator('button:has-text("Redact")').first().click();
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(1500);

  check('the redact tab says what redaction does to the file',
    (await page.locator('text=Marked regions are destroyed, not covered.').count()) === 1);

  await page.locator('input[aria-label="Text to find and redact"]').fill('PRIVILEGED-4417');
  await page.locator('button:has-text("Mark every match")').click();
  await page.waitForTimeout(2500);

  const matchReport = (await page.locator('text=/occurrence(s)? of/').first().textContent()) || '';
  check('searching the text layer finds the term', matchReport.includes('occurrence'), matchReport);
  check('the marked count reaches the tab',
    (await page.locator('button:has-text("Redact") span.tabular-nums').count()) > 0);

  // The mark must land on the words, not somewhere else on the page.
  const markBox = await page.locator('button[aria-label="Remove this mark"]').first().evaluate((node) => {
    const mark = node.parentElement;
    const rect = mark.getBoundingClientRect();
    const canvasRect = mark.parentElement.querySelector('canvas').getBoundingClientRect();
    return {
      left: rect.left - canvasRect.left,
      top: rect.top - canvasRect.top,
      width: rect.width,
      height: rect.height,
      canvasWidth: canvasRect.width,
      canvasHeight: canvasRect.height
    };
  });
  check('the mark sits inside the page it was made on',
    markBox.left >= -4 && markBox.top >= -4 &&
      markBox.left + markBox.width <= markBox.canvasWidth + 4 &&
      markBox.top + markBox.height <= markBox.canvasHeight + 4,
    JSON.stringify(markBox));
  check('the mark is roughly the size of the words it covers',
    markBox.width > 40 && markBox.width < markBox.canvasWidth * 0.9 &&
      markBox.height > 6 && markBox.height < markBox.canvasHeight * 0.2,
    JSON.stringify(markBox));

  // ── The exported bytes ─────────────────────────────────────────────────
  await page.locator('button:has-text("Export")').first().click();
  await page.waitForTimeout(400);
  check('the export dialog says the marks will be destroyed',
    (await page.locator('text=/will be destroyed in the exported file/').count()) === 1);

  const redactedDownload = page.waitForEvent('download', { timeout: 90000 }).catch(() => null);
  await page.locator('button:has-text("Export one PDF")').click();
  const redactedFile = await redactedDownload;
  check('a redacted export downloads', !!redactedFile, 'no download event fired');

  if (redactedFile) {
    const stream = await redactedFile.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const bytes = Buffer.concat(chunks);

    // Read the file the way anyone trying to recover the text would: inflate
    // every stream and look for the string, in both the forms a PDF writer
    // uses. This is the claim the whole feature rests on.
    const doc = await PDFDocument.load(new Uint8Array(bytes), { updateMetadata: false });
    const contains = (needle) => {
      const hex = Buffer.from(needle, 'latin1').toString('hex').toUpperCase();
      for (const [, object] of doc.context.enumerateIndirectObjects()) {
        if (!(object instanceof PDFRawStream)) continue;
        let contents = Buffer.from(object.contents);
        try {
          contents = zlib.inflateSync(contents);
        } catch {
          // Not deflated; searched as it stands.
        }
        const text = contents.toString('latin1');
        if (text.includes(needle) || text.toUpperCase().includes(hex)) return true;
      }
      return false;
    };

    check('the redacted string is not recoverable from the exported file',
      !contains('PRIVILEGED-4417'));
    check('text on an unmarked page is untouched', contains('EXHIBIT-4418'));
    check('the redacted export is a real PDF with every page',
      doc.getPageCount() === 4, `got ${doc.getPageCount()}`);
    // A redacted page is a picture and nothing else: one image, and no fonts,
    // because the resources it drew its text from went with the text.
    const resourcesOf = (index) => doc.getPages()[index].node.Resources();
    const countIn = (resources, key) => {
      const entry = resources?.lookupMaybe(PDFName.of(key), PDFDict);
      return entry ? entry.entries().length : 0;
    };
    check('the redacted page carries an image',
      countIn(resourcesOf(0), 'XObject') >= 1, String(countIn(resourcesOf(0), 'XObject')));
    check('the redacted page carries no fonts any more',
      countIn(resourcesOf(0), 'Font') === 0, String(countIn(resourcesOf(0), 'Font')));
    check('an unmarked page still carries its fonts',
      countIn(resourcesOf(3), 'Font') >= 1, String(countIn(resourcesOf(3), 'Font')));
  }

  // ── Replacing the stored document ──────────────────────────────────────
  await page.locator('button:has-text("Redact stored document")').click();
  await page.waitForTimeout(300);
  check('replacing the stored document asks for the word, not a click',
    await page.locator('button:has-text("Redact permanently")').isDisabled());
  check('the dialog says the stored file is overwritten',
    (await page.locator('text=/There is no unredacted copy left behind/').count()) === 1);

  await page.locator('#redact-confirm').fill('REDACT');
  await page.waitForTimeout(200);
  check('typing the word arms the action',
    !(await page.locator('button:has-text("Redact permanently")').isDisabled()));

  // Nobody is signed in here, so the upload must fail — and it must fail
  // visibly. A redaction that reports success without replacing the stored
  // file is the failure mode worth guarding.
  await page.locator('button:has-text("Redact permanently")').click();
  await page.waitForTimeout(4000);
  const successHeadings = await page.locator('h3:has-text("Redacted")').count();
  const errorNotices = await page.locator('text=/Not signed in/').count();
  check('a redaction that cannot be stored says so rather than reporting success',
    successHeadings === 0 && errorNotices > 0,
    `success headings ${successHeadings}, error notices ${errorNotices}`);

  check('no uncaught page errors', pageErrors.length === 0,
    `${pageErrors.join(' | ')} :: requests ${JSON.stringify(failedRequests)}`);
} finally {
  await browser?.close();
  await vite.close();
}

console.log(results.join('\n'));
console.log(failed === 0 ? `\npdf editor: all ${results.length} checks passed` : `\npdf editor: ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
