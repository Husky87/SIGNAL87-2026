/**
 * Mounts the real ResearchAssistantView with a small workspace and records each
 * /api/chat request, to check that choosing files limits the question to them.
 * `?scope=<docId>` simulates "Ask about this file" from the document viewer.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ResearchAssistantView } from '../src/components/ResearchAssistantView';
import { DocumentItem } from '../src/types';
import '../src/index.css';

(window as any).__requests = [];
const realFetch = window.fetch.bind(window);
window.fetch = (async (url: any, init: any) => {
  const href = String(url);
  if (href.includes('/api/chat')) {
    (window as any).__requests.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ text: 'Answer.', citations: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (href.includes('/api/')) return new Response('{}', { status: 503 });
  return realFetch(url, init);
}) as any;

const doc = (id: string, title: string, text: string) =>
  ({ id, title, type: 'pdf', sizeBytes: 50000, uploadDate: '2026-09-01', tags: [], owner: 'me', organization: 'o', status: 'Ready', aiIndexed: true, embeddingsComplete: true, versionHistory: [], permissions: 'Private', category: 'Legal', summary: title, fullText: text } as unknown as DocumentItem);
const documents = [
  doc('doc-lease', 'Harbor_Lease.pdf', 'Lease term ten years. Rent escalator three percent.'),
  doc('doc-loan', 'ROK_Loan_Term_Sheet.pdf', 'Loan amount $4,250,000. Lender ROK Financial.'),
  doc('doc-bio', 'Board_Bio.pdf', 'Michael Benezra founded Signal87 AI.')
];
const user = { uid: 'u', displayName: 'Test User', email: 't@example.com', photoURL: null, getIdToken: async () => 't' } as any;
const scope = new URLSearchParams(location.search).get('scope');

function Harness() {
  const [chatHistory, setChatHistory] = React.useState<any[]>([]);
  const [attached, setAttached] = React.useState<any[]>([]);
  const [scopeRequest] = React.useState(scope ? { ids: [scope], nonce: 1 } : null);
  return (
    <div className="s87-app" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ResearchAssistantView
        documents={documents}
        attachedFiles={attached}
        setAttachedFiles={setAttached as any}
        selectedModel="gemini-3.6-flash"
        onChangeModel={() => {}}
        chatHistory={chatHistory}
        setChatHistory={setChatHistory as any}
        currentUser={user}
        scopeRequest={scopeRequest}
      />
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);
