import assert from 'node:assert/strict';
const originalFetch = globalThis.fetch;
const originalEnv = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, GEMINI_API_KEY: process.env.GEMINI_API_KEY, GEMINI_MODEL: process.env.GEMINI_MODEL };
function response(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
function providerOf(url: string) { if (url.includes('api.openai.com')) return 'openai'; if (url.includes('generativelanguage.googleapis.com')) return 'gemini'; return 'unknown'; }
async function run() {
  const service = await import('../src/lib/aiFallbackService.ts'); const calls: Array<{ provider: string; body: any; signal?: AbortSignal }> = [];
  process.env.OPENAI_API_KEY = 'test-openai'; process.env.GEMINI_API_KEY = 'test-gemini'; process.env.GEMINI_MODEL = 'gemini-test';
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => { const url = String(input); const body = init?.body ? JSON.parse(String(init.body)) : {}; calls.push({ provider: providerOf(url), body, signal: init?.signal }); if (url.includes('api.openai.com')) return response(200, { choices: [{ message: { content: 'openai answer' } }] }); throw new Error(`Unexpected provider call: ${url}`); };
  let result = await service.generateWithFallback({ prompt: 'hello', maxOutputTokens: 321, temperature: 0.1 }); assert.equal(result.provider, 'openai'); assert.equal(result.fallbackTriggered, false); assert.deepEqual(calls.map(c => c.provider), ['openai']);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => { const url = String(input); const body = init?.body ? JSON.parse(String(init.body)) : {}; calls.push({ provider: providerOf(url), body, signal: init?.signal }); if (url.includes('api.openai.com')) return response(503, {}); if (url.includes('generativelanguage.googleapis.com')) return response(200, { candidates: [{ content: { parts: [{ text: 'gemini answer' }] } }] }); throw new Error(`Unexpected provider call: ${url}`); };
  calls.length = 0; result = await service.generateWithFallback({ prompt: 'hello' }); assert.equal(result.provider, 'gemini'); assert.equal(result.text, 'gemini answer'); assert.deepEqual(calls.map(c => c.provider), ['openai', 'gemini']); assert.equal(calls[1].body.contents[0].parts[0].text, 'hello');
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => { const url = String(input); calls.push({ provider: providerOf(url), body: init?.body ? JSON.parse(String(init.body)) : {} }); if (url.includes('api.openai.com')) return response(503, {}); if (url.includes('generativelanguage.googleapis.com')) return response(503, {}); throw new Error(`Unexpected provider call: ${url}`); };
  calls.length = 0; result = await service.generateWithFallback({ prompt: 'hello' }); assert.equal(result.provider, 'none'); assert.deepEqual(calls.map(c => c.provider), ['openai', 'gemini']);
  console.log('AI fallback tests passed: OpenAI -> Gemini only.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { globalThis.fetch = originalFetch; for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
