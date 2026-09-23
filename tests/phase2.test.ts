/**
 * Phase 2: meaning-based ranking, compact vectors, memory commands, and the
 * server accepting passages ranked in the app plus saved memory.
 */
process.env.OPENAI_API_KEY = 'test-key-not-used';
delete process.env.GEMINI_API_KEY;
process.env.SIGNAL87_TEST_AUTH = '1';

import assert from 'node:assert/strict';
import { packVector, unpackVector, packedDot, textFingerprint } from '../src/lib/vectorCodec';
import { retrieveContext } from '../src/lib/retrieval';
import { parseMemoryCommand } from '../src/lib/memoryCommands';
import handler from '../api/chat';

// 1. Packed vectors keep cosine similarity.
{
  const a = Array.from({ length: 512 }, (_, i) => Math.sin(i));
  const norm = Math.hypot(...a);
  const unit = a.map((x) => x / norm);
  const p = unpackVector(packVector(unit));
  assert.ok(Math.abs(packedDot(p, p) - 1) < 0.02, 'self-similarity ≈ 1');
  assert.notEqual(textFingerprint('a'), textFingerprint('b'));
}

// 2. Meaning finds a passage that shares no words with the question.
{
  const filler = Array.from({ length: 30 }, (_, i) => ({ id: `f${i}`, title: `Agreement ${i}`, fullText: Array.from({ length: 120 }, (_, p) => `Clause ${p}: deliveries within thirty days, order ${i}-${p}.`).join('\n\n') }));
  const lender = { id: 'rok', title: 'Term sheet', fullText: 'ROK Financial will provide a bridge facility to the Lodge for its Dorchester property.' };
  const docs = [...filler, lender];
  const question = "Who is financing Harvard St?";
  const wordsOnly = retrieveContext(docs, { question, budgetChars: 90000, maxDocChars: 28000 });
  assert.notEqual(wordsOnly.contextDocs[0]?.id, 'rok', 'word search alone misses it');
  const semanticScore = (d: any) => (d.id === 'rok' ? 0.62 : 0.08);
  const withMeaning = retrieveContext(docs, { question, budgetChars: 90000, maxDocChars: 28000, semanticScore });
  assert.equal(withMeaning.contextDocs[0]?.id, 'rok', 'meaning puts the term sheet first');
  assert.equal(withMeaning.stats.semantic, true);
  assert.equal(withMeaning.groups[0].doc.id, 'rok');
}

// 3. Memory commands: clear imperatives only.
assert.deepEqual(parseMemoryCommand('Remember that Crewstone is our co-GP'), { type: 'remember', text: 'Crewstone is our co-GP' });
assert.deepEqual(parseMemoryCommand('please forget about the Polaris offering'), { type: 'forget', text: 'the Polaris offering' });
assert.equal(parseMemoryCommand('Remember when we discussed the loan?'), null);
assert.equal(parseMemoryCommand('What do you remember about me'), null);

// 4. Server: pre-ranked passages and saved memory reach the model; memory events come back.
async function run(body: any): Promise<{ messages: any[]; payload: any }> {
  let sent: any = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_u: any, init: any) => { sent = JSON.parse(init.body); return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) }; }) as any;
  const res: any = { statusCode: 200, setHeader() {}, status(c: number) { this.statusCode = c; return this; }, json(p: any) { this.payload = p; return this; } };
  try { await handler({ method: 'POST', headers: { authorization: 'Bearer test' }, body } as any, res); } finally { globalThis.fetch = realFetch; }
  return { messages: sent?.messages || [], payload: res.payload };
}
(async () => {
  const { messages, payload } = await run({
    prompt: 'Who is financing Harvard St?',
    messages: [{ role: 'user', content: 'Who is financing Harvard St?' }],
    documents: [],
    retrieved: {
      stats: { mode: 'search', semantic: true, searchedDocuments: 31, searchedPassages: 1201 },
      groups: [{ id: 'rok', title: 'Term sheet', total: 1, passages: [{ index: 0, text: 'ROK Financial will provide a bridge facility.' }] }],
      workspaceFiles: ['Term sheet', 'Agreement 1'],
      unreadableFiles: ['Scan.pdf']
    },
    memories: ['Crewstone is our co-GP on Harvard Street'],
    memoryEvent: { type: 'saved', text: 'Crewstone is our co-GP on Harvard Street' }
  });
  const all = messages.map((m: any) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
  assert.ok(all.includes('--- DOCUMENT 1: Term sheet ---'), 'pre-ranked passage is in the prompt');
  assert.ok(all.includes('ROK Financial will provide a bridge facility.'));
  assert.ok(all.includes('WORKSPACE FILES (2'), 'workspace list is in the prompt');
  assert.ok(all.includes('Scan.pdf'), 'unreadable files are listed');
  assert.ok(all.includes('SAVED MEMORY') && all.includes('Crewstone is our co-GP'), 'saved memory is in the prompt');
  assert.ok(all.includes('JUST NOW'), 'the model is told a memory was just saved');
  assert.equal(payload.verificationTrace.searchedDocuments, 31);
  assert.equal(payload.verificationTrace.semanticSearch, true);
  assert.equal(payload.memoryEvent.type, 'saved');
  console.log('phase 2: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
