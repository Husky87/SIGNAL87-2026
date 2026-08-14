/**
 * Answering half of the end-to-end check.
 *
 * Feeds the text produced by the real parser (e2eRead.ts, run in a browser) into
 * the real /api/chat handler and inspects the request that leaves for the model.
 *
 * No provider key is available here, so a stub stands in for the model. It is
 * deliberately not a mock that returns a canned answer: it can only see the
 * payload it is handed, and it must locate the answer inside it. If a fact never
 * reaches the payload, the stub cannot find it and the check fails — which is
 * exactly the failure that produced the invented date and the "no document is
 * attached" reply. What this cannot judge is the quality of a real model's
 * wording; it proves the model is given what it needs, and is given nothing false.
 */
process.env.OPENAI_API_KEY = 'stub';
delete process.env.GEMINI_API_KEY;

import { readFileSync } from 'fs';
import handler from '../api/chat';

const parsed = JSON.parse(
  readFileSync(new URL('./.parsed.json', import.meta.url), 'utf8')
);

let failures = 0;
const log: string[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  log.push(`${ok ? 'PASS  ' : 'FAIL  '}${name}${ok ? '' : '\n        -> ' + detail}`);
};

/** Runs the real handler and returns what the model would have received. */
async function ask(body: any) {
  let sent: any = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_u: any, init: any) => {
    sent = JSON.parse(init.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'stub' } }] }) };
  }) as any;

  const res: any = {
    setHeader() {},
    status(c: number) { this.code = c; return this; },
    json(p: any) { this.payload = p; return this; }
  };
  try {
    await handler({ method: 'POST', body } as any, res);
  } finally {
    globalThis.fetch = realFetch;
  }
  const turns: { role: string; content: string }[] = sent?.messages ?? [];
  return {
    grounded: turns.length ? turns[turns.length - 1].content : '',
    turns,
    citations: res.payload?.citations ?? []
  };
}

const history = (q: string) => [
  { role: 'user', content: 'hi' },
  { role: 'assistant', content: 'Ask me about your documents.' },
  { role: 'user', content: q }
];

const contract = { fileName: 'Mercor Offer Letter.pdf', extractedText: parsed.pdf, summaryInfo: '1 page' };
const invoices = { id: 'doc-csv', title: 'Invoices.csv', fullText: parsed.csv };
const clauses = { id: 'doc-xlsx', title: 'Clauses.xlsx', fullText: parsed.xlsx };

/**
 * The stub "model": finds an answer only in what it was given.
 * `wrong` lists values that must NOT be presented as evidence.
 */
async function question(
  q: string,
  body: any,
  expect: RegExp,
  wrong: RegExp[] = []
) {
  const { grounded } = await ask({ prompt: q, messages: history(q), ...body });
  const found = expect.test(grounded);
  check(`Q: ${q}`, found, found ? '' : `answer not in payload. payload head: ${grounded.slice(0, 220)}`);
  for (const w of wrong) {
    check(`   …and no false value matching ${w}`, !w.test(grounded), `payload contained ${w}`);
  }
}

async function run() {
  // ---- Factual lookups against the parsed PDF ----
  await question('What is the start date?', { ingestedFilesData: [contract] }, /08\/12\/2026/, [/08\/12\/2025/, /12\/08\/2026/]);
  await question('What is the pay rate?', { ingestedFilesData: [contract] }, /\$70\.00/, [/\$75/, /\$65/]);
  await question('Who is the letter addressed to?', { ingestedFilesData: [contract] }, /Michael Benezra/);
  await question('What law governs?', { ingestedFilesData: [contract] }, /Delaware/, [/California/, /New York/]);
  await question('What is the notice period?', { ingestedFilesData: [contract] }, /14 days/, [/30 days/]);
  await question('How long does confidentiality last?', { ingestedFilesData: [contract] }, /three \(3\) years/);
  await question('What is the weekly commitment?', { ingestedFilesData: [contract] }, /20 hours per week/);

  // ---- Repository documents, not just attachments ----
  await question('What is invoice INV-1002 for?', { documents: [invoices] }, /1875\.50/);
  await question('Which clause is high risk?', { documents: [clauses] }, /Termination/);

  // ---- A question spanning several documents at once ----
  await question(
    'Compare the contract, the invoices and the clause list.',
    { ingestedFilesData: [contract], documents: [invoices, clauses] },
    /08\/12\/2026/
  );
  {
    const { grounded } = await ask({
      prompt: 'Compare them.',
      messages: history('Compare them.'),
      ingestedFilesData: [contract],
      documents: [invoices, clauses]
    });
    check('every document in a multi-doc question is present',
      /08\/12\/2026/.test(grounded) && /1875\.50/.test(grounded) && /Indemnity/.test(grounded),
      grounded.slice(0, 250));
  }

  // ---- Follow-up questions keep both the thread and the documents ----
  {
    const turns = [
      { role: 'user', content: 'What is the start date?' },
      { role: 'assistant', content: 'The start date is 08/12/2026.' },
      { role: 'user', content: 'And the pay rate?' }
    ];
    const { grounded, turns: sentTurns } = await ask({
      prompt: 'And the pay rate?',
      messages: turns,
      ingestedFilesData: [contract]
    });
    check('a follow-up still carries the document', /\$70\.00/.test(grounded), grounded.slice(0, 200));
    check('a follow-up still carries the earlier answer',
      sentTurns.some((t) => t.role === 'assistant' && t.content.includes('08/12/2026')),
      JSON.stringify(sentTurns.map((t) => t.role)));
  }

  // ---- Honest failure: a document that could not be read ----
  {
    const { grounded, citations } = await ask({
      prompt: 'What is the start date?',
      messages: history('What is the start date?'),
      ingestedFilesData: [{ fileName: 'Corrupt.pdf', extractedText: parsed.broken }]
    });
    check('an unreadable file is named to the model', /Corrupt\.pdf/.test(grounded) && /COULD NOT BE READ/.test(grounded), grounded.slice(0, 220));
    check('an unreadable file is not called absent', !/NO DOCUMENTS ARE AVAILABLE/.test(grounded));
    check('an unreadable file is not cited as a source', citations.length === 0, JSON.stringify(citations));
  }

  // ---- Honest failure: genuinely nothing sent ----
  {
    const { grounded, citations } = await ask({
      prompt: 'What is the start date?',
      messages: history('What is the start date?')
    });
    check('an empty request is declared empty', /NO DOCUMENTS ARE AVAILABLE/.test(grounded), grounded.slice(0, 200));
    check('an empty request cites nothing', citations.length === 0, JSON.stringify(citations));
  }

  // ---- A readable and an unreadable file together ----
  {
    const { grounded, citations } = await ask({
      prompt: 'What is the start date?',
      messages: history('What is the start date?'),
      ingestedFilesData: [contract, { fileName: 'Corrupt.pdf', extractedText: parsed.broken }]
    });
    check('the good file still answers when a bad one is present', /08\/12\/2026/.test(grounded));
    check('the bad file is still named', /Corrupt\.pdf/.test(grounded));
    check('only the readable file is cited',
      citations.length === 1 && citations[0].docTitle === 'Mercor Offer Letter.pdf',
      JSON.stringify(citations));
  }

  // ---- Grounding instructions actually reach the model ----
  {
    const { turns } = await ask({
      prompt: 'What is the start date?',
      messages: history('What is the start date?'),
      ingestedFilesData: [contract]
    });
    const system = turns.find((t) => t.role === 'system')?.content ?? '';
    check('the model is told never to answer from prior knowledge', /never fall back on prior knowledge/i.test(system));
    check('the model is told not to invent confidence or page refs', /Never state a confidence level/i.test(system));
    check('the model is told to match answer length to the question', /ANSWER LENGTH/.test(system));
  }

  // ---- Nothing fabricated on the way back out ----
  {
    const { citations } = await ask({
      prompt: 'What is the start date?',
      messages: history('What is the start date?'),
      ingestedFilesData: [contract]
    });
    check('citations name the real document', citations[0]?.docTitle === 'Mercor Offer Letter.pdf', JSON.stringify(citations));
    check('citations carry no invented page reference', citations.every((c: any) => c.paragraphRef === undefined), JSON.stringify(citations));
    check('citations carry no invented confidence score', citations.every((c: any) => c.confidence === undefined), JSON.stringify(citations));
  }

  console.log(log.join('\n'));
  console.log(failures === 0 ? `\nanswering: all ${log.length} checks passed` : `\nanswering: ${failures} FAILED of ${log.length}`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => { console.error('harness error:', e); process.exit(1); });
