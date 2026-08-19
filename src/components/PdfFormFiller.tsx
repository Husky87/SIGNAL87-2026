import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, PenLine } from 'lucide-react';
import type { PageViewport, PDFDocumentProxy } from 'pdfjs-dist';
import { PdfEditOverlay, PdfFieldInfo, PdfFieldWidget, PdfFormFieldValue } from '../lib/pdfEditTypes';
import { setFormValue } from '../lib/pdfEditOverlay';
import { renderPageToCanvas } from '../lib/pdfRender';

interface PdfFormFillerProps {
  fields: PdfFieldInfo[];
  overlay: PdfEditOverlay;
  originalPdf: PDFDocumentProxy | null;
  originalPageCount: number;
  onChange: (next: PdfEditOverlay) => void;
  disabled: boolean;
}

interface PositionedWidget {
  field: PdfFieldInfo;
  widget: PdfFieldWidget;
  /** Index of this widget within its field — a radio group's nth button. */
  widgetIndex: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The pending value if one has been entered, otherwise the document's own. */
function effectiveValue(field: PdfFieldInfo, overlay: PdfEditOverlay): PdfFormFieldValue | undefined {
  return overlay.formValues[field.name] ?? field.initial;
}

function textOf(value: PdfFormFieldValue | undefined): string {
  if (!value) return '';
  if (value.kind === 'text' || value.kind === 'radio' || value.kind === 'dropdown') return value.value;
  return '';
}

export const PdfFormFiller: React.FC<PdfFormFillerProps> = ({
  fields,
  overlay,
  originalPdf,
  originalPageCount,
  onChange,
  disabled
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [viewport, setViewport] = useState<PageViewport | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);

  /** Pages that actually carry a field, so the reader can skip to them. */
  const pagesWithFields = useMemo(() => {
    const pages = new Set<number>();
    for (const field of fields) {
      for (const widget of field.widgets) pages.add(widget.pageIndex);
    }
    return [...pages].sort((a, b) => a - b);
  }, [fields]);

  /** Fields with no widget anywhere. They are real and fillable, but have no
   *  position to sit at, so they get their own list rather than vanishing. */
  const unpositionedFields = useMemo(
    () => fields.filter((field) => field.widgets.length === 0 && field.kind !== 'button' && field.kind !== 'signature'),
    [fields]
  );

  useEffect(() => {
    if (pagesWithFields.length > 0) setPageIndex(pagesWithFields[0]);
  }, [pagesWithFields]);

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
        const unscaled = page.getViewport({ scale: 1 });
        // Cap the scale so a very narrow column does not render a page too
        // small to aim at, and a very wide one does not render a huge canvas.
        const scale = Math.max(0.4, Math.min(containerWidth / unscaled.width, 2));
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

  /**
   * Field rectangles are in PDF user space, whose origin is the bottom-left
   * corner; CSS wants top-left. The viewport's own conversion is used rather
   * than arithmetic here, because it already accounts for the page's rotation
   * and for the y-axis flip.
   */
  const positioned = useMemo<PositionedWidget[]>(() => {
    if (!viewport) return [];
    const result: PositionedWidget[] = [];
    for (const field of fields) {
      if (field.kind === 'button' || field.kind === 'signature') continue;
      field.widgets.forEach((widget, widgetIndex) => {
        if (widget.pageIndex !== pageIndex) return;
        const { x, y, width, height } = widget.rect;
        const corners = viewport.convertToViewportRectangle([x, y, x + width, y + height]) as number[];
        const left = Math.min(corners[0], corners[2]);
        const top = Math.min(corners[1], corners[3]);
        result.push({
          field,
          widget,
          widgetIndex,
          left,
          top,
          width: Math.abs(corners[2] - corners[0]),
          height: Math.abs(corners[3] - corners[1])
        });
      });
    }
    return result;
  }, [fields, viewport, pageIndex]);

  const update = (field: PdfFieldInfo, value: PdfFormFieldValue) => {
    onChange(setFormValue(overlay, field.name, value));
  };

  /** Shared look for an input sitting directly on the page. The overrides are
   *  inline because the app-wide field treatment is a pill on opaque white,
   *  which would hide the printed field it is standing on. */
  const overlayInputStyle: React.CSSProperties = {
    borderRadius: 3,
    backgroundColor: 'rgba(14, 124, 140, 0.07)',
    padding: '0 3px'
  };

  const renderControl = (item: PositionedWidget) => {
    const { field } = item;
    const value = effectiveValue(field, overlay);
    const locked = disabled || field.readOnly;
    const fontSize = Math.max(9, Math.min(item.height * 0.62, 15));

    if (field.kind === 'checkbox') {
      const checked = value?.kind === 'checkbox' ? value.value : false;
      return (
        <input
          type="checkbox"
          checked={checked}
          disabled={locked}
          onChange={(event) => update(field, { kind: 'checkbox', value: event.target.checked })}
          title={field.name}
          aria-label={field.name}
          className="cursor-pointer accent-[var(--accent)]"
          style={{ width: '100%', height: '100%', margin: 0 }}
        />
      );
    }

    if (field.kind === 'radio') {
      // pdf-lib reports a radio widget's on-state as an index into /Opt, not
      // as the option text, so widget n pairs with option n by position.
      const option = field.options[item.widgetIndex] ?? item.widget.exportValue ?? '';
      const selected = value?.kind === 'radio' ? value.value : '';
      return (
        <input
          type="radio"
          name={`${field.name}__${overlay.docId}`}
          checked={selected === option && option !== ''}
          disabled={locked || option === ''}
          onChange={() => update(field, { kind: 'radio', value: option })}
          title={`${field.name}: ${option}`}
          aria-label={`${field.name}: ${option}`}
          className="cursor-pointer accent-[var(--accent)]"
          style={{ width: '100%', height: '100%', margin: 0 }}
        />
      );
    }

    if (field.kind === 'dropdown') {
      return (
        <select
          value={textOf(value)}
          disabled={locked}
          onChange={(event) => update(field, { kind: 'dropdown', value: event.target.value })}
          title={field.name}
          aria-label={field.name}
          className="w-full h-full text-[var(--ink)] border-0 cursor-pointer"
          style={{ ...overlayInputStyle, fontSize }}
        >
          <option value="">—</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (field.kind === 'optionlist') {
      const selected = value?.kind === 'optionlist' ? value.value : [];
      return (
        <select
          multiple
          value={selected}
          disabled={locked}
          onChange={(event) =>
            update(field, {
              kind: 'optionlist',
              value: [...event.target.selectedOptions].map((option) => option.value)
            })
          }
          title={field.name}
          aria-label={field.name}
          className="w-full h-full text-[var(--ink)] border-0 cursor-pointer"
          style={{ ...overlayInputStyle, fontSize }}
        >
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (field.multiline) {
      return (
        <textarea
          value={textOf(value)}
          disabled={locked}
          onChange={(event) => update(field, { kind: 'text', value: event.target.value })}
          title={field.name}
          aria-label={field.name}
          className="w-full h-full text-[var(--ink)] border-0 resize-none"
          style={{ ...overlayInputStyle, fontSize, lineHeight: 1.25, paddingTop: 2 }}
        />
      );
    }

    return (
      <input
        type="text"
        value={textOf(value)}
        disabled={locked}
        onChange={(event) => update(field, { kind: 'text', value: event.target.value })}
        title={field.name}
        aria-label={field.name}
        className="w-full h-full text-[var(--ink)] border-0"
        style={{ ...overlayInputStyle, fontSize }}
      />
    );
  };

  const goToPage = (next: number) => {
    setPageIndex(Math.max(0, Math.min(originalPageCount - 1, next)));
  };

  const fieldsOnThisPage = positioned.length;

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="text-[13px] text-[var(--ink-2)]">
          <span className="font-medium text-[var(--ink)]">{fields.length}</span> form{' '}
          {fields.length === 1 ? 'field' : 'fields'} in this document
          {fieldsOnThisPage > 0 && <span className="text-[var(--muted)]"> · {fieldsOnThisPage} on this page</span>}
        </div>

        <div className="flex items-center gap-1 bg-[var(--raised)] px-2 py-1 rounded-lg">
          <button
            type="button"
            onClick={() => goToPage(pageIndex - 1)}
            disabled={pageIndex === 0}
            className="min-h-0 p-1 rounded text-[var(--ink-2)] hover:text-[var(--ink)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-[12px] text-[var(--ink-2)] px-1">
            Original page {pageIndex + 1} of {originalPageCount}
          </span>
          <button
            type="button"
            onClick={() => goToPage(pageIndex + 1)}
            disabled={pageIndex >= originalPageCount - 1}
            className="min-h-0 p-1 rounded text-[var(--ink-2)] hover:text-[var(--ink)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {pagesWithFields.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4 text-[12px]">
          <span className="text-[var(--muted)]">Pages with fields:</span>
          {pagesWithFields.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => goToPage(page)}
              className={`min-h-0 px-2 py-1 rounded-full transition-colors cursor-pointer ${
                page === pageIndex
                  ? 'bg-[var(--accent)] text-[var(--teal-ink)]'
                  : 'bg-[var(--raised)] text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              {page + 1}
            </button>
          ))}
        </div>
      )}

      <div ref={containerRef} className="w-full flex justify-center">
        <div className="relative inline-block rounded-xl overflow-hidden border border-[var(--rule)] bg-white">
          <canvas ref={canvasRef} className="block" />
          {viewport &&
            positioned.map((item) => (
              <div
                key={`${item.field.name}__${item.widgetIndex}`}
                className="absolute"
                style={{ left: item.left, top: item.top, width: item.width, height: item.height }}
              >
                {renderControl(item)}
              </div>
            ))}
        </div>
      </div>

      {renderError && (
        <p className="mt-3 text-[13px] text-[var(--warn)] text-center">{renderError}</p>
      )}

      {fieldsOnThisPage === 0 && !renderError && (
        <p className="mt-3 text-[13px] text-[var(--muted)] text-center">
          No form fields on this page.
        </p>
      )}

      {unpositionedFields.length > 0 && (
        <div className="mt-8 border-t border-[var(--rule-2)] pt-5">
          <div className="flex items-center gap-1.5 mb-3 text-[11px] font-medium text-[var(--muted)] uppercase" style={{ letterSpacing: '0.09em' }}>
            <PenLine size={12} />
            <span>Fields with no position on the page</span>
          </div>
          <div className="space-y-2.5">
            {unpositionedFields.map((field) => {
              const value = effectiveValue(field, overlay);
              return (
                <label key={field.name} className="flex flex-col gap-1 text-[13px]">
                  <span className="text-[var(--ink-2)] flex items-center gap-1.5">
                    {field.name}
                    {field.readOnly && <Lock size={11} className="text-[var(--muted)]" />}
                  </span>
                  {field.kind === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={value?.kind === 'checkbox' ? value.value : false}
                      disabled={disabled || field.readOnly}
                      onChange={(event) => update(field, { kind: 'checkbox', value: event.target.checked })}
                      className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
                    />
                  ) : (
                    <input
                      type="text"
                      value={textOf(value)}
                      disabled={disabled || field.readOnly}
                      onChange={(event) => update(field, { kind: 'text', value: event.target.value })}
                      className="px-3 py-2 text-[var(--ink)]"
                    />
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
