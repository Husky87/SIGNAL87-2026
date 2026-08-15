/**
 * Mounts the real ResearchAssistantView with an initialQuery — the exact prop
 * App sets when the mobile search box is submitted — and records the request it
 * makes. This is the pathway a quick answer travels: search box -> pending
 * query -> assistant -> /api/chat, with the library attached.
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
  if (href.includes('/api/')) {
    (window as any).__requests.push({ url: href, body: JSON.parse(init.body) });
    return new Response(
      JSON.stringify({ text: 'The start date is 08/12/2026.', provider: 'gemini', citations: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return realFetch(url, init);
}) as any;

const documents: DocumentItem[] = [
  {
    id: 'doc-mercor',
    title: 'Mercor Offer Letter.pdf',
    summary: 'Offer of engagement',
    fullText: 'MERCOR OFFER LETTER. Start Date: 08/12/2026. Pay Rate: $70.00 USD per hour.'
  } as DocumentItem
];

function Harness() {
  const [chatHistory, setChatHistory] = React.useState<any[]>([]);
  return (
    <div style={{ height: '100vh' }}>
      <ResearchAssistantView
        documents={documents}
        attachedFiles={[]}
        setAttachedFiles={() => {}}
        selectedModel="gemini-2.5-flash"
        onChangeModel={() => {}}
        chatHistory={chatHistory}
        setChatHistory={setChatHistory as any}
        initialQuery="What is the start date?"
        onInitialQueryConsumed={() => {
          (window as any).__consumed = true;
        }}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
