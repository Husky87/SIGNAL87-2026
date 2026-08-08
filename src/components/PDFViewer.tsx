import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Loader2, AlertCircle, Download } from 'lucide-react';
import { fileDataCache } from '../lib/pdfGenerator';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  docId?: string;
  fileUrl: string;
  fileName?: string;
  currentPage: number;
  totalPages: number;
  onTotalPagesChange: (total: number) => void;
  onPageChange: (page: number) => void;
  zoomLevel: number;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  docId,
  fileUrl,
  fileName = 'document.pdf',
  currentPage,
  totalPages,
  onTotalPagesChange,
  onPageChange,
  zoomLevel,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    setError(null);
    
    if (docId && fileDataCache.has(docId)) {
      const cachedBuffer = fileDataCache.get(docId);
      if (cachedBuffer) {
        setPdfFile({ data: new Uint8Array(cachedBuffer) });
        setLoading(false);
        return;
      }
    }
    
    if (fileUrl.startsWith('blob:')) {
      setLoading(true);
      fetch(fileUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch blob: ${res.statusText}`);
          return res.arrayBuffer();
        })
        .then((arrayBuffer) => {
          if (mounted) {
            setPdfFile({ data: new Uint8Array(arrayBuffer) });
            setLoading(false);
          }
        })
        .catch((err) => {
          if (mounted) {
            console.warn('Failed to fetch blob for react-pdf, falling back to direct blob URL string:', err);
            setPdfFile(fileUrl);
            setLoading(false);
          }
        });
    } else {
      setPdfFile(fileUrl);
      setLoading(false);
    }
    
    return () => { mounted = false; };
  }, [fileUrl, docId]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    onTotalPagesChange(numPages);
    setLoading(false);
    setError(null);
  }

  function onDocumentLoadError(err: Error) {
    console.error('Failed to load PDF in react-pdf:', err);
    setError(err.message || 'Failed to parse PDF document.');
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-center w-full relative">
      {loading && (
        <div className="flex flex-col items-center justify-center p-12 text-[#78716C] gap-3">
          <Loader2 size={32} className="animate-spin text-[#8C2F27]" />
          <span className="text-xs font-mono font-bold tracking-wider">RENDERING PDF DOCUMENT...</span>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center p-8 bg-[var(--card)] border border-[var(--rule)] rounded-xl text-center max-w-md mx-auto my-8 space-y-3">
          <AlertCircle size={32} className="text-[var(--accent)]" />
          <div className="text-sm font-bold text-[var(--ink)]">Could not render PDF preview</div>
          <p className="text-xs text-[var(--slate)]">{error}</p>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-[var(--accent)] text-[var(--paper)] text-xs font-semibold rounded-[4px] hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Download size={14} /> Download & View PDF Directly
          </a>
        </div>
      )}

      {pdfFile && !error && (
        <div
          className="transition-transform duration-200 origin-top shadow-xl rounded-xl overflow-hidden bg-white border border-[#DDD6C8]"
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
        >
          <Document
            file={pdfFile}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            error={null}
          >
            <Page
              pageNumber={Math.min(Math.max(1, currentPage), totalPages || 1)}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              className="shadow-sm"
            />
          </Document>
        </div>
      )}
    </div>
  );
};
