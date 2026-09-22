import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, StickyNote, FileText, ArrowLeft, Trash2, Link2, Check, Clock3, Bold, Italic, List, ListOrdered, Heading2, Undo2, Redo2, RemoveFormatting } from 'lucide-react';
import { SavedItem, SavedNote, DocumentItem } from '../types';
import { ScrollArea } from './ScrollArea';

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
  const [recentlyDeleted, setRecentlyDeleted] = useState<SavedItem | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const noteBodyHtmlRef = useRef('');
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeletionRef = useRef<SavedItem | null>(null);
  const onDeleteItemRef = useRef(onDeleteItem);
  onDeleteItemRef.current = onDeleteItem;

  const plainTextToHtml = (text: string) => text.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`).join('');

  const sanitizeNoteHtml = (html: string) => {
    const template = document.createElement('template');
    template.innerHTML = html;
    const allowed = new Set(['P', 'DIV', 'BR', 'STRONG', 'B', 'EM', 'I', 'UL', 'OL', 'LI', 'H2', 'H3']);
    Array.from(template.content.querySelectorAll('*')).forEach((node) => {
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') {
        node.remove();
      } else if (!allowed.has(node.tagName)) {
        node.replaceWith(...Array.from(node.childNodes));
      } else {
        Array.from(node.attributes).forEach((attribute) => node.removeAttribute(attribute.name));
      }
    });
    return template.innerHTML;
  };

  useEffect(() => {
    if (!newNoteRequestId && !prelinkedDocId) return;
    setSelectedItem(null);
    setIsCreatingNote(true);
    setNoteTitle('');
    setNoteBody('');
    noteBodyHtmlRef.current = '';
    setNoteLinkedDocId(prelinkedDocId || '');
  }, [newNoteRequestId, prelinkedDocId]);

  useEffect(() => {
    if (!titleRef.current) return;
    titleRef.current.style.height = 'auto';
    titleRef.current.style.height = `${titleRef.current.scrollHeight}px`;
  }, [noteTitle, selectedItem, isCreatingNote]);

  useEffect(() => () => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (pendingDeletionRef.current) onDeleteItemRef.current(pendingDeletionRef.current.id);
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...savedItems]
      .filter((item) => item.id !== recentlyDeleted?.id)
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
  }, [savedItems, activeFilter, searchQuery, recentlyDeleted]);

  const closeEditor = () => {
    setSelectedItem(null);
    setIsCreatingNote(false);
    setNoteTitle('');
    setNoteBody('');
    noteBodyHtmlRef.current = '';
    setNoteLinkedDocId('');
    onClearPrelinkedDoc?.();
  };

  const startNewNote = () => {
    setSelectedItem(null);
    setIsCreatingNote(true);
    setNoteTitle('');
    setNoteBody('');
    noteBodyHtmlRef.current = '';
    setNoteLinkedDocId('');
  };

  const openItem = (item: SavedItem) => {
    setSelectedItem(item);
    setIsCreatingNote(false);
    if (item.type === 'note') {
      setNoteTitle(item.title);
      setNoteBody(item.body);
      noteBodyHtmlRef.current = sanitizeNoteHtml(item.bodyHtml || plainTextToHtml(item.body));
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
      bodyHtml: sanitizeNoteHtml(noteBodyHtmlRef.current),
      linkedDocId: noteLinkedDocId || undefined,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    onSaveItem(note);
    closeEditor();
  };

  const formatNote = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    if (editorRef.current) {
      noteBodyHtmlRef.current = sanitizeNoteHtml(editorRef.current.innerHTML);
      setNoteBody(editorRef.current.innerText);
    }
  };

  const toolbarButton = (label: string, icon: React.ReactNode, command: string, value?: string, showLabel = false) => (
    <button key={label} type="button" aria-label={label} title={label} onMouseDown={(event) => { event.preventDefault(); formatNote(command, value); }} className={`flex h-9 min-h-9 items-center justify-center gap-1.5 rounded-lg text-[var(--muted)] transition hover:bg-[var(--raised)] hover:text-[var(--ink)] ${showLabel ? 'px-2.5 text-[11px] font-semibold' : 'w-9'}`}>
      {icon}{showLabel && <span>{label}</span>}
    </button>
  );

  const deleteSelectedItem = () => {
    if (!selectedItem) return;
    if (pendingDeletionRef.current) onDeleteItem(pendingDeletionRef.current.id);
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    pendingDeletionRef.current = selectedItem;
    setRecentlyDeleted(selectedItem);
    closeEditor();
    deleteTimerRef.current = setTimeout(() => {
      if (pendingDeletionRef.current) onDeleteItemRef.current(pendingDeletionRef.current.id);
      pendingDeletionRef.current = null;
      setRecentlyDeleted(null);
      deleteTimerRef.current = null;
    }, 8000);
  };

  const undoDelete = () => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = null;
    pendingDeletionRef.current = null;
    setRecentlyDeleted(null);
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
          {selectedItem && <button type="button" onClick={deleteSelectedItem} aria-label="Delete note" className="flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium text-[var(--muted)] transition hover:bg-[var(--raised)] hover:text-[var(--warn)]"><Trash2 size={15} /> Delete</button>}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-10 sm:py-12">
        {isCreatingNote || selectedItem?.type === 'note' ? (
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]"><StickyNote size={15} /> Note editor</div>
            <label htmlFor="note-title" className="sr-only">Note title</label>
            <textarea id="note-title" ref={titleRef} rows={1} value={noteTitle} onChange={(event) => setNoteTitle(event.target.value.replace(/\n/g, ' '))} placeholder="Untitled note" className="s87-note-title w-full resize-none overflow-hidden border-0 bg-transparent text-[34px] font-semibold leading-[1.08] tracking-[-0.05em] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] sm:text-[44px]" />
            <div className="mt-4 flex items-center gap-2 text-[11px] text-[var(--muted)]"><Clock3 size={13} /> Draft your thinking, decisions, and next steps.</div>
            <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--surface)] shadow-sm transition focus-within:border-[var(--teal)] focus-within:ring-2 focus-within:ring-[var(--teal-soft)]">
              <div className="flex flex-wrap items-center gap-1 border-b border-[var(--rule-2)] bg-[var(--surface-2)]/55 px-3 py-2" role="toolbar" aria-label="Note formatting">
                {toolbarButton('Bold', <Bold size={15} />, 'bold')}
                {toolbarButton('Italic', <Italic size={15} />, 'italic')}
                <span className="mx-1 h-5 w-px bg-[var(--rule)]" aria-hidden="true" />
                {toolbarButton('Heading', <Heading2 size={15} />, 'formatBlock', 'h2')}
                {toolbarButton('Bulleted list', <List size={15} />, 'insertUnorderedList')}
                {toolbarButton('Numbered list', <ListOrdered size={15} />, 'insertOrderedList')}
                <span className="mx-1 h-5 w-px bg-[var(--rule)]" aria-hidden="true" />
                {toolbarButton('Undo', <Undo2 size={15} />, 'undo', undefined, true)}
                {toolbarButton('Redo', <Redo2 size={15} />, 'redo', undefined, true)}
                {toolbarButton('Clear formatting', <RemoveFormatting size={15} />, 'removeFormat')}
              </div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label="Note body"
                aria-multiline="true"
                data-placeholder="Start writing..."
                className="s87-note-editor min-h-[480px] w-full px-6 py-5 text-[15px] leading-8 text-[var(--ink-2)] outline-none"
                dangerouslySetInnerHTML={{ __html: noteBodyHtmlRef.current }}
                onInput={(event) => {
                  noteBodyHtmlRef.current = sanitizeNoteHtml(event.currentTarget.innerHTML);
                  setNoteBody(event.currentTarget.innerText);
                }}
                onPaste={(event) => {
                  event.preventDefault();
                  document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
                }}
              />
            </div>
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
      <ScrollArea id="saved:list" className="min-h-0 flex-1 overflow-y-auto">
        <div className="s87-page">
          <div className="s87-column"><div className="flex flex-wrap items-end justify-between gap-6">
            <div>

              <h1 className="s87-page-title">Notes</h1>
              <p className="s87-page-description">Keep notes and saved answers together with the documents and decisions they reference.</p>
            </div>
            <button type="button" onClick={startNewNote} className="flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--teal)] px-5 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90"><Plus size={15} /> New note</button>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-2">
            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--surface)] px-4 shadow-sm"><Search size={15} className="text-[var(--muted)]" /><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search notes..." className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--muted)]" /></div>
            {(['all', 'notes', 'answers'] as const).map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`min-h-[38px] rounded-full border px-4 text-[11px] font-semibold transition ${activeFilter === filter ? 'border-[var(--teal-soft)] bg-[var(--teal-soft)] text-[var(--teal)]' : 'border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--raised)]'}`}>{filter === 'all' ? 'All' : filter === 'notes' ? 'Notes' : 'Saved answers'}</button>)}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--surface)] shadow-sm">
            {filteredItems.length > 0 ? filteredItems.map((item, idx) => <button key={item.id} type="button" onClick={() => openItem(item)} className={`group flex min-h-[88px] w-full items-center gap-4 px-5 text-left transition hover:bg-[var(--raised)] sm:px-6 ${idx < filteredItems.length - 1 ? 'border-b border-[var(--rule-2)]' : ''}`}><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.type === 'note' ? 'bg-[var(--teal-soft)] text-[var(--teal)]' : 'bg-[var(--blue-soft)] text-[var(--blue)]'}`}>{item.type === 'note' ? <StickyNote size={16} /> : <FileText size={16} />}</div><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-[var(--ink)]">{item.type === 'note' ? item.title : item.question}</div><div className="mt-1 truncate text-[11px] text-[var(--muted)]">{item.type === 'note' ? item.body || 'Empty note' : 'Saved answer'}</div></div><span className="shrink-0 text-[10px] text-[var(--muted)]">{new Date(item.type === 'note' ? item.updatedAt : item.timestamp).toLocaleDateString()}</span></button>) : <div className="px-6 py-16 text-center"><StickyNote size={26} className="mx-auto text-[var(--muted)]" /><p className="mt-4 text-[14px] font-medium text-[var(--ink-2)]">No notes or saved answers yet.</p><p className="mt-1 text-[12px] text-[var(--muted)]">Create a note or save a useful answer from Ask.</p><button type="button" onClick={startNewNote} className="mt-5 rounded-full bg-[var(--teal)] px-4 py-2.5 text-[11px] font-semibold text-white">Create your first note</button></div>}
          </div>
        </div></div>
      </ScrollArea>
      {recentlyDeleted && (
        <div role="status" className="fixed bottom-24 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-4 rounded-full bg-[var(--ink)] px-5 py-3 text-[12px] text-white shadow-xl sm:bottom-8">
          <span>Note removed.</span>
          <button type="button" onClick={undoDelete} className="min-h-0 font-semibold text-[#9be7ed] hover:text-white">Recover</button>
        </div>
      )}
    </div>
  );
};
