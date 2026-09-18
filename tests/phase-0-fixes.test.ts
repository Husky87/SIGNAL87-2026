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
