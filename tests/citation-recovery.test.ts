import assert from 'node:assert/strict';
import handler from '../api/chat';

process.env.SIGNAL87_TEST_AUTH = '1';
process.env.OPENAI_API_KEY = 'stub';
delete process.env.GEMINI_API_KEY;

const originalFetch = globalThis.fetch;

async function ask(documents: Array<{ id: string; title: string; fullText: string }>) {
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: 'The passphrase is copper sparrow 7319 [1].' } }] })
  })) as typeof fetch;
  const response: any = {
    statusCode: 200,
    setHeader() {},
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; }
  };
  await handler({ method: 'POST', headers: {}, body: { prompt: 'What is the passphrase?', documents } } as any, response);
  assert.equal(response.statusCode, 200);
  return response.body;
}

try {
  const first = { id: 'doc-1', title: 'Uploaded agreement', fullText: 'The passphrase is copper sparrow 7319. This is source text.' };
  const second = { id: 'doc-2', title: 'Other agreement', fullText: 'Another document with enough source text.' };
  const oneSource = await ask([first]);
  assert.equal(oneSource.citations[0]?.docId, first.id, 'single-source marker should identify the real document');
  const ambiguous = await ask([first, second]);
  assert.deepEqual(ambiguous.citations, [], 'ambiguous markers must not invent a source');
  const noSource = await ask([]);
  assert.deepEqual(noSource.citations, [], 'no document must not produce a citation');
  console.log('citation recovery: 3 checks passed');
} finally {
  globalThis.fetch = originalFetch;
  delete process.env.SIGNAL87_TEST_AUTH;
}
