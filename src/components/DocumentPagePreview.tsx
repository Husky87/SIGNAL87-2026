import React, { useEffect, useRef, useState } from 'react';
import { DocumentItem } from '../types';
import { uploadDocumentThumbnail } from '../lib/firebase';

// Older PDFs are converted only after their card enters view. One conversion at
// a time avoids fetching and rendering an entire folder's documents together.
let previewQueue: Promise<unknown> = Promise.resolve();
const pending = new Map<string, Promise<string>>();
const failed = new Set<string>();
const MAX_LEGACY_PDF_BYTES = 6 * 1024 * 1024;

function generateLegacyPreview(doc: DocumentItem): Promise<string> {
  const existing = pending.get(doc.id);
  if (existing) return existing;
  const job = previewQueue.then(async () => {
    const { renderPdfThumbnail } = await import('../lib/documentPreview');
    const res = await fetch(`/api/documents/preview?url=${encodeURIComponent(doc.fileUrl!)}`);
    if (!res.ok) throw new Error(`PDF preview returned ${res.status}`);
    const thumbnail = await renderPdfThumbnail(await res.blob());
    return uploadDocumentThumbnail(thumbnail, doc.id);
  });
  previewQueue = job.catch(() => undefined);
  pending.set(doc.id, job);
  job.catch(() => failed.add(doc.id));
  return job;
}

interface Props {
  doc: DocumentItem;
  onThumbnailReady?: (docId: string, url: string) => void;
}

export const DocumentPagePreview: React.FC<Props> = ({ doc, onThumbnailReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [doc.thumbnailUrl]);

  useEffect(() => {
    if (doc.thumbnailUrl) return;
    const el = containerRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '80px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [doc.thumbnailUrl]);

  useEffect(() => {
    if (!visible || doc.thumbnailUrl || doc.type !== 'pdf' || !doc.fileUrl ||
        doc.sizeBytes > MAX_LEGACY_PDF_BYTES || failed.has(doc.id) ||
        // Fresh uploads have their own asynchronous thumbnail job.
        Date.now() - new Date(doc.uploadDate).getTime() < 5 * 60 * 1000) return;
    let mounted = true;
    void generateLegacyPreview(doc)
      .then((url) => { if (mounted) onThumbnailReady?.(doc.id, url); })
      .catch(() => { /* The neutral placeholder remains when conversion fails. */ });
    return () => { mounted = false; };
  }, [visible, doc.id, doc.type, doc.fileUrl, doc.sizeBytes, doc.thumbnailUrl, doc.uploadDate, onThumbnailReady]);

  return (
    <div ref={containerRef} className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#e8e9e8]">
      {doc.thumbnailUrl && !imageFailed ? (
        <img
          src={doc.thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-contain object-top"
        />
      ) : (
        <div aria-hidden="true" className="flex h-[88%] w-[68%] flex-col gap-2 rounded-sm bg-white p-4 shadow-sm">
          <span className="mb-2 h-1.5 w-3/5 rounded bg-slate-400/45" />
          <span className="h-1 w-full rounded bg-slate-300" />
          <span className="h-1 w-11/12 rounded bg-slate-300" />
          <span className="h-1 w-5/6 rounded bg-slate-300" />
          <span className="mt-1 h-1 w-10/12 rounded bg-slate-300" />
        </div>
      )}
    </div>
  );
};
