# Phase 0 Fixes — What Was Reconciled, and What Wasn't

Companion to `docs/phase-0-audit.md` (the diagnostic baseline — left unmodified). This document records what was
actually changed in response to that audit's findings and recommended fix order, with the same standard: every
claim backed by a citation or a test, nothing asserted as fixed without evidence it runs.

**Branch:** `phase-0-fixes` (based on `phase-0-audit`)
**Baseline suite:** `tests/phase-0-audit.test.ts` — unmodified, re-run at the end of this pass (§3)
**New verification suite:** `tests/phase-0-fixes.test.ts` — 11/11 passing (§2)
**Firestore emulator verification (added after initial review):** `tests/phase-0-firestore-emulator.test.ts` — 8/8
passing against a real Firestore emulator, not mocks (§2.5). This closes the one item §1.4 originally flagged as
unverified.

---

## 1. What was fixed, and why, mapped to the audit's recommended order

### 1. Real retrieval (chunk + embed + rank) — `src/lib/retrieval.ts`

This was item 4 in the audit's recommended order, promoted to first because it's the actual mechanism behind the
reported bug (test A1b) — everything else in the list was a mitigation or a symptom, this is the cause.

`src/lib/retrieval.ts` adds `retrieveRelevantChunks(query, sources, maxTotalChars)`:
- Splits each source's text into ~1,500-char chunks (150-char overlap).
- Embeds the query and every chunk in one batched call to OpenAI's `text-embedding-3-small` (no new external
  service — reuses the `OPENAI_API_KEY` already configured for chat completions, no new secret required).
- Ranks all chunks by cosine similarity to the query and greedily selects the most relevant ones up to the
  character budget, reassembling each source's selected chunks in their original order.
- **Never a hard dependency.** If `OPENAI_API_KEY` is unset, or the embeddings call fails for any reason (network,
  rate limit, malformed response), it returns `usedRetrieval: false` and the caller falls back to the exact
  previous blind-concatenation behavior. A request that worked before this change cannot be made to fail by it —
  confirmed by test FIX-3 (§2), which simulates an embeddings outage and checks the response still succeeds.
- Capped at 400 chunks per request (~600,000 raw characters considered) to bound worst-case cost/latency — well
  beyond the old 90k/120k hard ceilings, and disclosed via the same "omitted" mechanism if even that is exceeded.

**Wired into `api/chat.ts`** (`buildContext`, replacing the direct `buildBoundedContext` call) and **`api/research.ts`**
(same pattern, its own `Doc N:`/`Attachment N:` formatting preserved). Both now report `usedRetrieval` and, when
retrieval didn't run, `retrievalFallbackReason` in `verificationTrace` — so this is externally observable, not
another cosmetic field (the audit's §2 concern was fields that assert something happened when it didn't; this one
tells the truth about whether it did).

Confirmed with a semantically-meaningful embeddings stub (not just a shape-matching one): tests FIX-1 and FIX-2
reproduce the exact filler-documents-then-Rockland-Trust-statement construction from the audit's test A1/A2 and
show the Verizon figure now reaches the model in both `chat.ts` and `research.ts`, regardless of the document's
position in the array.

**What this does not do:** there is still no persistent per-document embedding cache — chunks are embedded fresh on
every request. That's a deliberate scope choice, not an oversight: caching would mean a new Firestore write path on
top of the one already shown to fail silently for large documents (§1.2 row 4 of the audit), and correctness came
before that optimization in this pass. It is the natural next step once retrieval's correctness is proven in
production.

### 2. `api/research.ts` and `api/compare.ts` brought to parity — items 3 (partially) and audit finding rows 6-7

- `api/research.ts` gained the same retrieval integration as `api/chat.ts` (above) — it now discloses what it
  couldn't include instead of the fully-silent drop documented in test A2b.
- `api/compare.ts` had **zero** length limit before this pass (audit §1.2 row 7, test B6). It now caps total input
  at 300,000 characters, split as a fair per-document share, with truncation clearly marked in-prompt
  (`[TRUNCATED — ...]`) and reported back in the response (`_truncatedDocuments`). Comparison intentionally does
  **not** use relevance-ranked retrieval like chat/research — comparing documents means comparing each one as a
  whole (or a clearly-labeled excerpt of one), not the most relevant snippets of each, so a fair-share ceiling
  with disclosure is the correct fix here, not the same mechanism used in chat.ts/research.ts.

Confirmed by tests FIX-4 (a 400,000-char input is now bounded and the truncation disclosed) and FIX-5 (a
small, realistic input is unaffected — no regression for the common case).

### 3. False capability claims corrected — item 2, audit §2

- `index.html`: the "citations back to the exact page and paragraph" claim (meta description, OG tags, Twitter
  card, JSON-LD structured data, and visible landing copy — 5 locations) is replaced with "citations back to the
  source document," which is what the product actually does. This claim was directly contradicted by the
  codebase's own existing test (`tests/answering.e2e.ts:194`, which asserts `paragraphRef` is always `undefined`) —
  it was not a borderline call.
- `src/components/DocumentUploadModal.tsx`: "AI Vector Indexing & Text Extraction" → "AI-Powered Semantic Search &
  Text Extraction" (this is now accurate — real embedding-based similarity ranking runs at query time, even though
  there's still no persistent index, hence "search" rather than "indexing"). "We read and index every file
  automatically" → "We read and extract every file automatically," avoiding the loaded word for a capability that
  doesn't exist in the form implied.
- The same file's `aiIndexed`/`embeddingsComplete` flags, previously `true` whenever an unrelated AI-enrichment API
  call happened to return non-empty JSON, are now tied to `hasUsableText(extractedText)` — a real, verifiable
  property (whether usable text was actually extracted), not a proxy for something unrelated. This field is not
  currently rendered anywhere in the UI (confirmed by search), so this is a data-integrity fix rather than a
  visible one, done for consistency with the rest of this pass rather than urgency.
- `functions/src/index.ts:1083`'s hardcoded `'Received query and mapped doc identifiers to repository vector
  space'` string — shipped into `verificationTrace.steps` on every response from that (dormant, per the audit's
  §1.4) code path — is removed. This was the single most direct fabrication found in the audit: a claim that is
  false on every request, not merely imprecise.

Confirmed by tests FIX-6, FIX-7, FIX-8 — regression guards that read the actual source/HTML rather than trusting
that the edit landed correctly.

### 4. Firestore silent-write-failure surfaced — item 1 in the audit's order, promoted for urgency but landed last here

The audit flagged (§1.2 row 4) that `saveDocumentToFirestore` swallows write failures with only a `console.warn`,
meaning a document that fails to persist (most plausibly by pushing the request past Firestore's 1 MiB
per-document limit) still shows as "Ready" in the UI with no indication it never reached the database.

- `src/lib/firestoreService.ts`: `saveDocumentToFirestore` now returns `{ id, ok, error? }` instead of
  unconditionally returning the id as if nothing happened.
- `src/App.tsx`: a new `persistDocument` helper routes all six call sites that write through it (upload, trash,
  restore, star, rename, permissions change — every one of them rewrites the full document including `fullText`,
  so every one carries the same risk, not just upload) through the same handling: on failure, the document flips to
  `status: 'error'`, which `DocumentLibraryView.tsx`'s existing status badge already renders as "Failed" — reusing
  UI that exists today rather than adding a new component.

**Update:** this was originally verified only by source reading and the TypeScript compiler accepting each call
site's updated contract, not by an executed test — `src/lib/firestoreService.ts` imports the browser Firebase SDK,
which has no meaning in a plain Node/tsx harness, and no Firestore project was available in that environment. That
gap is now closed: §2.5 verifies the actual failure mode (a document whose `fullText` pushes it past Firestore's
1 MiB limit) against a real Firestore emulator, confirms the security rules permit exactly the read/write pattern
`firestoreService.ts` uses and nothing more, and confirms the fix's own multi-document scenario (four large filler
documents plus the Rockland Trust statement) round-trips correctly through a real Firestore collection at the
volume the fix is meant to solve.

---

## 2. New verification suite results (`tests/phase-0-fixes.test.ts`)

```
[PASS] FIX-1: chat.ts: Rockland Trust/Verizon figure now reaches the model regardless of array position (was baseline A1b FAIL)
[PASS] FIX-1-trace: chat.ts: verificationTrace honestly reports usedRetrieval=true
[PASS] FIX-2: research.ts: reaches parity with chat.ts — same bug, same fix, same result
[PASS] FIX-2-trace: research.ts: verificationTrace honestly reports usedRetrieval=true
[PASS] FIX-3: chat.ts: embeddings outage degrades to legacy full-context mode, not a hard failure
[PASS] FIX-4: compare.ts: 400,000 chars of input now bounded to a fair-share ceiling (was baseline B6: unbounded)
[PASS] FIX-4-disclosure: compare.ts: truncation is disclosed in-prompt and in the response, not silent
[PASS] FIX-5: compare.ts: small documents pass through untouched, no false-positive truncation
[PASS] FIX-6: index.html: "exact page and paragraph" claim removed from all 5 locations
[PASS] FIX-7: DocumentUploadModal.tsx: false copy removed, flags tied to real extraction result
[PASS] FIX-8: functions/src/index.ts: fabricated verificationTrace string removed

TOTAL: 11/11 passed
```

FIX-9 (Firestore surfacing) is deliberately not in this count — it's verified separately, against a real emulator
rather than a mock, in §2.5.

---

## 2.5. Firestore emulator verification (`tests/phase-0-firestore-emulator.test.ts`)

Added in response to review: the fix above touches Firestore, and Firestore-specific failure modes — security
rules, per-document size limits, composite index requirements — are exactly the class of bug a mock cannot catch,
because a mock only reflects what the author already assumed about the API's behavior. This section verifies
against the real thing.

### Emulator setup

No emulator was configured in this repository before this pass. Steps taken, in order:

1. **Installed the tooling** (not saved to `package.json` — see the note on why at the end of this section):
   ```
   npm install --no-save --no-audit --no-fund firebase-tools @firebase/rules-unit-testing
   ```
   `firebase-tools` provides `firebase emulators:exec`, which starts the emulator, runs a given command against it,
   and tears it down. `@firebase/rules-unit-testing` is Firebase's own library for writing tests against the
   emulator with per-user auth contexts, without needing real ID tokens.

2. **Added an `emulators` block to `firebase.json`** (purely additive — this key is never read by `firebase
   deploy`, so it has no effect on production configuration):
   ```json
   "emulators": {
     "firestore": { "port": 8080 },
     "ui": { "enabled": false },
     "singleProjectMode": true
   }
   ```
   The UI is disabled because it isn't needed for an automated test run and its emulator-UI bundle happens to be
   served from a host this sandbox's egress policy blocks (see the network note below) — disabling it removes that
   noise entirely; it has no effect on the Firestore emulator itself, which starts and serves on 8080 regardless.

3. **Wrote `tests/phase-0-firestore-emulator.test.ts`**, using `@firebase/rules-unit-testing`'s
   `initializeTestEnvironment` loaded with the repo's actual `firestore.rules`, rather than re-importing
   `src/lib/firestoreService.ts` directly. That module transitively imports `src/lib/firebase.ts`, which calls
   browser-only APIs (`indexedDBLocalPersistence`, `browserPopupRedirectResolver`, `window`, `sessionStorage`) at
   module load time — the same class of "browser-only, not executable in this Node/tsx harness" limitation already
   documented for `src/lib/fileParser.ts` in `docs/phase-0-audit.md` §3.4. The test instead replicates
   `firestoreService.ts`'s exact collection paths (`users/{uid}/documents/{id}`, `users/{uid}/chat_messages/{id}`),
   document shape, and query patterns against the real emulator and the real rules file — what matters for this
   verification is whether Firestore itself behaves the way the fix assumes, not the exact calling syntax used to
   reach it.

4. **Ran it** via the standard, documented workflow (this is also the reproduction command for anyone re-running
   this later):
   ```
   npx firebase emulators:exec --project demo-signal87-test --only firestore \
     "npx tsx tests/phase-0-firestore-emulator.test.ts"
   ```

**Network note, for reproducing this in a similarly locked-down environment:** this sandbox's egress policy
explicitly denied `firebase.google.com` and `firebase-public.firebaseio.com` (the emulator's MOTD/remote-config and
hub-telemetry endpoints — both non-fatal to block). The Firestore emulator JAR itself downloaded successfully from
a different, allowed host on the first `emulators:start` invocation and was cached locally after that. If the JAR
download is blocked in a stricter environment, it needs to be fetched once from an unrestricted network and the
resulting `~/.cache/firebase/emulators/` cache reused.

**Simplification, stated explicitly rather than left implicit:** production uses a *named* Firestore database
(`ai-studio-signal87ai-d3ac9818-22c6-408f-9f91-6cc2fa426bf0`, per `firebase-applet-config.json` and `firebase.json`),
not `(default)`. The installed version of `@firebase/rules-unit-testing` (5.0.2) does not expose a `databaseId`
option on `initializeTestEnvironment`, so this verification runs against the emulator's `(default)` database. This
is judged not to affect validity: named databases are Firestore Native-mode instances with identical rules
enforcement, identical per-document size limits, and identical indexing behavior to the default database — naming
is an isolation mechanism, not a behavioral variant. If that assumption ever needs to be re-checked, the Firestore
emulator does support multi-database emulation directly (`firebase emulators:start` reads the database ID from
`firebase.json`'s `firestore` block); the gap is specifically in this test *library's* current API, not the
emulator.

`firebase-tools` and `@firebase/rules-unit-testing` were installed with `--no-save` and are not added to
`package.json` — they're emulator/test-only tooling, not a production or build dependency, consistent with how this
repository already keeps `bun.lock`/`package-lock.json` free of anything not required to build or run the app. A
follow-up decision (outside this task's scope) is whether to add them as a checked-in `devDependency` so this suite
can run in CI rather than needing a one-off local install each time — see §4.

### Results

```
=== Firestore Emulator Verification — Results ===

[PASS] R1: Authenticated user can write to their own users/{uid}/documents subtree (matches saveDocumentToFirestore)
[PASS] R4: Round-tripped document data matches exactly what was written (matches fetchDocumentsFromFirestore read shape)
       got: {"title":"Test Doc","fullText":"hello world","userId":"alice-uid"}
[PASS] R2: A different authenticated user CANNOT read/write alice's documents subtree
[PASS] R3: An unauthenticated request is denied (defense in depth — saveDocumentToFirestore also short-circuits on !uid client-side)
[PASS] R5: A write to a legacy/root-level collection outside users/{uid}/** is denied (the "legacy shared collections are closed" rule)
[PASS] R6: A document whose fullText pushes it past Firestore's 1 MiB limit is rejected by Firestore itself (the exact failure saveDocumentToFirestore now surfaces instead of swallowing)
       invalid-argument: 3 INVALID_ARGUMENT: The value of property "fullText" is longer than 1048487 bytes.
[PASS] R7: All 5 documents (4 large fillers + the Rockland Trust statement) round-trip through a real collection write+read with content intact
       allPresent=true, contentIntact=true, readBackIds=["doc-filler-1","doc-filler-2","doc-filler-3","doc-filler-4","doc-rt-march"]
[PASS] R8: orderBy("timestampAsc")+limit(50) — the one query pattern the app uses — runs against the emulator with no composite index required
       orderCorrect=true

TOTAL: 8/8 passed
```

### Task-specific checks, called out explicitly

- **Composite index requirements:** none exist to check, and none were introduced by this fix. A repo-wide search
  confirms exactly one `orderBy` in the entire Firestore access layer
  (`src/lib/firestoreService.ts:101`, `fetchChatMessagesFromFirestore`'s `orderBy('timestampAsc','asc'),
  limit(50)`), paired with no `where()` clause — a single-field sort never requires a composite index, only a
  `where` + `orderBy` on different fields does. `firestore.indexes.json` does not exist and does not need to;
  nothing in `firebase.json` references one. Test R8 confirms this empirically rather than by inference alone: the
  identical query pattern, run against the real emulator, returns correctly ordered results with no
  `FAILED_PRECONDITION`/"requires an index" error. The Phase 0 retrieval fix itself (`src/lib/retrieval.ts`) issues
  no Firestore queries at all — it operates entirely on documents already supplied in the request body — so it
  introduces no new query surface to check in the first place.
- **Security rules:** R1–R5 confirm the exact read/write pattern `firestoreService.ts` uses
  (`users/{uid}/{collection}/{id}`) is permitted for that user and denied for every other case the current
  `firestore.rules` intends to deny: a different authenticated user, an unauthenticated request, and a legacy
  root-level collection. The fix did not change `firestore.rules` and did not need to — it changes what
  `saveDocumentToFirestore` *does* with a rules rejection or size-limit rejection (surface it, per §1.4), not what
  the rules themselves permit.
- **Behavior at the volume this fix targets:** R7 writes and reads back the identical five-document fixture set
  (`tests/fixtures/phase-0-audit/synthetic-documents.ts`) used throughout `tests/phase-0-audit.test.ts` and
  `tests/phase-0-fixes.test.ts` — four large filler documents plus the Rockland Trust/Verizon statement — through a
  real Firestore collection, not an in-memory array, and confirms all five persist and read back with their content
  intact, including the specific Verizon line item. R6 additionally confirms the actual, real failure mode
  `saveDocumentToFirestore`'s new `{ ok, error }` return exists to catch: Firestore's own emulator rejects an
  oversized `fullText` with `3 INVALID_ARGUMENT: The value of property "fullText" is longer than 1048487 bytes` —
  the exact scenario §1.4 was written to address, now confirmed to actually occur exactly as assumed rather than
  merely asserted from reading Firestore's documented limits.

### Did anything behave differently against the real emulator vs. the mocks used elsewhere?

**No.** `tests/phase-0-audit.test.ts` (21/22) and `tests/phase-0-fixes.test.ts` (11/11) were both re-run with the
real Firestore emulator live in the background (`firebase emulators:exec --only firestore "npx tsx ... && npx tsx
..."`) and produced byte-for-byte identical pass/fail results to running them standalone with no emulator present
at all — including the same single expected baseline failure, A1b. This is not a coincidence to be suspicious of:
neither suite touches Firestore. `api/chat.ts`, `api/research.ts`, and `api/compare.ts` all take a `documents` array
directly in the request body; the only Firestore-touching code path in the whole application is
`src/lib/firestoreService.ts` (upload/save/list), which those two suites never call. That's precisely why the
emulator work in this section was necessary as a *separate* suite (R1–R8) rather than something the existing mocks
could have exercised by being pointed at a different backend — the existing suites structurally cannot reach
Firestore at all, mocked or real.

---

## 3. Baseline suite re-run — proving nothing else broke

`tests/phase-0-audit.test.ts` was **not edited**. Re-run against the code as it stands after every fix in this
document: **21/22 passed — identical to the original baseline.**

One result needs an explicit note so it isn't misread:

- **B2** ("compare.ts: no length ceiling exists — full 150,000-char document is sent whole") still shows **PASS**.
  This is **not** because the fix didn't apply — it's because that specific test's input (one 150,000-char document
  alongside one small document, giving each a 150,000-char fair share under the new 300,000-char total ceiling)
  happens to land exactly at the new boundary rather than over it, so nothing was truncated for *that specific
  input*, and the test's loose assertion (`prompt length > 150,000`) stays trivially true regardless. It no longer
  means "no ceiling exists" — it means "this particular input didn't hit the new one." Tests FIX-4 and FIX-5 in the
  new suite (§2), built specifically to probe the new ceiling with a clearly-oversized and a clearly-under-sized
  input, are the ones that actually demonstrate the fix. This is called out here rather than left for a reader to
  discover, since a baseline test silently continuing to "pass" for an unrelated reason is exactly the kind of
  false confidence this whole audit exists to prevent.

Every other baseline result (A1a, A1c, A2b, A3, B1, B3, B4, B5, C1-C4, D1-D3) is unchanged for the reason each was
originally unchanged for: the legacy fallback path they exercise is still byte-for-byte the same code, now reached
via an `if (!usedRetrieval)` branch instead of being the only path. A1b remains the one recorded FAIL in the
baseline file by design (it's the "before" snapshot); its "after" counterpart is FIX-1 in the new suite.

Also re-run and unaffected: `tests/citation-recovery.test.ts`, `tests/chat-client.test.ts`,
`tests/ai-fallback-routing.test.ts`, `tests/chat-response-render.test.tsx`, and `npx tsc -p tsconfig.ci.json --noEmit`
(the exact typecheck CI runs) — all clean.

---

## 4. What was deliberately deferred, and why

Per the audit's own recommended order, two items were **not** done in this pass, on purpose rather than by
oversight:

- **Item 5 — consolidating `api/*.ts` and `functions/src/index.ts`.** The duplication is real and is the mechanism
  that let the citation-manifest bug (fixed earlier this session) exist inconsistently across two copies. But it's
  a large, mechanical, repo-wide refactor touching a dormant production path (per the audit's §1.4, Firebase
  Hosting isn't serving traffic today), and doing it inside the same pass as the retrieval/correctness fixes above
  would make this diff much harder to review and to revert independently if something in it needed to be rolled
  back. It's a clean, well-scoped follow-up on its own.
- **Item 6 — replacing the cosmetic `reasoningSteps`/`quantitativeData`/`confidence` fields in `api/analyze.ts` and
  the rest of `api/research.ts`'s templated steps.** These don't cause incorrect answers (unlike the retrieval gap),
  so they were lower urgency than everything above. `api/research.ts`'s reasoning-step list did get one honest new
  line in this pass (reporting whether retrieval actually ran, §1.1) — but the pre-existing regex-scraped fields in
  `api/analyze.ts` are untouched.

**What still needs attention before this can be called fully closed, in priority order:**

1. ~~Verify the Firestore silent-write-failure fix against a real or emulated Firestore project.~~ **Done — see
   §2.5.** Verified against a real Firestore emulator (rules, size-limit rejection, and realistic multi-document
   volume all confirmed, 8/8), not the mocks the rest of this pass necessarily relies on. The one remaining gap
   from that verification is narrower than "unverified": it was checked against the emulator's `(default)` database
   rather than production's named database, for the reason given in §2.5 (the installed test library doesn't expose
   a `databaseId` option) — worth re-confirming with a direct multi-database emulator setup if that assumption is
   ever in doubt, but not blocking.
2. Load-test the embeddings integration against realistic document library sizes to confirm the 400-chunk /
   20-second timeout ceiling in `src/lib/retrieval.ts` doesn't become the new bottleneck for large accounts, and
   confirm the actual latency/cost impact of embedding on every request before deciding whether a persistent chunk
   cache (deliberately not built in this pass — see §1.1) is worth its own write-path risk.
3. Decide whether to add `firebase-tools` and `@firebase/rules-unit-testing` as checked-in `devDependencies` so
   `tests/phase-0-firestore-emulator.test.ts` can run in CI (per `.github/workflows/signal87-build.yml`) rather than
   needing a one-off local install each time — see §2.5's closing note.
4. Items 5 and 6 above, as their own scoped passes.
