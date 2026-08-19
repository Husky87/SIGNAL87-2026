import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FilePlus2,
  RotateCw,
  Scissors,
  Trash2,
  TriangleAlert
} from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ORIGINAL_SOURCE_ID, PdfEditOverlay, PdfPageInstance } from '../lib/pdfEditTypes';
import { deletePage, duplicatePage, movePage, rotatePage } from '../lib/pdfEditOverlay';
import { renderPageThumbnail } from '../lib/pdfRender';

const THUMBNAIL_WIDTH = 240;

interface PdfPageOrganizerProps {
  overlay: PdfEditOverlay;
  originalPageCount: number;
  originalPdf: PDFDocumentProxy | null;
  /** Rendering handles for inserted sources this device holds bytes for. */
  sourcePdfs: Map<string, PDFDocumentProxy>;
  /** Inserted sources whose bytes are not on this device. */
  missingSourceIds: string[];
  /** Page positions after which the document splits, as indices into `pages`. */
  splitAfter: Set<number>;
  onToggleSplitAfter: (index: number) => void;
  onChange: (next: PdfEditOverlay) => void;
  /** Opens the file picker, inserting whatever is chosen at this position. */
  onInsertAt: (index: number) => void;
  disabled: boolean;
}

/** Identifies a rendered thumbnail. Rotation is included so turning a page
 *  re-renders it, and turning it back is served from the cache. */
function thumbnailKey(page: PdfPageInstance): string {
  return `${page.sourceId}:${page.sourceIndex}:${page.rotation}`;
}

export const PdfPageOrganizer: React.FC<PdfPageOrganizerProps> = ({
  overlay,
  originalPageCount,
  originalPdf,
  sourcePdfs,
  missingSourceIds,
  splitAfter,
  onToggleSplitAfter,
  onChange,
  onInsertAt,
  disabled
}) => {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // Keys already rendered or in flight. A ref rather than state so that
  // finishing one thumbnail does not re-run the effect for all the others.
  const requestedRef = useRef<Set<string>>(new Set());

  const pdfForSource = useCallback(
    (sourceId: string): PDFDocumentProxy | null =>
      sourceId === ORIGINAL_SOURCE_ID ? originalPdf : sourcePdfs.get(sourceId) ?? null,
    [originalPdf, sourcePdfs]
  );

  useEffect(() => {
    let cancelled = false;
    const pending = new Map<string, PdfPageInstance>();
    for (const page of overlay.pages) {
      const key = thumbnailKey(page);
      if (!requestedRef.current.has(key)) pending.set(key, page);
    }
    if (pending.size === 0) return;

    (async () => {
      for (const [key, page] of pending) {
        const pdf = pdfForSource(page.sourceId);
        if (!pdf) continue;
        requestedRef.current.add(key);
        const dataUrl = await renderPageThumbnail(pdf, page.sourceIndex + 1, THUMBNAIL_WIDTH, page.rotation);
        if (cancelled) return;
        if (dataUrl) setThumbnails((prev) => ({ ...prev, [key]: dataUrl }));
        else requestedRef.current.delete(key);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [overlay.pages, pdfForSource]);

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || disabled) return;
    onChange(movePage(overlay, dragIndex, targetIndex, originalPageCount));
    setDragIndex(null);
    setDropIndex(null);
  };

  const move = (from: number, to: number) => {
    if (disabled || to < 0 || to >= overlay.pages.length) return;
    onChange(movePage(overlay, from, to, originalPageCount));
  };

  const sourceLabel = (page: PdfPageInstance): string | null => {
    if (page.sourceId === ORIGINAL_SOURCE_ID) return null;
    const meta = overlay.sources.find((source) => source.id === page.sourceId);
    return meta ? meta.fileName : 'Inserted';
  };

  // Compact controls opt out of the global 44px button floor: at that height
  // the action row would be taller than the thumbnail it belongs to.
  const tileButton =
    'min-h-0 p-1.5 rounded-lg text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--raised)] ' +
    'disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer';

  return (
    <div className="w-full max-w-5xl mx-auto">
      {missingSourceIds.length > 0 && (
        <div className="flex items-start gap-2.5 p-3 mb-5 rounded-xl border border-[var(--rule)] bg-[var(--surface)]">
          <TriangleAlert size={16} className="flex-shrink-0 mt-0.5 text-[var(--warn)]" />
          <div className="min-w-0 text-[13px]">
            <p className="m-0 font-medium text-[var(--ink)]">Some inserted pages aren't on this device</p>
            <p className="m-0 text-[var(--ink-2)]">
              {missingSourceIds
                .map((id) => overlay.sources.find((source) => source.id === id)?.fileName || 'an inserted PDF')
                .join(', ')}{' '}
              was added on another device. The page plan is here, but the file itself isn't — re-insert it, or
              remove those pages, before exporting.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-6">
        {overlay.pages.map((page, index) => {
          const key = thumbnailKey(page);
          const thumbnail = thumbnails[key];
          const missing = page.sourceId !== ORIGINAL_SOURCE_ID && missingSourceIds.includes(page.sourceId);
          const label = sourceLabel(page);
          const isDropTarget = dropIndex === index && dragIndex !== null && dragIndex !== index;

          return (
            <React.Fragment key={page.id}>
              <div
                draggable={!disabled}
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropIndex(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(index);
                }}
                className={`w-[168px] rounded-xl border bg-[var(--surface)] overflow-hidden transition-colors ${
                  isDropTarget ? 'border-[var(--accent)]' : 'border-[var(--rule)]'
                } ${dragIndex === index ? 'opacity-40' : ''} ${disabled ? '' : 'cursor-grab active:cursor-grabbing'}`}
              >
                <div className="h-[190px] flex items-center justify-center bg-[var(--bg)] border-b border-[var(--rule-2)] p-2">
                  {missing ? (
                    <div className="text-center px-2">
                      <TriangleAlert size={18} className="mx-auto text-[var(--warn)]" />
                      <p className="m-0 mt-1.5 text-[11px] text-[var(--muted)]">Not on this device</p>
                    </div>
                  ) : thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={`Page ${index + 1}`}
                      className="max-h-full max-w-full object-contain"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full rounded bg-[var(--raised)] animate-pulse" />
                  )}
                </div>

                <div className="px-2 py-1.5 flex items-center justify-between gap-1 text-[11px] text-[var(--muted)]">
                  {/* Position, then where the page came from — but only when
                      that differs from the position. Once pages have been
                      reordered or duplicated, the position number alone says
                      where a tile sits and nothing about which page it is. */}
                  <span className="truncate">
                    {index + 1}
                    {label
                      ? ` · ${label} p.${page.sourceIndex + 1}`
                      : page.sourceIndex !== index
                        ? ` · p.${page.sourceIndex + 1}`
                        : ''}
                    {page.rotation !== 0 ? ` · ${page.rotation}°` : ''}
                  </span>
                </div>

                <div className="px-1 pb-1 flex items-center justify-between border-t border-[var(--rule-2)] pt-1">
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => move(index, index - 1)}
                      disabled={disabled || index === 0}
                      className={tileButton}
                      title="Move earlier"
                      aria-label={`Move page ${index + 1} earlier`}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, index + 1)}
                      disabled={disabled || index === overlay.pages.length - 1}
                      className={tileButton}
                      title="Move later"
                      aria-label={`Move page ${index + 1} later`}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => onChange(rotatePage(overlay, page.id, 90, originalPageCount))}
                      disabled={disabled}
                      className={tileButton}
                      title="Rotate 90° clockwise"
                      aria-label={`Rotate page ${index + 1}`}
                    >
                      <RotateCw size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(duplicatePage(overlay, page.id, originalPageCount))}
                      disabled={disabled}
                      className={tileButton}
                      title="Duplicate page"
                      aria-label={`Duplicate page ${index + 1}`}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(deletePage(overlay, page.id, originalPageCount))}
                      disabled={disabled || overlay.pages.length <= 1}
                      className={tileButton}
                      title={overlay.pages.length <= 1 ? 'A PDF must keep at least one page' : 'Delete page'}
                      aria-label={`Delete page ${index + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Gutter between two pages: insert here, or split here. */}
              <div className="flex flex-col items-center justify-center gap-1 self-stretch pt-[70px]">
                <button
                  type="button"
                  onClick={() => onInsertAt(index + 1)}
                  disabled={disabled}
                  className="min-h-0 p-1 rounded-lg text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--raised)] disabled:opacity-30 transition-colors cursor-pointer"
                  title="Insert pages from another PDF here"
                  aria-label={`Insert pages after page ${index + 1}`}
                >
                  <FilePlus2 size={14} />
                </button>
                {index < overlay.pages.length - 1 && (
                  <button
                    type="button"
                    onClick={() => onToggleSplitAfter(index)}
                    disabled={disabled}
                    className={`min-h-0 p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-30 ${
                      splitAfter.has(index)
                        ? 'text-[var(--teal-ink)] bg-[var(--accent)]'
                        : 'text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--raised)]'
                    }`}
                    title={splitAfter.has(index) ? 'Remove split here' : 'Split into a separate file here'}
                    aria-label={`Toggle split after page ${index + 1}`}
                    aria-pressed={splitAfter.has(index)}
                  >
                    <Scissors size={14} />
                  </button>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
