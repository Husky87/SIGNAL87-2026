import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, StickyNote, FileText, ArrowLeft, Trash2, Link2, Check, Clock3 } from 'lucide-react';
import { SavedItem, SavedNote, DocumentItem } from '../types';

export interface SavedViewProps {
  savedItems: SavedItem[];
  onSaveItem: (item: SavedItem) => void;
  onDeleteItem: (id: string) => void;
  documents: DocumentItem[];
  onSelectDocument: (doc: DocumentItem) => void;
  prelinkedDocId?: string | null;
  onClearPrelinkedDoc?: () => void;
  newNoteRequestId?: number;
}

export const SavedView: React.FC<SavedViewProps> = ({
  savedItems,
  onSaveItem,
  onDeleteItem,
  documents,
  onSelectDocument,
  prelinkedDocId,
  onClearPrelinkedDoc,
  newNoteRequestId = 0
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'notes' | 'answers'>('all');
  const [selectedItem, setSelectedItem] = useState<SavedItem | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteLinkedDocId, setNoteLinkedDocId] = useState('');

  useEffect(() => {
    if (!newNoteRequestId && !prelinkedDocId) return;
    setSelectedItem(null);
    setIsCreatingNote(true);
    setNoteTitle('');
    setNoteBody('');
    setNoteLinkedDocId(prelinkedDocId || '');
  }, [newNoteRequestId, prelinkedDocId]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...savedItems]
      .filter((item) => activeFilter === 'all' || item.type === (activeFilter === 'notes' ? 'note' : 'answer'))
      .filter((item) => {
        if (!q) return true;
        return item.type === 'note'
          ? `${item.title} ${item.body}`.toLowerCase().includes(q)
          : `${item.question} ${item.text}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const aTime = new Date(a.type === 'note' ? a.updatedAt : a.timestamp).getTime();
        const bTime = new Date(b.type === 'note' ? b.updatedAt : b.timestamp).getTime();
        return bTime - aTime;
      });
  }, [savedItems, activeFilter, searchQuery]);

  const closeEditor = () => {
    setSelectedItem(null);
    setIsCreatingNote(false);
    setNoteTitle('');
    setNoteBody('');
    setNoteLinkedDocId('');
    onClearPrelinkedDoc?.();
  };

  const startNewNote = () => {
    setSelectedItem(null);
    setIsCreatingNote(true);
    setNoteTitle('');
    setNoteBody('');
    setNoteLinkedDocId('');
  };

  const openItem = (item: SavedItem) => {
    setSelectedItem(item);
    setIsCreatingNote(false);
    if (item.type === 'note') {
      setNoteTitle(item.title);
      setNoteBody(item.body);
      setNoteLinkedDocId(item.linkedDocId || '');
    }
  };

  const saveNote = () => {
    if (!noteTitle.trim() && !noteBody.trim()) return;
    const now = new Date().toISOString();
    const existing = selectedItem?.type === 'note' ? selectedItem : null;
    const note: SavedNote = {
      id: existing?.id || `note-${Date.now()}`,
      type: 'note',
      title: noteTitle.trim() || 'Untitled Note',
      body: noteBody,
      linkedDocId: noteLinkedDocId || undefined,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    onSaveItem(note);
    closeEditor();
  };

  const renderEditor = () => (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--bg)]">
      <header className="flex min-h-[68px] items-center justify-between border-b border-[var(--rule)] bg-[var(--surface)] px-5 sm:px-8">
        <button type="button" onClick={closeEditor} className="flex min-h-[44px] items-center gap-2 rounded-full px-3 text-[12px] font-medium text-[var(--ink-2)] transition hover:bg-[var(--raised)] hover:text-[var(--ink)]">
          <ArrowLeft size={15} /> Back to notes
        </button>
        <div className="flex items-center gap-2">
          {selectedItem?.type === 'answer' && <span className="rounded-full bg-[var(--teal-soft)] px-3 py-1.5 text-[10px] font-semibold text-[var(--teal)]">Saved answer</span>}
          {(isCreatingNote || selectedItem?.type === 'note') && <button type="button" onClick={saveNote} className="flex min-h-[42px] items-center gap-2 rounded-full bg-[var(--ink)] px-5 text-[12px] font-semibold text-white transition hover:opacity-85"><Check size={14} /> Save note</button>}
          {selectedItem && <button type="button" onClick={() => { onDeleteItem(selectedItem.id); closeEditor(); }} aria-label="Delete" className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--raised)] hover:text-[var(--ink)]"><Trash2 size={15} /></button>}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-10 sm:py-12">
        {isCreatingNote || selectedItem?.type === 'note' ? (
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]"><StickyNote size={15} /> Note editor</div>
            <input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Untitled note" className="w-full border-0 bg-transparent text-[36px] font-semibold tracking-[-0.055em] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] sm:text-[52px]" />
            <div className="mt-4 flex items-center gap-2 text-[11px] text-[var(--muted)]"><Clock3 size={13} /> Draft your thinking, decisions, and next steps.</div>
            <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Start writing..." className="mt-10 min-h-[520px] w-full resize-none rounded-2xl border border-[var(--rule)] bg-[var(--surface)] px-6 py-5 text-[15px] leading-8 text-[var(--ink-2)] shadow-sm outline-none transition focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal-soft)] placeholder:text-[var(--muted)]" />
            {noteLinkedDocId && <button type="button" onClick={() => { const doc = documents.find((d) => d.id === noteLinkedDocId); if (doc) onSelectDocument(doc); }} className="mt-4 flex items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--surface)] px-4 py-2.5 text-[11px] text-[var(--ink-2)] transition hover:bg-[var(--raised)]"><Link2 size={13} /> {documents.find((d) => d.id === noteLinkedDocId)?.title || 'Linked document'}</button>}
          </div>
        ) : selectedItem?.type === 'answer' ? (
          <article className="mx-auto max-w-4xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">Saved answer</div>
            <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.045em] text-[var(--ink)] sm:text-[44px]">{selectedItem.question}</h2>
            <div className="mt-10 whitespace-pre-wrap text-[15px] leading-8 text-[var(--ink-2)]">{selectedItem.text}</div>
            {selectedItem.citations && selectedItem.citations.length > 0 && <div className="mt-10 border-t border-[var(--rule)] pt-6"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Sources</div><div className="mt-4 space-y-2">{selectedItem.citations.map((citation, idx) => <div key={`${citation.docId}-${idx}`} className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] px-4 py-3 text-[12px] text-[var(--ink-2)]">{citation.docTitle}</div>)}</div></div>}
          </article>
        ) : null}
      </div>
    </div>
  );

  if (selectedItem || isCreatingNote) return renderEditor();

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg)] text-[var(--ink)]">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-10 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]"><StickyNote size={15} /> Notes</div>
              <h1 className="mt-4 max-w-3xl text-[34px] font-semibold tracking-[-0.06em] text-[var(--ink)] sm:text-[48px]">Capture ideas. Build context. Take action.</h1>
              <p className="mt-4 max-w-2xl text-[14px] leading-7 text-[var(--ink-2)]">Keep notes and saved answers together with the documents and decisions they reference.</p>
            </div>
            <button type="button" onClick={startNewNote} className="flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--teal)] px-5 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90"><Plus size={15} /> New note</button>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-2">
            <div className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--surface)] px-4 shadow-sm"><Search size={15} className="text-[var(--muted)]" /><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search notes..." className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--muted)]" /></div>
            {(['all', 'notes', 'answers'] as const).map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`min-h-[38px] rounded-full border px-4 text-[11px] font-semibold transition ${activeFilter === filter ? 'border-[var(--teal-soft)] bg-[var(--teal-soft)] text-[var(--teal)]' : 'border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--raised)]'}`}>{filter === 'all' ? 'All' : filter === 'notes' ? 'Notes' : 'Saved answers'}</button>)}
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--surface)] shadow-sm">
            {filteredItems.length > 0 ? filteredItems.map((item, idx) => <button key={item.id} type="button" onClick={() => openItem(item)} className={`group flex min-h-[88px] w-full items-center gap-4 px-5 text-left transition hover:bg-[var(--raised)] sm:px-6 ${idx < filteredItems.length - 1 ? 'border-b border-[var(--rule-2)]' : ''}`}><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.type === 'note' ? 'bg-[var(--teal-soft)] text-[var(--teal)]' : 'bg-[var(--blue-soft)] text-[var(--blue)]'}`}>{item.type === 'note' ? <StickyNote size={16} /> : <FileText size={16} />}</div><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-[var(--ink)]">{item.type === 'note' ? item.title : item.question}</div><div className="mt-1 truncate text-[11px] text-[var(--muted)]">{item.type === 'note' ? item.body || 'Empty note' : 'Saved answer'}</div></div><span className="shrink-0 text-[10px] text-[var(--muted)]">{new Date(item.type === 'note' ? item.updatedAt : item.timestamp).toLocaleDateString()}</span></button>) : <div className="px-6 py-16 text-center"><StickyNote size={26} className="mx-auto text-[var(--muted)]" /><p className="mt-4 text-[14px] font-medium text-[var(--ink-2)]">No notes or saved answers yet.</p><p className="mt-1 text-[12px] text-[var(--muted)]">Create a note or save a useful answer from Ask.</p><button type="button" onClick={startNewNote} className="mt-5 rounded-full bg-[var(--teal)] px-4 py-2.5 text-[11px] font-semibold text-white">Create your first note</button></div>}
          </div>
        </div>
      </div>
    </div>
  );
};