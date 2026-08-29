import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import type { PageViewport, PDFDocumentProxy } from 'pdfjs-dist';
import { PdfEditOverlay, PdfRedaction, PdfWidgetRect } from '../lib/pdfEditTypes';
import {
  addRedaction,
  addRedactions,
  clearAllRedactions,
  clearRedactionsOnPage,
  redactionsOnPage,
  removeRedaction
} from '../lib/pdfRedaction';
import { findTextMatches, renderPageToCanvas } from '../lib/pdfRender';

interface PdfRedactionCanvasProps {
  overlay: PdfEditOverlay;
  originalPdf: PDFDocumentProxy | null;
  originalPageCount: number;
  onChange: (next: PdfEditOverlay) => void;
  disabled: boolean;
}

/** A rectangle being dragged, in CSS pixels relative to the page. */
interface DragRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type SearchScope = 'page' | 'document';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'done'; found: number; added: number; term: string };

function normalizeDrag(from: { x: number; y: number }, to: { x: number; y: number }): DragRect {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y)
  };
}

export const PdfRedactionCanvas: React.FC<PdfRedactionCanvasProps> = ({
  overlay,
  originalPdf,
  originalPageCount,
  onChange,
  disabled
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const [pageIndex, setPageIndex] = useState(0);
  const [viewport, setViewport] = useState<PageViewport | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragRect | null>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('document');
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' });

  /* ── Rendering the page ─────────────────────────────────────────────── */

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      const width = element.clientWidth;
      if (width > 0) setContainerWidth(width);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!originalPdf || !canvas || containerWidth === 0) return;
    let cancelled = false;

    (async () => {
      try {
        const page = await originalPdf.getPage(pageIndex + 1);
        const unscaled = page.getViewport({ scale: 1, rotation: page.rotate });
        // Aiming a rectangle at a line of text needs a page big enough to see.
        const scale = Math.max(0.5, Math.min(containerWidth / unscaled.width, 2.5));
        if (cancelled) return;
        const rendered = await renderPageToCanvas(originalPdf, pageIndex + 1, canvas, scale);
        if (cancelled) return;
        setViewport(rendered);
        setRenderError(null);
      } catch (error) {
        if (cancelled) return;
        setRenderError(error instanceof Error ? error.message : 'This page could not be rendered.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [originalPdf, pageIndex, containerWidth]);

  /* ── Placing rectangles ─────────────────────────────────────────────── */

  /**
   * Turns a rectangle drawn on screen into one in PDF user space.
   *
   * The viewport's own conversion is used in both directions rather than
   * arithmetic here, so a rotated page — where the y axis of the screen is not
   * the y axis of the page — lands in the right place.
   */
  const toPdfRect = useCallback(
    (rect: DragRect): PdfWidgetRect | null => {
      if (!viewport) return null;
      const topLeft = viewport.convertToPdfPoint(rect.x, rect.y) as number[];
      const bottomRight = viewport.convertToPdfPoint(rect.x + rect.width, rect.y + rect.height) as number[];
      const x = Math.min(topLeft[0], bottomRight[0]);
      const y = Math.min(topLeft[1], bottomRight[1]);
      return {
        x,
        y,
        width: Math.abs(bottomRight[0] - topLeft[0]),
        height: Math.abs(bottomRight[1] - topLeft[1])
      };
    },
    [viewport]
  );

  /** Where a stored rectangle sits on screen. */
  const toScreenRect = useCallback(
    (rect: PdfWidgetRect): DragRect | null => {
      if (!viewport) return null;
      const corners = viewport.convertToViewportRectangle([
        rect.x,
        rect.y,
        rect.x + rect.width,
        rect.y + rect.height
      ]) as number[];
      return {
        x: Math.min(corners[0], corners[2]),
        y: Math.min(corners[1], corners[3]),
        width: Math.abs(corners[2] - corners[0]),
        height: Math.abs(corners[3] - corners[1])
      };
    },
    [viewport]
  );

  const pointOn = (event: React.PointerEvent): { x: number; y: number } | null => {
    const surface = surfaceRef.current;
    if (!surface) return null;
    const bounds = surface.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    if (disabled || !viewport) return;
    const point = pointOn(event);
    if (!point) return;
    dragStartRef.current = point;
    setDrag({ x: point.x, y: point.y, width: 0, height: 0 });
    event.currentTarget.setPointerCapture(event.pointerId);
    // Otherwise a drag across the page selects the surrounding text instead.
    event.preventDefault();
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const start = dragStartRef.current;
    if (!start) return;
    const point = pointOn(event);
    if (!point) return;
    setDrag(normalizeDrag(start, point));
  };

  const finishDrag = (event: React.PointerEvent) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start || !drag) {
      setDrag(null);
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const pdfRect = toPdfRect(drag);
    setDrag(null);
    if (pdfRect) onChange(addRedaction(overlay, pageIndex, pdfRect, 'manual'));
  };

  /* ── Finding text ───────────────────────────────────────────────────── */

  const runSearch = async () => {
    const term = query.trim();
    if (!originalPdf || term.length === 0 || disabled) return;
    setSearch({ kind: 'searching' });
    try {
      const matches = await findTextMatches(originalPdf, term, scope === 'page' ? [pageIndex] : undefined);
      const next = addRedactions(overlay, matches, 'search');
      setSearch({
        kind: 'done',
        found: matches.length,
        added: next.redactions.length - overlay.redactions.length,
        term
      });
      if (next !== overlay) onChange(next);
    } catch {
      setSearch({ kind: 'done', found: 0, added: 0, term });
    }
  };

  /* ── Derived ────────────────────────────────────────────────────────── */

  const onThisPage = useMemo(() => redactionsOnPage(overlay, pageIndex), [overlay, pageIndex]);
  const total = overlay.redactions.length;

  const pagesWithRedactions = useMemo(
    () => [...new Set(overlay.redactions.map((redaction) => redaction.pageIndex))].sort((a, b) => a - b),
    [overlay.redactions]
  );

  const controlButton =
    'min-h-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] text-[var(--ink-2)] border border-[var(--rule)] ' +
    'hover:text-[var(--ink)] hover:bg-[var(--raised)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer';

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* What redaction here actually does. Stated up front because the word
          means two very different things in different products, and the
          difference is the whole reason to use this one. */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-[var(--rule)] bg-[var(--surface)]">
        <ShieldAlert size={16} className="flex-shrink-0 mt-0.5 text-[var(--accent)]" />
        <div className="text-[12.5px] text-[var(--ink-2)] space-y-1">
          <p className="m-0">
            <span className="text-[var(--ink)] font-medium">Marked regions are destroyed, not covered.</span>{' '}
            On export, every page carrying a mark is replaced by an image of itself taken after the regions were
            painted out, and the file is swept for anything the old page left behind. Nothing remains to select,
            copy or recover.
          </p>
          <p className="m-0 text-[var(--muted)]">
            A redacted page becomes a picture, so it loses selectable text and any form fields on it. Pages you
            leave unmarked are untouched.
          </p>
        </div>
      </div>

      {/* Find text */}
      <div className="p-3.5 rounded-xl border border-[var(--rule)] bg-[var(--surface)] space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            />
            <input
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearch({ kind: 'idle' });
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void runSearch();
                }
              }}
              placeholder="Find text to redact — a name, an account number"
              aria-label="Text to find and redact"
              className="w-full pl-9 pr-3 py-2.5 text-[13.5px] text-[var(--ink)]"
              disabled={disabled}
            />
          </div>

          <div className="flex items-center border border-[var(--rule)] rounded-lg overflow-hidden">
            <button
              onClick={() => setScope('document')}
              className={`min-h-0 px-3 py-2 text-[12.5px] transition-colors cursor-pointer ${
                scope === 'document'
                  ? 'bg-[var(--raised)] text-[var(--ink)] font-medium'
                  : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              Whole document
            </button>
            <button
              onClick={() => setScope('page')}
              className={`min-h-0 px-3 py-2 text-[12.5px] border-l border-[var(--rule)] transition-colors cursor-pointer ${
                scope === 'page'
                  ? 'bg-[var(--raised)] text-[var(--ink)] font-medium'
                  : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              This page
            </button>
          </div>

          <button
            onClick={() => void runSearch()}
            disabled={disabled || query.trim().length === 0 || search.kind === 'searching'}
            className="min-h-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] text-[13px] font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
          >
            {search.kind === 'searching' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Mark every match
          </button>
        </div>

        {search.kind === 'done' && (
          <p className="text-[12.5px] m-0 text-[var(--ink-2)]">
            {search.found === 0 ? (
              <>
                No occurrence of “{search.term}” was found{scope === 'page' ? ' on this page' : ''}. Matches are
                found in the document’s text layer, so a scanned page with no text behind it has to be marked by
                hand.
              </>
            ) : (
              <>
                {search.found} {search.found === 1 ? 'occurrence' : 'occurrences'} of “{search.term}” found
                {search.added === search.found ? '' : `, ${search.added} newly marked`}.
              </>
            )}
          </p>
        )}
      </div>

      {/* Page */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
            disabled={pageIndex === 0}
            className={controlButton}
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[13px] text-[var(--ink-2)] px-1 tabular-nums">
            Page {pageIndex + 1} of {originalPageCount}
          </span>
          <button
            onClick={() => setPageIndex((index) => Math.min(originalPageCount - 1, index + 1))}
            disabled={pageIndex >= originalPageCount - 1}
            className={controlButton}
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>

          {pagesWithRedactions.length > 0 && (
            <div className="flex items-center gap-1 ml-2 flex-wrap">
              <span className="text-[12px] text-[var(--muted)]">Marked:</span>
              {pagesWithRedactions.map((index) => (
                <button
                  key={index}
                  onClick={() => setPageIndex(index)}
                  className={`min-h-0 px-2 py-1 rounded-md text-[12px] tabular-nums cursor-pointer transition-colors ${
                    index === pageIndex
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                      : 'bg-[var(--accent-soft)] text-[var(--accent)] hover:opacity-80'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onChange(clearRedactionsOnPage(overlay, pageIndex))}
            disabled={disabled || onThisPage.length === 0}
            className={controlButton}
          >
            <Trash2 size={14} /> Clear page
          </button>
          <button
            onClick={() => onChange(clearAllRedactions(overlay))}
            disabled={disabled || total === 0}
            className={controlButton}
          >
            <Trash2 size={14} /> Clear all ({total})
          </button>
        </div>
      </div>

      {/* A page wider than the column scrolls rather than pushing the editor
          sideways: the surface has to keep its rendered size, because a
          rectangle is aimed at it in its own pixels. */}
      <div ref={containerRef} className="w-full overflow-x-auto">
        {renderError ? (
          <p className="text-[13px] text-[var(--warn)] m-0">{renderError}</p>
        ) : (
          <div className="flex justify-center min-w-min">
            <div
              ref={surfaceRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              className="relative inline-block shadow-sm border border-[var(--rule)] touch-none select-none"
              style={{ cursor: disabled ? 'default' : 'crosshair' }}
            >
              <canvas ref={canvasRef} className="block" />

              {viewport &&
                onThisPage.map((redaction: PdfRedaction) => {
                  const screen = toScreenRect(redaction.rect);
                  if (!screen) return null;
                  return (
                    <div
                      key={redaction.id}
                      className="absolute group"
                      style={{
                        left: screen.x,
                        top: screen.y,
                        width: screen.width,
                        height: screen.height,
                        backgroundColor: 'var(--ink)',
                        outline: '1px solid var(--accent)'
                      }}
                    >
                      <button
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          onChange(removeRedaction(overlay, redaction.id));
                        }}
                        disabled={disabled}
                        aria-label="Remove this mark"
                        title="Remove this mark"
                        className="absolute -top-2.5 -right-2.5 w-5 h-5 min-h-0 rounded-full bg-[var(--surface)] border border-[var(--rule)] text-[var(--ink-2)] hover:text-[var(--accent)] flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer p-0"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}

              {drag && drag.width > 1 && drag.height > 1 && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: drag.x,
                    top: drag.y,
                    width: drag.width,
                    height: drag.height,
                    backgroundColor: 'var(--ink)',
                    outline: '1px dashed var(--accent)'
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-[12px] text-[var(--muted)] text-center m-0">
        Drag across the page to mark a region. Hover a mark to remove it.
      </p>
    </div>
  );
};
