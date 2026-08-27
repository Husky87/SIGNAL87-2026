/**
 * The mobile shell, assembled the way App.tsx assembles it: the desktop rail
 * hidden, the drawer available behind the hamburger, the dock pinned at the
 * bottom, and one view filling what is left.
 *
 * ?view=compare|ask selects the surface; ?drawer=1 opens the navigation drawer.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Sidebar } from '../src/components/Sidebar';
import { MobileDock } from '../src/components/MobileDock';
import { MultiDocCompareView } from '../src/components/MultiDocCompareView';
import { DocumentLibraryView } from '../src/components/DocumentLibraryView';
import { ResearchAssistantView } from '../src/components/ResearchAssistantView';
import { ChatMessage, DocumentItem } from '../src/types';
import '../src/index.css';

const params = new URLSearchParams(location.search);

const docs: DocumentItem[] = [
  'Master Services Agreement 2026',
  'Amended and Restated Lease',
  'Board Minutes — Q3'
].map((title, i) => ({
  id: `doc_${i}`,
  title,
  type: 'pdf',
  sizeBytes: 120_000 * (i + 1),
  uploadDate: new Date().toISOString(),
  tags: ['Contract'],
  owner: 'counsel@signal87.ai',
  organization: 'Signal87',
  status: 'ready',
  aiIndexed: true,
  embeddingsComplete: true,
  versionHistory: [],
  permissions: 'Private',
  category: 'Legal'
}));

function Views() {
  const view = params.get('view') || 'compare';
  const [attached, setAttached] = React.useState<{ id: string; name: string; size: string }[]>([]);
  const [chat, setChat] = React.useState<ChatMessage[]>([]);

  if (view === 'library') {
    return (
      <DocumentLibraryView
        documents={docs}
        onSelectDocument={() => {}}
        onOpenUpload={() => {}}
        onDeleteDocument={() => {}}
      />
    );
  }
  if (view === 'ask') {
    return (
      <ResearchAssistantView
        documents={docs}
        attachedFiles={attached}
        setAttachedFiles={setAttached}
        selectedModel="signal87-default"
        onChangeModel={() => {}}
        chatHistory={chat}
        setChatHistory={setChat}
      />
    );
  }
  return <MultiDocCompareView documents={docs} initialSelectedIds={['doc_0', 'doc_1']} />;
}

function Harness() {
  const [drawer, setDrawer] = React.useState(params.get('drawer') === '1');

  return (
    <div className="s87-app flex h-[100dvh] w-full max-w-full overflow-hidden bg-[var(--paper)] text-[var(--ink)] antialiased">
      <Sidebar
        currentTab="compare"
        onSelectTab={() => setDrawer(false)}
        collapsed={false}
        onToggleCollapse={() => {}}
        documentCount={docs.length}
        projectCount={0}
        mobileMenuOpen={drawer}
        onCloseMobileMenu={() => setDrawer(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden">
        <header
          className="flex md:hidden bg-[var(--paper)] px-4 pb-2.5 items-center flex-shrink-0 z-30 relative"
          style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top))' }}
        >
          <div className="w-full flex items-center gap-2 bg-[var(--card)] px-3 py-1.5 border border-[var(--rule)] rounded-full">
            <button
              onClick={() => setDrawer(true)}
              aria-label="Open navigation menu"
              className="p-1.5 text-[var(--ink-2)] rounded-full flex items-center justify-center cursor-pointer"
            >
              ☰
            </button>
            <span className="text-[13px] text-[var(--muted)]">Search or ask</span>
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          <Views />
        </main>
        <MobileDock
          currentTab="compare"
          onSelectTab={() => {}}
          onNewSession={() => {}}
          onOpenUpload={() => {}}
          onOpenNewNote={() => {}}
          onOpenNewFolderModal={() => {}}
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
