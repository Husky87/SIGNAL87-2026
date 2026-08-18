import React, { useState, useMemo, useEffect } from 'react';
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
  ChevronDown,
  ArrowLeft,
  Trash2,
  Edit2,
  Check,
  Eye,
  Star,
  LayoutGrid,
  List as ListIcon,
  Share2,
  RotateCcw,
  Download,
  Plus,
  ArrowUp,
  ArrowDown,
  GitFork,
  Info,
  CheckSquare,
  Square,
  MinusSquare
} from 'lucide-react';
import { DocumentItem, FolderItem } from '../types';
import { useScrollMemory } from '../lib/useScrollMemory';
import { DocumentGridSkeleton, DocumentListSkeleton, LoadingAnnouncement } from './DocumentSkeleton';
import { DocumentThumbnail, getTypeMeta } from './DocumentThumbnail';

export type FilesView = 'workspace' | 'recent' | 'starred' | 'shared' | 'trash';

interface DocumentLibraryViewProps {
  documents: DocumentItem[];
  folders?: FolderItem[];
  filesView?: FilesView;
  /** True while the library is still arriving. Shows placeholders, not "empty". */
  loading?: boolean;
  onSelectDocument: (doc: DocumentItem) => void;
  onOpenUpload: (folderId?: string) => void;
  onCompareSelected?: (docs: DocumentItem[]) => void;
  onDeleteDocument: (docId: string) => void;
  onRestoreDocument?: (docId: string) => void;
  onPermanentlyDeleteDocument?: (docId: string) => void;
  onEmptyTrash?: () => void;
  onToggleStar?: (docId: string) => void;
  onRenameDocument?: (docId: string, newTitle: string) => void;
  onChangeDocumentPermissions?: (docId: string, permissions: DocumentItem['permissions']) => void;
  onCreateFolder?: (name: string, color?: string, parentId?: string | null) => void;
  onMoveFolder?: (folderId: string, parentId: string | null) => void;
  onRenameFolder?: (folderId: string, newName: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onMoveDocument?: (docId: string, folderId: string | undefined) => void;
  onFilesDropped?: (files: File[]) => void;
  initialFolderId?: string | null;
  onFolderChange?: (id: string | null) => void;
  initialSearch?: string;
}

const DEFAULT_FOLDER_COLORS = [
  'var(--teal)',
  '#0f9d58',
  '#f4b400',
  '#ea4335',
  '#a142f4',
  '#5f6368'
];

type SortField = 'name' | 'owner' | 'modified' | 'size';
type SortDir = 'asc' | 'desc';
type ModifiedFilter = 'any' | 'today' | 'week' | 'month' | 'year';

const VIEW_TITLES: Record<FilesView, string> = {
  workspace: 'My Workspace',
  recent: 'Recent',
  starred: 'Starred',
  shared: 'Shared',
  trash: 'Trash'
};

const PERMISSION_OPTIONS: DocumentItem['permissions'][] = ['Private', 'Project Only', 'Organization'];

export const DocumentLibraryView: React.FC<DocumentLibraryViewProps> = ({
  documents,
  folders = [],
  filesView = 'workspace',
  loading = false,
  onSelectDocument,
  onOpenUpload,
  onCompareSelected,
  onDeleteDocument,
  onRestoreDocument,
  onPermanentlyDeleteDocument,
  onEmptyTrash,
  onToggleStar,
  onRenameDocument,
  onChangeDocumentPermissions,
  onCreateFolder,
  onMoveFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveDocument,
  onFilesDropped,
  initialFolderId = null,
  onFolderChange,
  initialSearch = ''
}) => {
  const [searchFilter, setSearchFilter] = useState(initialSearch);
  const [searchScope, setSearchScope] = useState<'folder' | 'everywhere'>('everywhere');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(initialFolderId);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    try {
      const stored = localStorage.getItem('signal87_files_view_mode');
      return stored === 'grid' ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('signal87_files_view_mode', viewMode);
    } catch {}
  }, [viewMode]);

  useEffect(() => {
    setSearchFilter(initialSearch);
  }, [initialSearch]);

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  // Drive-style multi-select: a plain click replaces the selection, cmd/ctrl-click
  // toggles one item, shift-click extends a range from the last item clicked.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Two separate marks: the anchor a shift-range measures from, and the cursor the
  // arrow keys move. Conflating them makes shift+arrow collapse onto one item.
  const scrollRef = useScrollMemory<HTMLDivElement>(`files:${filesView}:${activeFolderId ?? 'root'}`);
  const [rangeAnchorId, setRangeAnchorId] = useState<string | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);
  /**
   * Whether the details panel is showing. Deliberately NOT tied to selection.
   *
   * The panel is in-flow on desktop, so opening it narrows and reflows the file
   * list. When a single click opened it, the row moved out from under the
   * pointer between the two clicks of a double-click — measured at 86px down and
   * 220px narrower — so the second click missed and documents could not be
   * opened at all. Drive treats its info panel the same way: a toggle, not a
   * consequence of selecting something.
   */
  const [detailsVisible, setDetailsVisible] = useState(false);
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [renamingDocTitle, setRenamingDocTitle] = useState('');

  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState<string | null>(null);
  const [filterModified, setFilterModified] = useState<ModifiedFilter>('any');
  const [openMenu, setOpenMenu] = useState<'type' | 'owner' | 'modified' | 'create' | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'doc' | 'folder'; id: string } | null>(null);
  const [contextShareOpen, setContextShareOpen] = useState(false);
  const [contextMoveOpen, setContextMoveOpen] = useState(false);

  const [draggingDocId, setDraggingDocId] = useState<string | null>(null);
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  // undefined = no crumb hovered; null = the root crumb is hovered
  const [dragOverCrumbId, setDragOverCrumbId] = useState<string | null | undefined>(undefined);
  const [isExternalDropActive, setIsExternalDropActive] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderColor, setSelectedFolderColor] = useState('var(--teal)');

  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [moveMenuDocId, setMoveMenuDocId] = useState<string | null>(null);
  const [selectionMoveOpen, setSelectionMoveOpen] = useState(false);

  useEffect(() => {
    setActiveFolderId(initialFolderId);
  }, [initialFolderId]);

  // Recent/Starred/Shared/Trash are always flat lists — leave folder drill-down
  // behind when navigating away from My Workspace.
  useEffect(() => {
    if (filesView !== 'workspace') {
      setActiveFolderId(null);
      if (onFolderChange) onFolderChange(null);
    }
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesView]);

  useEffect(() => {
    const closeMenus = () => {
      setOpenMenu(null);
      setContextMenu(null);
      setContextShareOpen(false);
      setContextMoveOpen(false);
    };
    window.addEventListener('click', closeMenus);
    return () => window.removeEventListener('click', closeMenus);
  }, []);

  useEffect(() => {
    const handleOpenFolderModal = () => setIsNewFolderModalOpen(true);
    window.addEventListener('open-new-folder-modal', handleOpenFolderModal);
    return () => window.removeEventListener('open-new-folder-modal', handleOpenFolderModal);
  }, []);

  const handleSetActiveFolderId = (id: string | null) => {
    setActiveFolderId(id);
    if (onFolderChange) onFolderChange(id);
  };

  const categories = ['All', 'Contracts', 'Financials', 'Legal', 'Research'];
  const currentFolder = folders.find((f) => f.id === activeFolderId);

  const foldersById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  // Only the folders directly inside wherever we are. Previously every folder was
  // listed at every level, so parentId went unused and there was one flat tier.
  const childFolders = useMemo(
    () => folders.filter((f) => (f.parentId ?? null) === activeFolderId),
    [folders, activeFolderId]
  );

  /** Root-first chain of folders down to the current one, for the breadcrumb. */
  const ancestors = useMemo(() => {
    const chain: FolderItem[] = [];
    const seen = new Set<string>();
    let cursor = activeFolderId ? foldersById.get(activeFolderId) : undefined;
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id); // a malformed parent cycle would otherwise spin forever
      chain.unshift(cursor);
      const parent = cursor.parentId ?? null;
      cursor = parent ? foldersById.get(parent) : undefined;
    }
    return chain;
  }, [activeFolderId, foldersById]);

  /** Every folder with its full path, so move menus can target any depth. */
  const folderPaths = useMemo(() => {
    const pathOf = (folder: FolderItem) => {
      const parts: string[] = [];
      const seen = new Set<string>();
      let cursor: FolderItem | undefined = folder;
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        parts.unshift(cursor.name);
        const parent = cursor.parentId ?? null;
        cursor = parent ? foldersById.get(parent) : undefined;
      }
      return parts;
    };
    return folders
      .map((folder) => {
        const parts = pathOf(folder);
        return { folder, path: parts.join(' / '), depth: parts.length - 1 };
      })
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [folders, foldersById]);

  const getLastModified = (doc: DocumentItem) =>
    (doc.versionHistory && doc.versionHistory.length > 0
      ? doc.versionHistory[doc.versionHistory.length - 1].updatedAt
      : undefined) || doc.uploadDate;

  const isShared = (doc: DocumentItem) => doc.permissions !== 'Private';

  // Base pool per Drive-style section — trashed documents only ever appear in Trash.
  const basePool = useMemo(() => {
    if (filesView === 'trash') return documents.filter((d) => d.trashed);
    const active = documents.filter((d) => !d.trashed);
    if (filesView === 'starred') return active.filter((d) => d.starred);
    if (filesView === 'shared') return active.filter((d) => isShared(d));
    return active; // workspace + recent
  }, [documents, filesView]);

  const uniqueOwners = useMemo(() => Array.from(new Set(documents.map((d) => d.owner))).filter(Boolean), [documents]);

  /**
   * Lowercased haystack per document, covering everything a user might search for
   * rather than the filename alone. Memoised against `documents` so typing costs
   * one substring test per document instead of re-lowercasing every summary and
   * extracted body on each keystroke.
   */
  const searchIndex = useMemo(() => {
    const index = new Map<string, string>();
    for (const doc of documents) {
      index.set(
        doc.id,
        [
          doc.title,
          doc.type,
          doc.owner,
          doc.summary ?? '',
          doc.contentPreview ?? '',
          (doc.tags ?? []).join(' '),
          (doc.entities ?? []).map((e) => e.name).join(' '),
          (doc.riskHighlights ?? []).join(' ')
        ]
          .join('\n')
          .toLowerCase()
      );
    }
    return index;
  }, [documents]);
  const uniqueTypes = useMemo(() => Array.from(new Set(documents.map((d) => d.type))), [documents]);

  const filteredDocs = useMemo(() => {
    const query = searchFilter.toLowerCase().trim();
    const now = Date.now();

    let list = basePool.filter((doc) => {
      // While browsing, the open folder scopes the list. While searching, the
      // default is the whole library — a query that silently skipped matches in
      // other folders looked like the document simply was not there.
      const scopeToFolder = !query || searchScope === 'folder';
      const folderMatch =
        filesView === 'workspace' && activeFolderId && scopeToFolder
          ? doc.folderId === activeFolderId
          : true;
      const categoryMatch = activeCategory === 'All' || (doc.category || '').toLowerCase() === activeCategory.toLowerCase();
      const typeMatch = !filterType || doc.type === filterType;
      const ownerMatch = !filterOwner || doc.owner === filterOwner;

      const modifiedMs = new Date(getLastModified(doc)).getTime();
      const age = now - modifiedMs;
      const modifiedMatch =
        filterModified === 'any' ||
        (filterModified === 'today' && age < 1000 * 60 * 60 * 24) ||
        (filterModified === 'week' && age < 1000 * 60 * 60 * 24 * 7) ||
        (filterModified === 'month' && age < 1000 * 60 * 60 * 24 * 30) ||
        (filterModified === 'year' && age < 1000 * 60 * 60 * 24 * 365);

      // Matches title, type, owner, summary, extracted body, tags, entities and
      // risk highlights — previously only the title and file type.
      const searchMatch = !query || (searchIndex.get(doc.id) ?? '').includes(query);

      return folderMatch && categoryMatch && typeMatch && ownerMatch && modifiedMatch && searchMatch;
    });

    if (filesView === 'recent' || filesView === 'trash') {
      list = [...list].sort((a, b) => new Date(getLastModified(b)).getTime() - new Date(getLastModified(a)).getTime());
      if (filesView === 'recent') list = list.slice(0, 50);
    } else {
      list = [...list].sort((a, b) => {
        let av: string | number;
        let bv: string | number;
        switch (sortField) {
          case 'owner':
            av = a.owner.toLowerCase();
            bv = b.owner.toLowerCase();
            break;
          case 'modified':
            av = new Date(getLastModified(a)).getTime();
            bv = new Date(getLastModified(b)).getTime();
            break;
          case 'size':
            av = a.sizeBytes;
            bv = b.sizeBytes;
            break;
          default:
            av = a.title.toLowerCase();
            bv = b.title.toLowerCase();
        }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [basePool, searchFilter, searchScope, searchIndex, activeCategory, activeFolderId, filterType, filterOwner, filterModified, sortField, sortDir, filesView]);

  // The details panel describes one document, so it only stands in for a single
  // selection; batch actions live in the selection bar instead.
  const selectedDoc =
    detailsVisible && selectedIds.size === 1
      ? documents.find((d) => selectedIds.has(d.id)) || null
      : null;

  const selectedDocs = useMemo(
    () => filteredDocs.filter((d) => selectedIds.has(d.id)),
    [filteredDocs, selectedIds]
  );

  const clearSelection = () => {
    setSelectedIds(new Set());
    setRangeAnchorId(null);
    setCursorId(null);
    setDetailsVisible(false);
  };

  const handleItemClick = (e: React.MouseEvent | React.KeyboardEvent, docId: string) => {
    const ids = filteredDocs.map((d) => d.id);

    if (e.shiftKey && rangeAnchorId) {
      const from = ids.indexOf(rangeAnchorId);
      const to = ids.indexOf(docId);
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from < to ? [from, to] : [to, from];
        setSelectedIds(new Set(ids.slice(lo, hi + 1)));
        return;
      }
    }

    if (e.metaKey || e.ctrlKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(docId)) next.delete(docId);
        else next.add(docId);
        return next;
      });
      setRangeAnchorId(docId);
      setCursorId(docId);
      return;
    }

    setSelectedIds(new Set([docId]));
    setRangeAnchorId(docId);
    setCursorId(docId);
  };

  /** A plain click opens the file; shift/cmd/ctrl-click still multi-selects. */
  const handleRowClick = (e: React.MouseEvent, doc: DocumentItem) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      handleItemClick(e, doc.id);
    } else {
      onSelectDocument(doc);
    }
  };

  /** Toggles one item without disturbing the rest — what a checkbox should do. */
  const toggleOne = (docId: string) => {
    setDetailsVisible(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
    setRangeAnchorId(docId);
    setCursorId(docId);
  };

  const allVisibleSelected =
    filteredDocs.length > 0 && filteredDocs.every((d) => selectedIds.has(d.id));

  const toggleSelectAllVisible = () => {
    setDetailsVisible(false);
    if (allVisibleSelected) clearSelection();
    else setSelectedIds(new Set(filteredDocs.map((d) => d.id)));
  };

  /** Columns currently laid out by the CSS grid, so Up/Down move a visual row. */
  const gridColumnCount = () => {
    const el = gridRef.current;
    if (!el) return 1;
    const cols = window.getComputedStyle(el).gridTemplateColumns;
    const n = cols ? cols.split(' ').filter(Boolean).length : 1;
    return n > 0 ? n : 1;
  };

  const moveCursor = (delta: number, extend: boolean) => {
    const ids = filteredDocs.map((d) => d.id);
    if (ids.length === 0) return;

    const from = cursorId ? ids.indexOf(cursorId) : -1;
    const to = from === -1 ? 0 : Math.min(ids.length - 1, Math.max(0, from + delta));
    const nextId = ids[to];

    if (extend) {
      const anchor = rangeAnchorId ?? nextId;
      const a = ids.indexOf(anchor);
      const [lo, hi] = a <= to ? [a, to] : [to, a];
      setSelectedIds(new Set(ids.slice(lo, hi + 1)));
      setRangeAnchorId(anchor);
    } else {
      setSelectedIds(new Set([nextId]));
      setRangeAnchorId(nextId);
    }
    setCursorId(nextId);

    // Keep the cursor on screen without yanking the whole page around.
    window.requestAnimationFrame(() => {
      document
        .querySelector(`[data-doc-id="${nextId}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  };

  // Batch actions operate on the visible selection, then clear it — leaving rows
  // selected after they have been trashed or moved away is disorienting.
  const runOnSelection = (fn: (doc: DocumentItem) => void) => {
    selectedDocs.forEach(fn);
    clearSelection();
  };

  const handleBatchDelete = () => {
    const permanent = filesView === 'trash' && onPermanentlyDeleteDocument;
    runOnSelection((doc) =>
      permanent ? onPermanentlyDeleteDocument!(doc.id) : onDeleteDocument(doc.id)
    );
  };

  /**
   * Downloads fire as separate staggered anchor clicks; browsers drop several
   * simultaneous navigations. Files stored cross-origin ignore the download
   * attribute and open in a tab instead, matching the single-file behaviour in
   * the details panel.
   */
  const handleBatchDownload = () => {
    const downloadable = selectedDocs.filter((d) => d.fileUrl);
    downloadable.forEach((doc, i) => {
      window.setTimeout(() => {
        const a = document.createElement('a');
        a.href = doc.fileUrl!;
        a.download = doc.title;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 350);
    });
  };

  const selectionDownloadable = selectedDocs.filter((d) => d.fileUrl).length;

  // Storage total is summed from the documents themselves rather than read from
  // the org stats counter, which only ever increments on upload and so drifts
  // upward as documents are deleted.
  const libraryTotals = useMemo(() => {
    const active = documents.filter((d) => !d.trashed);
    return {
      count: active.length,
      bytes: active.reduce((sum, d) => sum + (d.sizeBytes || 0), 0)
    };
  }, [documents]);

  // Drive-style keyboard handling for the file list. Skipped while focus is in a
  // text field so search and inline rename keep working normally.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(filteredDocs.map((d) => d.id)));
        return;
      }

      // In grid view Up/Down cross a visual row; in list view everything is ±1.
      const step = viewMode === 'grid' ? gridColumnCount() : 1;
      const arrows: Record<string, number> = {
        ArrowDown: step,
        ArrowUp: -step,
        ArrowRight: viewMode === 'grid' ? 1 : 0,
        ArrowLeft: viewMode === 'grid' ? -1 : 0
      };
      if (e.key in arrows) {
        const delta = arrows[e.key];
        if (delta !== 0) {
          e.preventDefault();
          moveCursor(delta, e.shiftKey);
        }
        return;
      }
      if (e.key === 'Escape' && selectedIds.size > 0) {
        clearSelection();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        e.preventDefault();
        handleBatchDelete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredDocs, selectedIds, filesView, viewMode, cursorId, rangeAnchorId]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  /** Every folder in the subtree rooted here, including itself. */
  const folderSubtree = (rootId: string): Set<string> => {
    const out = new Set<string>([rootId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of folders) {
        const parent = f.parentId ?? null;
        if (parent && out.has(parent) && !out.has(f.id)) {
          out.add(f.id);
          grew = true;
        }
      }
    }
    return out;
  };

  // Counted across the subtree — a folder showing "0 files" while its subfolders
  // are full would read as empty.
  const getFolderFileCount = (fldId: string) => {
    const subtree = folderSubtree(fldId);
    return documents.filter((d) => d.folderId && subtree.has(d.folderId) && !d.trashed).length;
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    // Created inside whatever folder is currently open, so nesting is reachable
    // from the UI rather than only from the data model.
    if (onCreateFolder) onCreateFolder(newFolderName.trim(), selectedFolderColor, activeFolderId);
    setNewFolderName('');
    setIsNewFolderModalOpen(false);
  };

  const handleSaveFolderRename = (fldId: string) => {
    if (editingFolderName.trim() && onRenameFolder) onRenameFolder(fldId, editingFolderName.trim());
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const startRenamingDoc = (doc: DocumentItem) => {
    setRenamingDocId(doc.id);
    setRenamingDocTitle(doc.title);
  };
  const saveDocRename = (docId: string) => {
    if (renamingDocTitle.trim() && onRenameDocument) onRenameDocument(docId, renamingDocTitle.trim());
    setRenamingDocId(null);
    setRenamingDocTitle('');
  };

  const getStatusText = (doc: DocumentItem) => {
    if (doc.status === 'indexing') return { label: 'Indexing', className: 'text-[var(--muted)]' };
    if (doc.status === 'error') return { label: 'Failed', className: 'text-[var(--warn)]' };
    return { label: 'Ready', className: 'text-[var(--muted)]' };
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

  const formatBytes = (bytes: number) => {
    if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    return `${(bytes / 1000).toFixed(0)} KB`;
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  // --- Drag and drop: internal move-to-folder ---
  const handleDocDragStart = (e: React.DragEvent, docId: string) => {
    e.dataTransfer.setData('application/x-signal87-doc', docId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingDocId(docId);
  };
  const handleDocDragEnd = () => {
    setDraggingDocId(null);
    setDragOverFolderId(null);
  };
  const handleFolderDragStart = (e: React.DragEvent, folderId: string) => {
    e.dataTransfer.setData('application/x-signal87-folder', folderId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingFolderId(folderId);
  };

  const handleFolderDragEnd = () => {
    setDraggingFolderId(null);
    setDragOverFolderId(null);
    setDragOverCrumbId(undefined);
  };

  /** A folder cannot be dropped into itself or anything beneath it. */
  const canDropFolderInto = (folderId: string, targetId: string | null) =>
    folderId !== targetId && !(targetId && folderSubtree(folderId).has(targetId));

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    const types = e.dataTransfer.types;
    if (types.includes('application/x-signal87-doc')) {
      e.preventDefault();
      setDragOverFolderId(folderId);
      return;
    }
    if (types.includes('application/x-signal87-folder')) {
      if (draggingFolderId && !canDropFolderInto(draggingFolderId, folderId)) return;
      e.preventDefault();
      setDragOverFolderId(folderId);
    }
  };

  const handleFolderDrop = (e: React.DragEvent, folderId: string) => {
    const types = e.dataTransfer.types;

    if (types.includes('application/x-signal87-doc')) {
      e.preventDefault();
      const docId = e.dataTransfer.getData('application/x-signal87-doc');
      // Dragging one of several selected rows moves the whole selection.
      if (docId && onMoveDocument) {
        if (selectedIds.has(docId) && selectedDocs.length > 1) {
          runOnSelection((d) => onMoveDocument(d.id, folderId));
        } else {
          onMoveDocument(docId, folderId);
        }
      }
    } else if (types.includes('application/x-signal87-folder')) {
      e.preventDefault();
      const movingId = e.dataTransfer.getData('application/x-signal87-folder');
      if (movingId && onMoveFolder && canDropFolderInto(movingId, folderId)) {
        onMoveFolder(movingId, folderId);
      }
    } else {
      return;
    }

    setDraggingDocId(null);
    setDraggingFolderId(null);
    setDragOverFolderId(null);
  };

  const handleCrumbDragOver = (e: React.DragEvent, crumbId: string | null) => {
    const types = e.dataTransfer.types;
    if (types.includes('application/x-signal87-doc')) {
      e.preventDefault();
      setDragOverCrumbId(crumbId);
      return;
    }
    if (types.includes('application/x-signal87-folder')) {
      if (draggingFolderId && !canDropFolderInto(draggingFolderId, crumbId)) return;
      e.preventDefault();
      setDragOverCrumbId(crumbId);
    }
  };

  const handleCrumbDrop = (e: React.DragEvent, crumbId: string | null) => {
    const types = e.dataTransfer.types;

    if (types.includes('application/x-signal87-doc')) {
      e.preventDefault();
      const docId = e.dataTransfer.getData('application/x-signal87-doc');
      if (docId && onMoveDocument) {
        if (selectedIds.has(docId) && selectedDocs.length > 1) {
          runOnSelection((d) => onMoveDocument(d.id, crumbId ?? undefined));
        } else {
          onMoveDocument(docId, crumbId ?? undefined);
        }
      }
    } else if (types.includes('application/x-signal87-folder')) {
      e.preventDefault();
      const movingId = e.dataTransfer.getData('application/x-signal87-folder');
      if (movingId && onMoveFolder && canDropFolderInto(movingId, crumbId)) {
        onMoveFolder(movingId, crumbId);
      }
    } else {
      return;
    }

    setDraggingDocId(null);
    setDraggingFolderId(null);
    setDragOverCrumbId(undefined);
  };

  // --- Drag and drop: external OS files dropped anywhere on the panel upload them ---
  const handleContainerDragEnter = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setDragCounter((c) => c + 1);
      setIsExternalDropActive(true);
    }
  };
  const handleContainerDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault();
  };
  const handleContainerDragLeave = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      setDragCounter((c) => {
        const next = Math.max(0, c - 1);
        if (next === 0) setIsExternalDropActive(false);
        return next;
      });
    }
  };
  const handleContainerDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setDragCounter(0);
      setIsExternalDropActive(false);
      const files = (Array.from(e.dataTransfer.files) as File[]).filter((f) => f.size > 0);
      if (files.length > 0 && onFilesDropped) onFilesDropped(files);
    }
  };

  const openContextMenu = (e: React.MouseEvent, type: 'doc' | 'folder', id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenuDocId(null);
    setActiveMenuFolderId(null);
    setContextMenu({ x: e.clientX, y: e.clientY, type, id });
  };

  const closeAllMenus = () => {
    setActiveMenuDocId(null);
    setActiveMenuFolderId(null);
    setMoveMenuDocId(null);
    setContextMenu(null);
    setContextShareOpen(false);
    setContextMoveOpen(false);
  };

  // Shared action list used by both the "..." dropdown and the right-click menu.
  const renderDocActions = (doc: DocumentItem, variant: 'dropdown' | 'context') => {
    const isTrash = filesView === 'trash';
    return (
      <>
        {!isTrash && (
          <button
            onClick={() => { onSelectDocument(doc); closeAllMenus(); }}
            className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer"
          >
            <Eye size={13} /> Open
          </button>
        )}

        <button
          onClick={() => {
            setSelectedIds(new Set([doc.id]));
            setRangeAnchorId(doc.id);
            setCursorId(doc.id);
            setDetailsVisible(true);
            closeAllMenus();
          }}
          className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer border-t border-[var(--rule-2)]"
        >
          <Info size={13} /> Details
        </button>

        {doc.fileUrl && (
          <a
            href={doc.fileUrl}
            download={doc.title}
            onClick={() => closeAllMenus()}
            className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer border-t border-[var(--rule-2)]"
          >
            <Download size={13} /> Download
          </a>
        )}

        {!isTrash && onToggleStar && (
          <button
            onClick={() => { onToggleStar(doc.id); closeAllMenus(); }}
            className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer border-t border-[var(--rule-2)]"
          >
            <Star size={13} className={doc.starred ? 'fill-[var(--teal)] text-[var(--teal)]' : ''} />
            {doc.starred ? 'Remove from starred' : 'Add to starred'}
          </button>
        )}

        {!isTrash && onChangeDocumentPermissions && (
          <div className="border-t border-[var(--rule-2)]">
            <button
              onClick={(e) => { e.stopPropagation(); if (variant === 'context') setContextShareOpen((v) => !v); }}
              className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2"><Share2 size={13} /> Share</span>
              <ChevronRight size={13} />
            </button>
            {(variant === 'dropdown' || contextShareOpen) && (
              <div className="bg-[var(--raised)] p-1 space-y-0.5">
                {PERMISSION_OPTIONS.map((p) => (
                  <button
                    key={p}
                    onClick={() => { onChangeDocumentPermissions(doc.id, p); closeAllMenus(); }}
                    className="w-full px-2 py-1 text-left hover:bg-[var(--surface)] text-[12px] text-[var(--ink)] rounded flex items-center justify-between"
                  >
                    <span>{p}</span>
                    {doc.permissions === p && <Check size={12} className="text-[var(--teal)]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!isTrash && onMoveDocument && (
          <div className="border-t border-[var(--rule-2)]">
            <button
              onClick={(e) => { e.stopPropagation(); if (variant === 'context') setContextMoveOpen((v) => !v); }}
              className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2"><Folder size={13} /> Move to folder</span>
              <ChevronRight size={13} />
            </button>
            {(variant === 'dropdown' || contextMoveOpen) && (
              <div className="bg-[var(--raised)] p-1 space-y-0.5 max-h-36 overflow-y-auto">
                <button
                  onClick={() => { onMoveDocument(doc.id, undefined); closeAllMenus(); }}
                  className="w-full px-2 py-1 text-left hover:bg-[var(--surface)] text-[12px] text-[var(--ink)] rounded flex items-center justify-between"
                >
                  <span>No folder</span>
                  {!doc.folderId && <Check size={12} className="text-[var(--teal)]" />}
                </button>
                {folderPaths.map(({ folder, depth }) => (
                  <button
                    key={folder.id}
                    onClick={() => { onMoveDocument(doc.id, folder.id); closeAllMenus(); }}
                    className="w-full px-2 py-1 text-left hover:bg-[var(--surface)] text-[12px] text-[var(--ink)] rounded flex items-center justify-between"
                    style={{ paddingLeft: `${8 + depth * 12}px` }}
                  >
                    <span className="truncate max-w-[120px]">{folder.name}</span>
                    {doc.folderId === folder.id && <Check size={12} className="text-[var(--teal)]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!isTrash && onRenameDocument && (
          <button
            onClick={() => { startRenamingDoc(doc); closeAllMenus(); }}
            className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer border-t border-[var(--rule-2)]"
          >
            <Edit2 size={13} /> Rename
          </button>
        )}

        {isTrash && onRestoreDocument && (
          <button
            onClick={() => { onRestoreDocument(doc.id); closeAllMenus(); }}
            className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw size={13} /> Restore
          </button>
        )}

        <button
          onClick={() => {
            if (isTrash && onPermanentlyDeleteDocument) onPermanentlyDeleteDocument(doc.id);
            else onDeleteDocument(doc.id);
            closeAllMenus();
          }}
          className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--warn)] flex items-center gap-2 cursor-pointer border-t border-[var(--rule-2)]"
        >
          <Trash2 size={13} /> {isTrash ? 'Delete forever' : 'Delete'}
        </button>
      </>
    );
  };

  const renderFolderActions = (fld: FolderItem) => (
    <>
      <button
        onClick={() => { setEditingFolderId(fld.id); setEditingFolderName(fld.name); closeAllMenus(); }}
        className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer"
      >
        <Edit2 size={13} /> Rename
      </button>
      {onDeleteFolder && (
        <button
          onClick={() => { onDeleteFolder(fld.id); closeAllMenus(); }}
          className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer border-t border-[var(--rule-2)]"
        >
          <Trash2 size={13} /> Delete folder
        </button>
      )}
    </>
  );

  // Rendered at every level now, not just the root, so nested folders are
  // reachable instead of vanishing the moment you open their parent.
  const showFolders = filesView === 'workspace' && childFolders.length > 0;

  const emptyStateCopy: Record<FilesView, { title: string; body: string }> = {
    workspace: {
      title: currentFolder ? `No files in ${currentFolder.name}` : 'Add a document to get started',
      body: "Upload a PDF, spreadsheet, or doc and it's ready to search in a moment."
    },
    recent: { title: 'Nothing recent', body: 'Files you add or open will show up here.' },
    starred: { title: 'Nothing starred yet', body: 'Star a file to find it quickly from here.' },
    shared: { title: 'No shared files', body: 'Files set to Project Only or Organization visibility appear here.' },
    trash: { title: 'Trash is empty', body: 'Deleted files stay here until removed for good.' }
  };

  return (
    <div
      className="flex-1 flex min-h-0 overflow-hidden relative"
      onDragEnter={handleContainerDragEnter}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
    >
      {isExternalDropActive && (
        <div className="absolute inset-0 z-40 bg-[var(--teal-soft)]/90 border-2 border-dashed border-[var(--teal)] flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-2">
            <Upload size={28} className="mx-auto text-[var(--teal)]" />
            <p className="text-[15px] font-semibold text-[var(--ink)]">Drop to upload</p>
          </div>
        </div>
      )}

      {/* Keyed per list, so Starred, Trash and each folder each keep their own
          place rather than sharing one position between them. */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-[var(--bg)] text-[var(--ink)] min-h-full w-full max-w-full overflow-x-hidden"
      >
        <div className="max-w-[1100px] mx-auto px-5 md:px-10 py-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              {/* Full ancestor trail. Each crumb is also a drop target, which is
                  the only way to move something back out of a nested folder. */}
              <div className="flex items-center gap-1.5 text-[12px] text-[var(--muted)] flex-wrap">
                <button
                  onClick={() => handleSetActiveFolderId(null)}
                  onDragOver={(e) => handleCrumbDragOver(e, null)}
                  onDragLeave={() => setDragOverCrumbId(undefined)}
                  onDrop={(e) => handleCrumbDrop(e, null)}
                  className={`hover:text-[var(--ink)] cursor-pointer transition-colors rounded px-1 -mx-1 ${
                    dragOverCrumbId === null ? 'bg-[var(--accent-soft)] text-[var(--ink)]' : ''
                  }`}
                >
                  {VIEW_TITLES[filesView]}
                </button>
                {ancestors.map((crumb, i) => {
                  const isLast = i === ancestors.length - 1;
                  return (
                    <React.Fragment key={crumb.id}>
                      <ChevronRight size={12} className="flex-shrink-0" />
                      {isLast ? (
                        <span className="text-[var(--ink)] font-medium">{crumb.name}</span>
                      ) : (
                        <button
                          onClick={() => handleSetActiveFolderId(crumb.id)}
                          onDragOver={(e) => handleCrumbDragOver(e, crumb.id)}
                          onDragLeave={() => setDragOverCrumbId(undefined)}
                          onDrop={(e) => handleCrumbDrop(e, crumb.id)}
                          className={`hover:text-[var(--ink)] cursor-pointer transition-colors rounded px-1 -mx-1 ${
                            dragOverCrumbId === crumb.id ? 'bg-[var(--accent-soft)] text-[var(--ink)]' : ''
                          }`}
                        >
                          {crumb.name}
                        </button>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 mt-1">
                {activeFolderId && (
                  <button
                    onClick={() => handleSetActiveFolderId(currentFolder?.parentId ?? null)}
                    className="p-1 -ml-1 text-[var(--ink-2)] hover:text-[var(--ink)] rounded-full transition-colors cursor-pointer"
                    title={
                      currentFolder?.parentId
                        ? `Back to ${foldersById.get(currentFolder.parentId)?.name ?? 'parent folder'}`
                        : 'Back to all files'
                    }
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                <h1 className="text-[26px] text-[var(--ink)]" style={{ fontWeight: 600, letterSpacing: '-0.036em' }}>
                  {currentFolder ? currentFolder.name : VIEW_TITLES[filesView]}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {filesView === 'trash' && onEmptyTrash && filteredDocs.length > 0 && (
                <button
                  onClick={onEmptyTrash}
                  className="px-3.5 py-2 text-[var(--warn)] hover:opacity-80 font-medium text-[13.5px] flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                >
                  <Trash2 size={15} />
                  <span>Empty trash</span>
                </button>
              )}

              {filesView !== 'trash' && (
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenMenu(openMenu === 'create' ? null : 'create')}
                    className="px-4 py-2 bg-[var(--teal)] hover:opacity-90 text-white font-medium text-[13.5px] rounded-full flex items-center gap-2 transition-all cursor-pointer min-h-[44px]"
                  >
                    <Plus size={15} />
                    <span>New</span>
                    <ChevronDown size={13} />
                  </button>
                  {openMenu === 'create' && (
                    <div className="absolute right-0 top-11 w-52 bg-[var(--surface)] border border-[var(--rule)] rounded-xl py-1.5 z-30 text-[13px] overflow-hidden">
                      {filesView === 'workspace' && onCreateFolder && (
                        <button
                          onClick={() => { setIsNewFolderModalOpen(true); setOpenMenu(null); }}
                          className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer"
                        >
                          <FolderPlus size={14} /> New folder
                        </button>
                      )}
                      <button
                        onClick={() => { onOpenUpload(activeFolderId || undefined); setOpenMenu(null); }}
                        className="w-full px-3 py-2 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center gap-2 cursor-pointer border-t border-[var(--rule-2)]"
                      >
                        <Upload size={14} /> Upload files
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Search + filters + view toggle */}
          <div className="flex flex-col md:flex-row md:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" size={16} />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder={
                  currentFolder && searchScope === 'folder'
                    ? `Search files in ${currentFolder.name}`
                    : `Search ${basePool.length} files`
                }
                className="w-full pl-10 pr-9 py-3 bg-[var(--surface)] border border-[var(--rule)] rounded-xl text-[15px] text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--teal)] transition-all"
              />
              {searchFilter && (
                <button onClick={() => setSearchFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] p-1 cursor-pointer">
                  <X size={14} />
                </button>
              )}

              {searchFilter.trim() && currentFolder && (
                <div className="absolute left-0 top-full mt-2 flex items-center gap-1.5 text-[11.5px]">
                  <span className="text-[var(--muted)]">Searching</span>
                  {(['everywhere', 'folder'] as const).map((scope) => (
                    <button
                      key={scope}
                      onClick={() => setSearchScope(scope)}
                      className={`px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                        searchScope === scope
                          ? 'border-[var(--teal)] text-[var(--ink)] bg-[var(--accent-soft)]'
                          : 'border-[var(--rule)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {scope === 'everywhere' ? 'Everywhere' : `In ${currentFolder.name}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* File type filter */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setOpenMenu(openMenu === 'type' ? null : 'type')}
                  className={`px-3 py-2 rounded-full text-[12.5px] border flex items-center gap-1.5 cursor-pointer min-h-[40px] ${filterType ? 'border-[var(--teal)] text-[var(--ink)]' : 'border-[var(--rule)] text-[var(--ink-2)] hover:text-[var(--ink)]'}`}
                >
                  <span>{filterType ? getFileTypeLabel(filterType) : 'Type'}</span>
                  <ChevronDown size={12} />
                </button>
                {openMenu === 'type' && (
                  <div className="absolute right-0 top-11 w-40 bg-[var(--surface)] border border-[var(--rule)] rounded-xl py-1 z-30 text-[13px] overflow-hidden max-h-56 overflow-y-auto">
                    <button onClick={() => { setFilterType(null); setOpenMenu(null); }} className="w-full px-3 py-1.5 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center justify-between cursor-pointer">
                      <span>Any type</span>{!filterType && <Check size={12} className="text-[var(--teal)]" />}
                    </button>
                    {uniqueTypes.map((t) => (
                      <button key={t} onClick={() => { setFilterType(t); setOpenMenu(null); }} className="w-full px-3 py-1.5 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center justify-between cursor-pointer">
                        <span>{getFileTypeLabel(t)}</span>{filterType === t && <Check size={12} className="text-[var(--teal)]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Owner filter */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setOpenMenu(openMenu === 'owner' ? null : 'owner')}
                  className={`px-3 py-2 rounded-full text-[12.5px] border flex items-center gap-1.5 cursor-pointer min-h-[40px] ${filterOwner ? 'border-[var(--teal)] text-[var(--ink)]' : 'border-[var(--rule)] text-[var(--ink-2)] hover:text-[var(--ink)]'}`}
                >
                  <span className="truncate max-w-[100px]">{filterOwner || 'Owner'}</span>
                  <ChevronDown size={12} />
                </button>
                {openMenu === 'owner' && (
                  <div className="absolute right-0 top-11 w-48 bg-[var(--surface)] border border-[var(--rule)] rounded-xl py-1 z-30 text-[13px] overflow-hidden max-h-56 overflow-y-auto">
                    <button onClick={() => { setFilterOwner(null); setOpenMenu(null); }} className="w-full px-3 py-1.5 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center justify-between cursor-pointer">
                      <span>Any owner</span>{!filterOwner && <Check size={12} className="text-[var(--teal)]" />}
                    </button>
                    {uniqueOwners.map((o) => (
                      <button key={o} onClick={() => { setFilterOwner(o); setOpenMenu(null); }} className="w-full px-3 py-1.5 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center justify-between cursor-pointer">
                        <span className="truncate max-w-[150px]">{o}</span>{filterOwner === o && <Check size={12} className="text-[var(--teal)]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Modified date filter */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setOpenMenu(openMenu === 'modified' ? null : 'modified')}
                  className={`px-3 py-2 rounded-full text-[12.5px] border flex items-center gap-1.5 cursor-pointer min-h-[40px] ${filterModified !== 'any' ? 'border-[var(--teal)] text-[var(--ink)]' : 'border-[var(--rule)] text-[var(--ink-2)] hover:text-[var(--ink)]'}`}
                >
                  <span>{filterModified === 'any' ? 'Modified' : filterModified === 'today' ? 'Today' : filterModified === 'week' ? 'This week' : filterModified === 'month' ? 'This month' : 'This year'}</span>
                  <ChevronDown size={12} />
                </button>
                {openMenu === 'modified' && (
                  <div className="absolute right-0 top-11 w-40 bg-[var(--surface)] border border-[var(--rule)] rounded-xl py-1 z-30 text-[13px] overflow-hidden">
                    {(['any', 'today', 'week', 'month', 'year'] as ModifiedFilter[]).map((m) => (
                      <button key={m} onClick={() => { setFilterModified(m); setOpenMenu(null); }} className="w-full px-3 py-1.5 text-left hover:bg-[var(--raised)] text-[var(--ink)] flex items-center justify-between cursor-pointer">
                        <span>{m === 'any' ? 'Any time' : m === 'today' ? 'Today' : m === 'week' ? 'This week' : m === 'month' ? 'This month' : 'This year'}</span>
                        {filterModified === m && <Check size={12} className="text-[var(--teal)]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setDetailsVisible((v) => !v)}
                title={detailsVisible ? 'Hide details' : 'Show details'}
                aria-label={detailsVisible ? 'Hide details' : 'Show details'}
                aria-pressed={detailsVisible}
                className={`p-2 rounded-full border cursor-pointer transition-colors min-h-[40px] flex items-center ${
                  detailsVisible
                    ? 'border-[var(--teal)] text-[var(--ink)] bg-[var(--accent-soft)]'
                    : 'border-[var(--rule)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                }`}
              >
                <Info size={15} />
              </button>

              {/* View toggle */}
              <div className="flex items-center gap-0.5 bg-[var(--surface)] border border-[var(--rule)] rounded-full p-0.5">
                <button
                  onClick={() => setViewMode('list')}
                  title="List view"
                  className={`p-1.5 rounded-full cursor-pointer transition-colors ${viewMode === 'list' ? 'bg-[var(--raised)] text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                >
                  <ListIcon size={15} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                  className={`p-1.5 rounded-full cursor-pointer transition-colors ${viewMode === 'grid' ? 'bg-[var(--raised)] text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                >
                  <LayoutGrid size={15} />
                </button>
              </div>
            </div>
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

          {/* Selection bar. Floated rather than placed in flow: as an in-flow band it
              pushed the whole list down the moment anything was selected, moving a row
              86px out from under the pointer between the two clicks of a double-click,
              so documents could not be opened. Fixed positioning keeps the list still. */}
          {selectedDocs.length > 0 && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-40 max-w-[calc(100vw-2rem)] overflow-x-auto flex items-center gap-2 px-3 py-2 bg-[var(--surface)] border border-[var(--teal)] rounded-full"
            >
              <button
                onClick={clearSelection}
                title="Clear selection"
                aria-label="Clear selection"
                className="p-1 text-[var(--ink-2)] hover:text-[var(--ink)] rounded-full cursor-pointer"
              >
                <X size={15} />
              </button>
              <span className="text-[13px] text-[var(--ink)] font-medium">
                {selectedDocs.length} selected
              </span>

              {/* The header select-all sits in a row hidden below sm, so the bar
                  carries its own — otherwise phones have no way to select all. */}
              {!allVisibleSelected && filteredDocs.length > selectedDocs.length && (
                <button
                  onClick={toggleSelectAllVisible}
                  className="px-2 py-1 text-[12px] text-[var(--ink-2)] hover:text-[var(--ink)] rounded-full cursor-pointer"
                >
                  Select all {filteredDocs.length}
                </button>
              )}

              {selectionDownloadable > 0 && (
                <button
                  onClick={handleBatchDownload}
                  title={
                    selectionDownloadable < selectedDocs.length
                      ? `${selectionDownloadable} of ${selectedDocs.length} have a stored file`
                      : 'Download selected'
                  }
                  className="px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] hover:bg-[var(--raised)] rounded-full cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={14} />
                  Download{selectionDownloadable < selectedDocs.length ? ` (${selectionDownloadable})` : ''}
                </button>
              )}

              {filesView !== 'trash' && onToggleStar && (
                <button
                  onClick={() => runOnSelection((d) => onToggleStar(d.id))}
                  className="px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] hover:bg-[var(--raised)] rounded-full cursor-pointer flex items-center gap-1.5"
                >
                  <Star size={14} /> Star
                </button>
              )}

              {filesView !== 'trash' && onMoveDocument && (
                <div className="relative">
                  <button
                    onClick={() => setSelectionMoveOpen((v) => !v)}
                    className="px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] hover:bg-[var(--raised)] rounded-full cursor-pointer flex items-center gap-1.5"
                  >
                    <Folder size={14} /> Move <ChevronDown size={12} />
                  </button>
                  {selectionMoveOpen && (
                    <div className="absolute right-0 top-9 w-48 bg-[var(--surface)] border border-[var(--rule)] rounded-xl p-1 z-30 text-[13px] max-h-48 overflow-y-auto">
                      <button
                        onClick={() => {
                          runOnSelection((d) => onMoveDocument(d.id, undefined));
                          setSelectionMoveOpen(false);
                        }}
                        className="w-full px-2 py-1.5 text-left hover:bg-[var(--raised)] text-[var(--ink)] rounded cursor-pointer"
                      >
                        No folder
                      </button>
                      {folderPaths.map(({ folder, depth }) => (
                        <button
                          key={folder.id}
                          onClick={() => {
                            runOnSelection((d) => onMoveDocument(d.id, folder.id));
                            setSelectionMoveOpen(false);
                          }}
                          className="w-full px-2 py-1.5 text-left hover:bg-[var(--raised)] text-[var(--ink)] rounded cursor-pointer truncate"
                          style={{ paddingLeft: `${8 + depth * 12}px` }}
                        >
                          {folder.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedDocs.length >= 2 && onCompareSelected && filesView !== 'trash' && (
                <button
                  onClick={() => onCompareSelected(selectedDocs)}
                  className="px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] hover:bg-[var(--raised)] rounded-full cursor-pointer flex items-center gap-1.5"
                >
                  <GitFork size={14} /> Compare
                </button>
              )}

              {filesView === 'trash' && onRestoreDocument && (
                <button
                  onClick={() => runOnSelection((d) => onRestoreDocument(d.id))}
                  className="px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] hover:bg-[var(--raised)] rounded-full cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw size={14} /> Restore
                </button>
              )}

              <button
                onClick={handleBatchDelete}
                className="px-2.5 py-1.5 text-[12.5px] text-[var(--warn)] hover:bg-[var(--raised)] rounded-full cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={14} /> {filesView === 'trash' ? 'Delete forever' : 'Delete'}
              </button>
            </div>
          )}

          {/* Folders — My Workspace only */}
          {showFolders && (
            <div>
              <h2 className="text-[11px] font-medium text-[var(--muted)] uppercase pb-2" style={{ letterSpacing: '0.09em' }}>
                Folders
              </h2>
              <div>
                {childFolders.map((fld) => {
                  const fileCount = getFolderFileCount(fld.id);
                  const isEditing = editingFolderId === fld.id;
                  const isDropTarget = dragOverFolderId === fld.id;
                  return (
                    <div
                      key={fld.id}
                      draggable={!isEditing && !!onMoveFolder}
                      onDragStart={(e) => handleFolderDragStart(e, fld.id)}
                      onDragEnd={handleFolderDragEnd}
                      className={`flex items-center justify-between gap-2 py-3.5 min-h-[44px] border-b border-[var(--rule-2)] last:border-b-0 cursor-pointer group ${isDropTarget ? 'bg-[var(--teal-soft)]' : ''} ${draggingFolderId === fld.id ? 'opacity-40' : ''}`}
                      onClick={() => { if (!isEditing) handleSetActiveFolderId(fld.id); }}
                      onContextMenu={(e) => openContextMenu(e, 'folder', fld.id)}
                      onDragOver={(e) => handleFolderDragOver(e, fld.id)}
                      onDragLeave={() => setDragOverFolderId(null)}
                      onDrop={(e) => handleFolderDrop(e, fld.id)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          handleSetActiveFolderId(fld.id);
                        }
                      }}
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
                              {renderFolderActions(fld)}
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

            {viewMode === 'list' ? (
              <div>
                {/* Sortable column header — extra columns reveal as space allows */}
                <div className="hidden sm:grid grid-cols-[1fr_110px_40px] md:grid-cols-[1fr_140px_120px_90px_40px] gap-3 px-1 pb-2 border-b border-[var(--rule)] text-[11px] uppercase text-[var(--muted)]" style={{ letterSpacing: '0.06em' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={toggleSelectAllVisible}
                      title={allVisibleSelected ? 'Deselect all' : 'Select all'}
                      aria-label={allVisibleSelected ? 'Deselect all' : 'Select all'}
                      className="flex-shrink-0 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      {allVisibleSelected ? (
                        <CheckSquare size={15} className="text-[var(--teal)]" />
                      ) : selectedDocs.length > 0 ? (
                        <MinusSquare size={15} className="text-[var(--teal)]" />
                      ) : (
                        <Square size={15} />
                      )}
                    </button>
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 text-left hover:text-[var(--ink)] cursor-pointer">
                      Name {sortField === 'name' && (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                    </button>
                  </div>
                  <button onClick={() => toggleSort('owner')} className="hidden md:flex items-center gap-1 text-left hover:text-[var(--ink)] cursor-pointer">
                    Owner {sortField === 'owner' && (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </button>
                  <button onClick={() => toggleSort('modified')} className="flex items-center gap-1 text-left hover:text-[var(--ink)] cursor-pointer">
                    Last modified {sortField === 'modified' && (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </button>
                  <button onClick={() => toggleSort('size')} className="hidden md:flex items-center gap-1 text-left hover:text-[var(--ink)] cursor-pointer">
                    File size {sortField === 'size' && (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </button>
                  <span />
                </div>

                {filteredDocs.map((doc) => {
                  const status = getStatusText(doc);
                  const isRenaming = renamingDocId === doc.id;
                  const isSelected = selectedIds.has(doc.id);
                  return (
                    <div
                      key={doc.id}
                      draggable={filesView !== 'trash'}
                      onDragStart={(e) => handleDocDragStart(e, doc.id)}
                      onDragEnd={handleDocDragEnd}
                      onClick={(e) => handleRowClick(e, doc)}
                      onContextMenu={(e) => openContextMenu(e, 'doc', doc.id)}
                      data-doc-id={doc.id}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          onSelectDocument(doc);
                        } else if (e.key === ' ') {
                          e.preventDefault();
                          handleItemClick(e, doc.id);
                        }
                      }}
                      className={`grid grid-cols-[1fr_40px] sm:grid-cols-[1fr_110px_40px] md:grid-cols-[1fr_140px_120px_90px_40px] gap-3 items-center py-3 px-1 min-h-[44px] border-b border-[var(--rule-2)] last:border-b-0 cursor-pointer group ${
                        isSelected ? 'bg-[var(--raised)]' : 'hover:bg-[var(--raised)]/60'
                      } ${draggingDocId === doc.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Always visible on touch, where there is no cmd or shift key
                            to multi-select with; on pointer devices it appears on
                            hover or once something is selected. */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleOne(doc.id); }}
                          aria-label={isSelected ? `Deselect ${doc.title}` : `Select ${doc.title}`}
                          className={`flex-shrink-0 cursor-pointer transition-opacity max-sm:opacity-100 focus-visible:opacity-100 ${
                            isSelected
                              ? 'opacity-100 text-[var(--teal)]'
                              : 'opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--ink)]'
                          }`}
                        >
                          {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                        </button>
                        {(() => {
                          const { Icon, color } = getTypeMeta(doc.type);
                          return <Icon size={18} className="flex-shrink-0" style={{ color }} />;
                        })()}
                        <div className="min-w-0 flex-1">
                          {isRenaming ? (
                            <input
                              type="text"
                              value={renamingDocTitle}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setRenamingDocTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveDocRename(doc.id);
                                if (e.key === 'Escape') setRenamingDocId(null);
                              }}
                              onBlur={() => saveDocRename(doc.id)}
                              className="w-full px-2 py-1 text-[14.5px] text-[var(--ink)] bg-[var(--surface)] border border-[var(--teal)] rounded focus:outline-none"
                            />
                          ) : (
                            <h3 className="text-[14.5px] text-[var(--ink)] truncate flex items-center gap-1.5">
                              {doc.starred && <Star size={12} className="flex-shrink-0 fill-[var(--teal)] text-[var(--teal)]" />}
                              <span className="truncate">{doc.title}</span>
                            </h3>
                          )}
                          <div className="flex items-center gap-2 text-[12px] text-[var(--muted)] sm:hidden">
                            <span>{getFileTypeLabel(doc.type)}</span>
                            <span>·</span>
                            <span className={status.className}>{status.label}</span>
                          </div>
                        </div>
                      </div>

                      <span className="hidden md:block text-[13px] text-[var(--ink-2)] truncate">{doc.owner}</span>
                      <span className="hidden sm:block text-[13px] text-[var(--ink-2)]">{formatDate(getLastModified(doc))}</span>
                      <span className="hidden md:block text-[13px] text-[var(--ink-2)]">{formatBytes(doc.sizeBytes)}</span>

                      <div className="relative flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id)}
                          className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded-full transition-colors cursor-pointer opacity-0 group-hover:opacity-100 sm:opacity-0"
                          title="File options"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {activeMenuDocId === doc.id && (
                          <div className="absolute right-0 top-7 w-52 bg-[var(--surface)] border border-[var(--rule)] rounded-xl py-1.5 z-30 text-[13px] overflow-hidden">
                            {renderDocActions(doc, 'dropdown')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {filteredDocs.map((doc) => {
                  const isSelected = selectedIds.has(doc.id);
                  return (
                    <div
                      key={doc.id}
                      draggable={filesView !== 'trash'}
                      onDragStart={(e) => handleDocDragStart(e, doc.id)}
                      onDragEnd={handleDocDragEnd}
                      onClick={(e) => handleRowClick(e, doc)}
                      onContextMenu={(e) => openContextMenu(e, 'doc', doc.id)}
                      data-doc-id={doc.id}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          onSelectDocument(doc);
                        } else if (e.key === ' ') {
                          e.preventDefault();
                          handleItemClick(e, doc.id);
                        }
                      }}
                      className={`relative bg-[var(--surface)] border rounded-xl p-2.5 cursor-pointer transition-colors group ${
                        isSelected ? 'border-[var(--teal)]' : 'border-[var(--rule)] hover:border-[var(--ink-2)]'
                      } ${draggingDocId === doc.id ? 'opacity-40' : ''}`}
                    >
                      {/* Title row sits above the preview, Drive-style */}
                      <div className="flex items-center gap-2 mb-2 min-w-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleOne(doc.id); }}
                          aria-label={isSelected ? `Deselect ${doc.title}` : `Select ${doc.title}`}
                          className={`flex-shrink-0 cursor-pointer transition-opacity max-sm:opacity-100 focus-visible:opacity-100 ${
                            isSelected
                              ? 'opacity-100 text-[var(--teal)]'
                              : 'opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--ink)]'
                          }`}
                        >
                          {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                        {(() => {
                          const { Icon, color } = getTypeMeta(doc.type);
                          return <Icon size={15} className="flex-shrink-0" style={{ color }} />;
                        })()}
                        {doc.starred && (
                          <Star size={12} className="flex-shrink-0 fill-[var(--teal)] text-[var(--teal)]" />
                        )}
                        <span className="text-[13px] text-[var(--ink)] truncate flex-1 min-w-0" title={doc.title}>
                          {doc.title}
                        </span>
                        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id)}
                            aria-label={`Actions for ${doc.title}`}
                            className="p-0.5 text-[var(--muted)] hover:text-[var(--ink)] rounded-full transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {activeMenuDocId === doc.id && (
                            <div className="absolute right-0 top-6 w-52 bg-[var(--surface)] border border-[var(--rule)] rounded-xl py-1.5 z-30 text-[13px] overflow-hidden">
                              {renderDocActions(doc, 'dropdown')}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Page preview */}
                      <div className="relative aspect-[4/3] rounded-lg bg-[var(--raised)] border border-[var(--rule-2)] flex items-center justify-center overflow-hidden">
                        <DocumentThumbnail doc={doc} />
                      </div>

                      <div className="text-[11px] text-[var(--muted)] mt-2 truncate">
                        {formatBytes(doc.sizeBytes)} · {formatDate(getLastModified(doc))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Storage total. No quota bar: there is no plan limit in the data model
              yet, and inventing one would show the user a made-up number. */}
          {libraryTotals.count > 0 && (
            <div className="pt-3 text-[11.5px] text-[var(--muted)]">
              {libraryTotals.count} {libraryTotals.count === 1 ? 'file' : 'files'} ·{' '}
              {formatBytes(libraryTotals.bytes)} used
            </div>
          )}

          {/* Loading. Checked before the empty state, which otherwise announced
              an empty library on every cold start and then took it back. */}
          {loading && (
            <>
              <LoadingAnnouncement label="Loading your files" />
              {viewMode === 'grid' ? <DocumentGridSkeleton /> : <DocumentListSkeleton />}
            </>
          )}

          {/* Empty state */}
          {!loading && filteredDocs.length === 0 && (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[var(--raised)] text-[var(--ink-2)] flex items-center justify-center mx-auto">
                <FolderOpen size={22} />
              </div>
              <h3 className="text-[15px] text-[var(--ink)] font-medium">{emptyStateCopy[filesView].title}</h3>
              <p className="text-[13.5px] text-[var(--ink-2)] max-w-sm mx-auto" style={{ lineHeight: 1.6 }}>
                {emptyStateCopy[filesView].body}
              </p>
              {filesView !== 'trash' && (
                <button
                  onClick={() => onOpenUpload(activeFolderId || undefined)}
                  className="px-4 py-2.5 bg-[var(--teal)] hover:opacity-90 text-white font-medium text-[13.5px] rounded-full cursor-pointer inline-flex items-center gap-1.5 transition-all min-h-[44px]"
                >
                  <Upload size={14} /> Upload document
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right-hand detail panel */}
      {selectedDoc && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => clearSelection()} />
          <aside className="fixed md:relative inset-y-0 right-0 z-50 md:z-auto w-full sm:w-96 md:w-80 flex-shrink-0 bg-[var(--surface)] border-l border-[var(--rule)] overflow-y-auto">
            <div className="p-4 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--muted)] uppercase" style={{ letterSpacing: '0.09em' }}>Details</span>
                <button onClick={() => clearSelection()} className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded-full cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col items-center text-center gap-2 py-3">
                <div className="w-14 h-14 rounded-xl bg-[var(--raised)] flex items-center justify-center">
                  <FileText size={26} className="text-[var(--muted)]" />
                </div>
                <h3 className="text-[15px] text-[var(--ink)] font-medium break-words px-2">{selectedDoc.title}</h3>
                {selectedDoc.starred && <span className="text-[12px] text-[var(--muted)] flex items-center gap-1"><Star size={11} className="fill-[var(--teal)] text-[var(--teal)]" /> Starred</span>}
              </div>

              <div className="space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between"><span className="text-[var(--muted)]">Type</span><span className="text-[var(--ink)]">{getFileTypeLabel(selectedDoc.type)}</span></div>
                <div className="flex items-center justify-between"><span className="text-[var(--muted)]">Size</span><span className="text-[var(--ink)]">{formatBytes(selectedDoc.sizeBytes)}</span></div>
                <div className="flex items-center justify-between"><span className="text-[var(--muted)]">Owner</span><span className="text-[var(--ink)] truncate max-w-[160px]">{selectedDoc.owner}</span></div>
                <div className="flex items-center justify-between"><span className="text-[var(--muted)]">Last modified</span><span className="text-[var(--ink)]">{formatDate(getLastModified(selectedDoc))}</span></div>
                <div className="flex items-center justify-between"><span className="text-[var(--muted)]">Uploaded</span><span className="text-[var(--ink)]">{formatDate(selectedDoc.uploadDate)}</span></div>
                <div className="flex items-center justify-between"><span className="text-[var(--muted)]">Visibility</span><span className="text-[var(--ink)]">{selectedDoc.permissions}</span></div>
                {selectedDoc.folderId && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Folder</span>
                    <span className="text-[var(--ink)] truncate max-w-[160px]">{folders.find((f) => f.id === selectedDoc.folderId)?.name || '—'}</span>
                  </div>
                )}
              </div>

              {selectedDoc.summary && (
                <div className="pt-3 border-t border-[var(--rule-2)] space-y-1.5">
                  <span className="text-[11px] font-medium text-[var(--muted)] uppercase" style={{ letterSpacing: '0.09em' }}>Summary</span>
                  <p className="text-[13px] text-[var(--ink-2)]" style={{ lineHeight: 1.55 }}>{selectedDoc.summary}</p>
                </div>
              )}

              {selectedDoc.versionHistory && selectedDoc.versionHistory.length > 0 && (
                <div className="pt-3 border-t border-[var(--rule-2)] space-y-2">
                  <span className="text-[11px] font-medium text-[var(--muted)] uppercase" style={{ letterSpacing: '0.09em' }}>Activity</span>
                  <div className="space-y-2">
                    {[...selectedDoc.versionHistory].reverse().map((v) => (
                      <div key={v.version} className="text-[12.5px] text-[var(--ink-2)]">
                        <span className="text-[var(--ink)]">{v.changeNote}</span>
                        <div className="text-[11px] text-[var(--muted)]">{formatDate(v.updatedAt)} · {v.updatedBy}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="pt-3 border-t border-[var(--rule-2)] space-y-1.5">
                {filesView !== 'trash' ? (
                  <>
                    <button onClick={() => onSelectDocument(selectedDoc)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[var(--raised)] text-[13.5px] text-[var(--ink)] cursor-pointer">
                      <Eye size={15} /> Open
                    </button>
                    {onToggleStar && (
                      <button onClick={() => onToggleStar(selectedDoc.id)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[var(--raised)] text-[13.5px] text-[var(--ink)] cursor-pointer">
                        <Star size={15} className={selectedDoc.starred ? 'fill-[var(--teal)] text-[var(--teal)]' : ''} /> {selectedDoc.starred ? 'Remove from starred' : 'Add to starred'}
                      </button>
                    )}
                    {selectedDoc.fileUrl && (
                      <a href={selectedDoc.fileUrl} download={selectedDoc.title} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[var(--raised)] text-[13.5px] text-[var(--ink)] cursor-pointer">
                        <Download size={15} /> Download
                      </a>
                    )}
                    {onCompareSelected && (
                      <button onClick={() => onCompareSelected([selectedDoc])} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[var(--raised)] text-[13.5px] text-[var(--ink)] cursor-pointer">
                        <GitFork size={15} /> Compare
                      </button>
                    )}
                    <button onClick={() => { onDeleteDocument(selectedDoc.id); clearSelection(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[var(--raised)] text-[13.5px] text-[var(--warn)] cursor-pointer">
                      <Trash2 size={15} /> Delete
                    </button>
                  </>
                ) : (
                  <>
                    {onRestoreDocument && (
                      <button onClick={() => { onRestoreDocument(selectedDoc.id); clearSelection(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[var(--raised)] text-[13.5px] text-[var(--ink)] cursor-pointer">
                        <RotateCcw size={15} /> Restore
                      </button>
                    )}
                    {onPermanentlyDeleteDocument && (
                      <button onClick={() => { onPermanentlyDeleteDocument(selectedDoc.id); clearSelection(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[var(--raised)] text-[13.5px] text-[var(--warn)] cursor-pointer">
                        <Trash2 size={15} /> Delete forever
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-[60] w-52 bg-[var(--surface)] border border-[var(--rule)] rounded-xl py-1.5 text-[13px] overflow-hidden shadow-lg"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 260), left: Math.min(contextMenu.x, window.innerWidth - 220) }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'doc'
            ? (() => {
                const doc = documents.find((d) => d.id === contextMenu.id);
                return doc ? renderDocActions(doc, 'context') : null;
              })()
            : (() => {
                const fld = folders.find((f) => f.id === contextMenu.id);
                return fld ? renderFolderActions(fld) : null;
              })()}
        </div>
      )}

      {/* New folder modal */}
      {isNewFolderModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-2xl max-w-md w-full p-6 text-[var(--ink)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule-2)] pb-3">
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">
                {currentFolder ? `New folder in ${currentFolder.name}` : 'New folder'}
              </h2>
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
