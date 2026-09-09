import assert from 'node:assert/strict';

const originalFetch = globalThis.fetch;
const originalEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  XAI_API_KEY: process.env.XAI_API_KEY
};

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function providerOf(url: string): string {
  if (url.includes('api.openai.com')) return 'openai';
  if (url.includes('generativelanguage.googleapis.com')) return 'gemini';
  if (url.includes('api.x.ai')) return 'grok';
  return 'unknown';
}

async function run() {
  const service = await import('../functions/src/lib/aiFallbackService.ts');
  const calls: string[] = [];
  process.env.OPENAI_API_KEY = 'test-openai';
  process.env.GEMINI_API_KEY = 'test-gemini';
  process.env.XAI_API_KEY = 'test-grok';

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('api.openai.com')) return response(503, { error: 'forced OpenAI failure' });
    if (url.includes('generativelanguage.googleapis.com')) return response(200, { candidates: [{ content: { parts: [{ text: 'gemini answer' }] } }] });
    if (url.includes('api.x.ai')) return response(200, { choices: [{ message: { content: 'grok answer' } }] });
    throw new Error(`Unexpected provider: ${url}`);
  };

  let result = await service.generateWithFallback({ prompt: 'hello' });
  assert.equal(result.provider, 'gemini');
  assert.equal(result.text, 'gemini answer');
  assert.deepEqual(calls.map(providerOf), ['openai', 'gemini']);

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('api.openai.com')) return response(503, { error: 'forced OpenAI failure' });
    if (url.includes('generativelanguage.googleapis.com')) return response(503, { error: 'forced Gemini failure' });
    if (url.includes('api.x.ai')) return response(200, { choices: [{ message: { content: 'grok answer' } }] });
    throw new Error(`Unexpected provider: ${url}`);
  };
  calls.length = 0;
  result = await service.generateWithFallback({ prompt: 'hello' });
  assert.equal(result.provider, 'grok');
  assert.equal(result.text, 'grok answer');
  assert.deepEqual(calls.map(providerOf), ['openai', 'gemini', 'grok']);

  process.env.GEMINI_API_KEY = '';
  process.env.XAI_API_KEY = '';
  globalThis.fetch = async () => response(503, { error: 'forced OpenAI failure' });
  calls.length = 0;
  result = await service.generateWithFallback({ prompt: 'hello' });
  assert.equal(result.provider, 'none');
  assert.match(result.text, /question was \*\*not\*\* answered/);

  console.log('Firebase AI fallback routing tests passed.');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
