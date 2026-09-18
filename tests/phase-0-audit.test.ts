/**
 * Phase 0 audit baseline regression suite (docs/phase-0-audit.md, section 4).
 *
 * Diagnostic only: this file must not be edited to make failing cases pass.
 * It runs against the EXISTING, unmodified api/chat.ts and api/research.ts
 * handlers and records what they actually do today, so a later Phase 0 fix
 * can be proven against this baseline without also proving it broke
 * something else.
 *
 * No provider key is available in this environment, so — following the same
 * pattern already used by tests/citation-recovery.test.ts and
 * tests/answering.e2e.ts — the outbound model call is stubbed and the test
 * inspects the actual request payload the handler built. That payload
 * construction (what text reaches the prompt, what gets silently dropped)
 * is exactly the layer under audit; it does not require a real model to
 * observe honestly.
 */
process.env.SIGNAL87_TEST_AUTH = '1';
process.env.OPENAI_API_KEY = 'stub';
delete process.env.GEMINI_API_KEY;

import chatHandler from '../api/chat';
import researchHandler from '../api/research';
import { hasUsableText, looksLikeBinary } from '../src/lib/extractedText';
import {
  rocklandTrustMarch,
  rocklandTrustApril,
  rocklandTrustMay,
  mtHorebLease,
  fillerDocument,
  rocklandTrustAttachment,
  scannedDocEmptyExtraction,
  scannedDocPdfBinaryNoise,
  scannedDocWhitespaceOnly
} from './fixtures/phase-0-audit/synthetic-documents';

type Result = { id: string; category: string; name: string; pass: boolean; detail: string };
const results: Result[] = [];
function check(category: string, id: string, name: string, pass: boolean, detail = '') {
  results.push({ id, category, name, pass, detail });
}

/** Stubs the outbound model call and returns the exact payload the handler sent, plus the response. */
async function invoke(handler: any, body: any) {
  let sentBody: any = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: any, init: any) => {
    if (typeof url === 'string' && url.includes('api.openai.com')) {
      sentBody = JSON.parse(init.body);
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'Stubbed model response [citation_manifest below].\n\n```citation_manifest\n[]\n```' } }] }) } as any;
    }
    return realFetch(url, init);
  }) as any;

  const res: any = {
    statusCode: 200,
    setHeader() {},
    status(c: number) { this.statusCode = c; return this; },
    json(p: any) { this.payload = p; return this; }
  };
  try {
    await handler({ method: 'POST', headers: {}, body } as any, res);
  } finally {
    globalThis.fetch = realFetch;
  }
  const promptText = (sentBody?.messages || []).map((m: any) => m.content).join('\n---\n');
  return { promptText, response: res.payload, statusCode: res.statusCode };
}

async function main() {
  // ── Category A: the reported Verizon / Rockland Trust bug class ──────────

  {
    // A1 — reproduces the reported bug end-to-end: the Rockland Trust
    // statement is real, readable, and included in the request, but four
    // larger documents ahead of it in the array consume the entire 90,000
    // char budget (MAX_TOTAL_CONTEXT_CHARS, api/chat.ts) before it is
    // reached. This is the mechanism — not mis-parsing, not an unreadable
    // file, just array position relative to a hard character ceiling.
    const fillers = [1, 2, 3, 4].map((n) => fillerDocument(`doc-filler-${n}`, `Unrelated Filing ${n}.pdf`, 28000));
    const documents = [...fillers, rocklandTrustMarch];
    const { promptText, response } = await invoke(chatHandler, {
      prompt: 'How much was spent on Verizon in the Rockland Trust statements?',
      documents
    });
    const needleReachedModel = promptText.includes('VERIZON WIRELESS PAYMENT');
    const omittedNoticePresent = promptText.includes('DOCUMENTS OMITTED FOR LENGTH') && promptText.includes(rocklandTrustMarch.title);
    check('A', 'A1a', 'chat.ts: omission of the Rockland Trust doc is disclosed to the model (post-fix)', omittedNoticePresent,
      omittedNoticePresent ? '' : 'Expected a "DOCUMENTS OMITTED FOR LENGTH" section naming the dropped document; not found.');
    check('A', 'A1b', 'chat.ts: the Verizon figure itself still reaches the model', needleReachedModel,
      needleReachedModel ? '' : 'KNOWN LIMITATION: the document is honestly disclosed as omitted (A1a) but its content never reaches the model, so the question still cannot be answered. This is the retrieval gap Phase 0/1 must close.');
    check('A', 'A1c', 'chat.ts: response is HTTP 200 (fails softly, not with an error)', response?.text !== undefined, '');
  }

  {
    // A2 — same construction against api/research.ts, which does not carry
    // the omission-notice fix applied to api/chat.ts. Confirms the same
    // architectural bug is un-mitigated on a second, still-live endpoint.
    const fillers = [1, 2, 3, 4, 5].map((n) => fillerDocument(`doc-filler-r${n}`, `Unrelated Filing ${n}.pdf`, 28000));
    const documents = [...fillers, rocklandTrustMarch];
    const { promptText } = await invoke(researchHandler, {
      researchGoal: 'How much was spent on Verizon in the Rockland Trust statements?',
      documents
    });
    const needleReachedModel = promptText.includes('VERIZON WIRELESS PAYMENT');
    const anyDisclosure = /omit|dropped|could not be included|truncat/i.test(promptText.replace('[Context truncated by server limit]', ''));
    check('A', 'A2a', 'research.ts: the Verizon figure does not reach the model (same bug class)', !needleReachedModel,
      !needleReachedModel ? '' : 'Expected the needle to be excluded given the budget-exhausting fillers; it was present instead.');
    check('A', 'A2b', 'research.ts: unlike chat.ts, the drop is completely silent (no disclosure at all)', !anyDisclosure,
      anyDisclosure ? 'Expected no acknowledgement of the dropped document; found disclosure language.' : '');
  }

  {
    // A3 — identical document set as A1, only the array order changes.
    // Proves the failure is purely positional (order the client happened to
    // attach documents in), not a relevance/ranking decision.
    const fillers = [1, 2, 3, 4].map((n) => fillerDocument(`doc-filler-ord-${n}`, `Unrelated Filing ${n}.pdf`, 28000));
    const documents = [rocklandTrustMarch, ...fillers]; // needle FIRST this time
    const { promptText } = await invoke(chatHandler, {
      prompt: 'How much was spent on Verizon in the Rockland Trust statements?',
      documents
    });
    const needleReachedModel = promptText.includes('VERIZON WIRELESS PAYMENT');
    check('A', 'A3', 'chat.ts: moving the SAME document earlier in the array makes it answerable', needleReachedModel,
      needleReachedModel ? '' : 'The needle should reach the model once it is first in the array — if not, something else is wrong.');
  }

  // ── Category B: multi-document, near/beyond the size ceiling ─────────────

  {
    // B1 — comfortably under the 90,000 char budget: nothing should be lost.
    const documents = [fillerDocument('doc-b1-1', 'Filing A.pdf', 20000), fillerDocument('doc-b1-2', 'Filing B.pdf', 20000), rocklandTrustMarch];
    const { promptText } = await invoke(chatHandler, { prompt: 'Verizon spend?', documents });
    const allPresent = promptText.includes('VERIZON WIRELESS PAYMENT') && promptText.includes('Filing A.pdf') && promptText.includes('Filing B.pdf');
    check('B', 'B1', 'chat.ts: well under budget — all documents included, nothing omitted', allPresent, allPresent ? '' : 'Expected all three documents present.');
  }

  {
    // B2 — comfortably over budget: verify the cutoff lands where arithmetic
    // says it should (first four ~28,000-char docs alone exceed 90,000) and
    // that everything after the cutoff is named in the omission notice.
    const fillers = [1, 2, 3, 4].map((n) => fillerDocument(`doc-b2-${n}`, `Filing ${n}.pdf`, 28000));
    const documents = [...fillers, rocklandTrustMarch, mtHorebLease];
    const { promptText } = await invoke(chatHandler, { prompt: 'Verizon spend and rent?', documents });
    const firstThreeIncluded = ['Filing 1.pdf', 'Filing 2.pdf', 'Filing 3.pdf'].every((t) => promptText.includes(t));
    const laterTwoOmitted = promptText.includes('DOCUMENTS OMITTED FOR LENGTH') && promptText.includes(rocklandTrustMarch.title) && promptText.includes(mtHorebLease.title);
    check('B', 'B2', 'chat.ts: cutoff point matches the 90,000 char budget arithmetic', firstThreeIncluded && laterTwoOmitted,
      `firstThreeIncluded=${firstThreeIncluded}, laterTwoOmitted=${laterTwoOmitted}`);
  }

  {
    // B3 — many SMALL documents (a realistic "12 months of statements plus
    // notes" library) that together stay well under budget: confirms the
    // ceiling is genuinely about total characters, not document count.
    const documents = Array.from({ length: 40 }, (_, i) => fillerDocument(`doc-b3-${i}`, `Small Note ${i}.pdf`, 1000));
    documents.push(rocklandTrustMarch);
    const { promptText } = await invoke(chatHandler, { prompt: 'Verizon spend?', documents });
    const allPresent = promptText.includes('VERIZON WIRELESS PAYMENT') && promptText.includes('Small Note 0.pdf') && promptText.includes('Small Note 39.pdf');
    check('B', 'B3', 'chat.ts: 41 small documents (41,000 chars total) all fit', allPresent, allPresent ? '' : 'Expected all 41 documents present under the 90,000 char budget.');
  }

  {
    // B4 — documents and ingestedFilesData (the second, parallel attachment
    // pathway) share ONE character budget in api/chat.ts. Confirm an
    // attachment can be starved out by documents alone, silently apart from
    // the omission notice.
    const fillers = [1, 2, 3, 4].map((n) => fillerDocument(`doc-b4-${n}`, `Filing ${n}.pdf`, 28000));
    const attachment = rocklandTrustAttachment('Rockland Trust Statement - June.pdf', '184.22', '06/14');
    const { promptText } = await invoke(chatHandler, {
      prompt: 'Verizon spend in June?',
      documents: fillers,
      ingestedFilesData: [attachment]
    });
    const attachmentDropped = !promptText.includes('VERIZON WIRELESS PAYMENT');
    const disclosed = promptText.includes('DOCUMENTS OMITTED FOR LENGTH') && promptText.includes(attachment.fileName);
    check('B', 'B4', 'chat.ts: an attached (not library) document can be starved by documents[] alone, but is disclosed', attachmentDropped && disclosed,
      `attachmentDropped=${attachmentDropped}, disclosed=${disclosed}`);
  }

  {
    // B5 — research.ts: documents and attachments share ONE remainingChars
    // pool (api/research.ts:108,114,130) with NO disclosure mechanism at
    // all. Confirms the same cross-pathway starvation, fully silent.
    const fillers = [1, 2, 3, 4, 5].map((n) => fillerDocument(`doc-b5-${n}`, `Filing ${n}.pdf`, 28000));
    const attachment = rocklandTrustAttachment('Rockland Trust Statement - July.pdf', '184.22', '07/14');
    const { promptText } = await invoke(researchHandler, {
      researchGoal: 'Verizon spend in July?',
      documents: fillers,
      ingestedFilesData: [attachment]
    });
    const attachmentDropped = !promptText.includes('VERIZON WIRELESS PAYMENT');
    const disclosed = /omit|dropped|could not be included/i.test(promptText);
    check('B', 'B5', 'research.ts: attachment starved by documents[], zero disclosure', attachmentDropped && !disclosed,
      `attachmentDropped=${attachmentDropped}, disclosed=${disclosed}`);
  }

  {
    // B6 — api/compare.ts applies NO length limit at all (confirmed by
    // reading the file: no MAX_* constant, no slice/truncate call). This is
    // a different failure mode — an oversized request sent whole to the
    // model rather than silently trimmed — recorded here for completeness.
    // We only assert the code path we can observe deterministically: that
    // the full, untruncated text of a large document reaches the prompt,
    // which is what would risk exceeding the real model's context window
    // in production once documents are large enough.
    const compareHandler = (await import('../api/compare')).default;
    const big = fillerDocument('doc-b6-big', 'Very Large Filing.pdf', 150000);
    const { promptText } = await invoke(compareHandler, { documents: [big, mtHorebLease] });
    const fullTextPresent = promptText.length > 150000;
    check('B', 'B6', 'compare.ts: no length ceiling exists — full 150,000-char document is sent whole', fullTextPresent,
      fullTextPresent ? 'Confirms unbounded concatenation; a different risk (oversized request) than the silent-drop bug above.' : 'Expected the full document to pass through untouched.');
  }

  // ── Category C: control group — should already work today ────────────────

  {
    const { promptText, response } = await invoke(chatHandler, {
      prompt: 'What is the monthly rent?',
      documents: [mtHorebLease]
    });
    const factPresent = promptText.includes('$4,200.00');
    check('C', 'C1', 'chat.ts: single small document, simple fact reaches the model', factPresent, factPresent ? '' : 'Expected rent figure in prompt.');
    check('C', 'C1-citation', 'chat.ts: response returns without error for a trivial case', Array.isArray(response?.citations), '');
  }

  {
    const attachment = rocklandTrustAttachment('Rockland Trust Statement - August.pdf', '199.10', '08/14');
    const { promptText } = await invoke(chatHandler, {
      prompt: 'Verizon spend in August?',
      ingestedFilesData: [attachment]
    });
    const factPresent = promptText.includes('199.10');
    check('C', 'C2', 'chat.ts: attachment-only request (no documents[]) works standalone', factPresent, factPresent ? '' : 'Expected the attachment fact in prompt.');
  }

  {
    // C3 — regression guard for the citation-manifest fix shipped earlier
    // this session (json-tagged fence + "context" key instead of
    // "citation_manifest" + "source"). Must keep passing.
    let sentBody: any = null;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      sentBody = null;
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'The rent is $4,200.00 [1].\n\n```json\n[{"marker": 1, "context": "DOCUMENT 1"}]\n```' } }] }) } as any;
    }) as any;
    const res: any = { setHeader() {}, status(c: number) { this.statusCode = c; return this; }, json(p: any) { this.payload = p; return this; } };
    try {
      await chatHandler({ method: 'POST', headers: {}, body: { prompt: 'rent?', documents: [mtHorebLease] } } as any, res);
    } finally {
      globalThis.fetch = realFetch;
    }
    const noRawJsonLeak = !String(res.payload?.text || '').includes('"marker"');
    const citationResolved = res.payload?.citations?.[0]?.docId === mtHorebLease.id;
    check('C', 'C3', 'chat.ts: json-tagged/"context"-keyed citation manifest still strips + resolves (no regression)', noRawJsonLeak && citationResolved,
      `noRawJsonLeak=${noRawJsonLeak}, citationResolved=${citationResolved}`);
  }

  {
    const { promptText } = await invoke(chatHandler, {
      prompt: 'And the rent?',
      messages: [
        { role: 'user', content: 'What documents do I have?' },
        { role: 'assistant', content: 'You have a lease on file.' },
        { role: 'user', content: 'And the rent?' }
      ],
      documents: [mtHorebLease]
    });
    const historyIncluded = promptText.includes('What documents do I have?');
    check('C', 'C4', 'chat.ts: prior conversation turns are included in the grounded prompt', historyIncluded, historyIncluded ? '' : 'Expected prior turn text in prompt.');
  }

  // ── Category D: scanned / image-based documents — current OCR baseline ───

  {
    const usable = hasUsableText(scannedDocEmptyExtraction.fullText);
    check('D', 'D1', 'extractedText.ts: empty extraction (typical of an unOCR\'d scan) is correctly flagged unusable', !usable, !usable ? '' : 'hasUsableText should reject empty text.');
    const { promptText } = await invoke(chatHandler, { prompt: 'What does the scanned invoice say?', documents: [scannedDocEmptyExtraction] });
    const listedAsUnreadable = promptText.includes('UNREADABLE FILES') && promptText.includes(scannedDocEmptyExtraction.title);
    check('D', 'D1-surfaced', 'chat.ts: empty-extraction doc is honestly listed as unreadable, not silently vanished', listedAsUnreadable, listedAsUnreadable ? '' : 'Expected the doc name under UNREADABLE FILES.');
  }

  {
    const binary = looksLikeBinary(scannedDocPdfBinaryNoise.fullText);
    check('D', 'D2', 'extractedText.ts: raw PDF container bytes (pdfjs-failure fallback shape) detected as binary noise', binary, binary ? '' : 'looksLikeBinary should flag %PDF container content.');
    const { promptText } = await invoke(chatHandler, { prompt: 'What does the scanned contract say?', documents: [scannedDocPdfBinaryNoise] });
    const listedAsUnreadable = promptText.includes('UNREADABLE FILES') && promptText.includes(scannedDocPdfBinaryNoise.title);
    check('D', 'D2-surfaced', 'chat.ts: binary-noise doc is listed as unreadable rather than answered from as if it were prose', listedAsUnreadable, listedAsUnreadable ? '' : 'Expected the doc name under UNREADABLE FILES.');
  }

  {
    const usable = hasUsableText(scannedDocWhitespaceOnly.fullText);
    check('D', 'D3', 'extractedText.ts: whitespace-only extraction (a scanned page with zero recovered text) flagged unusable', !usable, !usable ? '' : 'hasUsableText should reject whitespace-only text.');
  }

  // D4 is not executable in this Node harness: src/lib/fileParser.ts imports
  // `pdfjs-dist/build/pdf.worker.min.mjs?url`, a Vite-only asset import, so
  // it cannot be loaded outside a Vite/browser build. Verified instead by
  // direct source reading — see docs/phase-0-audit.md section 1 and 3 for
  // the fileParser.ts:97-100 citation and what it means for image uploads.

  // ── Report ────────────────────────────────────────────────────────────
  const byCategory: Record<string, Result[]> = {};
  for (const r of results) (byCategory[r.category] ||= []).push(r);
  let totalPass = 0;
  console.log('\n=== Phase 0 Audit Regression Suite — Results ===\n');
  for (const cat of Object.keys(byCategory).sort()) {
    console.log(`-- Category ${cat} --`);
    for (const r of byCategory[cat]) {
      if (r.pass) totalPass++;
      console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.id}: ${r.name}${r.detail ? `\n       ${r.detail}` : ''}`);
    }
    console.log('');
  }
  console.log(`TOTAL: ${totalPass}/${results.length} passed\n`);
}

main().catch((err) => {
  console.error('Suite crashed:', err);
  process.exitCode = 1;
});
