import React, { useState, useEffect, useRef } from 'react';
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
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    setError(null);
    setLoading(true);
    setPdfFile(null);

    // Only use cached data when it is actually a PDF. Older versions of the
    // upload flow cached the original DOCX/XLSX bytes under the document id,
    // which caused pdf.js to report "Invalid PDF structure".
    if (docId && fileDataCache.has(docId)) {
      const cachedBuffer = fileDataCache.get(docId);
      if (cachedBuffer) {
        const header = new TextDecoder().decode(new Uint8Array(cachedBuffer).subarray(0, 5));
        if (header === '%PDF-') {
          setPdfFile({ data: new Uint8Array(cachedBuffer) });
          setLoading(false);
          return () => { mounted = false; };
        }
        fileDataCache.delete(docId);
      }
    }

    if (!fileUrl) {
      setError('No document preview is available.');
      setLoading(false);
      return () => { mounted = false; };
    }

    if (fileUrl.startsWith('blob:')) {
      fetch(fileUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch document: ${res.statusText}`);
          return res.arrayBuffer();
        })
        .then((arrayBuffer) => {
          if (!mounted) return;
          const header = new TextDecoder().decode(new Uint8Array(arrayBuffer).subarray(0, 5));
          if (header !== '%PDF-') {
            throw new Error(`The preview source is not a valid PDF (${fileName}).`);
          }
          if (docId) fileDataCache.set(docId, arrayBuffer);
          setPdfFile({ data: new Uint8Array(arrayBuffer) });
          setLoading(false);
        })
        .catch((err) => {
          if (mounted) {
            console.error('Failed to load PDF preview:', err);
            setError(err instanceof Error ? err.message : 'Failed to load PDF document.');
            setLoading(false);
          }
        });
    } else {
      setPdfFile(fileUrl);
      setLoading(false);
    }

    return () => { mounted = false; };
  }, [fileUrl, docId, fileName]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      const width = element.clientWidth;
      if (width > 0) setContainerWidth(width);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

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

  const basePageWidth = Math.max(280, Math.min(containerWidth || 800, 900));
  const pageWidth = basePageWidth * (zoomLevel / 100);

  return (
    <div ref={containerRef} className="flex flex-col items-center w-full relative min-w-0">
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
            className="px-4 py-2 bg-[var(--accent)] text-[var(--teal-ink)] text-xs font-semibold rounded-[4px] hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Download size={14} /> Download & View PDF Directly
          </a>
        </div>
      )}

      {pdfFile && !error && (
        <div className="w-full flex justify-center min-w-0 overflow-visible">
          <div
            className="transition-transform duration-200 origin-top rounded-xl overflow-hidden bg-white border border-[#DDD6C8] shadow-sm"
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              width: `${basePageWidth}px`,
            }}
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
                width={pageWidth}
                renderTextLayer={true}
                renderAnnotationLayer={false}
                className="w-full"
              />
            </Document>
          </div>
        </div>
      )}
    </div>
  );
};
