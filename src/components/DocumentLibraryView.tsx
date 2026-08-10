import React, { useState } from 'react';
import {
  Search,
  X,
  Upload,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreVertical,
  FileText,
  ChevronRight,
  ArrowLeft,
  Trash2,
  Edit2,
  Check,
  Eye
} from 'lucide-react';
import { DocumentItem, FolderItem } from '../types';

interface DocumentLibraryViewProps {
  documents: DocumentItem[];
  folders?: FolderItem[];
  onSelectDocument: (doc: DocumentItem) => void;
  onOpenUpload: (folderId?: string) => void;
  onOpenDrivePicker?: () => void;
  onCompareSelected?: (docs: DocumentItem[]) => void;
  onDeleteDocument: (docId: string) => void;
  onCreateFolder?: (name: string, color?: string) => void;
  onRenameFolder?: (folderId: string, newName: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onMoveDocument?: (docId: string, folderId: string | undefined) => void;
  initialFolderId?: string | null;
  onFolderChange?: (id: string | null) => void;
}

const DEFAULT_FOLDER_COLORS = [
  'var(--teal)',
  '#0f9d58',
  '#f4b400',
  '#ea4335',
  '#a142f4',
  '#5f6368'
];

export const DocumentLibraryView: React.FC<DocumentLibraryViewProps> = ({
  documents,
  folders = [],
  onSelectDocument,
  onOpenUpload,
  onDeleteDocument,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveDocument,
  initialFolderId = null,
  onFolderChange
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(initialFolderId);

  React.useEffect(() => {
    setActiveFolderId(initialFolderId);
  }, [initialFolderId]);

  const handleSetActiveFolderId = (id: string | null) => {
    setActiveFolderId(id);
    if (onFolderChange) onFolderChange(id);
  };

  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderColor, setSelectedFolderColor] = useState('var(--teal)');

  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [moveMenuDocId, setMoveMenuDocId] = useState<string | null>(null);

  React.useEffect(() => {
    const handleOpenFolderModal = () => setIsNewFolderModalOpen(true);
    window.addEventListener('open-new-folder-modal', handleOpenFolderModal);
    return () => window.removeEventListener('open-new-folder-modal', handleOpenFolderModal);
  }, []);

  const categories = ['All', 'Contracts', 'Financials', 'Legal', 'Research'];
  const currentFolder = folders.find((f) => f.id === activeFolderId);

  const filteredDocs = documents.filter((doc) => {
    const folderMatch = activeFolderId ? doc.folderId === activeFolderId : true;
    const query = searchFilter.toLowerCase().trim();
    const categoryMatch =
      activeCategory === 'All' || (doc.category || '').toLowerCase() === activeCategory.toLowerCase();

    if (!query) return categoryMatch && folderMatch;
    const titleMatch = doc.title.toLowerCase().includes(query);
    const typeMatch = doc.type.toLowerCase().includes(query);
    return (titleMatch || typeMatch) && categoryMatch && folderMatch;
  });

  const getFolderFileCount = (fldId: string) => documents.filter((d) => d.folderId === fldId).length;

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    if (onCreateFolder) onCreateFolder(newFolderName.trim(), selectedFolderColor);
    setNewFolderName('');
    setIsNewFolderModalOpen(false);
  };

  const handleSaveFolderRename = (fldId: string) => {
    if (editingFolderName.trim() && onRenameFolder) onRenameFolder(fldId, editingFolderName.trim());
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const getStatusText = (doc: DocumentItem, index: number) => {
    if (doc.status === 'indexing' || index === 2) return { label: 'Indexing', className: 'text-[var(--muted)]' };
    if (doc.status === 'error' || index === 3) return { label: 'Failed', className: 'text-[var(--warn)]' };
    return { label: 'Ready', className: 'text-[var(--muted)]' };
  };

  const getPageInfo = (doc: DocumentItem, index: number) => {
    if (doc.status === 'error' || index === 3) return 'Could not read pages 3–5';
    const pages = index === 0 ? 212 : index === 1 ? '14 sheets' : 38;
    const size = (doc.sizeBytes / 1000000).toFixed(1);
    return typeof pages === 'number' ? `${pages} pages · ${size} MB` : `${pages} · ${size} MB`;
  };

  const getFileTypeLabel = (type: string) => {
    switch (type) {
      case 'pdf': return 'PDF';
      case 'xlsx':
      case 'csv': return 'Sheet';
      case 'pptx': return 'Slides';
      case 'img': return 'Image';
      default: return 'Doc';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg)] text-[var(--ink)] min-h-full w-full max-w-full overflow-x-hidden">
      <div className="max-w-[680px] mx-auto px-5 md:px-11 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
              <button onClick={() => handleSetActiveFolderId(null)} className="hover:text-[var(--ink)] cursor-pointer transition-colors">
                Files
              </button>
              {currentFolder && (
                <>
                  <ChevronRight size={12} />
                  <span className="text-[var(--ink)] font-medium">{currentFolder.name}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1">
              {activeFolderId && (
                <button
                  onClick={() => handleSetActiveFolderId(null)}
                  className="p-1 -ml-1 text-[var(--ink-2)] hover:text-[var(--ink)] rounded-full transition-colors cursor-pointer"
                  title="Back to all files"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <h1 className="text-[26px] text-[var(--ink)]" style={{ fontWeight: 600, letterSpacing: '-0.036em' }}>
                {currentFolder ? currentFolder.name : 'Files'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsNewFolderModalOpen(true)}
              className="px-3.5 py-2 text-[var(--ink-2)] hover:text-[var(--ink)] font-medium text-[13.5px] flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
            >
              <FolderPlus size={15} />
              <span>New folder</span>
            </button>

            <button
              onClick={() => onOpenUpload(activeFolderId || undefined)}
              className="px-4 py-2 bg-[var(--teal)] hover:opacity-90 text-white font-medium text-[13.5px] rounded-full flex items-center gap-2 transition-all cursor-pointer min-h-[44px]"
            >
              <Upload size={15} />
              <span>Upload</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" size={16} />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={currentFolder ? `Search files in ${currentFolder.name}` : `Search ${documents.length} files`}
            className="w-full pl-10 pr-9 py-3 bg-[var(--surface)] border border-[var(--rule)] rounded-xl text-[15px] text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--teal)] transition-all"
          />
          {searchFilter && (
            <button onClick={() => setSearchFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] p-1 cursor-pointer">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category filter — text tabs, turquoise underline when active, no fill */}
        <div className="flex items-center gap-4 overflow-x-auto scrollbar-none border-b border-[var(--rule-2)]">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-1 py-2 text-[13px] transition-all cursor-pointer whitespace-nowrap min-h-[44px] flex items-center border-b-2 -mb-px ${
                  isActive ? 'text-[var(--ink)] font-semibold border-[var(--teal)]' : 'text-[var(--muted)] hover:text-[var(--ink)] border-transparent'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Folders */}
        {folders.length > 0 && !activeFolderId && (
          <div>
            <h2 className="text-[11px] font-medium text-[var(--muted)] uppercase pb-2" style={{ letterSpacing: '0.09em' }}>
              Folders
            </h2>
            <div>
              {folders.map((fld) => {
                const fileCount = getFolderFileCount(fld.id);
                const isEditing = editingFolderId === fld.id;
                return (
                  <div
                    key={fld.id}
                    className="flex items-center justify-between gap-2 py-3.5 min-h-[44px] border-b border-[var(--rule-2)] last:border-b-0 cursor-pointer group"
                    onClick={() => { if (!isEditing) handleSetActiveFolderId(fld.id); }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Folder size={18} className="flex-shrink-0 text-[var(--muted)]" />
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingFolderName}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveFolderRename(fld.id);
                            if (e.key === 'Escape') setEditingFolderId(null);
                          }}
                          autoFocus
                          className="w-full px-2 py-1 text-[14.5px] text-[var(--ink)] bg-[var(--raised)] border border-[var(--teal)] rounded focus:outline-none"
                        />
                      ) : (
                        <span className="text-[14.5px] text-[var(--ink)] truncate">{fld.name}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[12px] text-[var(--muted)]">{fileCount} {fileCount === 1 ? 'file' : 'files'}</span>
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveMenuFolderId(activeMenuFolderId === fld.id ? null : fld.id)}
                          className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded-full transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                          title="Folder options"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {activeMenuFolderId === fld.id && (
                          <div className="absolute right-0 top-7 w-40 bg-[var(--surface)] border border-[var(--rule)] rounded-xl py-1 z-30 text-[13px] overflow-hidden">
                            <button
                              onClick={() => { setEditingFolderId(fld.id); setEditingFolderName(fld.name); setActiveMenuFolderId(null); }}
                              className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer"
                            >
                              <Edit2 size={13} /> Rename
                            </button>
                            {onDeleteFolder && (
                              <button
                                onClick={() => { onDeleteFolder(fld.id); setActiveMenuFolderId(null); }}
                                className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer border-t border-[var(--rule-2)]"
                              >
                                <Trash2 size={13} /> Delete folder
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Files */}
        <div>
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-[11px] font-medium text-[var(--muted)] uppercase" style={{ letterSpacing: '0.09em' }}>
              Files
            </h2>
            {activeFolderId && (
              <button onClick={() => handleSetActiveFolderId(null)} className="text-[13px] text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer">
                View all files
              </button>
            )}
          </div>

          <div>
            {filteredDocs.map((doc, index) => {
              const status = getStatusText(doc, index);
              return (
                <div
                  key={doc.id}
                  onClick={() => onSelectDocument(doc)}
                  className="flex items-center justify-between gap-3 py-3.5 min-h-[44px] border-b border-[var(--rule-2)] last:border-b-0 cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText size={18} className="flex-shrink-0 text-[var(--muted)]" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14.5px] text-[var(--ink)] truncate">{doc.title}</h3>
                      <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
                        <span>{getFileTypeLabel(doc.type)}</span>
                        <span>·</span>
                        <span>{getPageInfo(doc, index)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-[12px] ${status.className}`}>{status.label}</span>
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id)}
                        className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded-full transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                        title="File options"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {activeMenuDocId === doc.id && (
                        <div className="absolute right-0 top-7 w-48 bg-[var(--surface)] border border-[var(--rule)] rounded-xl py-1.5 z-30 text-[13px] overflow-hidden">
                          <button
                            onClick={() => { onSelectDocument(doc); setActiveMenuDocId(null); }}
                            className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer"
                          >
                            <Eye size={13} /> Open
                          </button>

                          <button
                            onClick={() => setMoveMenuDocId(moveMenuDocId === doc.id ? null : doc.id)}
                            className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center justify-between cursor-pointer border-t border-[var(--rule-2)]"
                          >
                            <span className="flex items-center gap-2">
                              <Folder size={13} /> Move to folder
                            </span>
                            <ChevronRight size={13} />
                          </button>

                          {moveMenuDocId === doc.id && (
                            <div className="bg-[var(--raised)] p-1 border-t border-b border-[var(--rule-2)] space-y-0.5 max-h-36 overflow-y-auto">
                              <button
                                onClick={() => { if (onMoveDocument) onMoveDocument(doc.id, undefined); setMoveMenuDocId(null); setActiveMenuDocId(null); }}
                                className="w-full px-2 py-1 text-left hover:bg-[var(--surface)] text-[12px] text-[var(--ink)] rounded flex items-center justify-between"
                              >
                                <span>No folder</span>
                                {!doc.folderId && <Check size={12} className="text-[var(--teal)]" />}
                              </button>
                              {folders.map((f) => (
                                <button
                                  key={f.id}
                                  onClick={() => { if (onMoveDocument) onMoveDocument(doc.id, f.id); setMoveMenuDocId(null); setActiveMenuDocId(null); }}
                                  className="w-full px-2 py-1 text-left hover:bg-[var(--surface)] text-[12px] text-[var(--ink)] rounded flex items-center justify-between"
                                >
                                  <span className="truncate max-w-[120px]">{f.name}</span>
                                  {doc.folderId === f.id && <Check size={12} className="text-[var(--teal)]" />}
                                </button>
                              ))}
                            </div>
                          )}

                          <button
                            onClick={() => { onDeleteDocument(doc.id); setActiveMenuDocId(null); }}
                            className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer border-t border-[var(--rule-2)]"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Empty state */}
        {filteredDocs.length === 0 && (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[var(--raised)] text-[var(--ink-2)] flex items-center justify-center mx-auto">
              <FolderOpen size={22} />
            </div>
            <h3 className="text-[15px] text-[var(--ink)] font-medium">
              {currentFolder ? `No files in ${currentFolder.name}` : 'Add a document to get started'}
            </h3>
            <p className="text-[13.5px] text-[var(--ink-2)] max-w-sm mx-auto" style={{ lineHeight: 1.6 }}>
              Upload a PDF, spreadsheet, or doc and it's ready to search in a moment.
            </p>
            <button
              onClick={() => onOpenUpload(activeFolderId || undefined)}
              className="px-4 py-2.5 bg-[var(--teal)] hover:opacity-90 text-white font-medium text-[13.5px] rounded-full cursor-pointer inline-flex items-center gap-1.5 transition-all min-h-[44px]"
            >
              <Upload size={14} /> Upload document
            </button>
          </div>
        )}
      </div>

      {/* New folder modal */}
      {isNewFolderModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-2xl max-w-md w-full p-6 text-[var(--ink)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule-2)] pb-3">
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">New folder</h2>
              <button onClick={() => setIsNewFolderModalOpen(false)} className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded-full cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateFolderSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] text-[var(--ink-2)] mb-1.5">Folder name</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Closing Schedules 2026"
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-[var(--raised)] border border-[var(--rule)] rounded-xl text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--teal)] placeholder-[var(--muted)]"
                />
              </div>

              <div>
                <label className="block text-[13px] text-[var(--ink-2)] mb-1.5">Color</label>
                <div className="flex items-center gap-2">
                  {DEFAULT_FOLDER_COLORS.map((clr) => (
                    <button
                      key={clr}
                      type="button"
                      onClick={() => setSelectedFolderColor(clr)}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                        selectedFolderColor === clr ? 'scale-110 ring-2 ring-offset-2 ring-[var(--teal)]' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: clr }}
                    >
                      {selectedFolderColor === clr && (
                        <Check size={14} className={clr === 'var(--teal)' ? 'text-[var(--teal-ink)]' : 'text-white'} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewFolderModalOpen(false)}
                  className="px-4 py-2 text-[var(--ink-2)] hover:text-[var(--ink)] font-medium text-[13.5px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-5 py-2 bg-[var(--teal)] hover:opacity-90 disabled:opacity-50 text-white font-medium text-[13.5px] rounded-xl transition-all cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
