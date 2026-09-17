import assert from 'node:assert/strict';
import { requestChat } from '../src/lib/chatClient';

const payload = { prompt: 'What is in the agreement?', documents: [{ id: 'one', fullText: 'The term is one year.' }] };
let sent: { url?: string; authorization?: string; body?: any } = {};

const answer = await requestChat(payload, async () => 'test-token', {
  fetchImpl: (async (url, options) => {
    sent = {
      url: String(url),
      authorization: new Headers(options?.headers).get('Authorization') || undefined,
      body: JSON.parse(String(options?.body))
    };
    return new Response(JSON.stringify({ text: 'The term is one year [1].', citations: [{ docId: 'one', docTitle: 'Agreement' }] }), { status: 200 });
  }) as typeof fetch
});
assert.equal(sent.url, '/api/chat');
assert.equal(sent.authorization, 'Bearer test-token');
assert.deepEqual(sent.body, payload);
assert.equal(answer.citations?.[0]?.docId, 'one');

await assert.rejects(
  requestChat(payload, async () => 'test-token', {
    fetchImpl: (async () => new Response(JSON.stringify({ error: 'Unauthorized', details: 'Expired token' }), { status: 401 })) as typeof fetch
  }),
  /status 401 — Expired token/
);
await assert.rejects(
  requestChat(payload, async () => 'test-token', {
    fetchImpl: (async () => new Response(JSON.stringify({ text: '' }), { status: 200 })) as typeof fetch
  }),
  /empty answer/
);
await assert.rejects(
  requestChat(payload, () => new Promise<string>(() => {}), { tokenTimeoutMs: 5 }),
  /Sign-in timed out/
);
await assert.rejects(
  requestChat(payload, async () => 'test-token', {
    requestTimeoutMs: 5,
    fetchImpl: (async (_url, options) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })) as typeof fetch
  }),
  /answer timed out/
);
console.log('chat client: 5 checks passed');
