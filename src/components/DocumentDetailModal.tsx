import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  FileText,
  ShieldAlert,
  Sparkles,
  Download,
  GitFork,
  Search,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  Printer,
  Scale,
  Eye,
  Maximize2,
  RotateCw,
  File,
  Layers,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { DocumentItem } from '../types';
import { PDFViewer } from './PDFViewer';
import { getDocumentPdfUrl } from '../lib/pdfGenerator';

interface DocumentDetailModalProps {
  document: DocumentItem | null;
  onClose: () => void;
  onOpenCompare: (doc: DocumentItem) => void;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  document: doc,
  onClose,
  onOpenCompare
}) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'analysis'>('pdf');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(3);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'reader' | 'native'>('reader');
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  const pagesContainerRef = useRef<HTMLDivElement>(null);

  const pdfUrl = useMemo(() => {
    return doc ? getDocumentPdfUrl(doc) : '';
  }, [doc]);

  useEffect(() => {
    setCurrentPage(1);
    setZoomLevel(100);
    setDocSearchQuery('');
    setActiveMatchIndex(0);
    setTotalPages(doc?.type === 'xlsx' || doc?.type === 'csv' ? 1 : 3);
    if (doc?.fileUrl) {
      setViewMode('native');
    } else {
      setViewMode('reader');
    }
  }, [doc]);

  // Reset match index when search query changes
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [docSearchQuery]);

  if (!doc) return null;

  const fullText = doc.contentPreview || doc.summary || 'No text content preview available.';

  // Calculate search matches count across document text
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
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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

  const handleCopyText = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  const handlePrint = () => {
    window.print();
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(200, prev + 15));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(50, prev - 15));
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const renderHighlightedText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const escaped = query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    let matchCounter = 0;

    return (
      <span>
        {parts.map((part, i) => {
          if (part.toLowerCase() === query.toLowerCase()) {
            const isCurrent = matchCounter === activeMatchIndex;
            const currentIdx = matchCounter;
            matchCounter++;
            return (
              <mark
                key={i}
                id={isCurrent ? 'active-search-match' : undefined}
                className={`${
                  isCurrent
                    ? 'bg-amber-400 text-slate-950 font-extrabold px-1 py-0.5 rounded shadow-md border border-amber-500 inline-block ring-2 ring-amber-300'
                    : 'bg-amber-300/80 text-slate-900 font-bold px-0.5 rounded'
                }`}
                title={`Match ${currentIdx + 1} of ${matchesCount}`}
              >
                {part}
              </mark>
            );
          }
          return part;
        })}
      </span>
    );
  };

  // Structured multi-page PDF content generator
  const renderPdfPageContent = (pageNum: number) => {
    if (pageNum === 1) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#131C25]/20 pb-3">
            <div className="space-y-0.5">
              <span className="font-mono text-[9px] font-bold text-[#6E7C89] uppercase tracking-widest block">
                CONFIDENTIAL LEGAL INSTRUMENT · PAGE 1 OF 3
              </span>
              <h2 className="text-base sm:text-lg font-black text-[#131C25] uppercase tracking-tight">
                {doc.title.replace(/\.[^/.]+$/, '')}
              </h2>
            </div>
            <div className="text-right">
              <span className="font-mono text-[10px] font-bold text-[#0F6E66] bg-[#E8F2F0] px-2 py-1 rounded border border-[#BDE0DB] uppercase">
                VERIFIED PDF
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-[#F8F9FA] rounded-lg border border-[#D3D9DE] font-mono text-[11px] text-[#3D4B58]">
            <div>
              <span className="text-[#6E7C89] block font-bold">ORGANIZATION:</span>
              <span className="font-extrabold text-[#131C25]">{doc.organization || 'Signal87 Legal Workspace'}</span>
            </div>
            <div>
              <span className="text-[#6E7C89] block font-bold">CATEGORY / CLASS:</span>
              <span className="font-extrabold text-[#131C25]">{doc.category || 'Legal Contract'}</span>
            </div>
            <div>
              <span className="text-[#6E7C89] block font-bold">RECORD SIZE:</span>
              <span className="font-extrabold text-[#131C25]">{(doc.sizeBytes / 1000000).toFixed(2)} MB</span>
            </div>
            <div>
              <span className="text-[#6E7C89] block font-bold">DEPOSIT TIMESTAMP:</span>
              <span className="font-extrabold text-[#131C25]">{new Date(doc.uploadDate).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold font-mono text-[#131C25] uppercase tracking-wider bg-[#EDEFF2] px-2 py-1 rounded">
              ARTICLE I — RECITALS & PREAMBLE
            </h3>
            <p className="text-xs leading-relaxed text-[#3D4B58]">
              {renderHighlightedText(
                `THIS AGREEMENT is entered into as of the date recorded herein, by and between Signal87 Acquisition Sub, a Delaware corporation ("Purchaser"), and the shareholders of record set forth in Schedule A attached hereto ("Sellers"). WHEREAS, Sellers hold 100% of the issued and outstanding capital stock of the Company; and WHEREAS, Purchaser desires to acquire all such capital stock on the terms set forth herein.`,
                docSearchQuery
              )}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold font-mono text-[#131C25] uppercase tracking-wider bg-[#EDEFF2] px-2 py-1 rounded">
              ARTICLE II — CORE TERMS & DISCLOSURE PREVIEW
            </h3>
            <div className="p-3 bg-[#FFFFFF] border border-[#131C25]/20 rounded-lg text-xs leading-relaxed text-[#131C25] shadow-xs">
              {renderHighlightedText(fullText, docSearchQuery)}
            </div>
          </div>
        </div>
      );
    }

    if (pageNum === 2) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#131C25]/20 pb-3">
            <div>
              <span className="font-mono text-[9px] font-bold text-[#6E7C89] uppercase tracking-widest block">
                CONFIDENTIAL LEGAL INSTRUMENT · PAGE 2 OF 3
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-[#131C25]">
                {doc.title} — INDEMNIFICATION & LIABILITY PROVISIONS
              </h2>
            </div>
            <span className="font-mono text-[10px] font-bold text-[#131C25] bg-[#EDEFF2] px-2 py-0.5 rounded">
              SECTION 8.0
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 bg-[#FBEECB] border border-[#EBD79B] rounded-xl text-xs text-[#131C25] space-y-1.5">
              <div className="font-mono font-bold text-[10px] text-[#8A6414] uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert size={14} />
                <span>§ 8.2 INDEMNIFICATION CAP & SURVIVAL</span>
              </div>
              <p className="font-medium leading-relaxed">
                {renderHighlightedText(
                  `8.2 Survival & Caps. All general representations and warranties shall survive the Closing for a period of eighteen (18) months. The aggregate liability of Sellers for Losses shall be capped at twelve percent (12%) of the total Purchase Price consideration ($4.2M maximum recovery basket).`,
                  docSearchQuery
                )}
              </p>
            </div>

            <div className="p-3 bg-[#F8F9FA] border border-[#D3D9DE] rounded-xl text-xs text-[#3D4B58] space-y-2">
              <h4 className="font-bold text-[#131C25] font-mono text-[11px] uppercase">
                § 8.3 DEDUCTIBLE & BASKET Mechanics
              </h4>
              <p className="leading-relaxed">
                {renderHighlightedText(
                  `No claim for indemnification shall be made by any Purchaser Indemnified Party unless and until aggregate Losses exceed $500,000 (the "Deductible"), after which Purchaser shall be entitled to recover Losses exceeding such Deductible amount in full.`,
                  docSearchQuery
                )}
              </p>
            </div>

            {doc.riskHighlights && doc.riskHighlights.length > 0 && (
              <div className="p-3 bg-[#E8F2F0] border border-[#BDE0DB] rounded-xl text-xs space-y-1">
                <span className="font-mono font-bold text-[10px] text-[#0F6E66] uppercase tracking-wider block">
                  CITED RISK EXPOSURE SUMMARY
                </span>
                <ul className="list-disc pl-4 text-[#131C25] space-y-1 font-medium">
                  {doc.riskHighlights.map((rh, i) => (
                    <li key={i}>{rh}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Page 3
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#131C25]/20 pb-3">
          <div>
            <span className="font-mono text-[9px] font-bold text-[#6E7C89] uppercase tracking-widest block">
              CONFIDENTIAL LEGAL INSTRUMENT · PAGE 3 OF 3
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-[#131C25]">
              {doc.title} — EXECUTION & GOVERNING LAW
            </h2>
          </div>
          <span className="font-mono text-[10px] font-bold text-[#131C25] bg-[#EDEFF2] px-2 py-0.5 rounded">
            SECTION 11.0
          </span>
        </div>

        <div className="space-y-3 text-xs text-[#3D4B58] leading-relaxed">
          <p>
            {renderHighlightedText(
              `11.1 Governing Law. This Agreement shall be governed by, construed and enforced in accordance with the internal laws of the State of Delaware, without giving effect to any choice of law rules.`,
              docSearchQuery
            )}
          </p>

          <p>
            {renderHighlightedText(
              `11.2 Severability. If any provision of this Agreement is held to be invalid or unenforceable, such provision shall be modified to the minimum extent necessary to render it valid and enforceable.`,
              docSearchQuery
            )}
          </p>

          <div className="mt-6 pt-4 border-t-2 border-[#131C25]/20 grid grid-cols-2 gap-6 font-mono text-[11px]">
            <div className="space-y-6">
              <div>
                <span className="block font-bold text-[#131C25]">PURCHASER:</span>
                <span className="block text-[#6E7C89]">Signal87 Acquisition Sub Inc.</span>
              </div>
              <div className="border-b border-[#131C25] pb-1">
                <span className="text-[10px] text-[#6E7C89] block">By: Authorized Officer</span>
                <span className="font-bold text-[#131C25]">/s/ CEO, Signal87</span>
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <span className="block font-bold text-[#131C25]">SELLERS REPRESENTATIVE:</span>
                <span className="block text-[#6E7C89]">{doc.organization || 'Meridian Holdings Group'}</span>
              </div>
              <div className="border-b border-[#131C25] pb-1">
                <span className="text-[10px] text-[#6E7C89] block">By: Managing Director</span>
                <span className="font-bold text-[#131C25]">/s/ Authorized Signatory</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-[#131C25]/75 backdrop-blur-xs z-50 flex items-center justify-center p-0 sm:p-3">
      <div className="bg-[#EDEFF2] rounded-none sm:rounded-2xl max-w-6xl w-full h-full sm:h-[94vh] shadow-2xl overflow-hidden border-0 sm:border sm:border-[#D3D9DE] flex flex-col text-[#131C25]">
        
        {/* Top Navigation Header */}
        <div className="px-3 py-2 bg-white border-b border-[#D3D9DE] flex items-center justify-between gap-2.5">
          {/* Document Title & Meta */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={onClose}
              className="p-1.5 text-[#3D4B58] hover:text-[#131C25] hover:bg-[#EDEFF2] rounded-full transition-colors cursor-pointer flex-shrink-0"
              title="Close modal"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-[#131C25] truncate">
                  {doc.title}
                </h2>
                <span className="font-mono text-[8px] font-black px-1 py-0.2 rounded bg-[#131C25] text-white uppercase flex-shrink-0">
                  {doc.type}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 mt-0.5 text-[10px] font-mono text-[#6E7C89]">
                <span className="text-[#0F6E66] font-bold bg-[#E8F2F0] px-1.5 py-0.2 rounded">
                  {doc.category || 'General'}
                </span>
                <span>·</span>
                <span>{(doc.sizeBytes / 1000000).toFixed(2)} MB</span>
                <span>·</span>
                <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* View Mode Switcher Tabs */}
          <div className="flex items-center gap-1 bg-[#EDEFF2] p-0.5 rounded-full border border-[#D3D9DE] flex-shrink-0">
            <button
              onClick={() => setActiveTab('pdf')}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'pdf'
                  ? 'bg-[#131C25] text-white shadow-2xs'
                  : 'text-[#3D4B58] hover:text-[#131C25]'
              }`}
              title="Interactive PDF Viewer"
            >
              <BookOpen size={14} />
              <span className="hidden xs:inline">Viewer</span>
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'analysis'
                  ? 'bg-[#131C25] text-white shadow-2xs'
                  : 'text-[#3D4B58] hover:text-[#131C25]'
              }`}
              title="AI Analysis"
            >
              <Sparkles size={14} className="text-[#F0B429]" />
              <span className="hidden xs:inline">AI Analysis</span>
            </button>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onOpenCompare(doc)}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors cursor-pointer hidden sm:flex items-center gap-1"
              title="Compare with another document"
            >
              <GitFork size={14} />
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors cursor-pointer hidden sm:block"
              title="Print document"
            >
              <Printer size={16} />
            </button>
            <button
              onClick={handleDownloadText}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="Download"
            >
              <Download size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors cursor-pointer sm:hidden"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* PDF Viewer Control Toolbar (Visible in 'pdf' tab) */}
        {activeTab === 'pdf' && (
          <div className="px-4 py-2 bg-[#131C25] text-white border-b border-[#28292a] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            {/* Page Pagination Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="p-1 rounded bg-[#28292a] hover:bg-[#37393b] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-white"
                title="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-bold">
                PAGE <span className="text-[#F0B429]">{currentPage}</span> OF {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className="p-1 rounded bg-[#28292a] hover:bg-[#37393b] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-white"
                title="Next Page"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* In-Document Search */}
            <div className="flex items-center gap-1 bg-[#28292a] px-2.5 py-1 rounded-lg border border-[#37393b] min-w-[200px] sm:min-w-[260px]">
              <Search size={14} className="text-[#9aa0a6] flex-shrink-0" />
              <input
                type="text"
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                placeholder="Search PDF text..."
                className="w-full bg-transparent text-white text-xs placeholder-[#9aa0a6] focus:outline-none"
              />
              {docSearchQuery && (
                <div className="flex items-center gap-1 text-[10px] text-[#F0B429] flex-shrink-0">
                  <span>{matchesCount > 0 ? `${activeMatchIndex + 1}/${matchesCount}` : '0'}</span>
                  <button onClick={handlePrevMatch} className="p-0.5 hover:text-white cursor-pointer">
                    <ChevronUp size={12} />
                  </button>
                  <button onClick={handleNextMatch} className="p-0.5 hover:text-white cursor-pointer">
                    <ChevronDown size={12} />
                  </button>
                  <button onClick={() => setDocSearchQuery('')} className="p-0.5 hover:text-white cursor-pointer">
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Zoom Controls & View Mode Toggle */}
            <div className="flex items-center gap-2">
              {doc.fileUrl && (
                <div className="flex items-center gap-1 bg-[#28292a] p-0.5 rounded-md border border-[#37393b] mr-2">
                  <button
                    onClick={() => setViewMode('native')}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                      viewMode === 'native' ? 'bg-[#F0B429] text-[#131C25]' : 'text-white hover:text-[#F0B429]'
                    }`}
                  >
                    Embedded PDF
                  </button>
                  <button
                    onClick={() => setViewMode('reader')}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                      viewMode === 'reader' ? 'bg-[#F0B429] text-[#131C25]' : 'text-white hover:text-[#F0B429]'
                    }`}
                  >
                    Page Reader
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1 bg-[#28292a] px-2 py-1 rounded-lg border border-[#37393b]">
                <button onClick={handleZoomOut} className="hover:text-[#F0B429] cursor-pointer" title="Zoom Out">
                  <ZoomOut size={14} />
                </button>
                <span className="w-10 text-center font-bold text-[11px]">{zoomLevel}%</span>
                <button onClick={handleZoomIn} className="hover:text-[#F0B429] cursor-pointer" title="Zoom In">
                  <ZoomIn size={14} />
                </button>
                <button
                  onClick={() => setZoomLevel(100)}
                  className="ml-1 text-[10px] text-[#9aa0a6] hover:text-white underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-[#3D4B58]/10 p-3 sm:p-6 flex justify-center items-start">
          {activeTab === 'pdf' ? (
            /* TAB 1: PDF VIEWER VIA REACT-PDF */
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

              {/* Page Navigation Indicator Pill */}
              <div className="flex items-center justify-between px-4 py-2 mt-4 w-full max-w-3xl bg-[#131C25] text-white rounded-xl shadow-md text-xs font-mono">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="flex items-center gap-1 hover:text-[#F0B429] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold"
                >
                  <ChevronLeft size={16} /> Previous Page
                </button>
                <span>
                  Viewing Page <span className="text-[#F0B429] font-bold">{currentPage}</span> of {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  className="flex items-center gap-1 hover:text-[#F0B429] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold"
                >
                  Next Page <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            /* TAB 2: AI ANALYSIS & EXTRACTED TEXT */
            <div className="bg-[#FFFFFF] border border-[#D3D9DE] rounded-xl p-6 sm:p-8 max-w-3xl w-full shadow-lg space-y-5 font-sans text-xs sm:text-sm text-[#3D4B58]">
              <div className="pb-3 border-b border-[#D3D9DE] flex items-center justify-between text-xs font-mono text-[#6E7C89]">
                <span>AI EXTRACTION ENGINE & CITATIONS</span>
                <span>ID: {doc.id}</span>
              </div>

              {/* Title Header */}
              <div>
                <h1 className="text-lg font-extrabold text-[#131C25]">{doc.title}</h1>
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {doc.tags.map((tag, idx) => (
                      <span key={idx} className="font-mono text-[10px] font-bold bg-[#EDEFF2] text-[#3D4B58] px-2 py-0.5 rounded-md">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Executive AI Summary Box */}
              {doc.summary && (
                <div className="p-4 bg-[#E8F2F0] border border-[#BDE0DB] rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[#0F6E66] font-bold text-xs uppercase font-mono">
                    <Sparkles size={14} />
                    <span>Executive AI Summary</span>
                  </div>
                  <p className="text-xs text-[#131C25] leading-relaxed font-medium">
                    {doc.summary}
                  </p>
                </div>
              )}

              {/* Risk Highlights Box */}
              {doc.riskHighlights && doc.riskHighlights.length > 0 && (
                <div className="p-4 bg-[#FBEECB] border border-[#EBD79B] rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-[#8A6414] font-bold text-xs uppercase font-mono">
                    <ShieldAlert size={14} />
                    <span>Key Risk & Liability Flags</span>
                  </div>
                  <ul className="space-y-1 text-xs text-[#131C25] font-medium list-disc pl-4">
                    {doc.riskHighlights.map((hl, idx) => (
                      <li key={idx}>{hl}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Dock Bar */}
        <div className="p-3 bg-[#FFFFFF] border-t border-[#D3D9DE] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 bg-[#FFFFFF] hover:bg-[#EDEFF2] text-[#131C25] font-bold text-xs rounded-xl border border-[#D3D9DE] transition-colors cursor-pointer text-center"
          >
            Back to workspace
          </button>
          <button
            onClick={() => onOpenCompare(doc)}
            className="flex-1 py-2 px-4 bg-[#131C25] hover:bg-[#28292a] text-[#FFFFFF] font-bold text-xs rounded-xl transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
          >
            <GitFork size={14} />
            <span>Cross-Compare PDF Clauses</span>
          </button>
        </div>
      </div>
    </div>
  );
};
