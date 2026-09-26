import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Plus, Search, StickyNote, FileText, ArrowLeft, Trash2, Link2, Check, Clock3, Bold, Italic, Underline, Strikethrough, Highlighter, Baseline, Link as LinkIcon, List, ListOrdered, ListTodo, Heading2, Undo2, Redo2, RemoveFormatting, ChevronDown } from 'lucide-react';
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
  initialFilter?: 'all' | 'notes' | 'answers';
}

const FONT_FAMILIES = [
  { key: 'sans', label: 'Sans', value: 'Inter, system-ui, sans-serif' },
  { key: 'serif', label: 'Serif', value: 'Georgia, serif' },
  { key: 'times', label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { key: 'mono', label: 'Mono', value: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
];

// execCommand('fontSize') takes the legacy 1-7 scale; 3 is the browser default.
const FONT_SIZES = [
  { label: 'Small', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Large', value: '5' },
  { label: 'Extra large', value: '6' }
];

const TEXT_COLORS = [
  { label: 'Ink', value: '#1f2328' },
  { label: 'Gray', value: '#6b7280' },
  { label: 'Red', value: '#d93025' },
  { label: 'Orange', value: '#e8710a' },
  { label: 'Green', value: '#188038' },
  { label: 'Blue', value: '#1a73e8' }
];

const HIGHLIGHT_COLOR = '#fff3a3';

const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%]+\)|transparent)$/i;
const SAFE_FONT_FAMILY = /^[\w\s,"'-]+$/;
const SAFE_STYLE_VALUES: Record<string, RegExp> = {
  color: SAFE_COLOR,
  'background-color': SAFE_COLOR,
  'font-family': SAFE_FONT_FAMILY,
  'font-size': /^(xx?x?-small|x?-?small|medium|x?x?x?-?large|\d+(\.\d+)?(px|em|rem|%))$/,
  'font-weight': /^(bold|normal|[1-9]00)$/,
  'font-style': /^(italic|normal)$/,
  'text-decoration-line': /^[a-z\s-]+$/,
  'text-decoration': /^[a-z\s-]+$/
};

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain text for the notes list preview, whatever markup a stored body carries. */
const stripHtml = (text: string) => text
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

const isMacPlatform = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD_KEY = isMacPlatform ? '⌘' : 'Ctrl+';

export const SavedView: React.FC<SavedViewProps> = ({
  savedItems,
  onSaveItem,
  onDeleteItem,
  documents,
  onSelectDocument,
  prelinkedDocId,
  onClearPrelinkedDoc,
  newNoteRequestId = 0,
  initialFilter = 'all'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'notes' | 'answers'>(initialFilter);
  const [selectedItem, setSelectedItem] = useState<SavedItem | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteLinkedDocId, setNoteLinkedDocId] = useState('');
  const [recentlyDeleted, setRecentlyDeleted] = useState<SavedItem | null>(null);
  // Bumped whenever a different note is loaded into the editor. The body is a
  // contentEditable element, so React must not own its children: re-rendering it
  // would replace the DOM nodes the caret lives in and drop the selection back to
  // offset 0, making every keystroke prepend. Its html is pushed in imperatively
  // on a session change only, and the browser owns it from then on.
  const [editorSession, setEditorSession] = useState(0);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const noteBodyHtmlRef = useRef('');
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeletionRef = useRef<SavedItem | null>(null);
  const onDeleteItemRef = useRef(onDeleteItem);
  onDeleteItemRef.current = onDeleteItem;
  // The note being edited keeps one id from its first autosave on, so later
  // saves update it rather than creating copies.
  const noteIdRef = useRef('');
  const noteCreatedAtRef = useRef('');
  const noteDirtyRef = useRef(false);
  const persistNoteRef = useRef<() => boolean>(() => false);
  const savedRangeRef = useRef<Range | null>(null);
  const checklistSplitRef = useRef<{ item: Element; next: Element | null } | null>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const [bodyRevision, setBodyRevision] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [currentFont, setCurrentFont] = useState('sans');
  const [currentSize, setCurrentSize] = useState('3');
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const isEditingNote = isCreatingNote || selectedItem?.type === 'note';

  const resetNoteSession = (id: string, createdAt: string, state: 'idle' | 'saved') => {
    noteIdRef.current = id;
    noteCreatedAtRef.current = createdAt;
    noteDirtyRef.current = false;
    savedRangeRef.current = null;
    setSaveState(state);
    setColorMenuOpen(false);
  };

  const plainTextToHtml = (text: string) => text.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`).join('');

  const sanitizeNoteHtml = (html: string) => {
    const template = document.createElement('template');
    template.innerHTML = html;
    const allowed = new Set(['P', 'DIV', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'FONT', 'SPAN', 'A', 'UL', 'OL', 'LI', 'H2', 'H3']);
    Array.from(template.content.querySelectorAll('*')).forEach((node) => {
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') {
        node.remove();
        return;
      }
      if (!allowed.has(node.tagName)) {
        node.replaceWith(...Array.from(node.childNodes));
        return;
      }
      // Only the attributes the toolbar itself writes survive, and only with
      // values that cannot carry script or remote resources.
      const keep: Record<string, string> = {};
      const read = (name: string) => node.getAttribute(name) || '';
      const style = (node as HTMLElement).style;
      const safeStyle = style ? Object.keys(SAFE_STYLE_VALUES)
        .map((property) => [property, style.getPropertyValue(property).trim()] as const)
        .filter(([property, value]) => value && SAFE_STYLE_VALUES[property].test(value))
        .map(([property, value]) => `${property}: ${value}`)
        .join('; ') : '';
      if (safeStyle) keep.style = safeStyle;
      if (node.tagName === 'FONT') {
        if (SAFE_FONT_FAMILY.test(read('face'))) keep.face = read('face');
        if (/^[1-7]$/.test(read('size'))) keep.size = read('size');
        if (SAFE_COLOR.test(read('color'))) keep.color = read('color');
      }
      if (node.tagName === 'A') {
        const href = read('href').trim();
        if (!/^(https?:|mailto:)/i.test(href)) {
          node.replaceWith(...Array.from(node.childNodes));
          return;
        }
        keep.href = href;
        keep.target = '_blank';
        keep.rel = 'noopener noreferrer';
      }
      if (node.tagName === 'UL' && read('data-checklist') === 'true') keep['data-checklist'] = 'true';
      if (node.tagName === 'LI' && /^(true|false)$/.test(read('data-checked'))) keep['data-checked'] = read('data-checked');
      Array.from(node.attributes).forEach((attribute) => node.removeAttribute(attribute.name));
      Object.entries(keep).forEach(([name, value]) => node.setAttribute(name, value));
    });
    return template.innerHTML;
  };

  useEffect(() => {
    if (!newNoteRequestId && !prelinkedDocId) return;
    if (noteDirtyRef.current) persistNoteRef.current();
    setSelectedItem(null);
    setIsCreatingNote(true);
    setNoteTitle('');
    setNoteBody('');
    noteBodyHtmlRef.current = '';
    resetNoteSession('', '', 'idle');
    setEditorSession((session) => session + 1);
    setNoteLinkedDocId(prelinkedDocId || '');
  }, [newNoteRequestId, prelinkedDocId]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== noteBodyHtmlRef.current) {
      editorRef.current.innerHTML = noteBodyHtmlRef.current;
    }
  }, [editorSession]);

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
    noteDirtyRef.current = false;
    setSelectedItem(null);
    setIsCreatingNote(false);
    setNoteTitle('');
    setNoteBody('');
    noteBodyHtmlRef.current = '';
    setNoteLinkedDocId('');
    onClearPrelinkedDoc?.();
  };

  const startNewNote = () => {
    if (noteDirtyRef.current) persistNoteRef.current();
    setSelectedItem(null);
    setIsCreatingNote(true);
    setNoteTitle('');
    setNoteBody('');
    noteBodyHtmlRef.current = '';
    resetNoteSession('', '', 'idle');
    setEditorSession((session) => session + 1);
    setNoteLinkedDocId('');
  };

  const openItem = (item: SavedItem) => {
    if (noteDirtyRef.current) persistNoteRef.current();
    setSelectedItem(item);
    setIsCreatingNote(false);
    if (item.type === 'note') {
      setNoteTitle(item.title);
      setNoteBody(item.body);
      noteBodyHtmlRef.current = sanitizeNoteHtml(item.bodyHtml || plainTextToHtml(item.body));
      resetNoteSession(item.id, item.createdAt, 'saved');
      setEditorSession((session) => session + 1);
      setNoteLinkedDocId(item.linkedDocId || '');
    }
  };

  /**
   * Saved answers are snapshots of an Ask reply. "Edit" turns one into a regular
   * note in place (same id, so it doesn't duplicate): the question becomes the
   * title, the answer the body, its sources a list at the end, and the first
   * source is linked. It then opens in the note editor.
   */
  const editAnswerAsNote = (answer: Extract<SavedItem, { type: 'answer' }>) => {
    const cleanText = String(answer.text || '').replace(/\s*\[\d{1,2}(?:\s*,\s*\d{1,2})*\]/g, '').trim();
    const sources = (answer.citations || []).map((c) => c.docTitle).filter(Boolean);
    const body = sources.length ? `${cleanText}\n\nSources:\n${sources.map((t) => `- ${t}`).join('\n')}` : cleanText;
    const now = new Date().toISOString();
    const note: SavedNote = {
      id: answer.id,
      ...(answer.userId ? { userId: answer.userId } : {}),
      type: 'note',
      title: String(answer.question || 'Saved answer').slice(0, 200),
      body,
      bodyHtml: sanitizeNoteHtml(plainTextToHtml(body)),
      ...(answer.citations?.[0]?.docId ? { linkedDocId: answer.citations[0].docId } : {}),
      createdAt: answer.timestamp && !Number.isNaN(Date.parse(answer.timestamp)) ? new Date(answer.timestamp).toISOString() : now,
      updatedAt: now
    };
    onSaveItem(note);
    openItem(note);
  };

  /** Writes the note as it stands; returns false when there is nothing to keep. */
  const persistNote = () => {
    if (!noteTitle.trim() && !noteBody.trim()) return false;
    const now = new Date().toISOString();
    if (!noteIdRef.current) noteIdRef.current = `note-${Date.now()}`;
    if (!noteCreatedAtRef.current) noteCreatedAtRef.current = now;
    const note: SavedNote = {
      id: noteIdRef.current,
      type: 'note',
      title: noteTitle.trim() || 'Untitled Note',
      body: noteBody,
      bodyHtml: sanitizeNoteHtml(noteBodyHtmlRef.current),
      linkedDocId: noteLinkedDocId || undefined,
      createdAt: noteCreatedAtRef.current,
      updatedAt: now
    };
    onSaveItem(note);
    noteDirtyRef.current = false;
    return true;
  };
  persistNoteRef.current = persistNote;

  // The parent unmounts this editor when a workspace tab is selected. Flush the
  // current draft before the debounce cleanup cancels its pending autosave.
  useEffect(() => () => {
    if (noteDirtyRef.current) persistNoteRef.current();
  }, []);

  const saveNote = () => {
    if (!persistNote()) return;
    closeEditor();
  };

  // Leaving the editor keeps what was typed rather than dropping an autosave
  // that had not fired yet.
  const leaveEditor = () => {
    if (noteDirtyRef.current) persistNote();
    closeEditor();
  };

  // Autosave, a short pause after the last change to the title, body or link.
  useEffect(() => {
    if (!noteDirtyRef.current) return;
    setSaveState('saving');
    const timer = setTimeout(() => {
      setSaveState(persistNote() ? 'saved' : 'idle');
    }, 800);
    return () => clearTimeout(timer);
  }, [noteTitle, bodyRevision, noteLinkedDocId]);

  const markDirty = () => {
    noteDirtyRef.current = true;
  };

  const syncBody = () => {
    const editor = editorRef.current;
    if (!editor) return;
    // Enter in a checklist copies the split item's attributes onto the new
    // one; a new item starts unchecked.
    const split = checklistSplitRef.current;
    checklistSplitRef.current = null;
    const created = split?.item.nextElementSibling;
    if (created && created !== split.next && created.tagName === 'LI') created.setAttribute('data-checked', 'false');
    noteBodyHtmlRef.current = sanitizeNoteHtml(editor.innerHTML);
    setNoteBody(editor.innerText);
    markDirty();
    setBodyRevision((revision) => revision + 1);
  };

  const rememberSelection = () => {
    const selection = window.getSelection();
    const editor = editorRef.current;
    if (!selection || !selection.rangeCount || !editor || !editor.contains(selection.anchorNode)) return;
    savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    const font = String(document.queryCommandValue('fontName') || '');
    setCurrentFont(/georgia/i.test(font) ? 'serif' : /times/i.test(font) ? 'times' : /mono|menlo|courier/i.test(font) ? 'mono' : 'sans');
    const size = String(document.queryCommandValue('fontSize') || '3');
    setCurrentSize(FONT_SIZES.some((option) => option.value === size) ? size : Number(size) < 3 ? '2' : Number(size) > 5 ? '6' : '3');
  };

  // Dropdowns and the link prompt take focus away from the body; the caret or
  // selection they act on is put back first.
  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    // Still focused with the caret inside: the live selection is current, and
    // the remembered one may lag it (selectionchange fires asynchronously).
    if (document.activeElement === editor && selection?.rangeCount && editor.contains(selection.anchorNode)) return;
    editor.focus();
    const range = savedRangeRef.current;
    if (range && selection && editor.contains(range.startContainer)) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  useEffect(() => {
    if (!isEditingNote) return;
    document.addEventListener('selectionchange', rememberSelection);
    return () => document.removeEventListener('selectionchange', rememberSelection);
  }, [isEditingNote]);

  useEffect(() => {
    if (!colorMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!colorMenuRef.current?.contains(event.target as Node)) setColorMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setColorMenuOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [colorMenuOpen]);

  const formatNote = (command: string, value?: string) => {
    restoreSelection();
    // Firefox only applies a highlight through inline CSS.
    const useCss = command === 'hiliteColor';
    if (useCss) document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    if (useCss) document.execCommand('styleWithCSS', false, 'false');
    syncBody();
  };

  const toggleHighlight = () => {
    restoreSelection();
    const current = String(document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor') || '').replace(/\s/g, '');
    formatNote('hiliteColor', current === 'rgb(255,243,163)' ? 'transparent' : HIGHLIGHT_COLOR);
  };

  const selectionListItem = () => {
    const node = window.getSelection()?.anchorNode;
    const element = node instanceof Element ? node : node?.parentElement;
    const item = element?.closest('li');
    return item && editorRef.current?.contains(item) ? item : null;
  };

  const markChecklist = (list: Element | null | undefined) => {
    if (!list || list.tagName !== 'UL') return;
    list.setAttribute('data-checklist', 'true');
    Array.from(list.children).forEach((child) => {
      if (child.tagName === 'LI' && !child.hasAttribute('data-checked')) child.setAttribute('data-checked', 'false');
    });
  };

  const toggleChecklist = () => {
    restoreSelection();
    const list = selectionListItem()?.parentElement;
    if (list?.tagName === 'UL' && list.getAttribute('data-checklist') === 'true') {
      document.execCommand('insertUnorderedList');
    } else if (list?.tagName === 'UL') {
      markChecklist(list);
    } else {
      document.execCommand('insertUnorderedList');
      markChecklist(selectionListItem()?.parentElement);
    }
    syncBody();
  };

  const insertLink = () => {
    const range = savedRangeRef.current?.cloneRange();
    const raw = window.prompt('Link URL', 'https://');
    if (!raw || !raw.trim() || raw.trim() === 'https://') return;
    let url = raw.trim();
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url) ? `mailto:${url}` : `https://${url}`;
    if (!/^(https?:|mailto:)/i.test(url)) return;
    savedRangeRef.current = range || savedRangeRef.current;
    restoreSelection();
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}">${escapeHtml(url.replace(/^mailto:/i, ''))}</a>`);
    } else {
      document.execCommand('createLink', false, url);
    }
    editorRef.current?.querySelectorAll('a').forEach((anchor) => {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    });
    syncBody();
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      const item = selectionListItem();
      checklistSplitRef.current = item?.parentElement?.getAttribute('data-checklist') === 'true'
        ? { item, next: item.nextElementSibling }
        : null;
    }
    const mod = event.metaKey || event.ctrlKey;
    if (!mod || event.altKey) return;
    const key = event.key.toLowerCase();
    let handled = true;
    if (!event.shiftKey && key === 'b') formatNote('bold');
    else if (!event.shiftKey && key === 'i') formatNote('italic');
    else if (!event.shiftKey && key === 'u') formatNote('underline');
    else if (!event.shiftKey && key === 'k') insertLink();
    else if (event.shiftKey && event.code === 'Digit7') formatNote('insertOrderedList');
    else if (event.shiftKey && event.code === 'Digit8') formatNote('insertUnorderedList');
    else handled = false;
    if (handled) event.preventDefault();
  };

  const handleEditorClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    const anchor = target.closest('a');
    if (anchor && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
      return;
    }
    // The checkbox is drawn in the item's left padding; a click there toggles it.
    const item = target.closest('li');
    if (item && item.parentElement?.getAttribute('data-checklist') === 'true') {
      const offset = event.clientX - item.getBoundingClientRect().left;
      if (offset >= 0 && offset < parseFloat(getComputedStyle(item).paddingLeft)) {
        event.preventDefault();
        item.setAttribute('data-checked', item.getAttribute('data-checked') === 'true' ? 'false' : 'true');
        syncBody();
      }
    }
  };

  const toolbarAction = (label: string, icon: React.ReactNode, onAction: () => void, shortcut?: string) => (
    <button key={label} type="button" aria-label={label} title={shortcut ? `${label} (${shortcut})` : label} onMouseDown={(event) => { event.preventDefault(); onAction(); }} className="flex h-8 min-h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--raised)] hover:text-[var(--ink)]">
      {icon}
    </button>
  );

  const toolbarButton = (label: string, icon: React.ReactNode, command: string, value?: string, shortcut?: string) =>
    toolbarAction(label, icon, () => formatNote(command, value), shortcut);

  const toolbarDivider = <span className="mx-1 h-4 w-px shrink-0 bg-[var(--rule)]" aria-hidden="true" />;

  const toolbarSelect = (label: string, value: string, options: { value: string; label: string }[], onChange: (value: string) => void, width: string) => (
    <div className={`relative shrink-0 ${width}`}>
      <select
        aria-label={label}
        title={label}
        value={value}
        onMouseDown={rememberSelection}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full cursor-pointer appearance-none truncate rounded-md border-0 bg-transparent pl-2 pr-5 text-[12px] text-[var(--ink-2)] outline-none transition hover:bg-[var(--raised)] focus-visible:ring-2 focus-visible:ring-[var(--teal-soft)]"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
    </div>
  );

  const wordCount = noteBody.trim() ? noteBody.trim().split(/\s+/).length : 0;

  const deleteSelectedItem = () => {
    if (!selectedItem) return;
    noteDirtyRef.current = false;
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
        <button type="button" onClick={leaveEditor} className="flex min-h-[44px] items-center gap-2 rounded-full px-3 text-[12px] font-medium text-[var(--ink-2)] transition hover:bg-[var(--raised)] hover:text-[var(--ink)]">
          <ArrowLeft size={15} /> Back to notes
        </button>
        <div className="flex items-center gap-2">
          {selectedItem?.type === 'answer' && <span className="rounded-full bg-[var(--teal-soft)] px-3 py-1.5 text-[10px] font-semibold text-[var(--teal)]">Saved answer</span>}
          {selectedItem?.type === 'answer' && <button type="button" onClick={() => editAnswerAsNote(selectedItem)} aria-label="Edit this answer as a note" className="flex min-h-[42px] items-center gap-2 rounded-full bg-[var(--teal)] px-5 text-[12px] font-semibold text-white transition hover:opacity-90"><Pencil size={14} /> Edit</button>}
          {(isCreatingNote || selectedItem?.type === 'note') && <button type="button" onClick={saveNote} className="flex min-h-[42px] items-center gap-2 rounded-full bg-[var(--ink)] px-5 text-[12px] font-semibold text-white transition hover:opacity-85"><Check size={14} /> Save note</button>}
          {selectedItem && <button type="button" onClick={deleteSelectedItem} aria-label="Delete note" className="flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium text-[var(--muted)] transition hover:bg-[var(--raised)] hover:text-[var(--warn)]"><Trash2 size={15} /> Delete</button>}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-10 sm:py-12">
        {isCreatingNote || selectedItem?.type === 'note' ? (
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]"><StickyNote size={15} /> Note editor</div>
            <label htmlFor="note-title" className="sr-only">Note title</label>
            <textarea id="note-title" ref={titleRef} rows={1} value={noteTitle} onChange={(event) => { markDirty(); setNoteTitle(event.target.value.replace(/\n/g, ' ')); }} placeholder="Untitled note" className="s87-note-title w-full resize-none overflow-hidden border-0 bg-transparent text-[34px] font-semibold leading-[1.08] tracking-[-0.05em] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] sm:text-[44px]" />
            <div className="mt-4 flex items-center gap-2 text-[11px] text-[var(--muted)]"><Clock3 size={13} /> Draft your thinking, decisions, and next steps.</div>
            <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--surface)] shadow-sm transition focus-within:border-[var(--teal)] focus-within:ring-2 focus-within:ring-[var(--teal-soft)]">
              <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--rule-2)] bg-[var(--surface-2)]/55 px-2 py-1.5" role="toolbar" aria-label="Note formatting">
                {toolbarSelect('Font', currentFont, FONT_FAMILIES.map(({ key, label }) => ({ value: key, label })), (key) => {
                  setCurrentFont(key);
                  formatNote('fontName', FONT_FAMILIES.find((font) => font.key === key)?.value);
                }, 'w-[84px]')}
                {toolbarSelect('Text size', currentSize, FONT_SIZES, (size) => {
                  setCurrentSize(size);
                  formatNote('fontSize', size);
                }, 'w-[84px]')}
                {toolbarDivider}
                {toolbarButton('Bold', <Bold size={15} />, 'bold', undefined, `${MOD_KEY}B`)}
                {toolbarButton('Italic', <Italic size={15} />, 'italic', undefined, `${MOD_KEY}I`)}
                {toolbarButton('Underline', <Underline size={15} />, 'underline', undefined, `${MOD_KEY}U`)}
                {toolbarButton('Strikethrough', <Strikethrough size={15} />, 'strikeThrough')}
                {toolbarDivider}
                {toolbarAction('Highlight', <Highlighter size={15} />, toggleHighlight)}
                <div ref={colorMenuRef} className="relative shrink-0">
                  {toolbarAction('Text color', <Baseline size={15} />, () => setColorMenuOpen((open) => !open))}
                  {colorMenuOpen && (
                    <div role="menu" aria-label="Text color" className="absolute left-0 top-full z-20 mt-1 flex gap-1.5 rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-2 shadow-md">
                      {TEXT_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          role="menuitem"
                          aria-label={color.label}
                          title={color.label}
                          onMouseDown={(event) => { event.preventDefault(); formatNote('foreColor', color.value); setColorMenuOpen(false); }}
                          className="h-5 min-h-0 w-5 rounded-full border border-black/10 transition hover:scale-110"
                          style={{ backgroundColor: color.value }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {toolbarDivider}
                {toolbarButton('Heading', <Heading2 size={15} />, 'formatBlock', 'h2')}
                {toolbarButton('Bulleted list', <List size={15} />, 'insertUnorderedList', undefined, `${MOD_KEY}Shift+8`)}
                {toolbarButton('Numbered list', <ListOrdered size={15} />, 'insertOrderedList', undefined, `${MOD_KEY}Shift+7`)}
                {toolbarAction('Checklist', <ListTodo size={15} />, toggleChecklist)}
                {toolbarDivider}
                {toolbarAction('Link', <LinkIcon size={15} />, insertLink, `${MOD_KEY}K`)}
                {toolbarDivider}
                {toolbarButton('Undo', <Undo2 size={15} />, 'undo', undefined, `${MOD_KEY}Z`)}
                {toolbarButton('Redo', <Redo2 size={15} />, 'redo')}
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
                onInput={syncBody}
                onKeyDown={handleEditorKeyDown}
                onClick={handleEditorClick}
                onPaste={(event) => {
                  event.preventDefault();
                  document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
                }}
              />
              <div className="flex items-center justify-between border-t border-[var(--rule-2)] px-4 py-2 text-[11px] text-[var(--muted)]">
                <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                <span aria-live="polite" className="flex items-center gap-1">
                  {saveState === 'saving' && 'Saving…'}
                  {saveState === 'saved' && <><Check size={12} /> Saved</>}
                </span>
              </div>
            </div>
            {noteLinkedDocId && <button type="button" onClick={() => { const doc = documents.find((d) => d.id === noteLinkedDocId); if (doc) onSelectDocument(doc); }} className="mt-4 flex items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--surface)] px-4 py-2.5 text-[11px] text-[var(--ink-2)] transition hover:bg-[var(--raised)]"><Link2 size={13} /> {documents.find((d) => d.id === noteLinkedDocId)?.title || 'Linked document'}</button>}
          </div>
        ) : selectedItem?.type === 'answer' ? (
          <article className="mx-auto max-w-4xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">Saved answer</div>
            <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.045em] text-[var(--ink)] sm:text-[44px]">{selectedItem.question}</h2>
            <p className="mt-3 text-[12px] text-[var(--muted)]">Saved answers are read-only. Choose <button type="button" onClick={() => editAnswerAsNote(selectedItem)} className="min-h-0 font-semibold text-[var(--teal)] underline-offset-2 hover:underline">Edit</button> to turn this into a note you can change.</p>
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

              <h1 className="s87-page-title">{initialFilter === 'notes' ? 'Notes' : 'Saved'}</h1>
              <p className="s87-page-description">Keep notes and saved answers together with the documents and decisions they reference.</p>
            </div>
            <button type="button" onClick={startNewNote} className="flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--teal)] px-5 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90"><Plus size={15} /> New note</button>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-2">
            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--surface)] px-4 shadow-sm"><Search size={15} className="text-[var(--muted)]" /><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search notes..." className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--muted)]" /></div>
            {(['all', 'notes', 'answers'] as const).map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`min-h-[38px] rounded-full border px-4 text-[11px] font-semibold transition ${activeFilter === filter ? 'border-[var(--teal-soft)] bg-[var(--teal-soft)] text-[var(--teal)]' : 'border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--raised)]'}`}>{filter === 'all' ? 'All' : filter === 'notes' ? 'Notes' : 'Saved answers'}</button>)}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--surface)] shadow-sm">
            {filteredItems.length > 0 ? filteredItems.map((item, idx) => <button key={item.id} type="button" onClick={() => openItem(item)} className={`group flex min-h-[88px] w-full items-center gap-4 px-5 text-left transition hover:bg-[var(--raised)] sm:px-6 ${idx < filteredItems.length - 1 ? 'border-b border-[var(--rule-2)]' : ''}`}><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.type === 'note' ? 'bg-[var(--teal-soft)] text-[var(--teal)]' : 'bg-[var(--blue-soft)] text-[var(--blue)]'}`}>{item.type === 'note' ? <StickyNote size={16} /> : <FileText size={16} />}</div><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-[var(--ink)]">{item.type === 'note' ? item.title : item.question}</div><div className="mt-1 truncate text-[11px] text-[var(--muted)]">{item.type === 'note' ? stripHtml(item.body) || 'Empty note' : 'Saved answer'}</div></div><span className="shrink-0 text-[10px] text-[var(--muted)]">{new Date(item.type === 'note' ? item.updatedAt : item.timestamp).toLocaleDateString()}</span></button>) : <div className="px-6 py-16 text-center"><StickyNote size={26} className="mx-auto text-[var(--muted)]" /><p className="mt-4 text-[14px] font-medium text-[var(--ink-2)]">No notes or saved answers yet.</p><p className="mt-1 text-[12px] text-[var(--muted)]">Create a note or save a useful answer from Ask.</p><button type="button" onClick={startNewNote} className="mt-5 rounded-full bg-[var(--teal)] px-4 py-2.5 text-[11px] font-semibold text-white">Create your first note</button></div>}
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
