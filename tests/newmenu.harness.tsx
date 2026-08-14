/** Mounts the real Sidebar and records which callback each menu item fires. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Sidebar } from '../src/components/Sidebar';
import '../src/index.css';

// Pushed onto whatever window.__calls currently is, so the test can reset it
// between cases without detaching the recorder from the array it reads back.
(window as any).__calls = [];
const record = (name: string) => (window as any).__calls.push(name);

function Harness() {
  return (
    <div style={{ width: 280, height: '100vh' }}>
      <Sidebar
        currentTab="research"
        onSelectTab={(t) => record(`tab:${t}`)}
        collapsed={false}
        onToggleCollapse={() => {}}
        documentCount={0}
        projectCount={0}
        onNewSession={() => record('newSession')}
        onOpenUpload={() => record('upload')}
        onOpenNewNote={() => record('newNote')}
        onOpenNewFolderModal={() => record('newFolder')}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
