import React from 'react';
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
