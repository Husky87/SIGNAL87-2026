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

function providerOf(url: string): string {
  if (url.includes('api.openai.com')) return 'openai';
  if (url.includes('generativelanguage.googleapis.com')) return 'gemini';
  if (url.includes('api.x.ai')) return 'grok';
  return 'unknown';
}

async function run() {
  const service = await loadService();
  const calls: Array<{ provider: string; body: any; signal?: AbortSignal }> = [];

  process.env.OPENAI_API_KEY = 'test-openai';
  process.env.GEMINI_API_KEY = 'test-gemini';
  process.env.XAI_API_KEY = 'test-grok';
  process.env.GEMINI_MODEL = 'gemini-test';
  process.env.GROK_MODEL = 'grok-test';

  // 1. OpenAI succeeds: Gemini/Grok must not be called.
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ provider: providerOf(url), body, signal: init?.signal });
    if (url.includes('api.openai.com')) {
      return response(200, { choices: [{ message: { content: 'openai answer' } }] });
    }
    throw new Error(`Unexpected provider call: ${url}`);
  };
  calls.length = 0;
  let result = await service.generateWithFallback({
    prompt: 'hello',
    systemInstruction: 'Be concise',
    maxOutputTokens: 321,
    temperature: 0.1
  });
  assert.equal(result.provider, 'openai');
  assert.equal(result.fallbackTriggered, false);
  assert.equal(result.text, 'openai answer');
  assert.deepEqual(calls.map((c) => c.provider), ['openai']);
  assert.equal(calls[0].body.model, 'gpt-4o');
  assert.equal(calls[0].body.max_tokens, 321);
  assert.equal(calls[0].body.temperature, 0.1);
  assert.equal(calls[0].body.messages[0].role, 'system');

  // 2. OpenAI failure -> Gemini, and Gemini model mapping is respected.
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ provider: providerOf(url), body, signal: init?.signal });
    if (url.includes('api.openai.com')) return response(503, { error: 'forced OpenAI failure' });
    if (url.includes('generativelanguage.googleapis.com')) {
      return response(200, { candidates: [{ content: { parts: [{ text: 'gemini answer' }] } }] });
    }
    throw new Error(`Unexpected provider call: ${url}`);
  };
  calls.length = 0;
  result = await service.generateWithFallback({ prompt: 'hello' });
  assert.equal(result.provider, 'gemini');
  assert.equal(result.fallbackTriggered, true);
  assert.equal(result.text, 'gemini answer');
  assert.deepEqual(calls.map((c) => c.provider), ['openai', 'gemini']);
  assert.match(calls[1].body.contents[0].parts[0].text, /hello/);
  assert.equal(calls[1].body.generationConfig.maxOutputTokens, 1400);

  // 3. OpenAI + Gemini failure -> Grok, with Grok model mapping.
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ provider: providerOf(url), body, signal: init?.signal });
    if (url.includes('api.openai.com')) return response(503, { error: 'forced OpenAI failure' });
    if (url.includes('generativelanguage.googleapis.com')) return response(503, { error: 'forced Gemini failure' });
    if (url.includes('api.x.ai')) return response(200, { choices: [{ message: { content: 'grok answer' } }] });
    throw new Error(`Unexpected provider call: ${url}`);
  };
  calls.length = 0;
  result = await service.generateWithFallback({ prompt: 'hello' });
  assert.equal(result.provider, 'grok');
  assert.equal(result.fallbackTriggered, true);
  assert.equal(result.text, 'grok answer');
  assert.deepEqual(calls.map((c) => c.provider), ['openai', 'gemini', 'grok']);
  assert.equal(calls[2].body.model, 'grok-test');
  assert.equal(calls[2].body.stream, false);

  // 4. Empty OpenAI response -> Gemini.
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ provider: providerOf(url), body, signal: init?.signal });
    if (url.includes('api.openai.com')) return response(200, { choices: [{ message: { content: '' } }] });
    if (url.includes('generativelanguage.googleapis.com')) return response(200, { candidates: [{ content: { parts: [{ text: 'gemini after empty OpenAI' }] } }] });
    throw new Error(`Unexpected provider call: ${url}`);
  };
  calls.length = 0;
  result = await service.generateWithFallback({ prompt: 'hello' });
  assert.equal(result.provider, 'gemini');
  assert.equal(result.text, 'gemini after empty OpenAI');
  assert.deepEqual(calls.map((c) => c.provider), ['openai', 'gemini']);

  // 5. Empty Gemini response -> Grok.
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ provider: providerOf(url), body, signal: init?.signal });
    if (url.includes('api.openai.com')) return response(503, { error: 'forced OpenAI failure' });
    if (url.includes('generativelanguage.googleapis.com')) return response(200, { candidates: [{ content: { parts: [{ text: '' }] } }] });
    if (url.includes('api.x.ai')) return response(200, { choices: [{ message: { content: 'grok after empty Gemini' } }] });
    throw new Error(`Unexpected provider call: ${url}`);
  };
  calls.length = 0;
  result = await service.generateWithFallback({ prompt: 'hello' });
  assert.equal(result.provider, 'grok');
  assert.equal(result.text, 'grok after empty Gemini');
  assert.deepEqual(calls.map((c) => c.provider), ['openai', 'gemini', 'grok']);

  // 6. JSON mode preserves valid JSON fallback behavior.
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ provider: providerOf(url), body, signal: init?.signal });
    if (url.includes('api.openai.com')) return response(503, { error: 'forced OpenAI failure' });
    if (url.includes('generativelanguage.googleapis.com')) {
      return response(200, { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] });
    }
    throw new Error(`Unexpected provider call: ${url}`);
  };
  calls.length = 0;
  result = await service.generateWithFallback({ prompt: 'return JSON', responseMimeType: 'application/json' });
  assert.equal(result.provider, 'gemini');
  assert.equal(result.text, '{"ok":true}');
  assert.equal(calls[0].body.response_format.type, 'json_object');
  assert.equal(calls[1].body.generationConfig.responseMimeType, 'application/json');

  // 7. Timeout aborts the provider call and advances to Gemini.
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ provider: providerOf(url), body, signal: init?.signal });
    if (url.includes('api.openai.com')) {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    }
    if (url.includes('generativelanguage.googleapis.com')) {
      return response(200, { candidates: [{ content: { parts: [{ text: 'gemini after timeout' }] } }] });
    }
    throw new Error(`Unexpected provider call: ${url}`);
  };
  calls.length = 0;
  result = await service.generateWithFallback({ prompt: 'hello', timeoutMs: 5 });
  assert.equal(result.provider, 'gemini');
  assert.equal(result.text, 'gemini after timeout');
  assert.equal(calls[0].signal?.aborted, true);
  assert.deepEqual(calls.map((c) => c.provider), ['openai', 'gemini']);

  // 8. All providers fail -> controlled, explicit no-answer response.
  process.env.XAI_API_KEY = '';
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push({ provider: providerOf(url), body: {}, signal: undefined });
    return response(503, { error: 'forced failure' });
  };
  calls.length = 0;
  result = await service.generateWithFallback({ prompt: 'hello' });
  assert.equal(result.provider, 'none');
  assert.equal(result.modelUsed, 'analysis-unavailable');
  assert.match(result.text, /question was \*\*not\*\* answered/);
  assert.deepEqual(calls.map((c) => c.provider), ['openai', 'gemini']);

  console.log('AI fallback tests passed: OpenAI -> Gemini -> Grok; empty responses; JSON; timeout; terminal failure.');
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
