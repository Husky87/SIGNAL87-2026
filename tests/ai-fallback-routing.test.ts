import assert from 'node:assert/strict';

const originalFetch = globalThis.fetch;
const originalEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  XAI_API_KEY: process.env.XAI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GROK_MODEL: process.env.GROK_MODEL
};

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function loadService() {
  return import('../src/lib/aiFallbackService.ts');
}

async function run() {
  const service = await loadService();
  const calls: string[] = [];

  process.env.OPENAI_API_KEY = 'test-openai';
  process.env.GEMINI_API_KEY = 'test-gemini';
  process.env.XAI_API_KEY = 'test-grok';
  process.env.GEMINI_MODEL = 'gemini-test';
  process.env.GROK_MODEL = 'grok-test';

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    const payload = init?.body ? JSON.parse(String(init.body)) : {};

    if (url.includes('api.openai.com')) {
      return response(200, { choices: [{ message: { content: 'openai answer' } }] });
    }
    if (url.includes('generativelanguage.googleapis.com')) {
      return response(200, { candidates: [{ content: { parts: [{ text: 'gemini answer' }] } }] });
    }
    if (url.includes('api.x.ai')) {
      return response(200, { choices: [{ message: { content: 'grok answer' } }] });
    }
    throw new Error(`unexpected URL ${url} ${JSON.stringify(payload)}`);
  };

  calls.length = 0;
  let result = await service.generateWithFallback({ prompt: 'hello' });
  assert.equal(result.provider, 'openai');
  assert.equal(result.fallbackTriggered, false);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /api\.openai\.com/);

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('api.openai.com')) return response(503, { error: 'forced OpenAI failure' });
    if (url.includes('generativelanguage.googleapis.com')) return response(200, { candidates: [{ content: { parts: [{ text: 'gemini answer' }] } }] });
    if (url.includes('api.x.ai')) return response(200, { choices: [{ message: { content: 'grok answer' } }] });
    throw new Error(`unexpected URL ${url}`);
  };
  calls.length = 0;
  result = await service.generateWithFallback({ prompt: 'hello' });
  assert.equal(result.provider, 'gemini');
  assert.equal(result.fallbackTriggered, true);
  assert.equal(result.text, 'gemini answer');
  assert.deepEqual(calls.map((url) => url.includes('openai') ? 'openai' : url.includes('googleapis') ? 'gemini' : 'grok'), ['openai', 'gemini']);

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('api.openai.com')) return response(503, { error: 'forced OpenAI failure' });
    if (url.includes('generativelanguage.googleapis.com')) return response(503, { error: 'forced Gemini failure' });
    if (url.includes('api.x.ai')) return response(200, { choices: [{ message: { content: 'grok answer' } }] });
    throw new Error(`unexpected URL ${url}`);
  };
  calls.length = 0;
  result = await service.generateWithFallback({ prompt: 'hello' });
  assert.equal(result.provider, 'grok');
  assert.equal(result.fallbackTriggered, true);
  assert.equal(result.text, 'grok answer');
  assert.deepEqual(calls.map((url) => url.includes('openai') ? 'openai' : url.includes('googleapis') ? 'gemini' : 'grok'), ['openai', 'gemini', 'grok']);

  process.env.XAI_API_KEY = '';
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return response(url.includes('openai') || url.includes('googleapis') ? 503 : 500, { error: 'forced failure' });
  };
  result = await service.generateWithFallback({ prompt: 'hello' });
  assert.equal(result.provider, 'none');
  assert.match(result.text, /question was \*\*not\*\* answered/);

  console.log('AI fallback routing tests passed: OpenAI -> Gemini -> Grok, plus terminal failure.');
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
