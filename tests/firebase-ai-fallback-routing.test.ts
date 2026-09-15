import assert from 'node:assert/strict';
const originalFetch = globalThis.fetch;
const originalEnv = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, GEMINI_API_KEY: process.env.GEMINI_API_KEY };
function response(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
function providerOf(url: string) { if (url.includes('api.openai.com')) return 'openai'; if (url.includes('generativelanguage.googleapis.com')) return 'gemini'; return 'unknown'; }
async function run() {
  const service = await import('../functions/src/lib/aiFallbackService.ts'); const calls: string[] = [];
  process.env.OPENAI_API_KEY = 'test-openai'; process.env.GEMINI_API_KEY = 'test-gemini';
  globalThis.fetch = async (input: RequestInfo | URL) => { const url = String(input); calls.push(url); if (url.includes('api.openai.com')) return response(503, {}); if (url.includes('generativelanguage.googleapis.com')) return response(200, { candidates: [{ content: { parts: [{ text: 'gemini answer' }] } }] }); throw new Error(`Unexpected provider: ${url}`); };
  let result = await service.generateWithFallback({ prompt: 'hello' }); assert.equal(result.provider, 'gemini'); assert.equal(result.text, 'gemini answer'); assert.deepEqual(calls.map(providerOf), ['openai', 'gemini']);
  process.env.GEMINI_API_KEY = '';
  globalThis.fetch = async (input: RequestInfo | URL) => { const url = String(input); calls.push(url); return response(503, {}); };
  calls.length = 0; result = await service.generateWithFallback({ prompt: 'hello' }); assert.equal(result.provider, 'none'); assert.deepEqual(calls.map(providerOf), ['openai']);
  console.log('Firebase AI fallback routing tests passed: OpenAI -> Gemini only.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { globalThis.fetch = originalFetch; for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
