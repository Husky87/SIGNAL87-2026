/**
 * Verification suite for the Phase 0 fixes applied on top of the
 * docs/phase-0-audit.md baseline (tests/phase-0-audit.test.ts, which is left
 * unmodified as the historical "before" record — see docs/phase-0-fixes.md
 * for the full before/after comparison).
 *
 * Same stubbing approach as the baseline suite, extended with a real
 * embeddings stub (the baseline suite's generic chat-completion-shaped stub
 * deliberately does NOT satisfy the embeddings response shape, so it always
 * exercises the legacy fallback path — that's why every baseline case still
 * passes unchanged there even after this integration landed).
 */
process.env.SIGNAL87_TEST_AUTH = '1';
process.env.OPENAI_API_KEY = 'stub';
delete process.env.GEMINI_API_KEY;

import { readFileSync } from 'fs';
import chatHandler from '../api/chat';
import researchHandler from '../api/research';
import compareHandler from '../api/compare';
import {
  rocklandTrustMarch,
  rocklandTrustMarchDisputed,
  mtHorebLease,
  fillerDocument
} from './fixtures/phase-0-audit/synthetic-documents';

type Result = { id: string; name: string; pass: boolean; detail: string };
const results: Result[] = [];
function check(id: string, name: string, pass: boolean, detail = '') { results.push({ id, name, pass, detail }); }

/** Toy embeddings: anything mentioning "verizon" clusters near the query; everything else is far away. */
function fakeEmbed(text: string): number[] {
  return /verizon/i.test(text) ? [1, 0, 0] : [0, 1, 0];
}

function stubWithRealEmbeddings() {
  let chatSentBody: any = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: any, init: any) => {
    const body = JSON.parse(init.body);
    if (typeof url === 'string' && url.includes('/v1/embeddings')) {
      const inputs: string[] = body.input;
      return { ok: true, json: async () => ({ data: inputs.map((t, i) => ({ embedding: fakeEmbed(t), index: i })) }) } as any;
    }
    if (typeof url === 'string' && url.includes('/v1/chat/completions')) {
      chatSentBody = body;
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'stub answer\n\n```citation_manifest\n[]\n```' } }] }) } as any;
    }
    return realFetch(url, init);
  }) as any;
  return { restore: () => { globalThis.fetch = realFetch; }, getSentBody: () => chatSentBody };
}

function stubEmbeddingsFailure() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: any, init: any) => {
    if (typeof url === 'string' && url.includes('/v1/embeddings')) return { ok: false, status: 500, text: async () => 'embedding service down' } as any;
    if (typeof url === 'string' && url.includes('/v1/chat/completions')) return { ok: true, json: async () => ({ choices: [{ message: { content: 'stub answer' } }] }) } as any;
    return realFetch(url, init);
  }) as any;
  return { restore: () => { globalThis.fetch = realFetch; } };
}

/**
 * Stubs the model's exact reply text (so a specific structured-format /
 * citation-leak / placeholder scenario can be simulated), while still
 * exercising real retrieval by default — pass embeddingsOk: false to force
 * the deterministic legacy buildBoundedContext path instead, when a test
 * needs exact, already-proven cutoff arithmetic (see FIX-13).
 */
function stubChat(content: string, opts: { embeddingsOk?: boolean } = {}) {
  const embeddingsOk = opts.embeddingsOk !== false;
  let chatSentBody: any = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: any, init: any) => {
    if (typeof url === 'string' && url.includes('/v1/embeddings')) {
      if (!embeddingsOk) return { ok: false, status: 500, text: async () => 'embedding service down' } as any;
      const body = JSON.parse(init.body); const inputs: string[] = body.input;
      return { ok: true, json: async () => ({ data: inputs.map((t: string, i: number) => ({ embedding: fakeEmbed(t), index: i })) }) } as any;
    }
    if (typeof url === 'string' && url.includes('/v1/chat/completions')) {
      chatSentBody = JSON.parse(init.body);
      return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) } as any;
    }
    return realFetch(url, init);
  }) as any;
  return { restore: () => { globalThis.fetch = realFetch; }, getSentBody: () => chatSentBody };
}

async function run() {
  const res: any = { setHeader() {}, status(c: number) { this.statusCode = c; return this; }, json(p: any) { this.payload = p; return this; } };
  return res;
}

async function main() {
  // ── FIX-1: chat.ts now answers the reported bug (was A1b, permanently FAIL in the baseline) ──
  {
    const stub = stubWithRealEmbeddings();
    const fillers = [1, 2, 3, 4].map((n) => fillerDocument(`doc-f1-${n}`, `Unrelated Filing ${n}.pdf`, 28000));
    const res = await run();
    await chatHandler({ method: 'POST', headers: {}, body: { prompt: 'How much was spent on Verizon in the Rockland Trust statements?', documents: [...fillers, rocklandTrustMarch] } } as any, res);
    const promptText = (stub.getSentBody()?.messages || []).map((m: any) => m.content).join('\n');
    stub.restore();
    const needleReached = promptText.includes('VERIZON WIRELESS PAYMENT');
    check('FIX-1', 'chat.ts: Rockland Trust/Verizon figure now reaches the model regardless of array position (was baseline A1b FAIL)', needleReached,
      needleReached ? '' : 'Retrieval should have ranked the Verizon-relevant chunk above the four irrelevant filler documents.');
    check('FIX-1-trace', 'chat.ts: verificationTrace honestly reports usedRetrieval=true', res.payload?.verificationTrace?.usedRetrieval === true, '');
  }

  // ── FIX-2: research.ts reaches parity with chat.ts (was baseline A2a, silently FAIL-by-design) ──
  {
    const stub = stubWithRealEmbeddings();
    // research.ts's chat-completions call is asserted via the same stub (URL-matched), reuse getSentBody.
    const fillers = [1, 2, 3, 4, 5].map((n) => fillerDocument(`doc-f2-${n}`, `Unrelated Filing ${n}.pdf`, 28000));
    const res = await run();
    await researchHandler({ method: 'POST', headers: {}, body: { researchGoal: 'How much was spent on Verizon in the Rockland Trust statements?', documents: [...fillers, rocklandTrustMarch] } } as any, res);
    const promptText = (stub.getSentBody()?.messages || []).map((m: any) => m.content).join('\n');
    stub.restore();
    const needleReached = promptText.includes('VERIZON WIRELESS PAYMENT');
    check('FIX-2', 'research.ts: reaches parity with chat.ts — same bug, same fix, same result', needleReached, needleReached ? '' : 'Expected research.ts to also rank the Verizon chunk above filler.');
    check('FIX-2-trace', 'research.ts: verificationTrace honestly reports usedRetrieval=true', res.payload?.verificationTrace?.usedRetrieval === true, '');
  }

  // ── FIX-3: resilience — an embeddings outage falls back to the OLD behavior, not an error ──
  {
    const stub = stubEmbeddingsFailure();
    const res = await run();
    await chatHandler({ method: 'POST', headers: {}, body: { prompt: 'What is the rent?', documents: [mtHorebLease] } } as any, res);
    stub.restore();
    const gracefulFallback = res.statusCode !== 500 && res.payload?.text !== undefined && res.payload?.verificationTrace?.usedRetrieval === false;
    check('FIX-3', 'chat.ts: embeddings outage degrades to legacy full-context mode, not a hard failure', gracefulFallback,
      `statusCode=${res.statusCode}, usedRetrieval=${res.payload?.verificationTrace?.usedRetrieval}, hasText=${res.payload?.text !== undefined}`);
  }

  // ── FIX-4: compare.ts now has a ceiling and discloses truncation (was baseline B6: unbounded) ──
  {
    let sentBody: any = null;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any, init: any) => { if (typeof url === 'string' && url.includes('/v1/chat/completions')) sentBody = JSON.parse(init.body); return { ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) } as any; }) as any;
    const big1 = fillerDocument('doc-cmp-1', 'Large Filing A.pdf', 200000);
    const big2 = fillerDocument('doc-cmp-2', 'Large Filing B.pdf', 200000);
    const res = await run();
    await compareHandler({ method: 'POST', headers: {}, body: { documents: [big1, big2] } } as any, res);
    globalThis.fetch = realFetch;
    const promptText = (sentBody?.messages || []).map((m: any) => m.content).join('\n');
    const isBounded = promptText.length < 320000; // well under the raw 400,000 chars that would have been sent unbounded
    const disclosesTruncation = promptText.includes('TRUNCATED') && (res.payload?._truncatedDocuments || []).length === 2;
    check('FIX-4', 'compare.ts: 400,000 chars of input now bounded to a fair-share ceiling (was baseline B6: unbounded)', isBounded, `prompt length=${promptText.length}`);
    check('FIX-4-disclosure', 'compare.ts: truncation is disclosed in-prompt and in the response, not silent', disclosesTruncation, disclosesTruncation ? '' : 'Expected TRUNCATED marker and _truncatedDocuments to list both documents.');
  }

  // ── FIX-5: compare.ts — small documents are unaffected (no regression for the common case) ──
  {
    let sentBody: any = null;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any, init: any) => { if (typeof url === 'string' && url.includes('/v1/chat/completions')) sentBody = JSON.parse(init.body); return { ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) } as any; }) as any;
    const res = await run();
    await compareHandler({ method: 'POST', headers: {}, body: { documents: [mtHorebLease, rocklandTrustMarch] } } as any, res);
    globalThis.fetch = realFetch;
    const promptText = (sentBody?.messages || []).map((m: any) => m.content).join('\n');
    const bothFullyPresent = promptText.includes('$4,200.00') && promptText.includes('VERIZON WIRELESS PAYMENT') && !promptText.includes('TRUNCATED');
    check('FIX-5', 'compare.ts: small documents pass through untouched, no false-positive truncation', bothFullyPresent, bothFullyPresent ? '' : 'Expected both small documents fully present with no truncation marker.');
  }

  // ── FIX-6/7: capability-claims copy — regression guards so the false claims can't silently return ──
  {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const noFalseClaim = !html.includes('exact page and paragraph');
    const hasHonestClaim = (html.match(/citations back to the source document/g) || []).length === 5;
    check('FIX-6', 'index.html: "exact page and paragraph" claim removed from all 5 locations (meta/OG/Twitter/JSON-LD/visible copy)', noFalseClaim && hasHonestClaim,
      `noFalseClaim=${noFalseClaim}, honestClaimCount=${(html.match(/citations back to the source document/g) || []).length}`);
  }
  {
    const modalSrc = readFileSync(new URL('../src/components/DocumentUploadModal.tsx', import.meta.url), 'utf8');
    const noVectorClaim = !modalSrc.includes('AI Vector Indexing');
    const noIndexEveryFileClaim = !modalSrc.includes('We read and index every file automatically');
    const flagsTiedToRealSignal = modalSrc.includes('hasUsableText(extractedText)');
    check('FIX-7', 'DocumentUploadModal.tsx: "AI Vector Indexing" / "index every file" copy removed, aiIndexed/embeddingsComplete tied to real extraction result', noVectorClaim && noIndexEveryFileClaim && flagsTiedToRealSignal,
      `noVectorClaim=${noVectorClaim}, noIndexEveryFileClaim=${noIndexEveryFileClaim}, flagsTiedToRealSignal=${flagsTiedToRealSignal}`);
  }
  {
    const fnSrc = readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8');
    const fabricatedStringRemoved = !fnSrc.includes('mapped doc identifiers to repository vector space');
    check('FIX-8', 'functions/src/index.ts: fabricated "mapped doc identifiers to repository vector space" verificationTrace string removed', fabricatedStringRemoved, '');
  }

  // ── FIX-10: the structured-answer-format instructions actually reach the model ──
  {
    const stub = stubWithRealEmbeddings();
    const res = await run();
    await chatHandler({ method: 'POST', headers: {}, body: { prompt: 'What is the monthly rent?', documents: [mtHorebLease] } } as any, res);
    const system = (stub.getSentBody()?.messages || []).find((m: any) => m.role === 'system')?.content || '';
    stub.restore();
    check('FIX-10a', 'chat.ts: system instruction leads with a one-sentence-summary-first structure', /Lead with exactly one sentence/i.test(system));
    check('FIX-10b', 'chat.ts: "Key facts" is instructed as conditional on 2+ distinct facts, not forced on every answer', /ONLY when there are two or more distinct facts/i.test(system));
    check('FIX-10c', 'chat.ts: a topic-specific narrative section is instructed as conditional, with a real (non-generic) header example', /never a generic "Analysis" or "Summary"/i.test(system));
    check('FIX-10d', 'chat.ts: the model is told to use the server-substituted documents-reviewed placeholder verbatim, never to count or invent a number itself', system.includes('Documents reviewed: {{DOCUMENTS_REVIEWED}}') && /the real count is filled in automatically/i.test(system));
    check('FIX-10e', 'chat.ts: a generic/invented "Potential issue" caveat is explicitly forbidden, not just discouraged', /expressly forbidden here too/i.test(system));
  }

  // ── FIX-11: "Documents reviewed" is substituted by the server from the retrieval layer, not left to the model — single document ──
  {
    const stub = stubChat('The rent is $4,200.00 [1].\n\nDocuments reviewed: {{DOCUMENTS_REVIEWED}}\n\n```citation_manifest\n[{"marker": 1, "source": "DOCUMENT 1"}]\n```');
    const res = await run();
    await chatHandler({ method: 'POST', headers: {}, body: { prompt: 'What is the rent?', documents: [mtHorebLease] } } as any, res);
    stub.restore();
    const text = res.payload?.text || '';
    check('FIX-11', 'chat.ts: a single-document answer reports "Documents reviewed: 1" — the stub only ever emitted the literal placeholder, so the number can only have come from the server',
      text.includes('Documents reviewed: 1') && !text.includes('{{DOCUMENTS_REVIEWED}}') && res.payload?.verificationTrace?.documentsReviewed === 1,
      `text=${JSON.stringify(text)}, trace=${res.payload?.verificationTrace?.documentsReviewed}`);
  }

  // ── FIX-12: multi-document synthesis — three small, unrelated-sized documents, all genuinely used ──
  {
    const stub = stubChat('Verizon was paid across the reviewed statements [1][2].\n\nDocuments reviewed: {{DOCUMENTS_REVIEWED}}\n\n```citation_manifest\n[{"marker": 1, "source": "DOCUMENT 1"}, {"marker": 2, "source": "DOCUMENT 2"}]\n```');
    const res = await run();
    await chatHandler({ method: 'POST', headers: {}, body: { prompt: 'Summarize the Verizon payments across these statements.', documents: [rocklandTrustMarch, rocklandTrustMarchDisputed, mtHorebLease] } } as any, res);
    stub.restore();
    const text = res.payload?.text || '';
    check('FIX-12', 'chat.ts: a 3-document synthesis question reports "Documents reviewed: 3" — all three small documents fit comfortably under budget and are genuinely included',
      text.includes('Documents reviewed: 3') && res.payload?.verificationTrace?.documentsReviewed === 3, `text=${JSON.stringify(text)}`);
  }

  // ── FIX-13: the count reflects REAL inclusion, not the naive supplied count — reuses the baseline's own proven B2 cutoff arithmetic ──
  {
    const fillers = [1, 2, 3, 4].map((n) => fillerDocument(`doc-f13-${n}`, `Filing ${n}.pdf`, 28000));
    const stub = stubChat('answer\n\nDocuments reviewed: {{DOCUMENTS_REVIEWED}}\n\n```citation_manifest\n[]\n```', { embeddingsOk: false });
    const res = await run();
    await chatHandler({ method: 'POST', headers: {}, body: { prompt: 'Verizon spend and rent?', documents: [...fillers, rocklandTrustMarch, mtHorebLease] } } as any, res);
    stub.restore();
    const text = res.payload?.text || '';
    // Ground truth, verified by hand against buildBoundedContext's own
    // arithmetic (api/chat.ts) and cross-checked against this exact run's
    // output, not assumed: 6 documents supplied. Fillers 1-3 (28,000 chars
    // each) fit at 28,000/56,000/84,000 used chars; filler 4 gets a final
    // truncated 6,000-char excerpt (still genuinely included — usedChars
    // was 84,000 < 90,000 when it was reached), pushing usedChars to
    // ~90,050. rocklandTrustMarch and mtHorebLease are then both reached
    // with usedChars already >= 90,000, so both are fully omitted. That is
    // 4 documents actually reviewed, not the 6 supplied — the same cutoff
    // test B2 (tests/phase-0-audit.test.ts) already proves for this exact
    // construction, just asserted here as an exact count instead of B2's
    // "first three present" / "last two omitted" pair of loose checks.
    const documentsReviewed = res.payload?.verificationTrace?.documentsReviewed;
    check('FIX-13', 'chat.ts: "Documents reviewed" reports the real, budget-limited inclusion count (4) — never the naive 6-document supplied count, and never a number the stub (which only echoed the placeholder) could have invented',
      documentsReviewed === 4 && text.includes('Documents reviewed: 4'),
      `documentsReviewed=${documentsReviewed}, text=${JSON.stringify(text)}`);
  }

  // ── FIX-14: citation-leak defense in depth — a manifest-shaped JSON leak with NO code fence at all (the exact reported bug shape) ──
  {
    const stub = stubChat('The rent is $4,200.00 [1].\n\n{"marker": 1, "context": "DOCUMENT 1"}');
    const res = await run();
    await chatHandler({ method: 'POST', headers: {}, body: { prompt: 'rent?', documents: [mtHorebLease] } } as any, res);
    stub.restore();
    const text = res.payload?.text || '';
    const noRawJsonLeak = !text.includes('"marker"');
    const citationResolved = res.payload?.citations?.[0]?.docId === mtHorebLease.id;
    check('FIX-14', 'chat.ts: an UNFENCED manifest-shaped JSON leak (no ``` at all — the reported {"marker":1,"context":"DOCUMENT 14"} bug shape) is still stripped from the visible answer and resolved into a real citation',
      noRawJsonLeak && citationResolved, `noRawJsonLeak=${noRawJsonLeak}, citationResolved=${citationResolved}, text=${JSON.stringify(text)}`);
  }

  // ── FIX-15: citation-leak defense — a fenced manifest with no language tag at all ──
  {
    const stub = stubChat('The rent is $4,200.00 [1].\n\n```\n[{"marker": 1, "source": "DOCUMENT 1"}]\n```');
    const res = await run();
    await chatHandler({ method: 'POST', headers: {}, body: { prompt: 'rent?', documents: [mtHorebLease] } } as any, res);
    stub.restore();
    const text = res.payload?.text || '';
    const noRawJsonLeak = !text.includes('"marker"');
    const citationResolved = res.payload?.citations?.[0]?.docId === mtHorebLease.id;
    check('FIX-15', 'chat.ts: a fenced manifest with no ```citation_manifest/```json language tag at all still strips and resolves (no regression from the stricter fence variant)',
      noRawJsonLeak && citationResolved, `noRawJsonLeak=${noRawJsonLeak}, citationResolved=${citationResolved}`);
  }

  // ── FIX-16: a genuine, document-grounded issue (contradictory figures across two real sources) passes through untouched ──
  {
    const content = 'The March Verizon payment is reported as $184.22 in one statement and $204.50 in another [1][2].\n\nKey facts\n- March Verizon payment (Statement A): $184.22 [1]\n- March Verizon payment (Bank Copy): $204.50 [2]\n\nDocuments reviewed: {{DOCUMENTS_REVIEWED}}\nPotential issue identified: the two statements report different amounts for the same 03/14 Verizon payment [1][2].\n\n```citation_manifest\n[{"marker": 1, "source": "DOCUMENT 1"}, {"marker": 2, "source": "DOCUMENT 2"}]\n```';
    const stub = stubChat(content);
    const res = await run();
    await chatHandler({ method: 'POST', headers: {}, body: { prompt: 'Compare the Verizon payment across statements.', documents: [rocklandTrustMarch, rocklandTrustMarchDisputed] } } as any, res);
    stub.restore();
    const text = res.payload?.text || '';
    check('FIX-16a', 'chat.ts: a genuine, model-identified issue grounded in two real documents passes through to the visible answer unaltered', text.includes('Potential issue identified: the two statements report different amounts'), text);
    check('FIX-16b', 'chat.ts: the Documents reviewed placeholder is still correctly substituted alongside a Potential issue line', text.includes('Documents reviewed: 2'), text);
    check('FIX-16c', 'chat.ts: both citation markers in a multi-source claim resolve to two distinct real documents', res.payload?.citations?.length === 2 && res.payload.citations.some((c: any) => c.docId === rocklandTrustMarch.id) && res.payload.citations.some((c: any) => c.docId === rocklandTrustMarchDisputed.id), JSON.stringify(res.payload?.citations));
  }

  // ── FIX-17: no "Potential issue" line is ever fabricated server-side when the model did not produce one ──
  {
    const stub = stubChat('The monthly rent is $4,200.00 [1].\n\nDocuments reviewed: {{DOCUMENTS_REVIEWED}}\n\n```citation_manifest\n[{"marker": 1, "source": "DOCUMENT 1"}]\n```');
    const res = await run();
    await chatHandler({ method: 'POST', headers: {}, body: { prompt: 'What is the rent?', documents: [mtHorebLease] } } as any, res);
    stub.restore();
    const text = res.payload?.text || '';
    check('FIX-17', 'chat.ts: a clean, unambiguous document never gets a "Potential issue" line added — the server has no code path that fabricates one', !/potential issue/i.test(text), text);
  }

  // ── FIX-18: a genuinely general question (no documents supplied at all) never gets a "Documents reviewed" line ──
  {
    const stub = stubChat('Signal87 supports OpenAI and Gemini as AI providers, with automatic fallback between them.');
    const res = await run();
    await chatHandler({ method: 'POST', headers: {}, body: { prompt: 'What AI models does Signal87 use?' } } as any, res);
    stub.restore();
    const text = res.payload?.text || '';
    check('FIX-18', 'chat.ts: a general platform question with zero documents supplied never has a "Documents reviewed" line appended — it would be noise, not honesty, on a question that was never about documents', !/documents reviewed/i.test(text), text);
  }

  // ── FIX-19: if a non-compliant model drops the placeholder, the server still appends the honest count rather than silently losing the field ──
  {
    const stub = stubChat('The monthly rent is $4,200.00 [1].\n\n```citation_manifest\n[{"marker": 1, "source": "DOCUMENT 1"}]\n```');
    const res = await run();
    await chatHandler({ method: 'POST', headers: {}, body: { prompt: 'What is the rent?', documents: [mtHorebLease] } } as any, res);
    stub.restore();
    const text = res.payload?.text || '';
    check('FIX-19', 'chat.ts: a non-compliant model that drops the placeholder still gets the honest count appended by the server, never a silently missing field', text.includes('Documents reviewed: 1'), text);
  }

  // FIX-9 (Firestore silent-write-failure surfacing) is not executable in this
  // harness: src/lib/firestoreService.ts imports the browser Firebase SDK
  // (`firebase/firestore`), which has no meaning outside a browser/Vite
  // context and no test project is available to write against here (same
  // limitation noted for this exact risk in docs/phase-0-audit.md §3.4).
  // Verified instead by source reading:
  //   - src/lib/firestoreService.ts: saveDocumentToFirestore now returns
  //     { ok, error } instead of swallowing the failure.
  //   - src/App.tsx `persistDocument`: awaits the result and flips the
  //     document to status='error' (the existing "Failed" badge in
  //     DocumentLibraryView) on failure, for all six call sites that write
  //     through saveDocumentToFirestore (upload, trash, restore, star,
  //     rename, permissions).

  console.log('\n=== Phase 0 Fixes — Verification Results ===\n');
  let totalPass = 0;
  for (const r of results) {
    if (r.pass) totalPass++;
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.id}: ${r.name}${r.detail ? `\n       ${r.detail}` : ''}`);
  }
  console.log(`\nTOTAL: ${totalPass}/${results.length} passed\n`);
}

main().catch((err) => { console.error('Suite crashed:', err); process.exitCode = 1; });
