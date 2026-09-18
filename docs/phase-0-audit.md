# Phase 0 Audit — Architecture, Capability Claims, and Bug Reproduction

**Status:** diagnostic only. No functional/production code was changed to produce this report.
**Branch:** `phase-0-audit` (based on `claude/codebase-connection-x3h222`, which already includes two unrelated bug
fixes shipped earlier in this engagement — the citation-manifest leak fix and the chat.ts context-omission-notice
fix. Those fixes are treated as part of "the actual code" for this audit; where they change the picture, that is
called out explicitly rather than assumed away.)
**Scope:** trace document upload → storage → chat context assembly → model; catalog every length/truncation limit;
confirm the authoritative deployment target; audit user-facing capability claims against actual behavior; reproduce
the reported Verizon/Rockland Trust bug with evidence; establish a baseline regression suite.

---

## 1. Architecture audit

### 1.1 Document lifecycle, end to end

```
Browser (upload) ──▶ src/lib/fileParser.ts (client-side extraction)
                        │  PDF → pdfjs-dist getTextContent (text layer only, no OCR)
                        │  DOCX → mammoth.extractRawText (raw text only)
                        │  XLSX/XLS → xlsx → markdown table
                        │  CSV/TSV → manual parse
                        │  TXT/JSON/MD → read as text
                        │  PNG/JPG/WEBP/GIF/PPTX/PPT/legacy .doc → hard `throw`, upload fails
                        ▼
      src/components/DocumentUploadModal.tsx (`simulateProgress`)
                        │  1. extractedText.slice(0, 100000) → POST /api/documents/process (AI enrichment: summary/entities/tags)
                        │  2. raw file bytes → Firebase Storage (uploadDocumentFile) → fileUrl
                        │  3. full extractedText (untruncated) → POST /api/summarize (truncates to 3000 chars server-side)
                        │  4. builds DocumentItem { fullText: extractedText, contentPreview: extractedText, aiIndexed, embeddingsComplete, ... }
                        ▼
                 src/App.tsx `handleUploadSuccess`
                        │  setDocuments(...) [local React state, immediate]
                        │  saveDocumentToFirestore(withText) [fire-and-forget, NOT awaited]
                        ▼
        src/lib/firestoreService.ts `saveDocumentToFirestore`
                        │  setDoc(users/{uid}/documents/{id}, { ...fullText, ... }, { merge: true })
                        │  on failure: handleFirestoreError() → console.warn ONLY. Never surfaced to the UI,
                        │  never retried, never thrown. (src/lib/firestoreService.ts:62-76)
                        ▼
                 Firestore (users/{uid}/documents/{id})
                        │  Firestore's platform limit: 1,048,576 bytes per document, ALL fields combined.
                        ▼
    Next session: fetchDocumentsFromFirestore() → App.tsx `myDocuments` (filtered by belongsToUser)
                        ▼
       src/components/ResearchAssistantView.tsx `handleSendQuery`
                        │  activeDocs = documents where selectedDocIds.includes(id) OR not yet "known"
                        │  (selectedDocIds is seeded to ALL doc ids on mount and only ever grows — there is
                        │  no UI to deselect a document, confirmed by grep: setSelectedDocIds is called only
                        │  at lines 332, 371, 404, never with a filtered/removed list)
                        │  fullTextDocumentPayload = activeDocs.map(doc => ({ id, title, summary, fullText }))
                        ▼
               POST /api/chat  { prompt, messages, documents, ingestedFilesData, attachedFiles }
                        ▼
                  api/chat.ts `buildBoundedContext` (see 1.2)
                        ▼
                  generateWithFallback (OpenAI gpt-4o → Gemini 3.6 Flash fallback)
```

**Key finding — no chunking, embedding, or vector storage exists anywhere in this pipeline.** `fullText` is the
verbatim output of the browser-side parser, stored as one Firestore string field, and later concatenated wholesale
into a single prompt. Confirmed by a repository-wide search for `embedding|vector|pinecone|chroma|faiss|weaviate|qdrant`:
every hit is either UI copy (audited in §2) or an unused boolean field (`embeddingsComplete`) — never an actual
embedding call, vector store client, or similarity search.

### 1.2 Every chunk / truncate / concatenate / length-limit point (cited)

| # | Location | Limit | Behavior when exceeded |
|---|---|---|---|
| 1 | `src/lib/fileParser.ts:97-100` | N/A (hard reject) | PNG/JPG/JPEG/WEBP/GIF/PPTX/PPT/legacy `.doc` throw immediately; upload fails, nothing is stored. No OCR fallback exists anywhere in the repo. |
| 2 | `src/components/DocumentUploadModal.tsx:109` | 100,000 chars | `extractedText.slice(0, 100000)` sent to `/api/documents/process` for AI-generated summary/entities/tags. Text beyond 100k chars is invisible to that enrichment step only (does not affect `fullText` used for chat). |
| 3 | `api/summarize.ts:9` | 3,000 chars (`maxLength`) | Document text truncated with a `...` suffix before generating the Files-list executive summary. Affects summary quality only, not chat grounding. |
| 4 | Firestore platform limit (via `src/lib/firestoreService.ts:62-76`) | 1,048,576 bytes/doc, all fields | `setDoc` throws; caught by `handleFirestoreError`, which only `console.warn`s. **No error is surfaced to the user.** The upload already showed "Ready" in the browser (local state), so a large document can appear successfully uploaded in the current session while never actually persisting — or persisting with a `fullText` value from a previous, smaller revision. Not reproduced with a live Firestore instance in this pass (no test project credentials); flagged as the single highest-severity unverified risk — see §3.4 and §5. |
| 5 | `api/chat.ts` (`MAX_DOC_CHARS`, `MAX_TOTAL_CONTEXT_CHARS`) | 28,000 chars/doc; 90,000 chars total across all documents+attachments | `buildBoundedContext` walks `readableDocs` then `readableAttached` in array order, decrementing a shared budget. Once the running total hits the ceiling, every remaining document/attachment is dropped. **Post-fix** (shipped earlier this session, commit `656b2a0`): dropped items are now named in a `DOCUMENTS OMITTED FOR LENGTH` section so the model is told they exist — but their content still never reaches the model. Confirmed live by test A1 (§4). |
| 6 | `api/research.ts:32-34,108-131` (`MAX_CONTEXT_CHARS`) | 120,000 chars total, shared across documents AND attachments via one `remainingChars` counter | Loop `break`s once the budget is exhausted (line 115); anything after that point is dropped with **zero trace** — no name, no notice, nothing. This endpoint did **not** receive the omission-notice fix applied to `api/chat.ts`. Confirmed live by tests A2/B5 (§4). |
| 7 | `api/compare.ts` | **none** | No `MAX_*` constant, no `.slice`/`.substring` call anywhere in the file (confirmed by grep — zero matches). Full text of every compared document is concatenated unbounded (`api/compare.ts:11`) and sent whole to the model. Different failure mode from #5/#6: this risks a hard API rejection from the provider once documents are large enough to exceed the model's actual context window, rather than a silent drop. Confirmed live by test B6 (§4). |
| 8 | `api/chat.ts` (`MAX_HISTORY_MESSAGES`, `MAX_HISTORY_CHARS`) | last 8 messages, ~1,500 chars each | Older conversation turns are dropped from context on long chat threads. Separate from the document-grounding bug; noted for completeness. |
| 9 | `functions/src/index.ts` | mirrors #2, #3, #5 (duplicated implementation) | See §1.3 — not confirmed reachable from production traffic today. |

### 1.3 Maximum documents / characters actually considered per query

There is **no cap on the number of documents** accepted into any endpoint's request body — only a cap on total
characters (`api/chat.ts`: 90,000; `api/research.ts`: 120,000; `api/compare.ts`: unbounded). `api/research.ts` does
cap `documentIds` at 50 (`.slice(0, 50)`, line 87) when resolving by ID from Firestore, but that is an ID-count cap
on one input path, not a character or total-document-count cap on what is actually sent to the model.

Practical consequence: an account with, say, 20 months of bank statements (a realistic "Rockland Trust statements"
scenario) at even a modest 5,000 characters each already totals 100,000 characters — past both the `api/chat.ts` and
`api/research.ts` ceilings before accounting for any other documents in the same request. Whichever statements land
later in the array (upload order, not relevance) are the ones a question about them will fail to see.

### 1.4 Authoritative deployment target

**Vercel is confirmed authoritative for production**, based on:

- `vercel.json` configures the Vite build (`buildCommand: vite build`, `outputDirectory: dist`) and rewrites — this
  is a live, exercised deploy config.
- `.github/workflows/signal87-build.yml`'s scheduled `production-health` job (runs every 15 minutes) curls
  `https://signal87.ai/api/health` and `https://signal87.ai/api/research` directly and fails CI if they don't
  respond correctly. This is the only automated, continuously-verified signal of what production actually is, and
  it points at the Vercel-served domain — not at any `*.web.app`/`*.firebaseapp.com` Firebase Hosting URL.
- No CI workflow deploys to Firebase Hosting or Firebase Functions (no `firebase deploy` step anywhere in
  `.github/workflows/`). If the Firebase Functions in `functions/src/index.ts` are deployed at all, it is a manual,
  out-of-band process with no CI verification — i.e., trivially able to drift from the Vercel copy, which is
  exactly what happened with the citation-manifest bug fixed earlier this session (present in one copy, silently
  inconsistent with the other).

**One reference to the Firebase project is legitimate and should stay**: `vercel.json:13-14` proxies
`/__/auth/*` and `/__/firebase/*` to `gen-lang-client-0608802366.firebaseapp.com` — this is the standard Firebase
Auth handler redirect and is required for Google sign-in to work regardless of where the app is hosted. This is not
dead code and was not touched.

**Firestore itself is in active, correct, production use** from the Vercel-hosted code (both the client SDK in
`src/lib/firebase.ts`/`firestoreService.ts` and a direct REST call in `api/research.ts:9,37-100`) — this is
separate from Firebase *Hosting*, which is the piece confirmed not serving traffic. Do not conflate "Firebase
Hosting is inactive" with "Firebase is unused": the database is Firestore, and it is live.

**Dangling/at-risk references found (not modified, per constraints):**
- `firebase.json:23-45` defines a complete, ready-to-activate Hosting config whose rewrites map the identical
  `/api/*` paths to Firebase Functions — meaning the dormant Firebase project is not just old code, it is a fully
  wired second production path that could start serving traffic from a DNS/hosting change alone, currently
  unverified against the same CI health checks that watch the Vercel path.
- `functions/src/index.ts` duplicates `chat`, `research`, `analyze`, `compare`, `documentsProcess`, `summarize` from
  the `api/*.ts` Vercel functions, hand-maintained in parallel with no shared source and no CI parity check.
  `functions/src/index.ts:1083` contains a hardcoded string, `'Received query and mapped doc identifiers to
  repository vector space'`, shipped into that copy's `verificationTrace.steps` on every response — a fabricated
  claim (see §2) that does **not** exist in the live `api/chat.ts` version. This is dormant, not reaching
  `signal87.ai` traffic today, but is evidence of exactly the drift risk this duplication creates.

---

## 2. Capability-claims audit

| Claim | Where it appears (user-facing) | What the code actually does | Verdict |
|---|---|---|---|
| "get answers with citations back to the **exact page and paragraph** in your own documents" | `index.html:8,35,43,58,177` — meta description, OG tags, Twitter card, JSON-LD structured data (schema.org, indexed by search engines), and visible landing page copy | `Citation.paragraphRef` exists in the type (`src/types.ts:70`, comment: "Omitted unless it is genuinely known") but is **never set** by `resolveCitations` in `api/chat.ts` or its `functions/src/index.ts` twin — citations only ever carry `docId`/`docTitle`/`snippet`. There is an existing test, `tests/answering.e2e.ts:194`, that explicitly asserts `paragraphRef === undefined` on every citation, i.e. the "no invented page reference" behavior is intentional and enforced. PDF extraction does record `[Page N]` markers in the raw text blob (`src/lib/fileParser.ts:85`), but that position information is discarded before it reaches a citation. | **False today.** This is the single most consequential mismatch — it's the primary above-the-fold product promise, and it's contradicted by a test the team itself wrote. |
| "AI Vector Indexing & Text Extraction" (upload modal subtitle) / "We read and index every file automatically" | `src/components/DocumentUploadModal.tsx:246,254` | No vector index of any kind exists (§1.1). "Indexing" here means "stored as a Firestore field," full stop. | **False/aspirational.** |
| `aiIndexed`, `embeddingsComplete` document flags | `src/components/DocumentUploadModal.tsx:172-173`; rendered in `DocumentLibraryView.tsx` status badges | Both are set to `Boolean(backendData && Object.keys(backendData).length)` — true whenever the `/api/documents/process` enrichment call returned *any* non-empty JSON, regardless of whether embedding or indexing of any kind occurred. There is no code path anywhere that sets `embeddingsComplete` based on an actual embedding operation. | **Cosmetic field masquerading as a real capability flag.** |
| "Generating AI-powered insights and analysis" | `src/pages/PrivacyPolicy.tsx:49` | Accurate as a generic description of what the single-shot LLM calls do; not a specific over-claim like the ones above. | **Accurate.** |
| Reasoning-step / verification-trace claims — e.g. `functions/src/index.ts:1083`: `'Received query and mapped doc identifiers to repository vector space'` | `verificationTrace.steps` in the (dormant) Firebase Functions chat response | Fabricated: there is no "repository vector space." This exact string ships unconditionally on every response from that code path, dormant in production today (§1.4) but present in the shipped codebase. | **False, and worse than aspirational — this specific string never becomes true no matter what the request contains.** |
| `reasoningSteps` (`api/analyze.ts:24`, `buildReasoningSteps`) | Displayed as step-by-step "reasoning" in the UI | Regex-scans the model's **own** markdown output for section headers it was prompted to produce (`Key Findings`, `Trend Analysis`, etc.) and slices out the text under them (`extractSection`, line 27). This is post-hoc labeling of the model's single free-text answer, not an independently computed or verified reasoning trace. | **Presented as more rigorous than it is.** |
| `quantitativeData` (`api/analyze.ts:25`, `extractQuantitativeData`) | Displayed as extracted metrics/trends/calculations | Blind regex over the model's prose (`/(\d+(?:\.\d+)?)\s*(%|billion|million...)/gi`, etc.) — string-matching, not computation. | **Presented as more rigorous than it is.** |
| `confidence: 'high'\|'medium'\|'low'` (`api/analyze.ts:26`, `assessConfidence`) | Displayed as a confidence indicator | Counts hedge words ("might", "may", "unclear", "uncertain", "unknown", "estimate", "approximate") and divides by response length. Not a model self-assessment, not tied to actual grounding strength or retrieval completeness. | **Presented as more rigorous than it is.** |
| `reasoningSteps` in `api/research.ts:156-163` | Displayed in the Research Assistant UI | Six static template strings ("Input validated and authenticated", "Resolved N document(s)...") interpolated with counts — not a real multi-step plan, confirmed by reading the literal array construction. | **Presented as more rigorous than it is.** |

**Pattern across the last four rows:** every "reasoning"/"confidence"/"quantitative" signal in the product today is
derived by parsing the model's own single free-text output after the fact, never by an independent verification or
planning step. None of this is disclosed to the user as post-hoc labeling.

---

## 3. Reproducing the known bug

### 3.1 What was assumed vs. what was confirmed

The task brief's suspected root cause — "concatenates document text directly into the prompt rather than doing real
chunk+embed+retrieve, so some uploaded documents are likely silently excluded once a size ceiling is hit" — is
**confirmed correct as the mechanism**, with one addition the brief didn't anticipate: as of this session's earlier
fixes, `api/chat.ts` no longer does this *completely* silently (it now names the dropped document), but the
underlying inability to answer is unchanged. `api/research.ts` remains fully silent. See test A1 vs. A2 in §4.2.

### 3.2 Reproduction method

Real Rockland Trust statements are not in the repository or any test fixture, so this pass built synthetic,
clearly-labeled stand-ins (`tests/fixtures/phase-0-audit/synthetic-documents.ts`) — a small "Rockland Trust
Statement" document containing one findable fact ("VERIZON WIRELESS PAYMENT -$184.22") plus several large filler
documents sized to deterministically exhaust the character budget ahead of it, matching a plausible real scenario
(several other financial documents in the same account, uploaded before the relevant statement).

The reproduction drives the real `api/chat.ts` handler with a stubbed outbound model call (no API key available in
this environment — see §3.4) and inspects **the actual outgoing prompt payload**, not the model's answer. This is
the correct place to look: the bug is in what data reaches the model, not in the model's reasoning over that data.

### 3.3 Evidence

Test **A1** (`tests/phase-0-audit.test.ts`): four 28,000-character filler documents followed by the Rockland Trust
statement.

- Documents 1–3 fit fully (28,000 + 28,000 + 28,000 = 84,000 of the 90,000-char budget).
- Document 4 is truncated to the remaining 6,000 chars.
- The Rockland Trust statement (document 5, containing the Verizon figure) hits `usedChars >= MAX_TOTAL_CONTEXT_CHARS`
  and is dropped entirely — confirmed by asserting `"VERIZON WIRELESS PAYMENT"` is **absent** from the actual prompt
  string sent to the model (`promptText`, captured from the stubbed `fetch` call's request body).
- The now-shipped fix means the prompt **does** contain a `DOCUMENTS OMITTED FOR LENGTH` section naming
  `Rockland Trust Statement - March 2026.pdf` — so the model, if asked, could tell the user it couldn't see that
  document. It cannot, however, produce the actual dollar figure, because the figure itself never left the client's
  request.
- Test **A3** proves this is purely positional: moving the *identical* Rockland Trust document to the front of the
  same array makes the Verizon figure reach the model. Nothing about relevance to the question changed — only array
  order.
- Test **A2** reproduces the same construction against `api/research.ts` and confirms zero disclosure of any kind —
  the document is simply absent, with no trace it ever existed in the request.

This directly answers "why it failed": **not** mis-parsing, **not** an unreadable/corrupted file, **not** a model
reasoning failure — the document's text was mechanically excluded from the request before the model ever saw it,
purely as a function of (a) how many/how large the documents ahead of it in the array were and (b) a fixed
character ceiling that has no awareness of which document is actually relevant to the question being asked.

### 3.4 Explicit assumptions (per task instructions, stated rather than guessed)

- **No `OPENAI_API_KEY`/`GEMINI_API_KEY` is available in this sandboxed environment**, so no case in this pass calls
  a real model. Every test instead inspects the constructed request payload against a stubbed provider response —
  the same pattern the repository's own `tests/citation-recovery.test.ts` and `tests/answering.e2e.ts` already use,
  and the correct layer to test given the bug is in context assembly, not model reasoning.
- **No Firestore test project credentials are available**, so the silent-write-failure risk identified in §1.2
  (row 4) — a large `fullText` value causing `setDoc` to exceed Firestore's 1 MiB document limit and fail silently
  — is a *code-reading finding*, not a reproduced-with-evidence one. It is flagged as the top item to verify first
  in §5, because if it is real, it would explain reports of "I uploaded it but the AI says it's not there" even more
  directly than the context-budget bug, and no fix to retrieval/ranking would help until the document is actually
  persisted.
- **Real Rockland Trust/Mount Horeb documents were not available**; synthetic stand-ins were built instead, sized
  and shaped to mirror a plausible real scenario (see §3.2). The dollar figures, dates, and document names in the
  fixtures are fabricated for testing purposes only.
- **`src/lib/fileParser.ts` cannot be executed in this Node/tsx test harness** because it imports
  `pdfjs-dist/build/pdf.worker.min.mjs?url`, a Vite-only asset import syntax that has no meaning outside a Vite
  build. The client-side "images/PPTX/legacy .doc are hard-rejected at upload" and "PDF OCR does not exist, scanned
  PDFs silently extract to empty text" findings in §1.2 and §2 are established by direct source reading, not by an
  executed test. The server-side half of the same behavior (what happens once a document *does* arrive with no
  usable text) **is** covered by executable tests D1–D3 in §4.

---

## 4. Baseline regression suite

**Location:** `tests/phase-0-audit.test.ts` + `tests/fixtures/phase-0-audit/synthetic-documents.ts`
**Run with:** `npx tsx tests/phase-0-audit.test.ts`
**Run against:** the unmodified code on this branch (`phase-0-audit`, tip `656b2a0` plus test-only additions — no
production file was edited to produce these results)

### 4.1 Result summary

**21 / 22 executable checks passed**, plus one non-executable finding (D4) recorded by citation only (§3.4).

The one intentional, expected failure is **A1b**. It is not a test bug — it is the honest baseline the task asked
for: the omission-notice fix (shipped earlier this session) makes the drop *disclosed*, but does not make the
document *answerable*. Both facts are recorded as separate checks (A1a passes, A1b fails) so a future fix can be
judged against each independently.

### 4.2 Full results

| ID | Category | Check | Result |
|---|---|---|---|
| A1a | Bug repro | `chat.ts`: Rockland Trust omission is disclosed to the model (post-fix) | **PASS** |
| A1b | Bug repro | `chat.ts`: the Verizon figure itself still reaches the model | **FAIL (expected — known limitation, see §4.1)** |
| A1c | Bug repro | `chat.ts`: fails softly with HTTP 200, not an error | PASS |
| A2a | Bug repro | `research.ts`: Verizon figure excluded (same bug class) | PASS |
| A2b | Bug repro | `research.ts`: drop is completely silent, unlike `chat.ts` | PASS |
| A3 | Bug repro | `chat.ts`: identical document, moved earlier in array, becomes answerable (proves positional not relevance-based) | PASS |
| B1 | Multi-doc ceiling | `chat.ts`: well under 90,000-char budget — nothing omitted | PASS |
| B2 | Multi-doc ceiling | `chat.ts`: cutoff point matches budget arithmetic exactly | PASS |
| B3 | Multi-doc ceiling | `chat.ts`: 41 small documents (41,000 chars total) all included | PASS |
| B4 | Multi-doc ceiling | `chat.ts`: an attachment can be starved by `documents[]` alone, but is disclosed | PASS |
| B5 | Multi-doc ceiling | `research.ts`: attachment starved by `documents[]`, zero disclosure | PASS |
| B6 | Multi-doc ceiling | `compare.ts`: no length ceiling exists at all; full 150,000-char doc sent whole | PASS |
| C1 | Control group | `chat.ts`: single small document, simple fact answerable | PASS |
| C1-citation | Control group | `chat.ts`: response well-formed for a trivial case | PASS |
| C2 | Control group | `chat.ts`: attachment-only request works standalone | PASS |
| C3 | Control group | `chat.ts`: citation-manifest fix (json tag / "context" key) — no regression | PASS |
| C4 | Control group | `chat.ts`: prior conversation turns included in grounded prompt | PASS |
| D1 | OCR baseline | `extractedText.ts`: empty extraction flagged unusable | PASS |
| D1-surfaced | OCR baseline | `chat.ts`: empty-extraction doc honestly listed as unreadable | PASS |
| D2 | OCR baseline | `extractedText.ts`: raw PDF-container noise flagged unusable | PASS |
| D2-surfaced | OCR baseline | `chat.ts`: binary-noise doc listed as unreadable, not answered from | PASS |
| D3 | OCR baseline | `extractedText.ts`: whitespace-only extraction flagged unusable | PASS |
| D4 | OCR baseline | Image/PPTX/legacy-`.doc` upload hard-rejected client-side; no OCR exists | **Not executable in this harness — established by source citation, `src/lib/fileParser.ts:97-100`** |

This table is the literal console output of the suite (reformatted; raw log reproduced in §4.3), so it can be
diffed against a re-run after any future Phase 0 change to prove what actually improved.

### 4.3 Raw console output

```
=== Phase 0 Audit Regression Suite — Results ===

-- Category A --
[PASS] A1a: chat.ts: omission of the Rockland Trust doc is disclosed to the model (post-fix)
[FAIL] A1b: chat.ts: the Verizon figure itself still reaches the model
       KNOWN LIMITATION: the document is honestly disclosed as omitted (A1a) but its content never
       reaches the model, so the question still cannot be answered. This is the retrieval gap
       Phase 0/1 must close.
[PASS] A1c: chat.ts: response is HTTP 200 (fails softly, not with an error)
[PASS] A2a: research.ts: the Verizon figure does not reach the model (same bug class)
[PASS] A2b: research.ts: unlike chat.ts, the drop is completely silent (no disclosure at all)
[PASS] A3: chat.ts: moving the SAME document earlier in the array makes it answerable

-- Category B --
[PASS] B1: chat.ts: well under budget — all documents included, nothing omitted
[PASS] B2: chat.ts: cutoff point matches the 90,000 char budget arithmetic
[PASS] B3: chat.ts: 41 small documents (41,000 chars total) all fit
[PASS] B4: chat.ts: an attached (not library) document can be starved by documents[] alone, but is disclosed
[PASS] B5: research.ts: attachment starved by documents[], zero disclosure
[PASS] B6: compare.ts: no length ceiling exists — full 150,000-char document is sent whole

-- Category C --
[PASS] C1: chat.ts: single small document, simple fact reaches the model
[PASS] C1-citation: chat.ts: response returns without error for a trivial case
[PASS] C2: chat.ts: attachment-only request (no documents[]) works standalone
[PASS] C3: chat.ts: json-tagged/"context"-keyed citation manifest still strips + resolves (no regression)
[PASS] C4: chat.ts: prior conversation turns are included in the grounded prompt

-- Category D --
[PASS] D1: extractedText.ts: empty extraction (typical of an unOCR'd scan) is correctly flagged unusable
[PASS] D1-surfaced: chat.ts: empty-extraction doc is honestly listed as unreadable, not silently vanished
[PASS] D2: extractedText.ts: raw PDF container bytes (pdfjs-failure fallback shape) detected as binary noise
[PASS] D2-surfaced: chat.ts: binary-noise doc is listed as unreadable rather than answered from as if it were prose
[PASS] D3: extractedText.ts: whitespace-only extraction (a scanned page with zero recovered text) flagged unusable

TOTAL: 21/22 passed
```

---

## 5. Recommended fix order

No fixes are implemented in this pass. In priority order for Phase 0 proper:

1. **Verify the Firestore silent-write-failure risk (§1.2 row 4, §3.4) against a real project before anything
   else.** If large documents are failing to persist at all, every retrieval improvement downstream is moot for
   those documents — they were never durably saved in the first place. This is a few hours of work (upload a
   deliberately oversized synthetic document to a real or staging Firestore instance and observe) and should gate
   how urgently the rest of this list is prioritized.
2. **Fix the false capability claims in `index.html` (page-and-paragraph citations) and `DocumentUploadModal.tsx`
   ("vector indexing")** — independent of any architecture work, these are currently false statements in public,
   indexed marketing copy and in the product UI. Low effort, immediate correctness/trust fix, and this regression
   suite's C3/D-series cases keep working unchanged regardless of when this lands.
3. **Bring `api/research.ts` and `api/compare.ts` up to at least the same honesty level `api/chat.ts` now has**
   (name what got dropped, and in `compare.ts`'s case, add *some* ceiling rather than none) — this is the same
   small, contained pattern already proven in `api/chat.ts`, applied to the two endpoints the A2/B5/B6 tests show
   are currently worse off, not a new design.
4. **Real retrieval (chunk + embed + rank + select)** to replace "concatenate in array order until a character
   ceiling truncates the rest" across all four endpoints. This is the actual fix for A1b/A2a and the only way to
   raise the "well under budget" ceiling in B1/B3 without just picking a bigger arbitrary number. Highest effort,
   and should be scoped as its own pass with this suite as the acceptance baseline — a real fix should turn A1b
   from FAIL to PASS without breaking any of the other 21 checks.
5. **Consolidate `api/*.ts` and `functions/src/index.ts`** so a fix applied once cannot silently fail to apply to
   the other copy (§1.4) — not urgent for user-facing correctness today since the Firebase path is dormant, but it
   is the mechanism that let the citation-manifest bug fixed earlier this session exist inconsistently across the
   two copies, and it will keep generating that class of bug until resolved.
6. **Replace the cosmetic `reasoningSteps`/`quantitativeData`/`confidence` fields (§2)** with either real signals or
   their removal — lower urgency than 1–4 since they don't cause incorrect answers, but they currently present
   regex-scraped, post-hoc labeling as if it were independent verification, which compounds user trust risk
   alongside item 2.
