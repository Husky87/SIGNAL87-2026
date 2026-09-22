import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PageProps } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Loader2, AlertCircle } from 'lucide-react';
import { fileDataCache } from '../lib/pdfGenerator';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// The worker ships with the app instead of being fetched from jsdelivr at
// runtime. On the CDN version the viewer rendered nothing whenever that host was
// unreachable — a VPN, an ad blocker, an offline moment or a strict CSP was
// enough — and the failure surfaced only as a blank pane. Vite emits this as a
// local asset, so it is always the exact version react-pdf expects.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface PDFViewerProps {
  docId?: string;
  fileUrl: string;
  fileName?: string;
  currentPage: number;
  totalPages: number;
  onTotalPagesChange: (total: number) => void;
  onPageChange: (page: number) => void;
  zoomLevel: number;
  /** Hands the loaded document to the parent, e.g. for the page-thumbnail rail. */
  onDocumentLoaded?: (pdf: PDFDocumentProxy) => void;
  /** Rewrites the text layer, e.g. to wrap search matches in <mark>. */
  customTextRenderer?: PageProps['customTextRenderer'];
}

function isFirebaseStorageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'firebasestorage.googleapis.com' && url.pathname.includes('/o/');
  } catch {
    return false;
  }
}

function buildSameOriginPreviewUrl(fileUrl: string): string {
  return `/api/documents/preview?url=${encodeURIComponent(fileUrl)}`;
}

function isPdfBuffer(buffer: ArrayBuffer): boolean {
  const header = new TextDecoder().decode(new Uint8Array(buffer).subarray(0, 5));
  return header === '%PDF-';
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  docId,
  fileUrl,
  fileName = 'document.pdf',
  currentPage,
  totalPages,
  onTotalPagesChange,
  onPageChange: _onPageChange,
  zoomLevel,
  onDocumentLoaded,
  customTextRenderer,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<any>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const loadPdf = async () => {
      setError(null);
      setLoading(true);
      setPdfFile(null);
      setFallbackUrl(null);

      if (docId && fileDataCache.has(docId)) {
        const cachedBuffer = fileDataCache.get(docId);
        if (cachedBuffer && isPdfBuffer(cachedBuffer)) {
          if (mounted) {
            setPdfFile({ data: new Uint8Array(cachedBuffer) });
            setLoading(false);
          }
          return;
        }
        fileDataCache.delete(docId);
      }

      if (!fileUrl) {
        if (mounted) {
          setError('No document preview is available.');
          setLoading(false);
        }
        return;
      }

      if (fileUrl.startsWith('blob:')) {
        try {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error(`Failed to fetch document: ${res.statusText}`);
          const arrayBuffer = await res.arrayBuffer();
          if (!isPdfBuffer(arrayBuffer)) throw new Error(`The preview source is not a valid PDF (${fileName}).`);
          if (!mounted) return;
          if (docId) fileDataCache.set(docId, arrayBuffer);
          setPdfFile({ data: new Uint8Array(arrayBuffer) });
          setLoading(false);
        } catch (err) {
          if (!mounted) return;
          console.error('Failed to load PDF preview:', err);
          setError(err instanceof Error ? err.message : 'Failed to load PDF document.');
          setLoading(false);
        }
        return;
      }

      try {
        // Firebase Storage URLs are fetched through a same-origin authenticated
        // endpoint. PDF.js then receives raw bytes from signal87.ai instead of
        // attempting a cross-origin Storage/range request that can fail in Firefox
        // with NetworkError even when the browser's built-in PDF viewer can open it.
        const sourceUrl = isFirebaseStorageUrl(fileUrl) ? buildSameOriginPreviewUrl(fileUrl) : fileUrl;
        const res = await fetch(sourceUrl);
        if (!res.ok) throw new Error(`Failed to fetch document preview: HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        if (!isPdfBuffer(arrayBuffer)) throw new Error(`The preview source is not a valid PDF (${fileName}).`);
        if (!mounted) return;
        if (docId) fileDataCache.set(docId, arrayBuffer);
        setPdfFile({ data: new Uint8Array(arrayBuffer) });
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Failed to load PDF document.';
        console.error('Failed to load PDF preview:', err);
        // Keep the existing browser PDF viewer as the last-resort compatibility
        // path, but only after the authenticated same-origin preview has failed.
        setFallbackUrl(fileUrl);
        setError(message);
        setLoading(false);
      }
    };

    void loadPdf();
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

    const Observer = typeof ResizeObserver !== 'undefined' ? ResizeObserver : null;
    if (!Observer) return;

    const observer = new Observer(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function onDocumentLoadSuccess(pdf: PDFDocumentProxy) {
    onTotalPagesChange(pdf.numPages);
    onDocumentLoaded?.(pdf);
    setLoading(false);
    setError(null);
  }

  function onDocumentLoadError(err: Error) {
    console.error('Failed to load PDF in react-pdf:', err);
    setError(err.message || 'Failed to parse PDF document.');
    setLoading(false);
  }

  const basePageWidth = Math.max(280, Math.min(containerWidth || 800, 1200));
  const pageWidth = basePageWidth * (zoomLevel / 100);

  return (
    <div ref={containerRef} className="flex flex-col items-center w-full relative min-w-0">
      {loading && (
        <div className="flex flex-col items-center justify-center p-12 text-[var(--muted)] gap-3">
          <Loader2 size={32} className="animate-spin text-[var(--teal)]" />
          <span className="text-xs font-semibold tracking-wider">RENDERING PDF DOCUMENT...</span>
        </div>
      )}

      {!loading && pdfFile && !error && (
        <div className="w-full flex justify-center min-w-0 overflow-visible">
          <div className="transition-transform duration-200 origin-top rounded-xl overflow-hidden bg-white border border-[var(--rule)] shadow-sm" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', width: `${basePageWidth}px` }}>
            <Document file={pdfFile} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError} loading={null} error={null}>
              <Page pageNumber={Math.min(Math.max(1, currentPage), totalPages || 1)} width={pageWidth} renderTextLayer={true} renderAnnotationLayer={false} customTextRenderer={customTextRenderer} className="w-full" />
            </Document>
          </div>
        </div>
      )}

      {!loading && error && fallbackUrl && (
        <div className="w-full space-y-3">
          <div className="flex items-start gap-2.5 p-3 bg-[var(--card)] border border-[var(--rule)] rounded-xl text-left">
            <AlertCircle size={16} className="text-[var(--accent)] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[var(--ink)]">The built-in document preview could not load</div>
              <p className="text-[11.5px] text-[var(--slate)] m-0 break-words">{error}</p>
              <p className="text-[11.5px] text-[var(--slate)] m-0 mt-1">Opening the browser-compatible PDF viewer instead.</p>
            </div>
          </div>
          <iframe
            src={fallbackUrl}
            title={fileName}
            className="w-full rounded-xl border border-[var(--rule)] bg-white"
            style={{ height: '82vh' }}
          />
        </div>
      )}

      {!loading && error && !fallbackUrl && (
        <div className="flex flex-col items-center justify-center p-8 bg-[var(--card)] border border-[var(--rule)] rounded-xl text-center max-w-md mx-auto my-8 space-y-3">
          <AlertCircle size={32} className="text-[var(--accent)]" />
          <div className="text-sm font-bold text-[var(--ink)]">No document to display</div>
          <p className="text-xs text-[var(--slate)]">{error}</p>
        </div>
      )}
    </div>
  );
};