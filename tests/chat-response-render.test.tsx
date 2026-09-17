import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssistantAnswer } from '../src/components/AssistantAnswer';
import type { ChatMessage } from '../src/types';

function renderAnswer(text: string) {
  const answer: ChatMessage = { id: 'answer', role: 'assistant', text, timestamp: '10:01', citations: [{ docId: 'source', docTitle: 'Source' }] };
  return renderToStaticMarkup(
    <AssistantAnswer
      msg={answer}
      userPrompt="What is the passphrase?"
      copiedMsgId={null}
      documents={[]}
      onCopy={() => {}}
      onExportPDF={() => {}}
      onInspectInCanvas={() => {}}
    />
  );
}

const answer = renderAnswer('The passphrase is amber harbor 6724 [1].');
assert.match(answer, /amber harbor 6724/, 'the assistant answer must appear in the chat transcript');
assert.match(answer, /data-export-message-id="answer"/, 'export must use the visible answer body');
assert.match(answer, /View: Source/, 'a real citation must remain interactive');
assert.match(renderAnswer('Unable to answer: The request timed out.'), /The request timed out/, 'errors must be visible in the transcript');
console.log('chat response rendering: 4 checks passed');
