import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Bookmark, 
  StickyNote, 
  Link2, 
  Check, 
  Calendar,
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
    <div className="flex flex-col h-full bg-[#F4F1EA] text-[#1C1917] select-none">
      {/* Detail view / Editor (Tapping a row opens it) */}
      {selectedItem || isCreatingNote ? (
        <div className="flex-1 flex flex-col h-full bg-[#FBF9F4] animate-in fade-in duration-200">
          {/* Editor Header */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-[#DDD6C8] bg-[#FBF9F4]">
            <button
              onClick={handleCloseDetail}
              className="flex items-center gap-2 text-[#57534E] hover:text-[#1C1917] font-sans font-bold text-sm cursor-pointer min-h-[44px]"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-2">
              {(selectedItem && selectedItem.type === 'note' || isCreatingNote) ? (
                <button
                  onClick={handleSaveNote}
                  className="px-4 py-1.5 bg-[#8C2F27] hover:bg-[#8C2F27]/90 text-white rounded-[4px] font-sans font-bold text-xs cursor-pointer min-h-[44px]"
                >
                  Save Note
                </button>
              ) : null}
              {selectedItem && (
                <button
                  onClick={() => handleDeleteItem(selectedItem.id)}
                  className="p-2 text-[#78716C] hover:text-[#8C2F27] hover:bg-[#F4F1EA] rounded-[4px] transition-colors cursor-pointer min-h-[44px]"
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
            {(selectedItem && selectedItem.type === 'note' || isCreatingNote) && (
              <div className="bg-[#F4F1EA] p-3 rounded-[4px] border border-[#DDD6C8] space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#57534E]">
                  <Link2 size={14} className="text-[#8C2F27]" />
                  <span className="font-mono uppercase tracking-wider text-[10px]" style={{ fontFamily: 'monospace' }}>
                    Linked Document Context
                  </span>
                </div>
                <select
                  value={noteLinkedDocId}
                  onChange={(e) => setNoteLinkedDocId(e.target.value)}
                  className="w-full bg-[#FBF9F4] text-[#1C1917] border border-[#DDD6C8] p-2.5 rounded-[4px] focus:outline-none focus:border-[#8C2F27] font-sans"
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
            {(selectedItem && selectedItem.type === 'note' || isCreatingNote) ? (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Note Title"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full bg-transparent border-b border-[#DDD6C8]/60 pb-2 text-2xl font-bold focus:outline-none focus:border-[#8C2F27] placeholder-[#78716C] text-[#1C1917]"
                  style={{ fontFamily: 'Georgia, serif', fontSize: '20px' }}
                />
                <textarea
                  placeholder="Write your note here..."
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  className="w-full min-h-[300px] bg-transparent resize-none focus:outline-none placeholder-[#78716C] text-[#57534E] leading-relaxed"
                  style={{ fontFamily: 'Georgia, serif', fontSize: '16px' }}
                />
                {selectedItem && (
                  <div className="pt-4 border-t border-[#DDD6C8]/40 text-[10px] font-mono text-[#78716C] uppercase tracking-wider" style={{ fontFamily: 'monospace' }}>
                    Last updated: {formattedDate(selectedItem.type === 'note' ? (selectedItem as SavedNote).updatedAt : '')}
                  </div>
                )}
              </div>
            ) : (
              /* Saved Read-Only Answer View */
              selectedItem && selectedItem.type === 'answer' && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <span className="inline-block px-2 py-0.5 bg-[#8C2F27]/10 text-[#8C2F27] font-mono text-[9px] font-bold uppercase tracking-wider rounded-[3px]" style={{ fontFamily: 'monospace' }}>
                      AI RESEARCH ANSWER
                    </span>
                    <h1 className="text-xl font-bold text-[#1C1917] leading-snug" style={{ fontFamily: 'Georgia, serif' }}>
                      {(selectedItem as SavedAnswer).question}
                    </h1>
                    <div className="text-[10px] font-mono text-[#78716C] uppercase tracking-wider" style={{ fontFamily: 'monospace' }}>
                      Saved on: {formattedDate((selectedItem as SavedAnswer).timestamp)}
                    </div>
                  </div>

                  {/* Read only citations-intact answer */}
                  <div className="p-5 bg-[#FBF9F4] border border-[#DDD6C8] rounded-[4px] leading-relaxed text-[#57534E]">
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
          <div className="p-4 bg-[#FBF9F4] border-b border-[#DDD6C8] space-y-3.5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark size={20} className="text-[#8C2F27]" />
                <h1 className="text-lg font-bold text-[#1C1917]" style={{ fontFamily: 'Georgia, serif' }}>
                  Saved Notebook
                </h1>
                <span className="bg-[#DDD6C8] text-[#1C1917] text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-[3px]" style={{ fontFamily: 'monospace' }}>
                  {savedItems.length}
                </span>
              </div>
              <button
                onClick={handleStartCreateNote}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8C2F27] hover:bg-[#8C2F27]/90 text-white rounded-[4px] font-sans font-bold text-xs transition-colors cursor-pointer min-h-[44px]"
              >
                <Plus size={14} />
                <span>New Note</span>
              </button>
            </div>

            {/* Search Field */}
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-[#78716C]" />
              <input
                type="text"
                placeholder="Search notes and answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-[#F4F1EA] text-[#1C1917] placeholder-[#78716C] border border-[#DDD6C8] rounded-[4px] focus:outline-none focus:border-[#8C2F27] font-sans"
                style={{ fontSize: '16px' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 p-1 text-[#78716C] hover:text-[#1C1917]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Horizontally scrolling Filter Chips */}
            <div className="overflow-x-auto scrollbar-none -mx-4 px-4">
              <div className="flex items-center gap-1.5 whitespace-nowrap min-w-max pb-1">
                {(['all', 'notes', 'answers'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-3 py-1 rounded-[4px] border font-sans font-bold text-[11px] uppercase tracking-wider transition-all cursor-pointer min-h-[44px] flex items-center ${
                      activeFilter === filter
                        ? 'bg-[#1C1917] text-white border-[#1C1917]'
                        : 'bg-[#F4F1EA] text-[#57534E] border-[#DDD6C8] hover:bg-[#FBF9F4] hover:text-[#1C1917]'
                    }`}
                  >
                    {filter === 'all' ? 'All Items' : filter === 'notes' ? 'My Notes' : 'Saved Answers'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List Scroll Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                    className="flex flex-col justify-between p-4 bg-[#FBF9F4] border border-[#DDD6C8] hover:border-[#8C2F27] rounded-[4px] transition-all cursor-pointer min-h-[74px]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span 
                            className={`px-1.5 py-0.2 font-mono text-[8px] font-black uppercase tracking-wider rounded-[2px] ${
                              isNote 
                                ? 'bg-[#8C2F27]/10 text-[#8C2F27]' 
                                : 'bg-[#1C1917]/10 text-[#1C1917]'
                            }`}
                            style={{ fontFamily: 'monospace' }}
                          >
                            {isNote ? 'NOTE' : 'ANSWER'}
                          </span>
                          {linkedId && (
                            <span 
                              className="inline-flex items-center gap-0.5 font-mono text-[8px] font-bold text-[#78716C]"
                              style={{ fontFamily: 'monospace' }}
                            >
                              <Link2 size={8} />
                              <span className="truncate max-w-[120px]">{getLinkedDocTitle(linkedId)}</span>
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-[#1C1917] truncate leading-snug" style={{ fontFamily: 'Georgia, serif' }}>
                          {title || 'Untitled Note'}
                        </h3>
                        <p className="text-xs text-[#57534E] truncate leading-relaxed">
                          {preview || <span className="italic text-[#78716C]">Empty content</span>}
                        </p>
                      </div>
                      
                      {/* Trash action shortcut directly from row */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(item.id);
                        }}
                        className="p-1.5 text-[#78716C]/50 hover:text-[#8C2F27] hover:bg-[#F4F1EA] rounded-[4px] transition-colors min-h-[44px]"
                        title="Delete immediately"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2.5 pt-1.5 border-t border-[#DDD6C8]/30">
                      <Calendar size={10} className="text-[#78716C]" />
                      <span className="font-mono text-[9px] text-[#78716C] uppercase" style={{ fontFamily: 'monospace' }}>
                        {formattedDate(timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              /* Empty State */
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-4 max-w-sm mx-auto">
                <div className="w-12 h-12 rounded-full bg-[#DDD6C8]/40 flex items-center justify-center text-[#78716C]">
                  <StickyNote size={24} />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-base font-bold text-[#1C1917]" style={{ fontFamily: 'Georgia, serif' }}>
                    Nothing saved yet
                  </h2>
                  <p className="text-xs text-[#57534E] leading-relaxed">
                    AI research answers can be saved directly from the ask assistant, and custom notes can be authored here.
                  </p>
                </div>
                <button
                  onClick={handleStartCreateNote}
                  className="px-4 py-2 bg-[#8C2F27] hover:bg-[#8C2F27]/90 text-white rounded-[4px] font-sans font-bold text-xs transition-colors cursor-pointer min-h-[44px]"
                >
                  Create first note
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
