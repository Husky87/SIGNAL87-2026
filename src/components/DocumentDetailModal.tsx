import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquareText,
  X,
  FileText,
  ShieldAlert,
  Sparkles,
  Download,
  GitFork,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  Printer,
  StickyNote,
  Loader2
} from 'lucide-react';
import { Page } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { DocumentItem } from '../types';
import { PDFViewer } from './PDFViewer';
import { getTypeMeta } from './DocumentThumbnail';
import { getDocumentPdfUrl, hasRenderablePdf } from '../lib/pdfGenerator';
import { buildHighlightRenderer, extractPageTexts, findMatches, PageText } from '../lib/pdfSearch';
import { printPdfDocument, printSheetsDocument, printTextDocument } from '../lib/printDocument';

/** Thumbnails are drawn only within this distance of the rail's visible part. */
const RAIL_MARGIN_PX = 480;
const THUMB_WIDTH = 92;

interface ParsedSheet {
  name: string;
  headers: string[];
  rows: string[][];
}

/** Splits a "| a | b |" markdown row into trimmed cells. */
const splitPipeRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

/**
 * Pads every row (including the header row) out to the widest row in the
 * grid, positionally. Building headers from cell *names* instead — the way
 * the upload-time text preview does — collapses distinct blank-header
 * columns together (spreadsheet libraries name them all "__EMPTY",
 * "__EMPTY_1", ...) and drops columns a given row happened not to populate.
 * Position is the only address a spreadsheet cell actually has.
 */
const gridToSheet = (name: string, grid: unknown[][]): ParsedSheet => {
  const colCount = grid.reduce((max, row) => Math.max(max, row.length), 0);
  const cell = (row: unknown[] | undefined, i: number) => {
    const v = row?.[i];
    return v === undefined || v === null ? '' : String(v).trim();
  };
  const headers = Array.from({ length: colCount }, (_, i) => cell(grid[0], i));
  const rows = grid.slice(1).map((row) => Array.from({ length: colCount }, (_, i) => cell(row, i)));
  return { name, headers, rows };
};

/**
 * Fallback for documents whose original file was never stored (only the
 * upload-time extracted text survived) — reconstructs a table from that
 * text. Lossier than reading the real file: headers are cell names rather
 * than positions, so repeated blank headers collapse into one column.
 */
const parseSpreadsheetPreviewText = (doc: DocumentItem): ParsedSheet[] | null => {
  const text = doc.contentPreview || '';
  if (!text.trim()) return null;

  if (doc.type === 'xlsx') {
    const sheets: ParsedSheet[] = [];
    const blocks = text.split(/^--- Sheet: (.+) ---$/m);
    // split() on a capturing group alternates [preamble, name, body, name, body, ...]
    for (let i = 1; i < blocks.length; i += 2) {
      const name = blocks[i].trim();
      const body = blocks[i + 1] || '';
      const lines = body.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
      if (lines.length === 0) continue;
      const grid = [lines[0], ...lines.slice(2)].map(splitPipeRow); // lines[1] is the --- separator row
      if (grid.length > 0) sheets.push(gridToSheet(name, grid));
    }
    return sheets.length > 0 ? sheets : null;
  }

  if (doc.type === 'csv') {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const headerLine = lines.find((l) => l.startsWith('HEADER:'));
    if (!headerLine) return null;
    const grid = [
      headerLine.slice('HEADER:'.length).trim().split(','),
      ...lines.filter((l) => /^ROW \d+:/.test(l)).map((l) => l.replace(/^ROW \d+:/, '').trim().split(','))
    ];
    return [gridToSheet(doc.title, grid)];
  }

  return null;
};

/**
 * Prefers reading the actual stored file over the lossy text reconstruction
 * above — same libraries the upload-time parser used, so the table matches
 * the source spreadsheet's real columns instead of its extracted text.
 */
function useSpreadsheetSheets(doc: DocumentItem | null): { sheets: ParsedSheet[] | null; loading: boolean } {
  const [state, setState] = useState<{ sheets: ParsedSheet[] | null; loading: boolean }>({ sheets: null, loading: false });

  useEffect(() => {
    if (!doc || (doc.type !== 'xlsx' && doc.type !== 'csv')) {
      setState({ sheets: null, loading: false });
      return;
    }

    if (!doc.fileUrl) {
      setState({ sheets: parseSpreadsheetPreviewText(doc), loading: false });
      return;
    }

    let cancelled = false;
    setState({ sheets: null, loading: true });

    (async () => {
      try {
        const res = await fetch(doc.fileUrl!);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        if (doc.type === 'csv') {
          const text = await res.text();
          const grid = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0).map((l) => l.split(','));
          if (!cancelled) setState({ sheets: grid.length > 0 ? [gridToSheet(doc.title, grid)] : null, loading: false });
          return;
        }

        const buffer = await res.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheets = workbook.SheetNames.map((name) =>
          gridToSheet(name, XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1 }))
        );
        if (!cancelled) setState({ sheets: sheets.length > 0 ? sheets : null, loading: false });
      } catch {
        if (!cancelled) setState({ sheets: parseSpreadsheetPreviewText(doc), loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [doc]);

  return state;
}

const SpreadsheetPreview: React.FC<{ sheets: ParsedSheet[] }> = ({ sheets }) => (
  <div className="w-full max-w-5xl space-y-6">
    {sheets.map((sheet, idx) => (
      <div key={idx} className="space-y-2">
        {sheets.length > 1 && (
          <h3 className="text-[13px] font-medium text-[var(--ink)]">{sheet.name}</h3>
        )}
        <div className="border border-[var(--rule)] rounded-xl overflow-auto max-h-[70vh]">
          <table className="w-full text-left text-[12.5px] border-collapse">
            {sheet.headers.length > 0 && (
              <thead className="sticky top-0 z-10">
                <tr className="bg-[var(--raised)]">
                  {sheet.headers.map((h, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 font-semibold text-[var(--ink)] border-b border-[var(--rule)] whitespace-nowrap"
                    >
                      {h || `Column ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {sheet.rows.map((row, r) => (
                <tr key={r} className="odd:bg-[var(--surface)] even:bg-[var(--bg)]">
                  {row.map((cell, c) => (
                    <td key={c} className="px-3 py-1.5 text-[var(--ink-2)] border-b border-[var(--rule-2)] whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ))}
  </div>
);

/** react-pdf destroys its PDFDocumentProxy on reload or unmount; a destroyed one throws on every call. */
const isPdfAlive = (pdf: PDFDocumentProxy | null): pdf is PDFDocumentProxy =>
  !!pdf && !(pdf as unknown as { loadingTask?: { destroyed?: boolean } }).loadingTask?.destroyed;

/** Keeps a failing thumbnail from reaching the app-level error boundary. */
class ThumbnailBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('Page thumbnail failed to render:', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface DocumentDetailModalProps {
  document: DocumentItem | null;
  onClose: () => void;
  onOpenCompare: (doc: DocumentItem) => void;
  onAddNote?: (docId: string) => void;
  /** Opens Ask limited to this file. */
  onAskAbout?: (doc: DocumentItem) => void;
  /** Search to start with, e.g. a phrase from a cited passage so it is highlighted on open. */
  initialSearch?: string;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  document: doc,
  onClose,
  onOpenCompare,
  onAddNote,
  onAskAbout,
  initialSearch = ''
}) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'analysis'>('pdf');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(3);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(0);
  const [pdfProxy, setPdfProxy] = useState<PDFDocumentProxy | null>(null);
  const thumbRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const railRef = useRef<HTMLElement>(null);
  const [nearThumbs, setNearThumbs] = useState<Set<number>>(() => new Set([1]));
  const [thumbHeight, setThumbHeight] = useState(119);
  const [pageTexts, setPageTexts] = useState<PageText[] | null>(null);
  const [printing, setPrinting] = useState(false);

  const pdfUrl = useMemo(() => (doc ? getDocumentPdfUrl(doc) : ''), [doc]);
  // Only PDFs with a real file can be rendered. Everything else shows its
  // extracted text, labelled as such, rather than a manufactured stand-in.
  const canRenderPdf = useMemo(() => (doc ? hasRenderablePdf(doc) : false), [doc]);
  const { sheets: parsedSheets, loading: sheetsLoading } = useSpreadsheetSheets(doc);

  useEffect(() => {
    setCurrentPage(1);
    setZoomLevel(100);
    setDocSearchQuery(initialSearch);
    setActiveMatchIndex(0);
    setTotalPages(doc?.type === 'xlsx' || doc?.type === 'csv' ? 1 : 3);
    setActiveTab('pdf');
    setPdfProxy(null);
    setPageTexts(null);
    setNearThumbs(new Set([1]));
  }, [doc]);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [docSearchQuery]);

  // Keep the current page's thumbnail in view as pages change from anywhere.
  useEffect(() => {
    thumbRefs.current.get(currentPage)?.scrollIntoView({ block: 'nearest' });
  }, [currentPage]);

  // Only a proxy react-pdf has not yet destroyed is ever read.
  const livePdf = isPdfAlive(pdfProxy) ? pdfProxy : null;
  const showRail = activeTab === 'pdf' && canRenderPdf && livePdf !== null;

  // Placeholders take the first page's proportions so the rail does not jump as thumbnails arrive.
  useEffect(() => {
    if (!livePdf) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => livePdf.getPage(1))
      .then((page) => {
        const { width, height } = page.getViewport({ scale: 1 });
        if (!cancelled && width > 0) setThumbHeight(Math.round((THUMB_WIDTH * height) / width));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [livePdf]);

  // Lazy rail: only pages near the visible part of the rail render a thumbnail.
  useEffect(() => {
    const root = railRef.current;
    if (!showRail || !root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        setNearThumbs((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            const n = Number((entry.target as HTMLElement).dataset.page);
            if (entry.isIntersecting) next.add(n); else next.delete(n);
          });
          return next;
        });
      },
      { root, rootMargin: `${RAIL_MARGIN_PX}px 0px` }
    );
    thumbRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [showRail, totalPages]);

  // Search reads the PDF's own text, once per document, the first time it is needed.
  const wantsPdfText = canRenderPdf && livePdf !== null && docSearchQuery.trim() !== '';
  useEffect(() => {
    if (!wantsPdfText || pageTexts || !livePdf) return;
    let cancelled = false;
    extractPageTexts(livePdf)
      .then((texts) => { if (!cancelled) setPageTexts(texts); })
      .catch((err) => { console.error('Could not read the PDF text for search:', err); if (!cancelled) setPageTexts([]); });
    return () => { cancelled = true; };
  }, [wantsPdfText, pageTexts, livePdf]);

  const searchesPdf = canRenderPdf && livePdf !== null;
  const plainText = doc ? doc.contentPreview || doc.summary || 'No text content preview available.' : '';
  const matches = useMemo(
    () => (searchesPdf ? (pageTexts ? findMatches(pageTexts, docSearchQuery) : []) : findMatches([{ text: plainText, items: [] }], docSearchQuery)),
    [searchesPdf, pageTexts, docSearchQuery, plainText]
  );
  const searchPending = searchesPdf && docSearchQuery.trim() !== '' && pageTexts === null;

  const highlightRenderer = useMemo(
    () => (searchesPdf && pageTexts && matches.length > 0 ? buildHighlightRenderer(pageTexts, matches, activeMatchIndex) : undefined),
    [searchesPdf, pageTexts, matches, activeMatchIndex]
  );

  // Bring the current match into view: open its page, then scroll once its highlight has rendered.
  useEffect(() => {
    const match = matches[activeMatchIndex];
    if (!match) return;
    if (searchesPdf) setCurrentPage(match.page);
    let frame = 0;
    const deadline = performance.now() + 2000;
    const seek = () => {
      const el = document.querySelector(`.s87-search-hit-active[data-match="${activeMatchIndex}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else if (performance.now() < deadline) frame = requestAnimationFrame(seek);
    };
    frame = requestAnimationFrame(seek);
    return () => cancelAnimationFrame(frame);
  }, [matches, activeMatchIndex, searchesPdf]);

  if (!doc) return null;

  const fullText = plainText;
  const matchesCount = matches.length;

  const handleNextMatch = () => {
    if (matchesCount === 0) return;
    setActiveMatchIndex((activeMatchIndex + 1) % matchesCount);
  };

  const handlePrevMatch = () => {
    if (matchesCount === 0) return;
    setActiveMatchIndex((activeMatchIndex - 1 + matchesCount) % matchesCount);
  };

  const handleDownloadText = () => {
    if (doc.fileUrl) {
      const a = document.createElement('a');
      a.href = doc.fileUrl;
      a.download = doc.title;
      a.target = '_blank';
      a.click();
      return;
    }
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_document.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Prints only the document, from a frame of its own, instead of the whole app page.
  const handlePrint = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      if (canRenderPdf && livePdf) await printPdfDocument(livePdf, doc.title);
      else if (parsedSheets) await printSheetsDocument(doc.title, parsedSheets);
      else await printTextDocument(doc.title, fullText);
    } catch (err) {
      console.error('Printing failed:', err);
      alert('This document could not be prepared for printing.');
    } finally {
      setPrinting(false);
    }
  };
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(200, prev + 15));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(50, prev - 15));
  const handlePrevPage = () => setCurrentPage((prev) => Math.max(1, prev - 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(totalPages, prev + 1));

  const iconButtonClass = 'flex h-9 w-9 items-center justify-center rounded-lg text-[#b3b3ad] hover:text-white hover:bg-white/10 transition-colors cursor-pointer';
  const subButtonClass = 'flex h-7 min-h-0 w-7 items-center justify-center rounded-md text-[#b3b3ad] hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer';
  const typeMeta = getTypeMeta(doc.type);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-0 sm:p-3">
      <div className="bg-[#1a1b1d] rounded-none sm:rounded-2xl max-w-6xl w-full h-full sm:h-[94vh] overflow-hidden border-0 sm:border sm:border-[#2c2e32] flex flex-col text-[#e8e8e4]">

        {/* Header: what the document is on the left, icon-only actions on the right. */}
        <div
          className="flex items-center gap-3 px-3 sm:px-4 py-2 bg-[#1f2124] border-b border-[#2c2e32]"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <typeMeta.Icon size={20} className="flex-shrink-0" style={{ color: typeMeta.color }} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-medium text-[#f2f2ee] truncate">{doc.title}</h2>
            <div className="hidden sm:flex items-center gap-1.5 text-[11.5px] text-[#8c8c86]">
              <span>{doc.type.toUpperCase()}</span>
              <span>·</span>
              <span>{(doc.sizeBytes / 1000000).toFixed(2)} MB</span>
              <span>·</span>
              <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            {onAskAbout && (
              <button
                onClick={() => { onAskAbout(doc); onClose(); }}
                className="mr-1 flex min-h-9 items-center gap-1.5 rounded-full bg-[#6cbfc5] px-3.5 text-[12px] font-semibold text-[#0b0e0c] hover:opacity-90"
                title="Ask questions about this file"
                aria-label="Ask about this file"
              >
                <MessageSquareText size={15} />
                <span className="hidden sm:inline">Ask about this file</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab(activeTab === 'analysis' ? 'pdf' : 'analysis')}
              className={`${iconButtonClass} ${activeTab === 'analysis' ? 'text-white bg-white/10' : ''}`}
              title="AI analysis"
              aria-label="AI analysis"
              aria-pressed={activeTab === 'analysis'}
            >
              <Sparkles size={17} />
            </button>
            <button
              onClick={() => { if (onAddNote) { onAddNote(doc.id); onClose(); } }}
              className={iconButtonClass}
              title="Add note"
              aria-label="Add note"
            >
              <StickyNote size={17} />
            </button>
            <button
              onClick={() => onOpenCompare(doc)}
              className={`${iconButtonClass} hidden sm:flex`}
              title="Compare"
              aria-label="Compare with another document"
            >
              <GitFork size={17} />
            </button>
            <span className="mx-1 h-5 w-px bg-[#34363a]" aria-hidden="true" />
            <button onClick={handleDownloadText} className={iconButtonClass} title="Download" aria-label="Download">
              <Download size={17} />
            </button>
            <button onClick={() => void handlePrint()} disabled={printing} className={`${iconButtonClass} hidden sm:flex disabled:cursor-wait`} title="Print" aria-label={printing ? 'Preparing to print' : 'Print'}>
              {printing ? <Loader2 size={17} className="animate-spin" /> : <Printer size={17} />}
            </button>
            <button onClick={onClose} className={iconButtonClass} title="Close" aria-label="Close viewer">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sub-toolbar: search, page counter, zoom. */}
        {activeTab === 'pdf' && (
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 bg-[#26282b] border-b border-[#2c2e32] text-[12px] text-[#b3b3ad]">
            <div className="flex items-center gap-1.5 bg-[#34363a] rounded-md px-2 h-8 min-w-0 flex-1 max-w-[340px]">
              <Search size={14} className="flex-shrink-0 text-[#8c8c86]" />
              <input
                type="text"
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) handlePrevMatch(); else handleNextMatch();
                  }
                }}
                placeholder="Search this document"
                aria-label="Search this document"
                className="s87-viewer-search w-full min-w-0 bg-transparent text-[13px] text-[#f2f2ee] placeholder-[#8c8c86] focus:outline-none"
              />
              {docSearchQuery && (
                <>
                  <span className="flex-shrink-0 whitespace-nowrap text-[11.5px] text-[#8c8c86]" aria-live="polite">
                    {searchPending ? 'Searching…' : matchesCount > 0 ? `${activeMatchIndex + 1} of ${matchesCount}` : 'No matches'}
                  </span>
                  <button onClick={handlePrevMatch} disabled={matchesCount === 0} className={subButtonClass} title="Previous match" aria-label="Previous match">
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={handleNextMatch} disabled={matchesCount === 0} className={subButtonClass} title="Next match" aria-label="Next match">
                    <ChevronDown size={14} />
                  </button>
                  <button onClick={() => setDocSearchQuery('')} className={subButtonClass} title="Clear search" aria-label="Clear search">
                    <X size={13} />
                  </button>
                </>
              )}
            </div>

            {canRenderPdf && (
            <div className="ml-auto flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="flex items-center gap-0.5">
                <button onClick={handlePrevPage} disabled={currentPage <= 1} className={subButtonClass} title="Previous page" aria-label="Previous page">
                  <ChevronLeft size={15} />
                </button>
                <span className="min-w-[48px] text-center tabular-nums text-[#f2f2ee]" aria-label={`Page ${currentPage} of ${totalPages}`}>
                  {currentPage} <span className="text-[#8c8c86]">/ {totalPages}</span>
                </span>
                <button onClick={handleNextPage} disabled={currentPage >= totalPages} className={subButtonClass} title="Next page" aria-label="Next page">
                  <ChevronRight size={15} />
                </button>
              </div>

              <span className="h-4 w-px bg-[#3a3c40]" aria-hidden="true" />

              <div className="flex items-center gap-0.5">
                <button onClick={handleZoomOut} disabled={zoomLevel <= 50} className={subButtonClass} title="Zoom out" aria-label="Zoom out">
                  <ZoomOut size={14} />
                </button>
                <button
                  onClick={() => setZoomLevel(100)}
                  className="min-w-[44px] h-7 min-h-0 rounded-md text-center tabular-nums text-[#f2f2ee] hover:bg-white/10 cursor-pointer"
                  title="Reset zoom to 100%"
                  aria-label={`Zoom ${zoomLevel}%, reset to 100%`}
                >
                  {zoomLevel}%
                </button>
                <button onClick={handleZoomIn} disabled={zoomLevel >= 200} className={subButtonClass} title="Zoom in" aria-label="Zoom in">
                  <ZoomIn size={14} />
                </button>
              </div>
            </div>
            )}
          </div>
        )}

        <div className="flex-1 flex min-h-0">
          {/* Page thumbnails. Rendered from the PDF the viewer already loaded. */}
          {showRail && (
            <nav ref={railRef} aria-label="Pages" className="hidden md:flex flex-col items-center gap-3 w-[132px] flex-shrink-0 overflow-y-auto bg-[#1a1b1d] border-r border-[#2c2e32] py-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
                const isCurrent = n === currentPage;
                return (
                  <button
                    key={n}
                    ref={(el) => { if (el) thumbRefs.current.set(n, el); else thumbRefs.current.delete(n); }}
                    data-page={n}
                    onClick={() => setCurrentPage(n)}
                    aria-label={`Go to page ${n}`}
                    aria-current={isCurrent ? 'page' : undefined}
                    className="group flex flex-shrink-0 flex-col items-center gap-1.5 cursor-pointer"
                  >
                    <span
                      className={`block overflow-hidden rounded-[3px] bg-white border-2 transition-colors ${
                        isCurrent ? 'border-[var(--teal)]' : 'border-transparent group-hover:border-[#4a4c50]'
                      }`}
                    >
                      {nearThumbs.has(n) && livePdf ? (
                        <ThumbnailBoundary key={`${doc?.id}-${n}`} fallback={<span className="block" style={{ width: THUMB_WIDTH, height: thumbHeight }} />}>
                          <Page
                            pdf={livePdf}
                            pageNumber={n}
                            width={THUMB_WIDTH}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            className="block"
                            loading={<span className="block" style={{ width: THUMB_WIDTH, height: thumbHeight }} />}
                            error={<span className="block" style={{ width: THUMB_WIDTH, height: thumbHeight }} />}
                          />
                        </ThumbnailBoundary>
                      ) : (
                        <span className="block" style={{ width: THUMB_WIDTH, height: thumbHeight }} />
                      )}
                    </span>
                    <span className={`text-[11px] tabular-nums ${isCurrent ? 'text-[#f2f2ee]' : 'text-[#8c8c86]'}`}>{n}</span>
                  </button>
                );
              })}
            </nav>
          )}

        {/* Reading surface */}
        <div className={`flex-1 min-w-0 overflow-y-auto px-4 sm:px-10 py-6 sm:py-10 flex justify-center items-start ${activeTab === 'pdf' ? 'bg-[#1a1b1d]' : 'bg-[var(--bg)] text-[var(--ink)]'}`}>
          {activeTab === 'pdf' && sheetsLoading ? (
            <div className="text-[13.5px] text-[var(--muted)] pt-10">Loading spreadsheet…</div>
          ) : activeTab === 'pdf' && !canRenderPdf && parsedSheets ? (
            <SpreadsheetPreview sheets={parsedSheets} />
          ) : activeTab === 'pdf' && !canRenderPdf ? (
            <div className="w-full max-w-3xl space-y-4">
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-[var(--rule)] bg-[var(--surface)] text-[13px]">
                <FileText size={16} className="flex-shrink-0 mt-0.5 text-[var(--muted)]" />
                <div className="space-y-1">
                  <p className="text-[var(--ink)] font-medium m-0">
                    {doc.type === 'pdf'
                      ? 'The original file for this document is not available'
                      : `${doc.type.toUpperCase()} files cannot be displayed as pages`}
                  </p>
                  <p className="text-[var(--ink-2)] m-0">
                    Showing the text extracted from it. {doc.fileUrl
                      ? 'Use Download to open the original in its own application.'
                      : 'The original was not stored, so there is nothing to download.'}
                  </p>
                </div>
              </div>

              <div
                className="whitespace-pre-wrap text-[14px] text-[var(--ink-2)] bg-[var(--surface)] border border-[var(--rule)] rounded-xl p-5"
                style={{ lineHeight: 1.7 }}
              >
                {searchesPdf || matches.length === 0
                  ? fullText
                  : matches.reduce<React.ReactNode[]>((nodes, match, index) => {
                      const prevEnd = index === 0 ? 0 : matches[index - 1].end;
                      nodes.push(fullText.slice(prevEnd, match.start));
                      nodes.push(
                        <mark
                          key={index}
                          data-match={index}
                          className={`s87-search-hit${index === activeMatchIndex ? ' s87-search-hit-active' : ''}`}
                        >
                          {fullText.slice(match.start, match.end)}
                        </mark>
                      );
                      if (index === matches.length - 1) nodes.push(fullText.slice(match.end));
                      return nodes;
                    }, [])}
              </div>
            </div>
          ) : activeTab === 'pdf' ? (
            <div className="w-full flex flex-col items-center">
              <PDFViewer
                docId={doc.id}
                fileUrl={pdfUrl}
                fileName={doc.title}
                currentPage={currentPage}
                totalPages={totalPages}
                onTotalPagesChange={setTotalPages}
                onPageChange={setCurrentPage}
                zoomLevel={zoomLevel}
                onDocumentLoaded={setPdfProxy}
                customTextRenderer={highlightRenderer}
              />
            </div>
          ) : (
            <div className="max-w-[680px] w-full space-y-6 text-[14.5px] text-[var(--ink-2)]" style={{ lineHeight: 1.6 }}>
              <div>
                <h1 className="text-[22px] text-[var(--ink)]" style={{ fontWeight: 600, letterSpacing: '-0.036em' }}>{doc.title}</h1>
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-x-2 gap-y-1 pt-2 text-[12px] text-[var(--muted)]">
                    {doc.tags.map((tag, idx) => (
                      <span key={idx}>{idx > 0 && '· '}{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {doc.summary && (
                <div className="pt-5 border-t border-[var(--rule-2)] space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)] uppercase" style={{ letterSpacing: '0.09em' }}>
                    <Sparkles size={12} />
                    <span>Summary</span>
                  </div>
                  <p className="text-[var(--ink)]">{doc.summary}</p>
                </div>
              )}

              {doc.riskHighlights && doc.riskHighlights.length > 0 && (
                <div className="pt-5 border-t border-[var(--rule-2)] space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)] uppercase" style={{ letterSpacing: '0.09em' }}>
                    <ShieldAlert size={12} />
                    <span>Worth a second look</span>
                  </div>
                  <ul className="space-y-1.5 list-disc pl-4 text-[var(--ink)]">
                    {doc.riskHighlights.map((hl, idx) => (
                      <li key={idx}>{hl}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        </div>

      </div>
    </div>
  );
};