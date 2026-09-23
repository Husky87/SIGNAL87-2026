/**
 * Prepares everything Ask sends to /api/chat besides the question itself.
 *
 * - Handles "remember …" / "forget …" before the question goes out.
 * - Small workspaces: sends the files whole, as before (the server reads them all).
 * - Larger workspaces: ranks passages from every file here in the browser, using
 *   words plus meaning (embeddings) when the index is ready, and sends only the
 *   best passages. The request stays small however many files there are.
 * - Sends the user's saved memory.
 */
import { hasUsableText } from './extractedText';
import { applyMemoryCommand, loadMemories, MemoryEvent, parseMemoryCommand } from './memoryStore';
import { docText, retrieveContext, RetrievalDoc, RetrievalStats } from './retrieval';
import { semanticScorer } from './semanticIndex';

/** Must match MAX_TOTAL_CONTEXT_CHARS / MAX_DOC_CHARS in api/chat.ts. */
const SEND_WHOLE_BELOW_CHARS = 90000;
const RETRIEVED_BUDGET_CHARS = 80000;
const MAX_DOC_CHARS = 28000;

export interface RetrievedPayload {
  stats: RetrievalStats;
  groups: Array<{ id: string; title: string; total: number; passages: Array<{ index: number; text: string }> }>;
  workspaceFiles: string[];
  /** Files whose text could not be extracted; the answer should say so if asked about them. */
  unreadableFiles: string[];
}

export interface AskPayload {
  documents: RetrievalDoc[];
  retrieved?: RetrievedPayload;
  memories: string[];
  memoryEvent?: MemoryEvent;
}

export async function prepareAsk(options: {
  question: string;
  docs: Array<RetrievalDoc & { id?: string }>;
  previousQuestions: string[];
  profile: { name?: string; email?: string };
}): Promise<AskPayload> {
  let memoryEvent: MemoryEvent | undefined;
  const command = parseMemoryCommand(options.question);
  if (command) {
    try { memoryEvent = await applyMemoryCommand(command); }
    catch (error) { memoryEvent = { type: 'not-found', text: error instanceof Error ? error.message : command.text }; }
  }
  const memories = (await loadMemories()).map((m) => m.text);

  // Files whose extraction failed stay out of the search; the server lists them as unreadable.
  const readable = options.docs.filter((d) => hasUsableText(docText(d)));
  const unreadable = options.docs.filter((d) => !hasUsableText(docText(d)));
  const total = readable.reduce((sum, d) => sum + Math.min(docText(d).length, MAX_DOC_CHARS), 0);
  if (total <= SEND_WHOLE_BELOW_CHARS) {
    return { documents: options.docs, memories, memoryEvent };
  }

  const semanticScore = await semanticScorer(options.question, readable);
  const result = retrieveContext(readable, {
    question: options.question,
    previousQuestions: options.previousQuestions,
    profile: options.profile,
    budgetChars: RETRIEVED_BUDGET_CHARS,
    maxDocChars: MAX_DOC_CHARS,
    semanticScore
  });
  return {
    documents: [],
    retrieved: {
      stats: result.stats,
      groups: result.groups.map((g) => ({
        id: String((g.doc as { id?: string }).id || g.doc.title || ''),
        title: String(g.doc.title || 'Untitled'),
        total: g.total,
        passages: g.passages
      })),
      workspaceFiles: readable.map((d) => String(d.title || 'Untitled')),
      unreadableFiles: unreadable.map((d) => String(d.title || 'Untitled'))
    },
    memories,
    memoryEvent
  };
}
