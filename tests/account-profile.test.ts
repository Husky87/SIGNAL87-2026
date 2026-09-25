/** Optional account profile: cleaning, completion and what Ask receives. */
process.env.OPENAI_API_KEY = 'test-key-not-used';
delete process.env.GEMINI_API_KEY;
process.env.SIGNAL87_TEST_AUTH = '1';
import assert from 'node:assert/strict';
import { cleanProfile, profileCompletion, profileForAsk } from '../src/lib/accountProfile';
import handler from '../api/chat';

const raw = {
  fullName: '  Michael   Benezra ', jobTitle: 'Founder & CEO', role: 'Executive / founder', company: 'Signal87 AI',
  industry: 'Technology', companySize: '2–10', location: 'Boston, MA', phone: '617 555 0100',
  linkedin: 'linkedin.com/in/example', website: 'not a url', useCases: ['Contract review', 'Hacking'], documentTypes: [],
  goals: 'x'.repeat(1500), productUpdates: true
};
const clean = cleanProfile(raw as any);
assert.equal(clean.fullName, 'Michael Benezra', 'whitespace trimmed');
assert.equal(clean.linkedin, 'https://linkedin.com/in/example', 'links get https');
assert.equal(clean.website, undefined, 'invalid links dropped');
assert.deepEqual(clean.useCases, ['Contract review'], 'unknown options dropped');
assert.equal(clean.documentTypes, undefined, 'empty lists dropped');
assert.equal(clean.goals?.length, 1000, 'long text capped');
assert.equal(clean.productUpdates, true);

assert.equal(profileCompletion({}), 0);
assert.equal(profileCompletion(clean), Math.round((9 / 12) * 100), '9 of 12 counted fields filled');

assert.deepEqual(profileForAsk(clean), { jobTitle: 'Founder & CEO', role: 'Executive / founder', company: 'Signal87 AI', industry: 'Technology' }, 'Ask gets role and organisation only');
assert.ok(!('phone' in profileForAsk(clean)), 'contact details never go to Ask');
(async () => {
  let sent: any = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_u: any, init: any) => { sent = JSON.parse(init.body); return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) }; }) as any;
  const res: any = { statusCode: 200, setHeader() {}, status(c: number) { this.statusCode = c; return this; }, json(p: any) { this.payload = p; return this; } };
  try {
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { prompt: 'hi', messages: [{ role: 'user', content: 'hi' }], documents: [], userProfile: { name: 'Michael Benezra', email: 'm@example.com', preferredName: 'Mike', ...profileForAsk(clean), phone: '617' } } } as any, res);
  } finally { globalThis.fetch = realFetch; }
  const system = (sent?.messages || []).filter((m: any) => m.role === 'system').map((m: any) => m.content).join('\n');
  assert.ok(system.includes('Their work: Founder & CEO Executive / founder at Signal87 AI (Technology)'), 'role and company reach the prompt');
  assert.ok(system.includes('by first name (Mike)'), 'preferred name is used');
  assert.ok(!system.includes('617'), 'phone never reaches the prompt');
  console.log('account profile: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
