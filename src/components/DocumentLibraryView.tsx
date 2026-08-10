import React, { useState } from 'react';
import {
  Search,
  X,
  Plus,
  Upload,
  Folder,
  FolderOpen,
  FolderPlus,
  Grid,
  List,
  MoreVertical,
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  Image as ImageIcon,
  ChevronRight,
  ArrowLeft,
  Trash2,
  Edit2,
  MoveRight,
  Check,
  Eye,
  Download,
  Sparkles
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
  'var(--accent)', // Accent/baby blue
  '#0f9d58',       // Drive Green
  '#f4b400',       // Drive Yellow
  '#ea4335',       // Drive Red
  '#a142f4',       // Purple
  '#5f6368'        // Grey
];

export const DocumentLibraryView: React.FC<DocumentLibraryViewProps> = ({
  documents,
  folders = [],
  onSelectDocument,
  onOpenUpload,
  onOpenDrivePicker,
  onCompareSelected,
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(initialFolderId);

  React.useEffect(() => {
    setActiveFolderId(initialFolderId);
  }, [initialFolderId]);

  const handleSetActiveFolderId = (id: string | null) => {
    setActiveFolderId(id);
    if (onFolderChange) {
      onFolderChange(id);
    }
  };

  // Modal States for Folder Creation
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderColor, setSelectedFolderColor] = useState('var(--accent)');

  // Folder Context Menu & Action States
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [moveMenuDocId, setMoveMenuDocId] = useState<string | null>(null);

  // Listen for open-new-folder-modal event from mobile FAB
  React.useEffect(() => {
    const handleOpenFolderModal = () => {
      setIsNewFolderModalOpen(true);
    };
    window.addEventListener('open-new-folder-modal', handleOpenFolderModal);
    return () => {
      window.removeEventListener('open-new-folder-modal', handleOpenFolderModal);
    };
  }, []);

  const categories = ['All', 'Contracts', 'Financials', 'Legal', 'Research'];

  // Current Active Folder Object
  const currentFolder = folders.find((f) => f.id === activeFolderId);

  // Filter Documents based on folder, category, and search query
  const filteredDocs = documents.filter((doc) => {
    // Folder match: if activeFolderId is set, show only docs inside that folder;
    // if activeFolderId is null, show docs that have no folder or show all depending on user view
    const folderMatch = activeFolderId ? doc.folderId === activeFolderId : true;

    const query = searchFilter.toLowerCase().trim();
    const categoryMatch =
      activeCategory === 'All' ||
      (doc.category || '').toLowerCase() === activeCategory.toLowerCase();

    if (!query) return categoryMatch && folderMatch;

    const titleMatch = doc.title.toLowerCase().includes(query);
    const typeMatch = doc.type.toLowerCase().includes(query);
    return (titleMatch || typeMatch) && categoryMatch && folderMatch;
  });

  // Calculate file counts for each folder
  const getFolderFileCount = (fldId: string) => {
    return documents.filter((d) => d.folderId === fldId).length;
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    if (onCreateFolder) {
      onCreateFolder(newFolderName.trim(), selectedFolderColor);
    }
    setNewFolderName('');
    setIsNewFolderModalOpen(false);
  };

  const handleSaveFolderRename = (fldId: string) => {
    if (editingFolderName.trim() && onRenameFolder) {
      onRenameFolder(fldId, editingFolderName.trim());
    }
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const getStatusBadge = (doc: DocumentItem, index: number) => {
    if (doc.status === 'indexing' || index === 2) {
      return (
        <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 uppercase tracking-wider border border-amber-500/20">
          Indexing
        </span>
      );
    }
    if (doc.status === 'error' || index === 3) {
      return (
        <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 uppercase tracking-wider border border-rose-500/20">
          Failed
        </span>
      );
    }
    return (
      <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 uppercase tracking-wider border border-emerald-500/20">
        Ready
      </span>
    );
  };

  const getPageInfo = (doc: DocumentItem, index: number) => {
    if (doc.status === 'error' || index === 3) return 'COULD NOT READ PAGES 3-5';
    const pages = index === 0 ? 212 : index === 1 ? '14 SHEETS' : 38;
    const size = (doc.sizeBytes / 1000000).toFixed(1);
    return typeof pages === 'number' ? `${pages} PAGES · ${size} MB` : `${pages} · ${size} MB`;
  };

  // Render Google Drive Thumbnail Preview Box with Premium Dark Aesthetic
  const renderDriveThumbnail = (doc: DocumentItem, index: number) => {
    const isPdf = doc.type === 'pdf' || doc.title.toLowerCase().endsWith('.pdf');
    const isSpreadsheet =
      doc.type === 'xlsx' ||
      doc.type === 'csv' ||
      doc.title.toLowerCase().endsWith('.xlsx') ||
      doc.title.toLowerCase().endsWith('.csv');
    const isPresentation = doc.type === 'pptx' || doc.title.toLowerCase().endsWith('.pptx');
    const isImage =
      doc.type === 'img' ||
      doc.title.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/i);

    if (isImage) {
      return (
        <div className="w-full h-[115px] bg-[var(--raised)] border border-[var(--rule)] rounded-md shadow-2xs p-1 flex items-center justify-center group-hover:scale-[1.02] transition-transform relative overflow-hidden">
          {doc.fileUrl ? (
            <img src={doc.fileUrl} alt={doc.title} className="w-full h-full object-cover rounded" />
          ) : (
            <div className="flex flex-col items-center text-[var(--ink)]/80 space-y-0.5">
              <ImageIcon size={20} className="text-[var(--accent)]" />
              <span className="text-[8px] font-mono uppercase font-bold text-[var(--ink-2)]">IMAGE PREVIEW</span>
            </div>
          )}
        </div>
      );
    }

    if (isSpreadsheet) {
      return (
        <div className="w-full h-[115px] bg-[var(--card)] border border-[var(--rule)] rounded-md shadow-2xs p-1.5 flex flex-col justify-between group-hover:scale-[1.02] transition-transform relative overflow-hidden">
          <div className="space-y-0.5">
            <div className="flex items-center justify-between bg-emerald-500/10 p-0.5 rounded border border-emerald-500/20">
              <span className="text-[7px] font-mono font-bold text-emerald-400">FINANCIAL</span>
              <span className="text-[7px] font-mono text-emerald-400 font-bold">XLSX</span>
            </div>
            <div className="grid grid-cols-3 gap-0.5 pt-0.5 text-[5px] font-mono">
              <div className="bg-[var(--raised)] p-0.5 font-bold text-[var(--ink)]">COL A</div>
              <div className="bg-[var(--raised)] p-0.5 font-bold text-[var(--ink)]">COL B</div>
              <div className="bg-[var(--raised)] p-0.5 font-bold text-[var(--ink)]">COL C</div>
              <div className="bg-[var(--paper)] border border-[var(--rule)] p-0.5 text-[5px] text-[var(--ink-2)]">$4.2M</div>
              <div className="bg-[var(--paper)] border border-[var(--rule)] p-0.5 text-[5px] text-[var(--ink-2)]">12%</div>
              <div className="bg-[var(--paper)] border border-[var(--rule)] p-0.5 text-[5px] text-emerald-400 font-bold">VERIFIED</div>
            </div>
          </div>
          <div className="border-t border-[var(--rule)] pt-0.5 text-[6px] font-mono text-[var(--slate)] flex justify-between font-bold">
            <span>14 SHEETS</span>
            <span>CELLS</span>
          </div>
        </div>
      );
    }

    if (isPresentation) {
      return (
        <div className="w-full h-[115px] bg-[var(--card)] border border-[var(--rule)] rounded-md shadow-2xs p-1.5 flex flex-col justify-between group-hover:scale-[1.02] transition-transform relative overflow-hidden">
          <div className="space-y-1">
            <div className="bg-amber-500/10 p-0.5 rounded border border-amber-500/20 flex justify-between items-center">
              <span className="text-[7px] font-mono font-bold text-amber-400">SLIDE DECK</span>
              <span className="text-[7px] font-mono font-bold text-amber-400">PPTX</span>
            </div>
            <div className="h-1.5 w-full bg-amber-500/20 rounded" />
            <div className="grid grid-cols-2 gap-1 pt-0.5">
              <div className="h-7 bg-[var(--raised)] rounded p-0.5 space-y-0.5">
                <div className="h-1 w-full bg-[var(--ink)]/60 rounded" />
                <div className="h-1 w-2/3 bg-[var(--slate)]/40 rounded" />
              </div>
              <div className="h-7 bg-[var(--raised)] rounded p-0.5 space-y-0.5">
                <div className="h-1 w-full bg-[var(--ink)]/60 rounded" />
                <div className="h-1 w-2/3 bg-[var(--slate)]/40 rounded" />
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--rule)] pt-0.5 text-[6px] font-mono text-[var(--slate)] flex justify-between font-bold">
            <span>KEYNOTE</span>
            <span>24 SLIDES</span>
          </div>
        </div>
      );
    }

    if (isPdf) {
      return (
        <div className="w-full h-[115px] bg-[var(--card)] border border-[var(--rule)] rounded-md shadow-2xs p-1.5 flex flex-col justify-between group-hover:scale-[1.02] transition-transform relative overflow-hidden">
          <div className="space-y-1">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-0.5">
              <div className="h-1 w-12 bg-rose-500/80 rounded" />
              <span className="text-[6px] font-mono font-bold text-rose-400 bg-rose-500/10 px-1 rounded border border-rose-500/20">
                PDF
              </span>
            </div>
            <div className="h-1 w-full bg-[var(--ink)]/80 rounded" />
            <div className="h-1 w-4/5 bg-[var(--slate)] rounded" />
            <div className="h-1 w-full bg-[var(--raised)] rounded" />
            <div className="mt-1 p-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[5px] font-mono font-bold text-[var(--ink)] truncate">
              {doc.title.slice(0, 18)}
            </div>
          </div>
          <div className="border-t border-[var(--rule)] pt-0.5 flex justify-between text-[6px] font-mono text-[var(--slate)] font-bold">
            <span>PAGE 44</span>
            <span>VERIFIED</span>
          </div>
        </div>
      );
    }

    // Default DOCX / TXT / Document
    return (
      <div className="w-full h-[115px] bg-[var(--card)] border border-[var(--rule)] rounded-md shadow-2xs p-1.5 flex flex-col justify-between group-hover:scale-[1.02] transition-transform relative overflow-hidden">
        <div className="space-y-1">
          <div className="flex items-center justify-between border-b border-[var(--rule)] pb-0.5">
            <div className="h-1 w-16 bg-[var(--accent)] rounded" />
            <span className="text-[6px] font-mono font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-1 rounded border border-[var(--accent)]/20">
              DOC
            </span>
          </div>
          <div className="h-1 w-full bg-[var(--ink)] rounded" />
          <div className="h-1 w-full bg-[var(--slate)] rounded" />
          <div className="h-1 w-3/4 bg-[var(--raised)] rounded" />
        </div>
        <div className="border-t border-[var(--rule)] pt-0.5 flex justify-between text-[6px] font-mono text-[var(--slate)] font-bold">
          <span>INDEXED</span>
          <span>WORD</span>
        </div>
      </div>
    );
  };

  // Get File Type Icon badge
  const getFileTypeBadge = (type: string) => {
    switch (type) {
      case 'pdf':
        return <div className="w-5 h-5 rounded bg-rose-600 text-white flex items-center justify-center font-black text-[9px] flex-shrink-0">PDF</div>;
      case 'xlsx':
      case 'csv':
        return <div className="w-5 h-5 rounded bg-emerald-600 text-white flex items-center justify-center font-black text-[9px] flex-shrink-0">XLS</div>;
      case 'pptx':
        return <div className="w-5 h-5 rounded bg-amber-500 text-white flex items-center justify-center font-black text-[9px] flex-shrink-0">PPT</div>;
      case 'img':
        return <div className="w-5 h-5 rounded bg-purple-600 text-white flex items-center justify-center font-black text-[9px] flex-shrink-0">IMG</div>;
      default:
        return <div className="w-5 h-5 rounded bg-[var(--teal)] text-white flex items-center justify-center font-black text-[9px] flex-shrink-0">DOC</div>;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--paper)] text-[var(--ink)] min-h-full p-4 sm:p-5 space-y-4">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--rule)] gap-3">
        <div>
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-[var(--slate)] uppercase tracking-wider">
            <button
              onClick={() => handleSetActiveFolderId(null)}
              className="hover:text-[var(--ink)] cursor-pointer transition-colors"
            >
              WORKSPACE
            </button>
            {currentFolder && (
              <>
                <ChevronRight size={12} className="text-[var(--slate)]" />
                <span className="text-[var(--ink)] font-extrabold">{currentFolder.name}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {activeFolderId && (
              <button
                onClick={() => handleSetActiveFolderId(null)}
                className="p-1 text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--raised)] rounded-lg transition-colors cursor-pointer mr-1"
                title="Back to all files"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h1 className="text-xl sm:text-2xl font-normal text-[var(--ink)] tracking-tight" style={{ fontFamily: 'var(--serif)' }}>
              {currentFolder ? currentFolder.name : 'Meridian Acquisition'}
            </h1>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsNewFolderModalOpen(true)}
            className="px-3.5 py-1.5 bg-[var(--card)] hover:bg-[var(--raised)] text-[var(--ink)] font-bold text-xs rounded-full border border-[var(--rule)] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs min-h-[44px]"
          >
            <FolderPlus size={15} className="text-[var(--accent)]" />
            <span>New folder</span>
          </button>

          <button
            onClick={() => onOpenUpload(activeFolderId || undefined)}
            className="px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-[var(--paper)] font-bold text-xs rounded-full flex items-center gap-2 transition-all cursor-pointer shadow-xs min-h-[44px]"
            title="Upload a new document"
          >
            <Upload size={15} />
            <span>Upload document</span>
          </button>
        </div>
      </div>

      {/* Search Input & View Toggle Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:flex-1">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--slate)] pointer-events-none"
            size={16}
          />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={
              currentFolder
                ? `Search files in ${currentFolder.name}...`
                : `Search ${documents.length} sources...`
            }
            className="w-full pl-10 pr-9 py-2.5 bg-[var(--card)] border border-[var(--rule)] rounded-xl text-sm text-[var(--ink)] placeholder-[var(--slate)] focus:outline-none focus:border-[var(--accent)] transition-all shadow-2xs"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--slate)] hover:text-[var(--ink)] p-1 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* View Mode Switcher (Grid vs List) */}
        <div className="flex items-center gap-1 bg-[var(--card)] p-1 rounded-xl border border-[var(--rule)] shadow-2xs self-end sm:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer w-11 h-11 flex items-center justify-center ${
              viewMode === 'grid'
                ? 'bg-[var(--accent)] text-[var(--paper)] shadow-2xs'
                : 'text-[var(--slate)] hover:text-[var(--ink)] hover:bg-[var(--raised)]'
            }`}
            title="Grid View"
          >
            <Grid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer w-11 h-11 flex items-center justify-center ${
              viewMode === 'list'
                ? 'bg-[var(--accent)] text-[var(--paper)] shadow-2xs'
                : 'text-[var(--slate)] hover:text-[var(--ink)] hover:bg-[var(--raised)]'
            }`}
            title="List View"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Filter Category Chips */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px] flex items-center ${
                isActive
                  ? 'bg-[var(--accent)] text-[var(--paper)]'
                  : 'bg-[var(--card)] text-[var(--ink-2)] border border-[var(--rule)] hover:bg-[var(--raised)]'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* 1. FOLDERS SECTION */}
      {folders.length > 0 && !activeFolderId && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold text-[var(--slate)] uppercase tracking-wider">
              FOLDERS ({folders.length})
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {folders.map((fld) => {
              const fileCount = getFolderFileCount(fld.id);
              const isEditing = editingFolderId === fld.id;

              return (
                <div
                  key={fld.id}
                  className="bg-[var(--card)] border border-[var(--rule)] hover:border-[var(--accent)] rounded-xl p-3 flex items-center justify-between gap-2 shadow-2xs group cursor-pointer transition-all relative"
                  onClick={() => {
                    if (!isEditing) handleSetActiveFolderId(fld.id);
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Folder
                      size={22}
                      className="flex-shrink-0"
                      style={{ color: fld.color || 'var(--accent)', fill: fld.color || 'var(--accent)', fillOpacity: 0.15 }}
                    />
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
                        className="w-full px-2 py-1 text-xs font-bold text-[var(--ink)] bg-[var(--raised)] border border-[var(--accent)] rounded focus:outline-none"
                      />
                    ) : (
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-xs text-[var(--ink)] truncate">
                          {fld.name}
                        </h3>
                        <span className="font-mono text-[10px] text-[var(--slate)] font-bold block">
                          {fileCount} {fileCount === 1 ? 'file' : 'files'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Folder Options Menu */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() =>
                        setActiveMenuFolderId(activeMenuFolderId === fld.id ? null : fld.id)
                      }
                      className="p-1 text-[var(--slate)] hover:text-[var(--ink)] rounded-lg hover:bg-[var(--raised)] transition-colors cursor-pointer"
                      title="Folder Options"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {activeMenuFolderId === fld.id && (
                      <div className="absolute right-0 top-7 w-40 bg-[var(--card)] border border-[var(--rule)] rounded-xl shadow-lg py-1 z-30 font-sans text-xs overflow-hidden">
                        <button
                          onClick={() => {
                            setEditingFolderId(fld.id);
                            setEditingFolderName(fld.name);
                            setActiveMenuFolderId(null);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer font-semibold"
                        >
                          <Edit2 size={13} /> Rename
                        </button>
                        {onDeleteFolder && (
                          <button
                            onClick={() => {
                              onDeleteFolder(fld.id);
                              setActiveMenuFolderId(null);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-rose-500/15 text-rose-400 flex items-center gap-2 cursor-pointer font-semibold border-t border-[var(--rule)]"
                          >
                            <Trash2 size={13} /> Delete folder
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. FILES SECTION HEADER */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--rule)]">
        <span className="font-mono text-[10px] font-bold text-[var(--slate)] uppercase tracking-wider">
          FILES ({filteredDocs.length})
        </span>

        {activeFolderId && (
          <button
            onClick={() => handleSetActiveFolderId(null)}
            className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer flex items-center gap-1"
          >
            View all files
          </button>
        )}
      </div>

      {/* 3. FILES DISPLAY (GRID VIEW WITH GOOGLE DRIVE THUMBNAILS vs LIST VIEW) */}
      {viewMode === 'grid' ? (
        /* GOOGLE DRIVE STYLE THUMBNAIL GRID */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredDocs.map((doc, index) => (
            <div
              key={doc.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectDocument(doc);
              }}
              className="bg-[var(--card)] border border-[var(--rule)] hover:border-[var(--accent)] hover:ring-2 hover:ring-[var(--accent)]/15 rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between relative"
              title="Click thumbnail to view document"
            >
              {/* Drive Card Top Header */}
              <div
                className="p-2.5 border-b border-[var(--rule)] flex items-start justify-between gap-2 bg-[var(--card)] cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDocument(doc);
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {getFileTypeBadge(doc.type)}
                  <h3 className="font-bold text-xs text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors truncate tracking-tight leading-tight">
                    {doc.title}
                  </h3>
                </div>

                {/* File Options 3-Dots Dropdown */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id)}
                    className="p-1 text-[var(--slate)] hover:text-[var(--ink)] rounded-lg hover:bg-[var(--raised)] transition-colors cursor-pointer"
                    title="File Options"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {activeMenuDocId === doc.id && (
                    <div className="absolute right-0 top-7 w-48 bg-[var(--card)] border border-[var(--rule)] rounded-xl shadow-lg py-1.5 z-30 text-xs overflow-hidden">
                      <button
                        onClick={() => {
                          onSelectDocument(doc);
                          setActiveMenuDocId(null);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer font-semibold"
                      >
                        <Eye size={13} /> Open viewer
                      </button>

                      {/* Move to folder submenu */}
                      <button
                        onClick={() => {
                          setMoveMenuDocId(moveMenuDocId === doc.id ? null : doc.id);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center justify-between cursor-pointer font-semibold border-t border-[var(--rule)]"
                      >
                        <span className="flex items-center gap-2">
                          <Folder size={13} className="text-[var(--accent)]" /> Move to folder
                        </span>
                        <ChevronRight size={13} />
                      </button>

                      {moveMenuDocId === doc.id && (
                        <div className="bg-[var(--raised)] p-1 border-t border-b border-[var(--rule)] space-y-0.5 max-h-36 overflow-y-auto">
                          <button
                            onClick={() => {
                              if (onMoveDocument) onMoveDocument(doc.id, undefined);
                              setMoveMenuDocId(null);
                              setActiveMenuDocId(null);
                            }}
                            className="w-full px-2 py-1 text-left hover:bg-[var(--card)] text-[11px] font-bold text-[var(--ink)] rounded flex items-center justify-between"
                          >
                            <span>Root (No Folder)</span>
                            {!doc.folderId && <Check size={12} className="text-[var(--accent)]" />}
                          </button>
                          {folders.map((f) => (
                            <button
                              key={f.id}
                              onClick={() => {
                                if (onMoveDocument) onMoveDocument(doc.id, f.id);
                                setMoveMenuDocId(null);
                                setActiveMenuDocId(null);
                              }}
                              className="w-full px-2 py-1 text-left hover:bg-[var(--card)] text-[11px] font-bold text-[var(--ink)] rounded flex items-center justify-between"
                            >
                              <span className="truncate max-w-[120px]">{f.name}</span>
                              {doc.folderId === f.id && <Check size={12} className="text-[var(--accent)]" />}
                            </button>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          onDeleteDocument(doc.id);
                          setActiveMenuDocId(null);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-rose-500/15 text-rose-400 flex items-center gap-2 cursor-pointer font-semibold border-t border-[var(--rule)]"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Drive Style Card Body: Framed Thumbnail Preview Canvas */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDocument(doc);
                }}
                className="p-2.5 bg-[var(--raised)]/40 group-hover:bg-[var(--raised)]/70 transition-colors flex items-center justify-center min-h-[140px] cursor-pointer relative"
              >
                {renderDriveThumbnail(doc, index)}

                {/* Subtle Hover Action Badge */}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--paper)] text-[var(--ink)] text-[9px] font-mono font-bold px-2 py-1 rounded-md shadow-md border border-[var(--rule)] flex items-center gap-1">
                  <Eye size={11} />
                  <span>VIEW</span>
                </div>
              </div>

              {/* Drive Card Bottom Footer */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDocument(doc);
                }}
                className="p-2 bg-[var(--card)] border-t border-[var(--rule)] flex items-center justify-between text-[10px] font-mono font-bold text-[var(--slate)] cursor-pointer"
              >
                <span>{getPageInfo(doc, index)}</span>
                <div>{getStatusBadge(doc, index)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-2">
          {filteredDocs.map((doc, index) => (
            <div
              key={doc.id}
              onClick={() => onSelectDocument(doc)}
              className="p-3.5 bg-[var(--card)] border border-[var(--rule)] hover:border-[var(--accent)] rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors shadow-2xs group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {getFileTypeBadge(doc.type)}
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-[var(--ink)] truncate tracking-tight">
                    {doc.title}
                  </h3>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--slate)]">
                    <span>{getPageInfo(doc, index)}</span>
                    <span>·</span>
                    <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {getStatusBadge(doc, index)}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDocument(doc.id);
                  }}
                  className="p-1 text-[var(--slate)] hover:text-rose-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Delete file"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredDocs.length === 0 && (
        <div className="p-10 text-center bg-[var(--card)] border border-[var(--rule)] rounded-2xl space-y-3 shadow-2xs my-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--raised)] text-[var(--ink)] flex items-center justify-center mx-auto">
            <FolderOpen size={24} />
          </div>
          <h3 className="text-base font-bold text-[var(--ink)]">
            {currentFolder ? `No files in ${currentFolder.name}` : 'No document sources found'}
          </h3>
          <p className="text-xs text-[var(--ink-2)] max-w-sm mx-auto">
            Upload PDFs, spreadsheets, or docs to automatically run OCR and index with AI citations.
          </p>
          <button
            onClick={() => onOpenUpload(activeFolderId || undefined)}
            className="px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-[var(--paper)] font-bold text-xs rounded-full cursor-pointer inline-flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <Upload size={14} /> Upload document
          </button>
        </div>
      )}

      {/* NEW FOLDER MODAL */}
      {isNewFolderModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[var(--card)] border border-[var(--rule)] rounded-2xl max-w-md w-full p-6 shadow-xl text-[var(--ink)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus size={20} className="text-[var(--accent)]" />
                <h2 className="text-base font-extrabold text-[var(--ink)]">New folder</h2>
              </div>
              <button
                onClick={() => setIsNewFolderModalOpen(false)}
                className="p-1 text-[var(--slate)] hover:text-[var(--ink)] rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateFolderSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--ink-2)] mb-1.5">Folder Name</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Closing Schedules 2026"
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-[var(--raised)] border border-[var(--rule)] rounded-xl text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)] placeholder-[var(--slate)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--ink-2)] mb-1.5">Folder Tag Color</label>
                <div className="flex items-center gap-2">
                  {DEFAULT_FOLDER_COLORS.map((clr) => (
                    <button
                      key={clr}
                      type="button"
                      onClick={() => setSelectedFolderColor(clr)}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                        selectedFolderColor === clr ? 'scale-110 ring-2 ring-offset-2 ring-[var(--accent)]' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: clr }}
                    >
                      {selectedFolderColor === clr && <Check size={14} className="text-[var(--paper)]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewFolderModalOpen(false)}
                  className="px-4 py-2 bg-[var(--raised)] hover:bg-[var(--raised)]/80 text-[var(--ink)] font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-5 py-2 bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-[var(--paper)] font-bold text-xs rounded-xl transition-all cursor-pointer"
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
