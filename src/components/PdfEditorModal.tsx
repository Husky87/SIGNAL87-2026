import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Download,
  FilePlus2,
  FileText,
  Loader2,
  Lock,
  Merge,
  RotateCw,
  ShieldAlert,
  Undo2,
  X
} from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { DocumentItem } from '../types';
import { PdfEditBlocker, PdfEditOverlay, PdfEditSourceMeta, PdfInspection } from '../lib/pdfEditTypes';
import {
  createIdentityOverlay,
  hasPendingEdits,
  insertPagesFromSource,
  missingSourceIds as findMissingSourceIds,
  newId,
  normalizeOverlay,
  parsePageRange,
  rotateAllPages,
  segmentsFromBreaks,
  setFlattenOnExport
} from '../lib/pdfEditOverlay';
import {
  applyOverlayToPdf,
  inspectPdf,
  PdfExportError,
  readPageCount,
  resolvePdfBytes,
  splitPdf
} from '../lib/pdfEditEngine';
import { clearAllRedactions } from '../lib/pdfRedaction';
import { loadPdfJsDocument, rasterizeRedactions } from '../lib/pdfRender';
import { listAvailableSourceIds, loadSourceBytesMap, putSourceBytes } from '../lib/pdfSourceStore';
import {
  deletePdfEditOverlayFromFirestore,
  fetchPdfEditOverlayFromFirestore,
  savePdfEditOverlayToFirestore
} from '../lib/firestoreService';
import { useBackDismiss } from '../lib/useBackDismiss';
import { replaceDocumentFile } from '../lib/firebase';
import { fileDataCache } from '../lib/pdfGenerator';
import { PdfPageOrganizer } from './PdfPageOrganizer';
import { PdfFormFiller } from './PdfFormFiller';
import { PdfRedactionCanvas } from './PdfRedactionCanvas';

interface PdfEditorModalProps {
  document: DocumentItem | null;
  onClose: () => void;
  /**
   * Called when redaction has replaced the stored document, with the record as
   * it now stands. The editor cannot update the app's copy of the document by
   * itself, and a redacted file paired with the old extracted text would leave
   * the removed content answerable by the assistant.
   */
  onDocumentReplaced?: (document: DocumentItem) => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface ReadyState {
  originalBytes: Uint8Array;
  inspection: PdfInspection;
  originalPdf: PDFDocumentProxy;
}

/** A file the user picked, waiting on a page range before it is inserted. */
interface PendingInsert {
  fileName: string;
  bytes: Uint8Array;
  pageCount: number;
  atIndex: number;
}

const SAVE_DEBOUNCE_MS = 800;

function baseFileName(title: string): string {
  return title.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, '_') || 'document';
}

function downloadBytes(bytes: Uint8Array, fileName: string): void {
  // Copied into a fresh buffer: the Blob must own bytes that pdf-lib is not
  // also holding a view onto.
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  // Revoking immediately can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const BLOCKER_COPY: Record<PdfEditBlocker['kind'], { title: string; body: string }> = {
  encrypted: {
    title: 'This PDF is password-protected',
    body:
      'Encrypted documents cannot be edited here. Remove the password in the application that produced the file, ' +
      're-upload it, and it will open normally.'
  },
  xfa: {
    title: "This form type isn't supported yet",
    body:
      'This is an XFA form — an XML form wrapped in a PDF, produced by tools such as Adobe LiveCycle. The editor ' +
      'reads standard AcroForm fields, and showing an XFA form as an empty one would quietly discard anything typed ' +
      'into it. Page operations are unavailable for these files too, because saving would drop the form definition.'
  },
  corrupt: { title: 'This PDF could not be read', body: '' },
  unavailable: { title: 'This document has no file to edit', body: '' }
};

/** What the user must type to replace a stored document with a redacted one. */
const REDACT_CONFIRMATION = 'REDACT';

type RedactState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; pages: number }
  | { kind: 'error'; message: string };

export const PdfEditorModal: React.FC<PdfEditorModalProps> = ({
  document: doc,
  onClose,
  onDocumentReplaced
}) => {
  const [loading, setLoading] = useState(true);
  const [blocker, setBlocker] = useState<PdfEditBlocker | null>(null);
  const [ready, setReady] = useState<ReadyState | null>(null);
  const [overlay, setOverlay] = useState<PdfEditOverlay | null>(null);
  const [sourcePdfs, setSourcePdfs] = useState<Map<string, PDFDocumentProxy>>(new Map());
  const [availableSourceIds, setAvailableSourceIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'pages' | 'form' | 'redact'>('pages');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [splitAfter, setSplitAfter] = useState<Set<number>>(new Set());
  const [pendingInsert, setPendingInsert] = useState<PendingInsert | null>(null);
  const [insertRange, setInsertRange] = useState('');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showRedactConfirm, setShowRedactConfirm] = useState(false);
  const [redactConfirmText, setRedactConfirmText] = useState('');
  const [redactState, setRedactState] = useState<RedactState>({ kind: 'idle' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const insertAtRef = useRef<number>(0);
  /** 'all' appends every page (merge); 'choose' asks for a range first. */
  const insertModeRef = useRef<'all' | 'choose'>('choose');
  /**
   * Mirrors sourcePdfs. pdf.js proxies hold a worker port each and must be
   * destroyed, but they cannot be released from an effect keyed on the map
   * itself: adding one source would run that effect's cleanup against the
   * previous map and destroy proxies the new map still refers to.
   */
  const sourcePdfsRef = useRef<Map<string, PDFDocumentProxy>>(new Map());
  // The overlay as last written. Compared before saving so that merely opening
  // a document never writes to Firestore.
  const lastSavedRef = useRef<string>('');

  useBackDismiss(!!doc, onClose);

  /* ── Open the document ─────────────────────────────────────────────── */

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    let openedPdf: PDFDocumentProxy | null = null;

    setLoading(true);
    setBlocker(null);
    setReady(null);
    setOverlay(null);
    setSourcePdfs(new Map());
    setSplitAfter(new Set());
    setActiveTab('pages');
    setSaveState('idle');
    setExportError(null);
    setShowRedactConfirm(false);
    setRedactConfirmText('');
    setRedactState({ kind: 'idle' });
    lastSavedRef.current = '';

    (async () => {
      const loaded = await resolvePdfBytes(doc);
      if (cancelled) return;
      if (loaded.ok === false) {
        setBlocker(loaded.blocker);
        setLoading(false);
        return;
      }

      const inspected = await inspectPdf(loaded.bytes);
      if (cancelled) return;
      if (inspected.ok === false) {
        setBlocker(inspected.blocker);
        setLoading(false);
        return;
      }

      let pdf: PDFDocumentProxy;
      try {
        pdf = await loadPdfJsDocument(loaded.bytes);
      } catch (error) {
        if (cancelled) return;
        setBlocker({
          kind: 'corrupt',
          message: error instanceof Error ? error.message : 'This PDF could not be rendered.'
        });
        setLoading(false);
        return;
      }
      if (cancelled) {
        pdf.destroy();
        return;
      }
      openedPdf = pdf;

      const stored = await fetchPdfEditOverlayFromFirestore(doc.id);
      if (cancelled) return;
      const restored = stored
        ? normalizeOverlay(stored, doc.id, inspected.inspection.pageCount)
        : createIdentityOverlay(doc.id, inspected.inspection.pageCount);

      const available = await listAvailableSourceIds(doc.id);
      if (cancelled) return;

      // Open a rendering handle for each inserted source this device holds.
      const bytesById = await loadSourceBytesMap(doc.id, available);
      if (cancelled) return;
      const proxies = new Map<string, PDFDocumentProxy>();
      for (const [sourceId, bytes] of bytesById) {
        try {
          proxies.set(sourceId, await loadPdfJsDocument(bytes));
        } catch {
          // A source that will not render is treated as absent; the organizer
          // already has a state for that.
        }
      }
      if (cancelled) {
        for (const proxy of proxies.values()) proxy.destroy();
        return;
      }

      setReady({ originalBytes: loaded.bytes, inspection: inspected.inspection, originalPdf: pdf });
      setOverlay(restored);
      setAvailableSourceIds(available);
      sourcePdfsRef.current = proxies;
      setSourcePdfs(proxies);
      lastSavedRef.current = JSON.stringify(restored);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      if (openedPdf) openedPdf.destroy();
      for (const proxy of sourcePdfsRef.current.values()) proxy.destroy();
      sourcePdfsRef.current = new Map();
    };
  }, [doc]);

  /* ── Persist ───────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!overlay || !doc) return;
    const serialized = JSON.stringify(overlay);
    if (serialized === lastSavedRef.current) return;

    setSaveState('saving');
    const timer = window.setTimeout(async () => {
      await savePdfEditOverlayToFirestore(overlay);
      lastSavedRef.current = serialized;
      setSaveState('saved');
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [overlay, doc]);

  /* ── Derived ───────────────────────────────────────────────────────── */

  const missingSources = useMemo(
    () => (overlay ? findMissingSourceIds(overlay, availableSourceIds) : []),
    [overlay, availableSourceIds]
  );

  const pendingEdits = useMemo(
    () => (overlay && ready ? hasPendingEdits(overlay, ready.inspection.pageCount) : false),
    [overlay, ready]
  );

  const editableFieldCount = useMemo(
    () => (ready ? ready.inspection.fields.filter((f) => f.kind !== 'button' && f.kind !== 'signature').length : 0),
    [ready]
  );

  /* ── Inserting another PDF ─────────────────────────────────────────── */

  const openFilePicker = (atIndex: number, mode: 'all' | 'choose' = 'choose') => {
    insertAtRef.current = atIndex;
    insertModeRef.current = mode;
    fileInputRef.current?.click();
  };

  const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset immediately so choosing the same file twice still fires a change.
    event.target.value = '';
    if (!file || !overlay || !ready) return;

    setBusy(true);
    setExportError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const counted = await readPageCount(bytes);
      if (counted.ok === false) {
        setExportError(
          counted.blocker.kind === 'encrypted'
            ? `${file.name} is password-protected, so its pages cannot be inserted.`
            : `${file.name} could not be read as a PDF.`
        );
        return;
      }

      const insert: PendingInsert = {
        fileName: file.name,
        bytes,
        pageCount: counted.pageCount,
        atIndex: insertAtRef.current
      };

      // Merging, or a single-page file, leaves nothing to choose between.
      if (insertModeRef.current === 'all' || counted.pageCount === 1) {
        await commitInsert(insert, Array.from({ length: counted.pageCount }, (_, i) => i));
        return;
      }
      setInsertRange(`1-${counted.pageCount}`);
      setPendingInsert(insert);
    } finally {
      setBusy(false);
    }
  };

  const commitInsert = useCallback(
    async (insert: PendingInsert, indices: number[]) => {
      if (!overlay || !ready || !doc || indices.length === 0) return;
      setBusy(true);
      try {
        const sourceId = newId('src');
        const stored = await putSourceBytes(doc.id, sourceId, insert.fileName, insert.bytes.slice().buffer);
        if (!stored) {
          setExportError(
            'This browser would not store the inserted file locally, so those pages could not be added. ' +
              'Private-browsing windows commonly block this.'
          );
          return;
        }

        const meta: PdfEditSourceMeta = {
          id: sourceId,
          fileName: insert.fileName,
          pageCount: insert.pageCount,
          sizeBytes: insert.bytes.byteLength,
          addedAt: new Date().toISOString()
        };

        try {
          const proxy = await loadPdfJsDocument(insert.bytes);
          setSourcePdfs((prev) => {
            const next = new Map(prev).set(sourceId, proxy);
            sourcePdfsRef.current = next;
            return next;
          });
        } catch {
          // Thumbnails will show the unavailable state; the export path reads
          // the bytes from IndexedDB regardless, so the pages still export.
        }

        setAvailableSourceIds((prev) => [...prev, sourceId]);
        setOverlay(insertPagesFromSource(overlay, meta, indices, insert.atIndex, ready.inspection.pageCount));
        setPendingInsert(null);
      } finally {
        setBusy(false);
      }
    },
    [overlay, ready, doc]
  );

  /* ── Export ────────────────────────────────────────────────────────── */

  const runExport = async (mode: 'single' | 'split') => {
    if (!overlay || !ready || !doc) return;
    setExporting(true);
    setExportError(null);
    try {
      const sourceBytes = await loadSourceBytesMap(doc.id, availableSourceIds);
      const base = baseFileName(doc.title);

      if (mode === 'split') {
        const segments = segmentsFromBreaks(splitAfter, overlay.pages.length);
        const parts = await splitPdf(ready.originalBytes, overlay, sourceBytes, segments, {
          rasterizer: rasterizeRedactions
        });
        parts.forEach((part, index) => {
          // Staggered: browsers drop simultaneous programmatic downloads.
          window.setTimeout(() => downloadBytes(part.bytes, `${base}-part-${index + 1}.pdf`), index * 350);
        });
      } else {
        const applied = await applyOverlayToPdf(ready.originalBytes, overlay, sourceBytes, {
          rasterizer: rasterizeRedactions
        });
        downloadBytes(applied.bytes, `${base}-edited.pdf`);
      }
      setShowExport(false);
    } catch (error) {
      setExportError(
        error instanceof PdfExportError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'The edited PDF could not be produced.'
      );
    } finally {
      setExporting(false);
    }
  };

  /* ── Redacting the stored document ─────────────────────────────────── */

  /**
   * Applies the marked redactions to the stored document, in place.
   *
   * Deliberately narrow: only the redactions are applied, on the document's own
   * page order. Page moves, insertions and deletions stay pending, because they
   * describe a document being produced for someone rather than a document being
   * made safe to hold, and running both at once makes it hard to say afterwards
   * what the stored file is.
   *
   * Three things have to change together, and a failure between them is the
   * dangerous case:
   *
   *   the file in Storage, which is overwritten rather than joined by a copy;
   *   the extracted text in Firestore, which the assistant answers from and
   *     which would otherwise still hold every redacted word;
   *   the summary, which was written from that text.
   *
   * The file goes first. If the text write then fails the document is over-
   * redacted in the index rather than under-redacted, which is the direction
   * to fail in.
   */
  const applyRedactionsToStoredDocument = async () => {
    if (!overlay || !ready || !doc) return;
    setRedactState({ kind: 'working' });
    try {
      // The document's own pages, in their own order, carrying only the marks.
      const redactionOnly: PdfEditOverlay = {
        ...createIdentityOverlay(doc.id, ready.inspection.pageCount),
        redactions: overlay.redactions
      };

      const applied = await applyOverlayToPdf(ready.originalBytes, redactionOnly, new Map(), {
        rasterizer: rasterizeRedactions
      });

      const fileUrl = await replaceDocumentFile(
        applied.bytes,
        doc.id,
        doc.fileUrl,
        `${baseFileName(doc.title)}.pdf`
      );

      // The upload-time cache is what the viewer and the editor read first, so
      // leaving the pre-redaction bytes in it would keep showing the old page
      // for the rest of the session.
      fileDataCache.set(doc.id, new Uint8Array(applied.bytes).buffer);

      const text = applied.redactedText ?? '';
      onDocumentReplaced?.({
        ...doc,
        fileUrl,
        sizeBytes: applied.bytes.byteLength,
        contentPreview: text,
        fullText: text,
        // Written from the text that has just been removed, so it cannot stand.
        summary: ''
      });

      const cleared = clearAllRedactions(overlay);
      setOverlay(cleared);
      lastSavedRef.current = JSON.stringify(cleared);
      await savePdfEditOverlayToFirestore(cleared);

      setRedactState({ kind: 'done', pages: applied.pagesRedacted });
    } catch (error) {
      setRedactState({
        kind: 'error',
        message:
          error instanceof PdfExportError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'The document could not be redacted.'
      });
    }
  };

  const discardEdits = async () => {
    if (!ready || !doc) return;
    const fresh = createIdentityOverlay(doc.id, ready.inspection.pageCount);
    setOverlay(fresh);
    setSplitAfter(new Set());
    lastSavedRef.current = JSON.stringify(fresh);
    setSaveState('idle');
    await deletePdfEditOverlayFromFirestore(doc.id);
  };

  if (!doc) return null;

  const toolbarButton =
    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] text-[var(--ink-2)] hover:text-[var(--ink)] ' +
    'hover:bg-[var(--raised)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer';

  return (
    <div className="fixed inset-0 bg-[var(--ink)]/60 backdrop-blur-xs z-50 flex items-center justify-center p-0 sm:p-3">
      <div className="bg-[var(--surface)] rounded-none sm:rounded-2xl max-w-6xl w-full h-full sm:h-[94vh] overflow-hidden border-0 sm:border sm:border-[var(--rule)] flex flex-col text-[var(--ink)]">

        {/* Header. Same safe-area handling as DocumentDetailModal: edge-to-edge
            on mobile, so it would otherwise sit under the notch. */}
        <div
          className="px-3 py-2 bg-[var(--surface)] border-b border-[var(--rule)] flex items-center gap-3"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <div className="min-w-0 flex-1 px-1">
            <h2 className="text-[14.5px] font-medium text-[var(--ink)] truncate">Edit · {doc.title}</h2>
            <div className="flex items-center gap-2 mt-0.5 text-[12px] text-[var(--muted)]">
              {ready ? (
                <>
                  <span>{overlay ? overlay.pages.length : ready.inspection.pageCount} pages</span>
                  {editableFieldCount > 0 && (
                    <>
                      <span>·</span>
                      <span>{editableFieldCount} form fields</span>
                    </>
                  )}
                  <span>·</span>
                  <span>
                    {saveState === 'saving'
                      ? 'Saving…'
                      : pendingEdits
                        ? 'Pending edits saved'
                        : 'No pending edits'}
                  </span>
                </>
              ) : (
                <span>Opening…</span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-h-0 p-2 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--raised)] transition-colors cursor-pointer"
            aria-label="Close editor"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        {ready && overlay && (
          <div className="px-3 py-1.5 border-b border-[var(--rule)] bg-[var(--surface)] flex items-center flex-wrap gap-1">
            <div className="flex items-center gap-0 border border-[var(--rule)] rounded-lg overflow-hidden mr-2">
              <button
                onClick={() => setActiveTab('pages')}
                className={`min-h-0 px-3 py-2 text-[13px] transition-colors cursor-pointer ${
                  activeTab === 'pages' ? 'bg-[var(--raised)] text-[var(--ink)] font-medium' : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                }`}
              >
                Pages
              </button>
              <button
                onClick={() => setActiveTab('form')}
                disabled={editableFieldCount === 0}
                title={editableFieldCount === 0 ? 'This document has no fillable form fields' : undefined}
                className={`min-h-0 px-3 py-2 text-[13px] border-l border-[var(--rule)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeTab === 'form' ? 'bg-[var(--raised)] text-[var(--ink)] font-medium' : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                }`}
              >
                Form
              </button>
              <button
                onClick={() => setActiveTab('redact')}
                className={`min-h-0 px-3 py-2 text-[13px] border-l border-[var(--rule)] transition-colors cursor-pointer ${
                  activeTab === 'redact'
                    ? 'bg-[var(--raised)] text-[var(--ink)] font-medium'
                    : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                }`}
              >
                Redact
                {overlay.redactions.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] text-[11px] tabular-nums">
                    {overlay.redactions.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'pages' && (
              <>
                <button
                  onClick={() => setOverlay(rotateAllPages(overlay, 90, ready.inspection.pageCount))}
                  disabled={busy}
                  className={toolbarButton}
                  title="Rotate every page 90° clockwise"
                >
                  <RotateCw size={14} /> Rotate all
                </button>
                <button
                  onClick={() => openFilePicker(overlay.pages.length, 'all')}
                  disabled={busy}
                  className={toolbarButton}
                  title="Append every page of another PDF to the end"
                >
                  <Merge size={14} /> Merge PDF
                </button>
                <button
                  onClick={() => openFilePicker(overlay.pages.length, 'choose')}
                  disabled={busy}
                  className={toolbarButton}
                  title="Insert chosen pages from another PDF"
                >
                  <FilePlus2 size={14} /> Insert pages
                </button>
              </>
            )}

            {activeTab === 'redact' && (
              <button
                onClick={() => {
                  setRedactConfirmText('');
                  setRedactState({ kind: 'idle' });
                  setShowRedactConfirm(true);
                }}
                disabled={busy || exporting || overlay.redactions.length === 0}
                className={toolbarButton}
                title={
                  overlay.redactions.length === 0
                    ? 'Mark something to redact first'
                    : 'Destroy the marked content in the stored document'
                }
              >
                <ShieldAlert size={14} /> Redact stored document
              </button>
            )}

            <div className="flex-1" />

            <button onClick={discardEdits} disabled={!pendingEdits || busy} className={toolbarButton} title="Discard every pending edit">
              <Undo2 size={14} /> Discard edits
            </button>
            <button
              onClick={() => {
                setExportError(null);
                setShowExport(true);
              }}
              disabled={busy}
              className="min-h-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] text-[13px] font-medium hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
            >
              <Download size={14} /> Export
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-[var(--bg)] px-4 sm:px-8 py-6">
          {loading && (
            <div className="flex flex-col items-center justify-center p-12 text-[var(--muted)] gap-3">
              <Loader2 size={30} className="animate-spin text-[var(--accent)]" />
              <span className="text-[13px]">Opening document…</span>
            </div>
          )}

          {blocker && (
            <div className="flex flex-col items-center justify-center p-8 bg-[var(--surface)] border border-[var(--rule)] rounded-xl text-center max-w-lg mx-auto my-8 space-y-3">
              {blocker.kind === 'encrypted' ? (
                <Lock size={28} className="text-[var(--accent)]" />
              ) : blocker.kind === 'xfa' ? (
                <FileText size={28} className="text-[var(--accent)]" />
              ) : (
                <AlertCircle size={28} className="text-[var(--accent)]" />
              )}
              <div className="text-[14px] font-medium text-[var(--ink)]">{BLOCKER_COPY[blocker.kind].title}</div>
              <p className="text-[13px] text-[var(--ink-2)] m-0">
                {BLOCKER_COPY[blocker.kind].body ||
                  (blocker.kind === 'corrupt' || blocker.kind === 'unavailable' ? blocker.message : '')}
              </p>
            </div>
          )}

          {ready && overlay && activeTab === 'pages' && (
            <PdfPageOrganizer
              overlay={overlay}
              originalPageCount={ready.inspection.pageCount}
              originalPdf={ready.originalPdf}
              sourcePdfs={sourcePdfs}
              missingSourceIds={missingSources}
              splitAfter={splitAfter}
              onToggleSplitAfter={(index) =>
                setSplitAfter((prev) => {
                  const next = new Set(prev);
                  if (next.has(index)) next.delete(index);
                  else next.add(index);
                  return next;
                })
              }
              onChange={setOverlay}
              onInsertAt={(index) => openFilePicker(index, 'choose')}
              disabled={busy || exporting}
            />
          )}

          {ready && overlay && activeTab === 'redact' && (
            <PdfRedactionCanvas
              overlay={overlay}
              originalPdf={ready.originalPdf}
              originalPageCount={ready.inspection.pageCount}
              onChange={setOverlay}
              disabled={busy || exporting}
            />
          )}

          {ready && overlay && activeTab === 'form' && (
            <PdfFormFiller
              fields={ready.inspection.fields}
              overlay={overlay}
              originalPdf={ready.originalPdf}
              originalPageCount={ready.inspection.pageCount}
              onChange={setOverlay}
              disabled={busy || exporting}
            />
          )}
        </div>

        {exportError && (
          <div className="px-4 py-2.5 border-t border-[var(--rule)] bg-[var(--surface)] flex items-start gap-2 text-[13px]">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-[var(--warn)]" />
            <span className="text-[var(--ink-2)]">{exportError}</span>
          </div>
        )}

        {/* Footer */}
        <div
          className="p-3 bg-[var(--surface)] border-t border-[var(--rule)] flex items-center justify-between gap-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <p className="text-[12px] text-[var(--muted)] m-0 px-1 truncate">
            {overlay && overlay.redactions.length > 0
              ? 'Marked regions are destroyed on export. Replacing the stored document is the only step that changes it.'
              : 'Edits are pending until you export. The stored original is never changed.'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-[var(--ink-2)] hover:text-[var(--ink)] font-medium text-[13.5px] rounded-xl transition-colors cursor-pointer flex-shrink-0"
          >
            Done
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChosen}
        className="hidden"
      />

      {/* Which pages to insert */}
      {pendingInsert && (
        <div className="fixed inset-0 bg-[var(--ink)]/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-2xl w-full max-w-sm p-5 space-y-3">
            <h3 className="text-[15px] font-medium text-[var(--ink)] m-0">Insert pages</h3>
            <p className="text-[13px] text-[var(--ink-2)] m-0">
              {pendingInsert.fileName} has {pendingInsert.pageCount} pages. Which of them should go in?
            </p>
            <input
              type="text"
              value={insertRange}
              onChange={(event) => setInsertRange(event.target.value)}
              placeholder={`1-${pendingInsert.pageCount}`}
              aria-label="Pages to insert"
              className="w-full px-3.5 py-2.5 text-[13.5px] text-[var(--ink)]"
            />
            <p className="text-[12px] text-[var(--muted)] m-0">
              A list or ranges, for example 1-3, 7, 9-12.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setPendingInsert(null)}
                className="px-3.5 py-2 text-[13px] text-[var(--ink-2)] hover:text-[var(--ink)] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => commitInsert(pendingInsert, parsePageRange(insertRange, pendingInsert.pageCount))}
                disabled={busy || parsePageRange(insertRange, pendingInsert.pageCount).length === 0}
                className="px-3.5 py-2 text-[13px] font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Redact the stored document. This is the one irreversible action in the
          editor, so it asks for the word rather than a click. */}
      {showRedactConfirm && ready && overlay && (
        <div className="fixed inset-0 bg-[var(--ink)]/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-2xl w-full max-w-md p-5 space-y-3.5">
            {redactState.kind === 'done' ? (
              <>
                <h3 className="text-[15px] font-medium text-[var(--ink)] m-0 flex items-center gap-2">
                  <Check size={16} className="text-[var(--ok)]" /> Redacted
                </h3>
                <p className="text-[13px] text-[var(--ink-2)] m-0">
                  {redactState.pages} {redactState.pages === 1 ? 'page was' : 'pages were'} replaced, and the
                  stored document, its extracted text and its summary were rewritten. The removed content is no
                  longer in the file and is no longer readable by the assistant.
                </p>
                <p className="text-[12.5px] text-[var(--muted)] m-0">
                  Answers the assistant has already given, and any copy of this document downloaded before now,
                  are unaffected.
                </p>
                <div className="flex items-center justify-end pt-1">
                  <button
                    onClick={() => {
                      setShowRedactConfirm(false);
                      onClose();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-[13.5px] font-medium hover:opacity-90 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-[15px] font-medium text-[var(--ink)] m-0 flex items-center gap-2">
                  <ShieldAlert size={16} className="text-[var(--accent)]" /> Redact the stored document
                </h3>
                <p className="text-[13px] text-[var(--ink-2)] m-0">
                  {overlay.redactions.length} marked{' '}
                  {overlay.redactions.length === 1 ? 'region' : 'regions'} across{' '}
                  {new Set(overlay.redactions.map((redaction) => redaction.pageIndex)).size}{' '}
                  {new Set(overlay.redactions.map((redaction) => redaction.pageIndex)).size === 1
                    ? 'page'
                    : 'pages'}{' '}
                  will be destroyed. This cannot be undone.
                </p>
                <ul className="text-[12.5px] text-[var(--ink-2)] m-0 pl-4 space-y-1 list-disc">
                  <li>The stored file is overwritten. There is no unredacted copy left behind.</li>
                  <li>Marked pages become images: they lose selectable text and any form fields on them.</li>
                  <li>The extracted text the assistant reads is rewritten without the removed content.</li>
                  <li>The AI summary is cleared, because it was written from that text.</li>
                  <li>Pending page and form edits are left pending — only the marks are applied.</li>
                </ul>
                <p className="text-[12.5px] text-[var(--muted)] m-0">
                  Answers already given in a chat are not rewritten, and neither is any copy downloaded earlier.
                </p>

                <div className="space-y-1.5">
                  <label className="block text-[12.5px] text-[var(--ink-2)]" htmlFor="redact-confirm">
                    Type <span className="font-medium text-[var(--ink)]">{REDACT_CONFIRMATION}</span> to confirm
                  </label>
                  <input
                    id="redact-confirm"
                    type="text"
                    value={redactConfirmText}
                    onChange={(event) => setRedactConfirmText(event.target.value)}
                    autoComplete="off"
                    className="w-full px-3.5 py-2.5 text-[13.5px] text-[var(--ink)]"
                  />
                </div>

                {redactState.kind === 'error' && (
                  <p className="text-[12.5px] text-[var(--warn)] m-0">{redactState.message}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowRedactConfirm(false)}
                    disabled={redactState.kind === 'working'}
                    className="px-3.5 py-2 text-[13px] text-[var(--ink-2)] hover:text-[var(--ink)] rounded-lg cursor-pointer disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void applyRedactionsToStoredDocument()}
                    disabled={
                      redactState.kind === 'working' || redactConfirmText.trim() !== REDACT_CONFIRMATION
                    }
                    className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-[13.5px] font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                  >
                    {redactState.kind === 'working' ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <ShieldAlert size={15} />
                    )}
                    Redact permanently
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Export */}
      {showExport && ready && overlay && (
        <div className="fixed inset-0 bg-[var(--ink)]/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-[15px] font-medium text-[var(--ink)] m-0">Export</h3>

            <p className="text-[13px] text-[var(--ink-2)] m-0">
              The pending edits are applied to a copy. The stored original is left untouched.
            </p>

            {overlay.redactions.length > 0 && (
              <p className="text-[12.5px] text-[var(--ink-2)] m-0 p-2.5 rounded-lg bg-[var(--accent-soft)]">
                <span className="text-[var(--ink)] font-medium">
                  {overlay.redactions.length} marked{' '}
                  {overlay.redactions.length === 1 ? 'region' : 'regions'} will be destroyed in the exported file.
                </span>{' '}
                The stored document keeps them — use <span className="font-medium">Redact stored document</span> on
                the Redact tab to remove them from the copy Signal87 holds and from what the assistant can read.
              </p>
            )}

            {ready.inspection.hasAcroForm && (
              <label className="flex items-start gap-2.5 text-[13px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={overlay.flattenOnExport}
                  onChange={(event) => setOverlay(setFlattenOnExport(overlay, event.target.checked))}
                  className="mt-0.5 w-4 h-4 accent-[var(--accent)] cursor-pointer"
                />
                <span>
                  <span className="text-[var(--ink)]">Flatten the form</span>
                  <span className="block text-[var(--muted)] text-[12px]">
                    Bakes the values into the page so they can no longer be edited. Leave this off to keep the
                    fields fillable.
                  </span>
                </span>
              </label>
            )}

            {missingSources.length > 0 && (
              <p className="text-[12.5px] text-[var(--warn)] m-0">
                Pages inserted from{' '}
                {missingSources
                  .map((id) => overlay.sources.find((source) => source.id === id)?.fileName || 'another PDF')
                  .join(', ')}{' '}
                are not on this device, so the export will fail until they are re-inserted or removed.
              </p>
            )}

            {exportError && <p className="text-[12.5px] text-[var(--warn)] m-0">{exportError}</p>}

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => runExport('single')}
                disabled={exporting}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-[13.5px] font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                Export one PDF ({overlay.pages.length} pages)
              </button>

              <button
                onClick={() => runExport('split')}
                disabled={exporting || splitAfter.size === 0}
                title={splitAfter.size === 0 ? 'Mark split points between pages first' : undefined}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--rule)] text-[var(--ink)] text-[13.5px] font-medium hover:bg-[var(--raised)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                <Check size={15} />
                Split into {segmentsFromBreaks(splitAfter, overlay.pages.length).length} files
              </button>

              <button
                onClick={() => setShowExport(false)}
                className="w-full px-4 py-2 text-[13px] text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
