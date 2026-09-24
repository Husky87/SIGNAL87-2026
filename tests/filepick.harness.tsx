/** Mounts the real Files page in "choose files to ask about" mode and records what it reports. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { DocumentLibraryView } from '../src/components/DocumentLibraryView';
import { DocumentItem } from '../src/types';
import '../src/index.css';

const w = window as any;
w.__confirmed = null; w.__cancelled = false; w.__opened = []; w.__deleted = [];
const doc = (id: string, title: string) =>
  ({ id, title, type: 'pdf', sizeBytes: 50000, uploadDate: '2026-09-01', tags: [], owner: 'me', organization: 'o', status: 'Ready', aiIndexed: true, embeddingsComplete: true, versionHistory: [], permissions: 'Private', category: 'Legal', summary: title } as unknown as DocumentItem);
const documents = [doc('doc-lease', 'Harbor_Lease.pdf'), doc('doc-loan', 'ROK_Loan_Term_Sheet.pdf'), doc('doc-bio', 'Board_Bio.pdf')];

createRoot(document.getElementById('root')!).render(
  <div className="s87-app" style={{ height: '100vh', display: 'flex' }}>
    <DocumentLibraryView
      documents={documents}
      filesView="workspace"
      onSelectDocument={(d) => w.__opened.push(d.id)}
      onOpenUpload={() => {}}
      onDeleteDocument={(id) => w.__deleted.push(id)}
      pickForAsk={{ initialIds: ['doc-loan'], onConfirm: (ids) => { w.__confirmed = ids; }, onCancel: () => { w.__cancelled = true; } }}
    />
  </div>
);
