import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Brain, FileText } from 'lucide-react';
import type { ChatMessage, DocumentItem } from '../types';
import { Signal87Logo } from './Signal87Logo';
import { ActionRouterCard, CitationUI, GeminiMarkdownRenderer } from './ActionRouterComponents';
import { getShowCitationNumbers, subscribeCitationNumbers } from '../lib/citationDisplay';
import { chipCitations, findSearchPhrase, SourceChip } from '../lib/citationSegments';

/** Opens a file in the viewer, optionally with its search pre-filled so a passage is highlighted. */
export type OpenDocument = (doc: DocumentItem, options?: { search?: string }) => void;

interface AssistantAnswerProps {
  msg: ChatMessage;
  userPrompt: string;
  copiedMsgId: string | null;
  documents: DocumentItem[];
  onCopy: (id: string, text: string) => void;
  onExportPDF: (title: string, text: string) => void;
  onInspectInCanvas: (msg: ChatMessage) => void;
  onSelectDocument?: OpenDocument;
  onSaveAnswer?: (msg: ChatMessage, question: string) => void;
  isAnswerSaved?: boolean;
}

/** "Saved to memory: …" when this turn remembered or forgot something. */
const MemoryNote: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const e = msg.memoryEvent;
  if (!e || e.type === 'not-found') return null;
  return (
    <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-[var(--teal-soft)] px-3 py-1.5 text-[11.5px] text-[var(--teal)]">
      <Brain size={13} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{e.type === 'saved' ? 'Saved to memory' : 'Removed from memory'}: {e.text}</span>
    </div>
  );
};

/** The "Show citation numbers in answers" setting, kept in sync when it changes in Settings. */
function useShowCitationNumbers(): boolean {
  const [on, setOn] = useState(getShowCitationNumbers);
  useEffect(() => subscribeCitationNumbers(setOn), []);
  return on;
}

const findDocument = (documents: DocumentItem[], ref: { docId: string; docTitle: string }) =>
  documents.find((d) => d.id === ref.docId) || documents.find((d) => d.title.toLowerCase() === ref.docTitle.toLowerCase());

/** At most `max` characters, with an ellipsis if it was cut (here or by the server). */
const shorten = (s: string, max: number) => {
  const cut = /(\.{3}|…)$/.test(s.trim());
  const t = s.trim().replace(/(\.{3}|…)$/, '').trimEnd();
  if (t.length > max) return `${t.slice(0, max - 1).trimEnd()}…`;
  return cut ? `${t}…` : t;
};

export const AssistantAnswer: React.FC<AssistantAnswerProps> = ({
  msg, userPrompt, copiedMsgId, documents, onCopy, onExportPDF,
  onInspectInCanvas, onSelectDocument, onSaveAnswer, isAnswerSaved
}) => {
  const showNumbers = useShowCitationNumbers();
  const citations = useMemo(() => msg.citations || [], [msg.citations]);
  // The server's sources already merge citations and collapse file versions; citations are the fallback for older answers.
  const chips: SourceChip[] = useMemo(() => {
    const seen = new Set<string>();
    return (msg.sources?.length ? msg.sources : citations.map((c) => ({ docId: c.docId, docTitle: c.docTitle })))
      .filter((s) => {
        const key = s.docId || s.docTitle;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [msg.sources, citations]);
  const chipCites = useMemo(() => chipCitations(chips, citations), [chips, citations]);

  const idPrefix = `ans-${String(msg.id).replace(/[^\w-]/g, '')}`;
  const popoverId = `${idPrefix}-sources`;
  const bodyRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const timers = useRef<{ open?: number; close?: number }>({});
  const lastPointer = useRef('');

  // Which chip is highlighting its sentences (hover or keyboard focus; a first tap on touch).
  const [activeChip, setActiveChip] = useState<number | null>(null);
  // The sentence whose sources popover is open. Pinned = opened by click, tap or keyboard.
  const [pop, setPop] = useState<{ id: string; cites: number[]; pinned: boolean; focus: boolean } | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  // Cited sentences as rendered, so each chip can name the sentences it highlights (aria-controls).
  const [sentences, setSentences] = useState<Array<{ id: string; cites: number[] }>>([]);

  useEffect(() => {
    const els = Array.from(bodyRef.current?.querySelectorAll<HTMLElement>('.s87-cited') || []);
    setSentences(els.map((el) => ({ id: el.id, cites: (el.dataset.cites || '').split(' ').map(Number) })));
  }, [msg.text, citations.length]);

  useEffect(() => () => { window.clearTimeout(timers.current.open); window.clearTimeout(timers.current.close); }, []);

  const clearTimers = () => { window.clearTimeout(timers.current.open); window.clearTimeout(timers.current.close); };
  const scheduleClose = () => {
    window.clearTimeout(timers.current.close);
    timers.current.close = window.setTimeout(() => setPop((p) => (p && !p.pinned ? null : p)), 200);
  };
  const sentenceEl = (id: string) => (bodyRef.current?.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null);
  const closePopover = (returnFocus: boolean) => {
    const id = pop?.id;
    clearTimers();
    setPop(null);
    if (returnFocus && id) sentenceEl(id)?.focus();
  };

  const citationUI: CitationUI = {
    showNumbers,
    citationCount: citations.length,
    highlight: activeChip !== null ? chipCites[activeChip] || [] : [],
    idPrefix,
    openId: pop?.id ?? null,
    popoverId,
    onSentenceEnter: (id) => {
      if (pop?.pinned) return;
      clearTimers();
      const cites = (sentenceEl(id)?.dataset.cites || '').split(' ').map(Number);
      timers.current.open = window.setTimeout(() => setPop({ id, cites, pinned: false, focus: false }), 120);
    },
    onSentenceLeave: () => {
      window.clearTimeout(timers.current.open);
      if (!pop?.pinned) scheduleClose();
    },
    onSentenceActivate: (id, cites, viaKeyboard) => {
      clearTimers();
      setPop((p) => (p && p.id === id && p.pinned ? null : { id, cites, pinned: true, focus: viaKeyboard }));
    },
    onSentenceEscape: () => closePopover(true)
  };

  // Place the popover under the line where the sentence ends, kept inside the answer column.
  useLayoutEffect(() => {
    if (!pop) { setPos(null); return; }
    const el = sentenceEl(pop.id);
    const body = bodyRef.current;
    if (!el || !body) { setPos(null); return; }
    const rects = el.getClientRects();
    const last = rects[rects.length - 1] || el.getBoundingClientRect();
    const box = body.getBoundingClientRect();
    const width = Math.min(320, box.width);
    const left = Math.max(0, Math.min(last.left - box.left, box.width - width));
    setPos({ top: last.bottom - box.top + 6, left, width });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pop?.id]);

  useEffect(() => {
    if (pop?.focus && pos) popRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [pop?.focus, pop?.id, pos]);

  // A pinned popover, or a chip highlighted by tap, closes when you tap or click elsewhere.
  useEffect(() => {
    if (!pop?.pinned && activeChip === null) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (pop?.pinned && !popRef.current?.contains(target) && !sentenceEl(pop.id)?.contains(target)) setPop(null);
      if (activeChip !== null && !(target instanceof Element && target.closest(`[data-source-chip="${idPrefix}"]`))) setActiveChip(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pop?.pinned, pop?.id, activeChip, idPrefix]);

  const openSource = (ref: { docId: string; docTitle: string }, fallback?: { docId: string; docTitle: string }, sentence = '', snippet?: string) => {
    const doc = findDocument(documents, ref) || (fallback ? findDocument(documents, fallback) : undefined);
    if (!doc || !onSelectDocument) return;
    const search = sentence ? findSearchPhrase(doc.fullText || doc.contentPreview || '', sentence, snippet) : '';
    onSelectDocument(doc, search ? { search } : undefined);
  };

  // The files behind the open sentence: one entry per chip (versions collapse), in citation order.
  const popEntries = useMemo(() => {
    if (!pop) return [];
    const out: Array<{ key: string; title: string; versions?: number; ref: { docId: string; docTitle: string }; chip?: SourceChip; snippet?: string }> = [];
    for (const n of pop.cites) {
      const c = citations[n - 1];
      if (!c) continue;
      const k = chipCites.findIndex((list) => list.includes(n));
      const chip = k >= 0 ? chips[k] : undefined;
      const key = chip?.docId || c.docId;
      if (out.some((e) => e.key === key)) continue;
      out.push({ key, title: chip?.docTitle || c.docTitle, versions: chip?.versions, ref: { docId: c.docId, docTitle: c.docTitle }, chip, snippet: c.snippet });
    }
    return out;
  }, [pop, citations, chipCites, chips]);

  const popSentence = pop ? (sentenceEl(pop.id)?.textContent || '').replace(/\[\d+\]/g, '') : '';

  return (
    <div className="flex gap-3 sm:gap-4 items-start my-4">
      <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] text-[var(--muted)] flex items-center justify-center flex-shrink-0 mt-1">
        <Signal87Logo size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div ref={bodyRef} className="relative">
          <div data-export-message-id={msg.id}>
            <GeminiMarkdownRenderer text={msg.text} citationUI={citationUI} />
          </div>
          {pop && pos && popEntries.length > 0 && (
            <div
              ref={popRef}
              id={popoverId}
              role="dialog"
              aria-label={popEntries.length === 1 ? 'Source for this sentence' : 'Sources for this sentence'}
              className="s87-cite-pop"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
              onMouseEnter={clearTimers}
              onMouseLeave={() => { if (!pop.pinned) scheduleClose(); }}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); closePopover(true); } }}
              onBlur={(e) => { if (pop.focus && !e.currentTarget.contains(e.relatedTarget as Node)) setPop(null); }}
            >
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{popEntries.length === 1 ? 'Source' : 'Sources'}</div>
              {popEntries.map((entry) => {
                const available = Boolean(onSelectDocument && (findDocument(documents, entry.ref) || (entry.chip && findDocument(documents, entry.chip))));
                return (
                  <div key={entry.key} className="mt-1.5">
                    <button
                      type="button"
                      disabled={!available}
                      onClick={() => openSource(entry.ref, entry.chip, popSentence, entry.snippet)}
                      title={available ? `Open ${entry.title}` : `${entry.title} is not in your files`}
                      className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 -mx-1.5 text-left text-[12.5px] font-medium text-[var(--ink)] hover:bg-[var(--raised)] hover:text-[var(--teal)] disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-[var(--ink)]"
                    >
                      <FileText size={13} className="shrink-0 text-[var(--teal)]" aria-hidden="true" />
                      <span className="truncate">{entry.title}</span>
                      {entry.versions && entry.versions > 1 && <span className="shrink-0 font-normal text-[var(--muted)]">· {entry.versions} versions</span>}
                    </button>
                    {entry.snippet && <p className="mt-0.5 text-[12px] leading-snug text-[var(--muted)]">{shorten(entry.snippet, 120)}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <MemoryNote msg={msg} />
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Sources</span>
            {chips.map((chip, k) => {
              const cites = chipCites[k] || [];
              const controls = sentences.filter((s) => s.cites.some((n) => cites.includes(n))).map((s) => s.id).join(' ');
              return (
                <button
                  key={chip.docId || chip.docTitle}
                  type="button"
                  data-source-chip={idPrefix}
                  aria-controls={controls || undefined}
                  onPointerDown={(e) => { lastPointer.current = e.pointerType; }}
                  onKeyDown={() => { lastPointer.current = 'keyboard'; }}
                  onPointerEnter={(e) => { if (e.pointerType === 'mouse') setActiveChip(k); }}
                  onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActiveChip((a) => (a === k ? null : a)); }}
                  onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setActiveChip(k); }}
                  onBlur={() => setActiveChip((a) => (a === k ? null : a))}
                  onClick={() => {
                    const touch = lastPointer.current === 'touch' || lastPointer.current === 'pen';
                    lastPointer.current = '';
                    // On touch, the first tap shows which sentences this file supports; a second tap opens it.
                    if (touch && controls && activeChip !== k) { setActiveChip(k); return; }
                    openSource(chip);
                  }}
                  title={`Open ${chip.docTitle}`}
                  className={`inline-flex max-w-[260px] items-center gap-1.5 rounded-full border bg-[var(--surface)] px-2.5 py-1 text-[11.5px] transition hover:border-[var(--teal)] hover:text-[var(--teal)] ${activeChip === k && controls ? 'border-[var(--teal)] text-[var(--teal)]' : 'border-[var(--rule)] text-[var(--ink-2)]'}`}
                >
                  <FileText size={12} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">{chip.docTitle}</span>
                  {chip.versions && chip.versions > 1 && <span className="shrink-0 text-[var(--muted)]">· {chip.versions} versions</span>}
                </button>
              );
            })}
          </div>
        )}
        <ActionRouterCard
          msg={msg}
          userPrompt={userPrompt}
          copiedMsgId={copiedMsgId}
          onCopy={onCopy}
          onExportPDF={onExportPDF}
          onInspectInCanvas={onInspectInCanvas}
          onSelectDocument={onSelectDocument}
          documents={documents}
          onSaveAnswer={onSaveAnswer}
          isAnswerSaved={isAnswerSaved}
        />
      </div>
    </div>
  );
};
