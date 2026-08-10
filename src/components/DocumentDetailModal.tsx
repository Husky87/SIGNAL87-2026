import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
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
  BookOpen,
  StickyNote
} from 'lucide-react';
import { DocumentItem } from '../types';
import { PDFViewer } from './PDFViewer';
import { getDocumentPdfUrl } from '../lib/pdfGenerator';

interface DocumentDetailModalProps {
  document: DocumentItem | null;
  onClose: () => void;
  onOpenCompare: (doc: DocumentItem) => void;
  onAddNote?: (docId: string) => void;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  document: doc,
  onClose,
  onOpenCompare,
  onAddNote
}) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'analysis'>('pdf');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(3);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'reader' | 'native'>('reader');

  const pdfUrl = useMemo(() => (doc ? getDocumentPdfUrl(doc) : ''), [doc]);

  useEffect(() => {
    setCurrentPage(1);
    setZoomLevel(100);
    setDocSearchQuery('');
    setActiveMatchIndex(0);
    setTotalPages(doc?.type === 'xlsx' || doc?.type === 'csv' ? 1 : 3);
    setViewMode(doc?.fileUrl ? 'native' : 'reader');
  }, [doc]);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [docSearchQuery]);

  if (!doc) return null;

  const fullText = doc.contentPreview || doc.summary || 'No text content preview available.';

  const getMatchesCount = () => {
    if (!docSearchQuery.trim()) return 0;
    const escaped = docSearchQuery.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const matches = fullText.match(new RegExp(escaped, 'gi'));
    return matches ? matches.length : 0;
  };

  const matchesCount = getMatchesCount();

  const scrollToActiveMatch = () => {
    setTimeout(() => {
      const activeEl = document.getElementById('active-search-match');
      if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const handleNextMatch = () => {
    if (matchesCount === 0) return;
    const nextIdx = (activeMatchIndex + 1) % matchesCount;
    setActiveMatchIndex(nextIdx);
    scrollToActiveMatch();
  };

  const handlePrevMatch = () => {
    if (matchesCount === 0) return;
    const prevIdx = (activeMatchIndex - 1 + matchesCount) % matchesCount;
    setActiveMatchIndex(prevIdx);
    scrollToActiveMatch();
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

  const handlePrint = () => window.print();
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(200, prev + 15));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(50, prev - 15));
  const handlePrevPage = () => setCurrentPage((prev) => Math.max(1, prev - 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(totalPages, prev + 1));

  return (
    <div className="fixed inset-0 bg-[var(--ink)]/60 backdrop-blur-xs z-50 flex items-center justify-center p-0 sm:p-3">
      <div className="bg-[var(--surface)] rounded-none sm:rounded-2xl max-w-6xl w-full h-full sm:h-[94vh] overflow-hidden border-0 sm:border sm:border-[var(--rule)] flex flex-col text-[var(--ink)]">

        {/* Top header */}
        <div className="px-4 py-3 bg-[var(--surface)] border-b border-[var(--rule)] flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={onClose}
              className="p-1.5 text-[var(--ink-2)] hover:text-[var(--ink)] rounded-full transition-colors cursor-pointer flex-shrink-0"
              title="Close"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0">
              <h2 className="text-[14.5px] font-medium text-[var(--ink)] truncate">{doc.title}</h2>
              <div className="hidden sm:flex items-center gap-2 mt-0.5 text-[12px] text-[var(--muted)]">
                <span>{doc.type.toUpperCase()}</span>
                <span>·</span>
                <span>{doc.category || 'General'}</span>
                <span>·</span>
                <span>{(doc.sizeBytes / 1000000).toFixed(2)} MB</span>
                <span>·</span>
                <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* View tabs — plain underlined text, not pills */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <button
              onClick={() => setActiveTab('pdf')}
              className={`pb-0.5 text-[13.5px] transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 ${
                activeTab === 'pdf' ? 'text-[var(--ink)] font-medium border-[var(--ink)]' : 'text-[var(--muted)] border-transparent hover:text-[var(--ink)]'
              }`}
              title="Viewer"
            >
              <BookOpen size={14} />
              <span className="hidden xs:inline">Viewer</span>
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`pb-0.5 text-[13.5px] transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 ${
                activeTab === 'analysis' ? 'text-[var(--ink)] font-medium border-[var(--ink)]' : 'text-[var(--muted)] border-transparent hover:text-[var(--ink)]'
              }`}
              title="AI Analysis"
            >
              <Sparkles size={14} />
              <span className="hidden xs:inline">AI Analysis</span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => { if (onAddNote) { onAddNote(doc.id); onClose(); } }}
              className="p-1.5 text-[var(--ink-2)] hover:text-[var(--ink)] rounded-full transition-colors cursor-pointer"
              title="Add a linked note"
            >
              <StickyNote size={16} />
            </button>
            <button
              onClick={() => onOpenCompare(doc)}
              className="p-1.5 text-[var(--ink-2)] hover:text-[var(--ink)] rounded-full transition-colors cursor-pointer hidden sm:flex"
              title="Compare with another document"
            >
              <GitFork size={14} />
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 text-[var(--ink-2)] hover:text-[var(--ink)] rounded-full transition-colors cursor-pointer hidden sm:block"
              title="Print"
            >
              <Printer size={16} />
            </button>
            <button
              onClick={handleDownloadText}
              className="p-1.5 text-[var(--ink-2)] hover:text-[var(--ink)] rounded-full transition-colors cursor-pointer"
              title="Download"
            >
              <Download size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[var(--ink-2)] hover:text-[var(--ink)] rounded-full transition-colors cursor-pointer sm:hidden"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Hairline toolbar — no dark chrome */}
        {activeTab === 'pdf' && (
          <div className="px-4 py-2.5 bg-[var(--surface)] border-b border-[var(--rule)] flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--ink-2)]">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="p-1 rounded text-[var(--ink-2)] hover:text-[var(--ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Page <span className="text-[var(--ink)] font-medium">{currentPage}</span> of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className="p-1 rounded text-[var(--ink-2)] hover:text-[var(--ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex items-center gap-1 bg-[var(--raised)] px-2.5 py-1 rounded-lg min-w-[200px] sm:min-w-[260px]">
              <Search size={14} className="text-[var(--muted)] flex-shrink-0" />
              <input
                type="text"
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                placeholder="Search this document"
                className="w-full bg-transparent text-[var(--ink)] text-[13px] placeholder-[var(--muted)] focus:outline-none"
              />
              {docSearchQuery && (
                <div className="flex items-center gap-1 text-[12px] text-[var(--muted)] flex-shrink-0">
                  <span>{matchesCount > 0 ? `${activeMatchIndex + 1}/${matchesCount}` : '0'}</span>
                  <button onClick={handlePrevMatch} className="p-0.5 hover:text-[var(--ink)] cursor-pointer">
                    <ChevronUp size={12} />
                  </button>
                  <button onClick={handleNextMatch} className="p-0.5 hover:text-[var(--ink)] cursor-pointer">
                    <ChevronDown size={12} />
                  </button>
                  <button onClick={() => setDocSearchQuery('')} className="p-0.5 hover:text-[var(--ink)] cursor-pointer">
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {doc.fileUrl && (
                <div className="flex items-center gap-1 mr-2">
                  <button
                    onClick={() => setViewMode('native')}
                    className={`px-2 py-1 text-[12px] rounded transition-colors cursor-pointer ${
                      viewMode === 'native' ? 'bg-[var(--raised)] text-[var(--ink)] font-medium' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Embedded
                  </button>
                  <button
                    onClick={() => setViewMode('reader')}
                    className={`px-2 py-1 text-[12px] rounded transition-colors cursor-pointer ${
                      viewMode === 'reader' ? 'bg-[var(--raised)] text-[var(--ink)] font-medium' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Page reader
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1 bg-[var(--raised)] px-2 py-1 rounded-lg">
                <button onClick={handleZoomOut} className="text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer" title="Zoom out">
                  <ZoomOut size={14} />
                </button>
                <span className="w-10 text-center text-[12px]">{zoomLevel}%</span>
                <button onClick={handleZoomIn} className="text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer" title="Zoom in">
                  <ZoomIn size={14} />
                </button>
                <button onClick={() => setZoomLevel(100)} className="ml-1 text-[12px] text-[var(--muted)] hover:text-[var(--ink)] underline cursor-pointer">
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reading surface */}
        <div className="flex-1 overflow-y-auto bg-[var(--bg)] px-4 sm:px-10 py-6 sm:py-10 flex justify-center items-start">
          {activeTab === 'pdf' ? (
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
              />

              <div className="flex items-center justify-between px-2 py-3 mt-4 w-full max-w-3xl border-t border-[var(--rule-2)] text-[13px] text-[var(--ink-2)]">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="flex items-center gap-1 hover:text-[var(--ink)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <span>Page {currentPage} of {totalPages}</span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  className="flex items-center gap-1 hover:text-[var(--ink)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
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

        {/* Bottom bar */}
        <div className="p-3 bg-[var(--surface)] border-t border-[var(--rule)] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 text-[var(--ink-2)] hover:text-[var(--ink)] font-medium text-[13.5px] rounded-xl transition-colors cursor-pointer text-center"
          >
            Back to workspace
          </button>
          <button
            onClick={() => onOpenCompare(doc)}
            className="flex-1 py-2.5 px-4 bg-[var(--teal)] hover:opacity-90 text-white font-medium text-[13.5px] rounded-xl transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
          >
            <GitFork size={14} />
            <span>Compare documents</span>
          </button>
        </div>
      </div>
    </div>
  );
};
