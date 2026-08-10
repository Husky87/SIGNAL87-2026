import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  Trash2,
  ArrowLeft,
  Bookmark,
  StickyNote,
  Link2,
  X
} from 'lucide-react';
import { SavedItem, SavedNote, SavedAnswer, DocumentItem } from '../types';
import { GeminiMarkdownRenderer } from './ActionRouterComponents';

export interface SavedViewProps {
  savedItems: SavedItem[];
  onSaveItem: (item: SavedItem) => void;
  onDeleteItem: (id: string) => void;
  documents: DocumentItem[];
  onSelectDocument: (doc: DocumentItem) => void;
  prelinkedDocId?: string | null;
  onClearPrelinkedDoc?: () => void;
}

export const SavedView: React.FC<SavedViewProps> = ({
  savedItems,
  onSaveItem,
  onDeleteItem,
  documents,
  onSelectDocument,
  prelinkedDocId,
  onClearPrelinkedDoc
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'notes' | 'answers'>('all');
  const [selectedItem, setSelectedItem] = useState<SavedItem | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);

  // Note editor states
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteLinkedDocId, setNoteLinkedDocId] = useState('');

  // Handle auto-opening of prelinked note
  useEffect(() => {
    if (prelinkedDocId) {
      setNoteTitle('');
      setNoteBody('');
      setNoteLinkedDocId(prelinkedDocId);
      setIsCreatingNote(true);
      setSelectedItem(null);
    }
  }, [prelinkedDocId]);

  // Filter and sort items (most recent first)
  const filteredItems = useMemo(() => {
    let items = [...savedItems];

    // Filter by type
    if (activeFilter === 'notes') {
      items = items.filter(item => item.type === 'note');
    } else if (activeFilter === 'answers') {
      items = items.filter(item => item.type === 'answer');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(item => {
        if (item.type === 'note') {
          return item.title.toLowerCase().includes(q) || item.body.toLowerCase().includes(q);
        } else {
          return item.question.toLowerCase().includes(q) || item.text.toLowerCase().includes(q);
        }
      });
    }

    // Sort: Notes use updatedAt/createdAt, Answers use timestamp. All parsed to date
    return items.sort((a, b) => {
      const dateA = new Date(a.type === 'note' ? a.updatedAt : a.timestamp).getTime();
      const dateB = new Date(b.type === 'note' ? b.updatedAt : b.timestamp).getTime();
      return dateB - dateA;
    });
  }, [savedItems, activeFilter, searchQuery]);

  // Start creating new note
  const handleStartCreateNote = () => {
    setNoteTitle('');
    setNoteBody('');
    setNoteLinkedDocId('');
    setIsCreatingNote(true);
    setSelectedItem(null);
    if (onClearPrelinkedDoc) onClearPrelinkedDoc();
  };

  // Open existing item
  const handleSelectItem = (item: SavedItem) => {
    setSelectedItem(item);
    setIsCreatingNote(false);
    if (onClearPrelinkedDoc) onClearPrelinkedDoc();

    if (item.type === 'note') {
      setNoteTitle(item.title);
      setNoteBody(item.body);
      setNoteLinkedDocId(item.linkedDocId || '');
    }
  };

  // Save/Update note
  const handleSaveNote = () => {
    if (!noteTitle.trim() && !noteBody.trim()) return;

    const timestamp = new Date().toISOString();
    const isNew = isCreatingNote || !selectedItem;

    const noteId = isNew ? `note-${Date.now()}` : selectedItem!.id;
    const createdAt = isNew ? timestamp : (selectedItem as SavedNote).createdAt;

    const savedNote: SavedNote = {
      id: noteId,
      type: 'note',
      title: noteTitle.trim() || 'Untitled Note',
      body: noteBody,
      linkedDocId: noteLinkedDocId || undefined,
      createdAt,
      updatedAt: timestamp
    };

    onSaveItem(savedNote);

    // Reset view
    setSelectedItem(null);
    setIsCreatingNote(false);
    if (onClearPrelinkedDoc) onClearPrelinkedDoc();
  };

  // Delete item
  const handleDeleteItem = (id: string) => {
    onDeleteItem(id);
    setSelectedItem(null);
    setIsCreatingNote(false);
    if (onClearPrelinkedDoc) onClearPrelinkedDoc();
  };

  // Close editor/viewer
  const handleCloseDetail = () => {
    setSelectedItem(null);
    setIsCreatingNote(false);
    if (onClearPrelinkedDoc) onClearPrelinkedDoc();
  };

  const formattedDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const getLinkedDocTitle = (id?: string) => {
    if (!id) return '';
    const doc = documents.find(d => d.id === id);
    return doc ? doc.title : 'Linked Document';
  };

  return (
    <div className="flex flex-col h-full bg-[var(--paper)] text-[var(--ink)] font-sans select-none">
      {/* Detail view / Editor (Tapping a row opens it) */}
      {selectedItem || isCreatingNote ? (
        <div className="flex-1 flex flex-col h-full bg-[var(--paper)] animate-in fade-in duration-200 overflow-hidden">
          {/* Editor Header */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--rule)] bg-[var(--paper)] flex-shrink-0">
            <button
              onClick={handleCloseDetail}
              className="flex items-center gap-2 text-[var(--ink-2)] hover:text-[var(--ink)] font-bold text-sm cursor-pointer min-h-[44px]"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-2">
              {((selectedItem && selectedItem.type === 'note') || isCreatingNote) ? (
                <button
                  onClick={handleSaveNote}
                  className="px-4 py-1.5 bg-[var(--accent)] hover:opacity-90 text-[var(--paper)] rounded-[4px] font-bold text-xs cursor-pointer min-h-[44px]"
                >
                  Save
                </button>
              ) : null}
              {selectedItem && (
                <button
                  onClick={() => handleDeleteItem(selectedItem.id)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--slate)] hover:text-[var(--ink)] hover:bg-[var(--raised)] rounded-full transition-colors cursor-pointer"
                  title="Delete item"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Editor Content Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 max-w-3xl mx-auto w-full">
            {/* LINKED DOCUMENT INDICATOR / SELECTOR */}
            {((selectedItem && selectedItem.type === 'note') || isCreatingNote) && (
              <div className="bg-[var(--card)] p-3 rounded-[4px] border border-[var(--rule)] space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-2)]">
                  <Link2 size={14} className="text-[var(--accent)]" />
                  <span className="font-mono uppercase tracking-[0.09em] text-[10px]" style={{ fontFamily: 'var(--mono)' }}>
                    Linked Document Context
                  </span>
                </div>
                <select
                  value={noteLinkedDocId}
                  onChange={(e) => setNoteLinkedDocId(e.target.value)}
                  className="w-full bg-[var(--paper)] text-[var(--ink)] border border-[var(--rule)] p-2.5 rounded-[4px] focus:outline-none focus:border-[var(--accent)] font-sans"
                  style={{ fontSize: '16px' }}
                >
                  <option value="">No linked document</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Note Editor */}
            {(selectedItem && selectedItem.type === 'note') || isCreatingNote ? (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Note Title"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full bg-transparent border-b border-[var(--rule)] pb-2 font-normal focus:outline-none focus:border-[var(--accent)] placeholder-[var(--ink-2)] text-[var(--ink)] tracking-tight"
                  style={{ fontFamily: 'var(--serif)', fontSize: '22px' }}
                />
                <textarea
                  placeholder="Write your note here..."
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  className="w-full min-h-[300px] bg-transparent resize-none focus:outline-none placeholder-[var(--ink-2)] text-[var(--ink-2)] leading-relaxed font-sans"
                  style={{ fontSize: '16px' }}
                />
                {selectedItem && (
                  <div className="pt-4 border-t border-[var(--rule-2)] text-[10px] font-mono text-[var(--slate)] uppercase tracking-[0.09em]" style={{ fontFamily: 'var(--mono)' }}>
                    Last updated: {formattedDate(selectedItem.type === 'note' ? (selectedItem as SavedNote).updatedAt : '')}
                  </div>
                )}
              </div>
            ) : (
              /* Saved Read-Only Answer View */
              selectedItem && selectedItem.type === 'answer' && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-[var(--muted)]">
                      Saved answer
                    </span>
                    <h1 className="text-lg sm:text-xl text-[var(--ink)] leading-snug" style={{ fontWeight: 600, letterSpacing: '-0.036em' }}>
                      {(selectedItem as SavedAnswer).question}
                    </h1>
                    <div className="text-[12px] text-[var(--muted)]">
                      Saved {formattedDate((selectedItem as SavedAnswer).timestamp)}
                    </div>
                  </div>

                  {/* Read only citations-intact answer */}
                  <div className="leading-relaxed">
                    <GeminiMarkdownRenderer
                      text={(selectedItem as SavedAnswer).text}
                      citations={(selectedItem as SavedAnswer).citations}
                      onSelectDocument={onSelectDocument}
                      documents={documents}
                    />
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header Controls (Fixed above list) */}
          <div className="p-4 bg-[var(--paper)] border-b border-[var(--rule)] space-y-3.5 flex-shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Bookmark size={18} className="text-[var(--accent)] flex-shrink-0" />
                <h1 className="text-lg font-normal text-[var(--ink)] truncate" style={{ fontFamily: 'var(--serif)' }}>
                  Saved
                </h1>
                <span
                  className="bg-[var(--raised)] text-[var(--ink-2)] text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-[3px] flex-shrink-0"
                  style={{ fontFamily: 'var(--mono)' }}
                >
                  {savedItems.length}
                </span>
              </div>
              <button
                onClick={handleStartCreateNote}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--accent)] hover:opacity-90 text-[var(--paper)] rounded-full font-bold text-xs transition-colors cursor-pointer min-h-[44px] flex-shrink-0"
              >
                <Plus size={14} />
                <span>New Note</span>
              </button>
            </div>

            {/* Search Field */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--slate)] pointer-events-none" size={16} />
              <input
                type="text"
                placeholder="Search notes and answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-[var(--card)] text-[var(--ink)] placeholder-[var(--slate)] border border-[var(--rule)] rounded-xl focus:outline-none focus:border-[var(--accent)] transition-all font-sans"
                style={{ fontSize: '16px' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--slate)] hover:text-[var(--ink)] p-1 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Horizontally scrolling Filter Chips */}
            <div className="overflow-x-auto scrollbar-none -mx-4 px-4">
              <div className="flex items-center gap-2 whitespace-nowrap min-w-max pb-1">
                {(['all', 'notes', 'answers'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-3 py-2 rounded-full text-[13px] transition-all cursor-pointer min-h-[44px] flex items-center whitespace-nowrap ${
                      activeFilter === filter
                        ? 'bg-[var(--raised)] text-[var(--ink)] font-semibold'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter === 'notes' ? 'Notes' : 'Answers'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List Scroll Container */}
          <div className="flex-1 overflow-y-auto px-4">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const isNote = item.type === 'note';
                const title = isNote ? (item as SavedNote).title : (item as SavedAnswer).question;
                const preview = isNote ? (item as SavedNote).body : (item as SavedAnswer).text;
                const timestamp = isNote ? (item as SavedNote).updatedAt : (item as SavedAnswer).timestamp;
                const linkedId = isNote ? (item as SavedNote).linkedDocId : undefined;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className="flex items-center justify-between gap-3 py-3.5 min-h-[44px] border-b border-[var(--rule-2)] last:border-b-0 cursor-pointer group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap text-[12px] text-[var(--muted)]">
                        <span>{isNote ? 'Note' : 'Answer'}</span>
                        {linkedId && (
                          <span className="inline-flex items-center gap-1 min-w-0">
                            <Link2 size={10} />
                            <span className="truncate max-w-[120px]">{getLinkedDocTitle(linkedId)}</span>
                          </span>
                        )}
                        <span>·</span>
                        <span>{formattedDate(timestamp)}</span>
                      </div>
                      <h3 className="text-[14.5px] text-[var(--ink)] truncate">{title || 'Untitled Note'}</h3>
                      <p className="text-[12.5px] text-[var(--ink-2)] truncate">
                        {preview || <span className="italic text-[var(--muted)]">Empty content</span>}
                      </p>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] rounded-full transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                      title="Delete immediately"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            ) : (
              /* Empty State */
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-4 max-w-sm mx-auto">
                <div className="w-12 h-12 rounded-full bg-[var(--raised)] flex items-center justify-center text-[var(--slate)]">
                  <StickyNote size={24} />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-base font-normal text-[var(--ink)]" style={{ fontFamily: 'var(--serif)' }}>
                    Nothing saved yet
                  </h2>
                  <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                    AI research answers can be saved directly from the ask assistant, and custom notes can be authored here.
                  </p>
                </div>
                <button
                  onClick={handleStartCreateNote}
                  className="px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-[var(--paper)] rounded-full font-bold text-xs transition-colors cursor-pointer min-h-[44px]"
                >
                  New note
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
