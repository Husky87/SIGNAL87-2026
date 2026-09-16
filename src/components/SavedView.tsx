import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, StickyNote, FileText, ArrowLeft, Trash2, Link2, Check } from 'lucide-react';
import { SavedItem, SavedNote, SavedAnswer, DocumentItem } from '../types';

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

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg)] text-[var(--ink)]">
      {(selectedItem || isCreatingNote) ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-[64px] items-center justify-between border-b border-[var(--rule)] bg-[var(--surface)] px-5 sm:px-7">
            <button type="button" onClick={closeEditor} className="flex min-h-[44px] items-center gap-2 text-[12px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Back</button>
            <div className="flex items-center gap-2">
              {selectedItem?.type === 'answer' && <span className="rounded-full bg-[var(--teal-soft)] px-3 py-1.5 text-[10px] font-semibold text-[var(--teal)]">Saved answer</span>}
              {isCreatingNote || selectedItem?.type === 'note' ? <button type="button" onClick={saveNote} className="flex min-h-[42px] items-center gap-2 rounded-full bg-[var(--ink)] px-4 text-[12px] font-medium text-white hover:opacity-90"><Check size={14} /> Save</button> : null}
              {selectedItem && <button type="button" onClick={() => { onDeleteItem(selectedItem.id); closeEditor(); }} aria-label="Delete" className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--ink)]"><Trash2 size={15} /></button>}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-10">
            {isCreatingNote || selectedItem?.type === 'note' ? (
              <div className="mx-auto max-w-3xl">
                <input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Note title" className="w-full border-0 bg-transparent text-[30px] font-semibold tracking-[-0.045em] outline-none placeholder:text-[var(--muted)] sm:text-[38px]" />
                <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Start writing..." className="mt-6 min-h-[420px] w-full resize-none border-0 bg-transparent text-[15px] leading-7 text-[var(--ink-2)] outline-none placeholder:text-[var(--muted)]" />
                {noteLinkedDocId && <button type="button" onClick={() => { const doc = documents.find((d) => d.id === noteLinkedDocId); if (doc) onSelectDocument(doc); }} className="mt-4 flex items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 text-[11px] text-[var(--ink-2)] hover:bg-[var(--raised)]"><Link2 size={13} /> {documents.find((d) => d.id === noteLinkedDocId)?.title || 'Linked document'}</button>}
              </div>
            ) : selectedItem?.type === 'answer' ? (
              <article className="mx-auto max-w-3xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Original question</div>
                <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.04em] sm:text-[32px]">{selectedItem.question}</h2>
                <div className="mt-8 whitespace-pre-wrap text-[14px] leading-7 text-[var(--ink-2)]">{selectedItem.text}</div>
                {selectedItem.citations && selectedItem.citations.length > 0 && <div className="mt-8 border-t border-[var(--rule)] pt-5"><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Sources</div><div className="mt-3 space-y-2">{selectedItem.citations.map((citation, idx) => <div key={`${citation.docId}-${idx}`} className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] px-4 py-3 text-[12px] text-[var(--ink-2)]">{citation.docTitle}</div>)}</div></div>}
              </article>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div><div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]"><StickyNote size={14} className="text-[var(--teal)]" /> Notes</div><h1 className="mt-3 text-[32px] font-semibold tracking-[-0.055em] sm:text-[40px]">Capture ideas, build context, take action.</h1><p className="mt-3 text-[14px] leading-6 text-[var(--ink-2)]">Keep notes and saved answers together with the documents they reference.</p></div>
              <button type="button" onClick={() => { setSelectedItem(null); setIsCreatingNote(true); setNoteTitle(''); setNoteBody(''); setNoteLinkedDocId(''); }} className="flex min-h-[42px] items-center gap-2 rounded-full bg-[var(--teal)] px-4 text-[12px] font-medium text-white hover:opacity-90"><Plus size={14} /> New note</button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              <div className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--surface)] px-3"><Search size={14} className="text-[var(--muted)]" /><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search notes..." className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--muted)]" /></div>
              {(['all','notes','answers'] as const).map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`min-h-[38px] rounded-full border px-3 text-[11px] font-medium ${activeFilter === filter ? 'border-[var(--teal-soft)] bg-[var(--teal-soft)] text-[var(--teal)]' : 'border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--raised)]'}`}>{filter === 'all' ? 'All' : filter === 'notes' ? 'Notes' : 'Saved answers'}</button>)}
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--surface)]">
              {filteredItems.length > 0 ? filteredItems.map((item, idx) => <button key={item.id} type="button" onClick={() => openItem(item)} className={`flex min-h-[76px] w-full items-center gap-4 px-4 text-left hover:bg-[var(--raised)] sm:px-5 ${idx < filteredItems.length - 1 ? 'border-b border-[var(--rule-2)]' : ''}`}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--teal-soft)] text-[var(--teal)]">{item.type === 'note' ? <StickyNote size={14} /> : <FileText size={14} />}</div><div className="min-w-0 flex-1">{item.type === 'note' ? <><div className="truncate text-[13px] font-semibold text-[var(--ink)]">{item.title}</div><div className="mt-1 truncate text-[11px] text-[var(--muted)]">{item.body || 'Empty note'}</div></> : <><div className="truncate text-[13px] font-semibold text-[var(--ink)]">{item.question}</div><div className="mt-1 truncate text-[11px] text-[var(--muted)]">Saved answer</div></>}</div><span className="shrink-0 text-[10px] text-[var(--muted)]">{new Date(item.type === 'note' ? item.updatedAt : item.timestamp).toLocaleDateString()}</span></button>) : <div className="px-6 py-14 text-center"><StickyNote size={22} className="mx-auto text-[var(--muted)]" /><p className="mt-3 text-[13px] text-[var(--ink-2)]">No notes or saved answers yet.</p><p className="mt-1 text-[11px] text-[var(--muted)]">Create a note or save a useful answer from Ask.</p></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
