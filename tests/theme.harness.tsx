/**
 * Mounts the surfaces the theme conversion prioritised, inside the same
 * .s87-app wrapper the real shell uses, so computed colours can be inspected.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MultiDocCompareView } from '../src/components/MultiDocCompareView';
import { Sidebar } from '../src/components/Sidebar';
import { WelcomeTourModal } from '../src/components/WelcomeTourModal';
import { DocumentItem } from '../src/types';
import '../src/index.css';

const docs: DocumentItem[] = ['Master Services Agreement', 'Amended Lease', 'Board Minutes'].map(
  (title, i) => ({
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
    category: 'Legal',
    summary: 'A short synopsis used only by this harness.'
  })
);

function Harness() {
  return (
    <div className="s87-app flex h-[100dvh] bg-[var(--paper)] text-[var(--ink)]">
      <div style={{ width: 280 }}>
        <Sidebar
          currentTab="compare"
          onSelectTab={() => {}}
          collapsed={false}
          onToggleCollapse={() => {}}
          documentCount={docs.length}
          projectCount={2}
        />
      </div>
      <main className="flex-1 overflow-y-auto">
        <MultiDocCompareView documents={docs} initialSelectedIds={['doc_0', 'doc_1']} />
      </main>
      <WelcomeTourModal isOpen onClose={() => {}} userName="Counsel" userEmail="counsel@signal87.ai" />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
