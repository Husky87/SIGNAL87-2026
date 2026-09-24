import React from 'react';
import { Brain, FileText } from 'lucide-react';
import type { ChatMessage, DocumentItem } from '../types';
import { Signal87Logo } from './Signal87Logo';
import { ActionRouterCard, GeminiMarkdownRenderer } from './ActionRouterComponents';


interface AssistantAnswerProps {
  msg: ChatMessage;
  userPrompt: string;
  copiedMsgId: string | null;
  documents: DocumentItem[];
  onCopy: (id: string, text: string) => void;
  onExportPDF: (title: string, text: string) => void;
  onInspectInCanvas: (msg: ChatMessage) => void;
  onSelectDocument?: (doc: DocumentItem) => void;
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

/** Clickable source files under an answer, so every answer that used your files shows which ones. */
const SourcesRow: React.FC<{ msg: ChatMessage; documents: DocumentItem[]; onSelectDocument?: (doc: DocumentItem) => void }> = ({ msg, documents, onSelectDocument }) => {
  const seen = new Set<string>();
  // The server's sources already merge citations and collapse file versions; citations are the fallback for older answers.
  const sources: Array<{ docId: string; docTitle: string; versions?: number }> = (msg.sources?.length ? msg.sources : (msg.citations || []).map((c) => ({ docId: c.docId, docTitle: c.docTitle })))
    .filter((s) => {
      const key = s.docId || s.docTitle;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (sources.length === 0) return null;
  const open = (source: { docId: string; docTitle: string; versions?: number }) => {
    const title = source.docTitle.toLowerCase();
    const doc = documents.find((d) => d.id === source.docId) || documents.find((d) => d.title.toLowerCase() === title);
    if (doc && onSelectDocument) onSelectDocument(doc);
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Sources</span>
      {sources.map((source) => (
        <button
          key={source.docId || source.docTitle}
          type="button"
          onClick={() => open(source)}
          title={`Open ${source.docTitle}`}
          className="inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-[var(--rule)] bg-[var(--surface)] px-2.5 py-1 text-[11.5px] text-[var(--ink-2)] transition hover:border-[var(--teal)] hover:text-[var(--teal)]"
        >
          <FileText size={12} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{source.docTitle}</span>
          {source.versions && source.versions > 1 && <span className="shrink-0 text-[var(--muted)]">· {source.versions} versions</span>}
        </button>
      ))}
    </div>
  );
};

export const AssistantAnswer: React.FC<AssistantAnswerProps> = ({
  msg, userPrompt, copiedMsgId, documents, onCopy, onExportPDF,
  onInspectInCanvas, onSelectDocument, onSaveAnswer, isAnswerSaved
}) => (
  <div className="flex gap-3 sm:gap-4 items-start my-4">
    <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] text-[var(--muted)] flex items-center justify-center flex-shrink-0 mt-1">
      <Signal87Logo size={16} />
    </div>
    <div className="flex-1 min-w-0">
      <div data-export-message-id={msg.id}>
        <GeminiMarkdownRenderer
          text={msg.text}
          citations={msg.citations}
          onSelectDocument={onSelectDocument}
          documents={documents}
        />
      </div>
      <MemoryNote msg={msg} />
      <SourcesRow msg={msg} documents={documents} onSelectDocument={onSelectDocument} />
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
