/**
 * Drives the real /api/chat handler and inspects the request body that actually
 * leaves for the model. Every earlier fix in this area verified an intermediate
 * string that was then discarded, so the only assertion worth making is on the
 * outbound payload itself.
 *
 * Gemini is left unconfigured so generateWithFallback goes to the OpenAI path,
 * which builds its request with global fetch — the seam this test intercepts.
 */
process.env.OPENAI_API_KEY = 'test-key-not-used';
delete process.env.GEMINI_API_KEY;

import handler from '../api/chat';

const results: string[] = [];
let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS  ' : 'FAIL  '}${name}${ok ? '' : '\n        -> ' + detail}`);
}

/** Captures the messages array sent to the model for one handler invocation. */
async function capture(body: any): Promise<{ role: string; content: string }[]> {
  let sent: any = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: any, init: any) => {
    sent = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'stubbed answer' } }] })
    };
  }) as any;

  const res: any = {
    statusCode: 200,
    setHeader() {},
    status(c: number) { this.statusCode = c; return this; },
    json(payload: any) { this.payload = payload; return this; }
  };

  try {
    await handler({ method: 'POST', body } as any, res);
  } finally {
    globalThis.fetch = realFetch;
  }

  if (!sent) throw new Error('the handler never called out to a model');
  return sent.messages;
}

const CONTRACT = [
  'MERCOR OFFER LETTER',
  'Dear Michael Benezra,',
  'Start Date: 08/12/2026.',
  'Pay Rate: $70.00 USD per hour.'
].join('\n');

// PDF container bytes — what a failed text extraction leaves behind.
const GARBAGE = [
  '%PDF-1.4',
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
  '4 0 obj<</Length 44/Filter/FlateDecode>>stream',
  'x' + String.fromCharCode(1, 0, 3, 218, 12) + 'endstream endobj'
].join('\n');

/** The composer always sends a history ending with the current question. */
const historyFor = (q: string) => [
  { role: 'user', content: 'hello' },
  { role: 'assistant', content: 'Hi — ask me about your documents.' },
  { role: 'user', content: q }
];

async function run() {
  // 1. The reported bug: an attached document, asked about by name.
  {
    const msgs = await capture({
      prompt: 'What is the date on the Mercor letter?',
      messages: historyFor('What is the date on the Mercor letter?'),
      ingestedFilesData: [
        { fileName: '16efdad145d80672233d99255dec18af3dcbe812.pdf', extractedText: CONTRACT }
      ]
    });
    const whole = msgs.map((m) => m.content).join('\n');
    const last = msgs[msgs.length - 1];

    check('the attached document reaches the model', whole.includes('08/12/2026'), whole.slice(0, 300));
    check('it rides on the final user turn, not an earlier one', last.role === 'user' && last.content.includes('08/12/2026'), `last turn was ${last.role}: ${last.content.slice(0, 200)}`);
    check('the question is still asked', last.content.includes('What is the date on the Mercor letter?'));
    check('the question is asked exactly once', last.content.split('What is the date on the Mercor letter?').length - 1 === 1, `appears ${last.content.split('What is the date on the Mercor letter?').length - 1}x`);
    check('no bare copy of the question trails the grounded turn', !msgs.slice(0, -1).some((m) => m.role === 'user' && m.content.trim() === 'What is the date on the Mercor letter?'));
  }

  // 2. Repository documents travel the same way.
  {
    const msgs = await capture({
      prompt: 'When does it start?',
      messages: historyFor('When does it start?'),
      documents: [{ id: 'doc-1', title: 'Mercor Offer Letter', fullText: CONTRACT }]
    });
    const last = msgs[msgs.length - 1];
    check('repository documents reach the model too', last.content.includes('08/12/2026'), last.content.slice(0, 300));
  }

  // 3. Earlier conversation is preserved, so follow-ups still work.
  {
    const msgs = await capture({
      prompt: 'And the pay rate?',
      messages: historyFor('And the pay rate?'),
      ingestedFilesData: [{ fileName: 'Mercor.pdf', extractedText: CONTRACT }]
    });
    check('prior turns survive for follow-up questions', msgs.some((m) => m.role === 'assistant' && m.content.includes('ask me about your documents')), JSON.stringify(msgs.map((m) => m.role)));
    check('the system instruction is present exactly once', msgs.filter((m) => m.role === 'system').length === 1, JSON.stringify(msgs.map((m) => m.role)));
  }

  // 4. An unreadable attachment is named, not silently dropped.
  {
    const msgs = await capture({
      prompt: 'What is the date on the Mercor letter?',
      messages: historyFor('What is the date on the Mercor letter?'),
      ingestedFilesData: [{ fileName: 'Mercor-scan.pdf', extractedText: GARBAGE }]
    });
    const last = msgs[msgs.length - 1];
    check('unreadable attachments are named to the model', last.content.includes('Mercor-scan.pdf') && last.content.includes('COULD NOT BE READ'), last.content.slice(0, 300));
    check('their container bytes are never presented as text', !last.content.includes('FlateDecode'), last.content.slice(0, 300));
    check('the model is not told the request was empty', !last.content.includes('NO DOCUMENTS ARE AVAILABLE'));
  }

  // 5. With genuinely nothing attached, the model is told so.
  {
    const msgs = await capture({
      prompt: 'What is the date on the Mercor letter?',
      messages: historyFor('What is the date on the Mercor letter?')
    });
    const last = msgs[msgs.length - 1];
    check('a genuinely empty request is declared empty', last.content.includes('NO DOCUMENTS ARE AVAILABLE'), last.content.slice(0, 200));
  }

  // 6. The regression itself: history present must not displace the context.
  {
    const withHistory = await capture({
      prompt: 'What is the date?',
      messages: historyFor('What is the date?'),
      ingestedFilesData: [{ fileName: 'Mercor.pdf', extractedText: CONTRACT }]
    });
    const withoutHistory = await capture({
      prompt: 'What is the date?',
      ingestedFilesData: [{ fileName: 'Mercor.pdf', extractedText: CONTRACT }]
    });
    const grounded = (m: any[]) => m[m.length - 1].content.includes('08/12/2026');
    check('sending a history does not strip the documents', grounded(withHistory) && grounded(withoutHistory), `withHistory=${grounded(withHistory)} withoutHistory=${grounded(withoutHistory)}`);
  }

  console.log(results.join('\n'));
  console.log(failures === 0 ? '\nall checks passed' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('harness error:', e);
  process.exit(1);
});
