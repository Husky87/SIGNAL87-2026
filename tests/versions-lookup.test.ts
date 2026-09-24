/**
 * Versions of one file, quick lookups and answer style.
 */
process.env.OPENAI_API_KEY = 'test-key-not-used';
delete process.env.GEMINI_API_KEY;
process.env.SIGNAL87_TEST_AUTH = '1';

import assert from 'node:assert/strict';
import { isQuickLookup, retrieveContext, versionStem } from '../src/lib/retrieval';
import handler from '../api/chat';

// 1. File names that are versions of one another.
assert.equal(versionStem('Resume, Michael Benezra.docx-2.pdf'), 'resume michael benezra');
assert.equal(versionStem('Resume, Michael Benezra.docx'), 'resume michael benezra');
assert.equal(versionStem('Lease_2024_FINAL (1).pdf'), 'lease 2024');
assert.notEqual(versionStem('Lease A.pdf'), versionStem('Loan A.pdf'));

// 2. Quick lookups vs. real analysis.
for (const q of ["What's Sarah Cohen's birthday?", 'Mason EIN?', 'When does the Harbor lease expire?', "What is John's address"]) assert.ok(isQuickLookup(q), q);
assert.notEqual(versionStem('2024 K1 Mason.pdf'), versionStem('2025 K1 Mason.pdf'), 'different tax years are different documents');
for (const q of ['Who is Michael Benezra?', 'What is Signal87?', 'Compare the two loan offers', 'Summarize everything about Mount Horeb', 'What are the biggest risks in the Harvard Street financing and how should I prepare?']) assert.ok(!isQuickLookup(q), q);

// 3. Retrieval: "birthday" finds "Date of Birth", and résumé versions collapse to the newest.
const filler = Array.from({ length: 30 }, (_, i) => ({ id: `f${i}`, title: `Agreement ${i}`, uploadDate: '2026-01-01', fullText: Array.from({ length: 120 }, (_, p) => `Clause ${p}: deliveries within thirty days, order ${i}-${p}.`).join('\n\n') }));
const app = { id: 'app', title: 'Cohen_Application.pdf', uploadDate: '2026-05-01', fullText: 'Applicant: Sarah Cohen. Date of Birth: 03/14/1980. Citizenship: USA.' };
const oldCv = { id: 'cv1', title: 'Resume, Michael Benezra.docx', uploadDate: '2024-02-01', fullText: 'Michael Benezra. Director of Innovation, Israeli Ministry of Foreign Affairs, 2017-2020. Founder, Signal87 AI.' };
const newCv = { id: 'cv2', title: 'Resume, Michael Benezra.docx-2.pdf', uploadDate: '2026-08-01', fullText: 'Michael Benezra. Consul of Innovation and Economic Affairs, Israeli Ministry of Foreign Affairs, 2017-2020. Founder, Signal87 AI.' };
const docs = [...filler, app, oldCv, newCv];
{
  const r = retrieveContext(docs, { question: "What's Sarah Cohen's birthday?", budgetChars: 16000, maxDocChars: 28000 });
  assert.equal(r.contextDocs[0]?.id, 'app', 'birthday finds Date of Birth');
}
{
  const r = retrieveContext(docs, { question: 'Who is Michael Benezra?', budgetChars: 80000, maxDocChars: 28000 });
  const latest = r.groups.find((g) => g.doc.id === 'cv2');
  const older = r.groups.find((g) => g.doc.id === 'cv1');
  assert.equal(latest?.versionCount, 2, 'newest résumé is marked as the latest of 2');
  assert.equal(older?.olderVersionOf, 'Resume, Michael Benezra.docx-2.pdf', 'older résumé is labelled as older (it says something different)');
  assert.ok(r.text.includes('LATEST of 2 versions') && r.text.includes('OLDER VERSION of'), 'labels reach the prompt');
}

// 4. Server: quick-lookup and Direct instructions; version chips collapse.
async function run(body: any, reply: string) {
  let sent: any = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_u: any, init: any) => { sent = JSON.parse(init.body); return { ok: true, json: async () => ({ choices: [{ message: { content: reply } }] }) }; }) as any;
  const res: any = { statusCode: 200, setHeader() {}, status(c: number) { this.statusCode = c; return this; }, json(p: any) { this.payload = p; return this; } };
  try { await handler({ method: 'POST', headers: { authorization: 'Bearer test' }, body } as any, res); } finally { globalThis.fetch = realFetch; }
  const system = (sent?.messages || []).filter((m: any) => m.role === 'system').map((m: any) => m.content).join('\n');
  return { system, payload: res.payload, maxTokens: sent?.max_tokens ?? sent?.max_completion_tokens };
}
(async () => {
  const lookup = await run({ prompt: "What's Sarah Cohen's birthday?", messages: [{ role: 'user', content: "What's Sarah Cohen's birthday?" }], documents: [app] }, 'March 14, 1980 (from Cohen_Application.pdf)');
  assert.ok(lookup.system.includes('QUICK LOOKUP'), 'quick lookup instruction sent');
  assert.equal(lookup.payload.verificationTrace.quickLookup, true);

  const direct = await run({ prompt: 'Who is Michael Benezra?', messages: [{ role: 'user', content: 'Who is Michael Benezra?' }], documents: [app], answerStyle: 'direct' }, 'x');
  assert.ok(direct.system.includes('STYLE: DIRECT'), 'direct style instruction sent');
  const conv = await run({ prompt: 'Who is Michael Benezra?', messages: [{ role: 'user', content: 'Who is Michael Benezra?' }], documents: [app] }, 'x');
  assert.ok(!conv.system.includes('STYLE: DIRECT'), 'conversational by default');

  const chips = await run({
    prompt: 'Who is Michael Benezra?', messages: [{ role: 'user', content: 'Who is Michael Benezra?' }], documents: [],
    retrieved: {
      stats: { mode: 'search', searchedDocuments: 33 },
      groups: [
        { id: 'cv2', title: newCv.title, total: 1, versionCount: 2, familyId: 'cv2', passages: [{ index: 0, text: newCv.fullText }] },
        { id: 'cv1', title: oldCv.title, total: 1, olderVersionOf: newCv.title, familyId: 'cv2', passages: [{ index: 0, text: oldCv.fullText }] }
      ],
      workspaceFiles: [newCv.title, oldCv.title], unreadableFiles: []
    }
  }, 'Michael Benezra founded Signal87 AI and served at the Israeli Ministry of Foreign Affairs as Consul of Innovation [1][2].\n```citation_manifest\n[{"marker":"[1]","source":"DOCUMENT 1"},{"marker":"[2]","source":"DOCUMENT 2"}]\n```');
  assert.equal(chips.payload.sources.length, 1, 'two versions collapse into one chip');
  assert.equal(chips.payload.sources[0].docId, 'cv2');
  assert.equal(chips.payload.sources[0].versions, 2);
  console.log('versions and lookups: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
