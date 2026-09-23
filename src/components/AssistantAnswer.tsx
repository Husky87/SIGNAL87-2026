import React from 'react';
import type { ChatMessage, DocumentItem } from '../types';
import { Signal87Logo } from './Signal87Logo';
import { ActionRouterCard, GeminiMarkdownRenderer } from './ActionRouterComponents';

/** "Searched 142 files · used 4": shows the answer came from a search of the whole workspace. */
const RetrievalNote: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const trace = msg.verificationTrace;
  const searched = trace?.searchedDocuments ?? 0;
  const used = trace?.groundedDocuments ?? 0;
  if (!trace || searched === 0) return null;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const label = trace.retrievalMode === 'search'
    ? `Searched ${plural(searched, 'file')} · used ${plural(used, 'file')}`
    : trace.retrievalMode === 'overview'
      ? `Scanned the opening of ${plural(used, 'file')} out of ${searched}`
      : `Read ${plural(used, 'file')} in full`;
  return (
    <div className="mb-2 flex items-center gap-2 text-[11px] text-[var(--muted)]" aria-label={label}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--teal)]" aria-hidden="true" />
      {label}
    </div>
  );
};

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

export const AssistantAnswer: React.FC<AssistantAnswerProps> = ({
  msg, userPrompt, copiedMsgId, documents, onCopy, onExportPDF,
  onInspectInCanvas, onSelectDocument, onSaveAnswer, isAnswerSaved
}) => (
  <div className="flex gap-3 sm:gap-4 items-start my-4">
    <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] text-[var(--muted)] flex items-center justify-center flex-shrink-0 mt-1">
      <Signal87Logo size={16} />
    </div>
    <div className="flex-1 min-w-0">
      <RetrievalNote msg={msg} />
      <div data-export-message-id={msg.id}>
        <GeminiMarkdownRenderer
          text={msg.text}
          citations={msg.citations}
          onSelectDocument={onSelectDocument}
          documents={documents}
        />
      </div>
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
