/** Mounts the real AssistantAnswer with a cited answer, and records which file each source opens. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AssistantAnswer } from '../src/components/AssistantAnswer';
import { setShowCitationNumbers } from '../src/lib/citationDisplay';
import type { ChatMessage, DocumentItem } from '../src/types';
import '../src/index.css';

const doc = (id: string, title: string, fullText: string): DocumentItem => ({
  id, title, fullText, type: 'pdf', sizeBytes: 1000, uploadDate: '2026-09-01', tags: [], owner: 'me', organization: 'org',
  status: 'ready', aiIndexed: true, embeddingsComplete: true, versionHistory: [], permissions: 'Private', category: 'Financial'
});
const documents = [
  doc('loan', 'Term sheet.pdf', 'Borrower: Mount Horeb Lodge #10. Loan amount: $4,250,000. Rate: 9.5% fixed for the term.'),
  doc('lender', 'Lender letter.pdf', 'ROK Financial confirms the bridge loan will close on October 15, 2026.')
];

// Three cited sentences (two from the term sheet, one from the lender letter) and one uncited sentence.
const msg: ChatMessage = {
  id: 'a1', role: 'assistant', timestamp: '10:00',
  text: 'The loan is **$4,250,000** [1]. The rate is fixed at 9.5% [1]. ROK Financial will close it on October 15, 2026 [2]. Bridge loans like this are usually refinanced within two years.',
  citations: [
    { docId: 'loan', docTitle: 'Term sheet.pdf', snippet: 'Term sheet for the Mount Horeb Lodge bridge loan: amount, rate and borrower details...' },
    { docId: 'lender', docTitle: 'Lender letter.pdf' }
  ],
  sources: [{ docId: 'loan', docTitle: 'Term sheet.pdf', versions: 2 }, { docId: 'lender', docTitle: 'Lender letter.pdf' }]
};

(window as any).__opened = [];
(window as any).__setNumbers = (on: boolean) => setShowCitationNumbers(on);

createRoot(document.getElementById('root')!).render(
  <div className="s87-app" style={{ background: 'var(--bg)', minHeight: '100vh', padding: 16 }}>
    <div style={{ maxWidth: 768, margin: '0 auto' }}>
      <AssistantAnswer
        msg={msg}
        userPrompt="Tell me about the loan"
        copiedMsgId={null}
        documents={documents}
        onCopy={() => {}}
        onExportPDF={() => {}}
        onInspectInCanvas={() => {}}
        onSelectDocument={(d, options) => (window as any).__opened.push({ id: d.id, search: options?.search || '' })}
      />
    </div>
  </div>
);
