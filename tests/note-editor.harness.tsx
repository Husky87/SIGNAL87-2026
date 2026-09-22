import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { SavedView } from '../src/components/SavedView';
import { SavedItem } from '../src/types';

const seeded: SavedItem[] = [{
  id: 'note-seed',
  type: 'note',
  title: 'Seeded note',
  body: 'Existing body',
  bodyHtml: '<p>Existing body</p>',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}];

function Harness() {
  const [items, setItems] = useState<SavedItem[]>(seeded);
  const [noteRequest, setNoteRequest] = useState(0);
  return (
    <div className="s87-app flex h-[100dvh] overflow-hidden">
      <button type="button" onClick={() => setNoteRequest((n) => n + 1)}>Harness new note</button>
      <button type="button" onClick={() => setItems((prev) => [{ ...seeded[0], id: 'note-unsafe', title: 'Unsafe note', body: '<b>safe text</b>', bodyHtml: '<p onclick="x()">safe text <a href="javascript:alert(1)">bad</a><img src=x onerror="alert(1)"><span style="background-image: url(https://evil.test/x)">styled</span></p>' }, ...prev])}>Harness unsafe note</button>
      <SavedView
        savedItems={items}
        onSaveItem={(item) => setItems((prev) => [item, ...prev.filter((p) => p.id !== item.id)])}
        onDeleteItem={(id) => setItems((prev) => prev.filter((p) => p.id !== id))}
        documents={[]}
        onSelectDocument={() => {}}
        newNoteRequestId={noteRequest}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
