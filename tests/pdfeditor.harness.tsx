/**
 * Mounts the real PdfEditorModal over a PDF built in the browser.
 *
 * The document's bytes are planted in fileDataCache, which is exactly where
 * the upload flow puts them, so the editor takes its ordinary path rather than
 * a test-only one. Nothing is signed in, so the Firestore accessors return
 * early — which is itself worth exercising: the editor has to work for a
 * signed-out user rather than hanging on a read that never resolves.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { PdfEditorModal } from '../src/components/PdfEditorModal';
import { fileDataCache } from '../src/lib/pdfGenerator';
import { DocumentItem } from '../src/types';
import '../src/index.css';

const DOC_ID = 'doc_harness_pdf';

async function buildFixture(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const form = doc.getForm();

  for (let i = 0; i < 4; i++) {
    const page = doc.addPage([420, 560]);
    page.drawText(`PAGE ${i + 1}`, { x: 40, y: 500, size: 26, font, color: rgb(0.1, 0.1, 0.1) });
  }
  const pages = doc.getPages();
  // A page that already carries a rotation, so the additive-rotation path is
  // covered rather than only the 0-degree case.
  pages[2].setRotation(degrees(90));

  const name = form.createTextField('applicant.name');
  name.setText('');
  name.addToPage(pages[0], { x: 40, y: 400, width: 220, height: 26 });

  const agree = form.createCheckBox('agree');
  agree.addToPage(pages[0], { x: 40, y: 350, width: 18, height: 18 });

  const state = form.createDropdown('state');
  state.addOptions(['NY', 'CA', 'TX']);
  state.addToPage(pages[1], { x: 40, y: 300, width: 130, height: 26 });

  const tier = form.createRadioGroup('tier');
  tier.addOptionToPage('gold', pages[1], { x: 40, y: 250, width: 18, height: 18 });
  tier.addOptionToPage('silver', pages[1], { x: 90, y: 250, width: 18, height: 18 });

  const saved = await doc.save();
  // save() returns a view onto a larger buffer; slice it to exact bytes.
  return saved.slice().buffer;
}

const testDocument: DocumentItem = {
  id: DOC_ID,
  title: 'Harness Agreement.pdf',
  type: 'pdf',
  sizeBytes: 1024,
  uploadDate: new Date().toISOString(),
  tags: [],
  owner: 'harness@signal87.ai',
  organization: 'Signal87',
  status: 'ready',
  aiIndexed: true,
  embeddingsComplete: true,
  versionHistory: [],
  permissions: 'Private',
  category: 'Legal'
};

function Harness() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    buildFixture().then((bytes) => {
      if (cancelled) return;
      fileDataCache.set(DOC_ID, bytes);
      setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) return <div data-testid="harness-loading">building fixture…</div>;
  return (
    <div className="s87-app">
      <PdfEditorModal document={testDocument} onClose={() => setOpen(false)} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
