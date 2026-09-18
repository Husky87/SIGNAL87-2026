/**
 * Verifies the Firestore-touching half of the Phase 0 fix (§1.4 in
 * docs/phase-0-fixes.md — "not verified against a live Firestore project in
 * this environment") against the real Firestore emulator, not mocks.
 *
 * Must be run through `firebase emulators:exec`, which starts the emulator,
 * injects FIRESTORE_EMULATOR_HOST, runs this file, then tears the emulator
 * down:
 *
 *   npx firebase emulators:exec --project demo-signal87-test \
 *     "npx tsx tests/phase-0-firestore-emulator.test.ts"
 *
 * Uses @firebase/rules-unit-testing rather than re-importing
 * src/lib/firestoreService.ts directly, because that module transitively
 * imports src/lib/firebase.ts, which calls browser-only APIs
 * (indexedDBLocalPersistence, browserPopupRedirectResolver, window,
 * sessionStorage) at module load time and has no meaning in this Node/tsx
 * harness — the same class of limitation already noted for
 * src/lib/fileParser.ts in docs/phase-0-audit.md §3.4. This file instead
 * replicates firestoreService.ts's exact collection paths, document shape,
 * and query patterns against the real emulator and real firestore.rules,
 * which is what actually matters for this verification: not the calling
 * syntax, but whether Firestore itself (rules, size limits, index
 * requirements) behaves the way the fix assumes.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { fillerDocument, rocklandTrustMarch } from './fixtures/phase-0-audit/synthetic-documents';

const PROJECT_ID = 'demo-signal87-test';

type Result = { id: string; name: string; pass: boolean; detail: string };
const results: Result[] = [];
function check(id: string, name: string, pass: boolean, detail = '') { results.push({ id, name, pass, detail }); }

async function expectSucceeds(id: string, name: string, promise: Promise<any>) {
  try { await promise; check(id, name, true); }
  catch (err: any) { check(id, name, false, err?.message || String(err)); }
}
async function expectDenied(id: string, name: string, promise: Promise<any>) {
  try { await assertFails(promise); check(id, name, true); }
  catch (err: any) { check(id, name, false, err?.message || String(err)); }
}

async function main() {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  let testEnv: RulesTestEnvironment;
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules, host: '127.0.0.1', port: 8080 }
    });
  } catch (err: any) {
    console.error('Could not connect to the Firestore emulator on 127.0.0.1:8080. Run this file via:');
    console.error('  npx firebase emulators:exec --project demo-signal87-test "npx tsx tests/phase-0-firestore-emulator.test.ts"');
    console.error(err?.message || err);
    process.exitCode = 1;
    return;
  }

  try {
    await testEnv.clearFirestore();

    // ── R1-R4: security rules match firestoreService.ts's actual access pattern ──
    {
      const alice = testEnv.authenticatedContext('alice-uid');
      const aliceDb = alice.firestore();
      const docRef = aliceDb.collection('users').doc('alice-uid').collection('documents').doc('doc-1');

      await expectSucceeds('R1', 'Authenticated user can write to their own users/{uid}/documents subtree (matches saveDocumentToFirestore)',
        docRef.set({ title: 'Test Doc', fullText: 'hello world', userId: 'alice-uid' }));

      const snap = await docRef.get();
      check('R4', 'Round-tripped document data matches exactly what was written (matches fetchDocumentsFromFirestore read shape)',
        snap.data()?.fullText === 'hello world' && snap.data()?.title === 'Test Doc',
        `got: ${JSON.stringify(snap.data())}`);

      const bob = testEnv.authenticatedContext('bob-uid');
      const bobReadingAlice = bob.firestore().collection('users').doc('alice-uid').collection('documents').doc('doc-1');
      await expectDenied('R2', 'A different authenticated user CANNOT read/write alice\'s documents subtree', bobReadingAlice.get());

      const unauthed = testEnv.unauthenticatedContext();
      const unauthedWrite = unauthed.firestore().collection('users').doc('alice-uid').collection('documents').doc('doc-2');
      await expectDenied('R3', 'An unauthenticated request is denied (defense in depth — saveDocumentToFirestore also short-circuits on !uid client-side)', unauthedWrite.set({ title: 'x', fullText: 'y' }));

      const legacyWrite = aliceDb.collection('documents').doc('legacy-doc');
      await expectDenied('R5', 'A write to a legacy/root-level collection outside users/{uid}/** is denied (the "legacy shared collections are closed" rule)', legacyWrite.set({ title: 'legacy' }));
    }

    // ── R6: the exact failure mode saveDocumentToFirestore's catch block exists for ──
    {
      const alice = testEnv.authenticatedContext('alice-uid');
      const db = alice.firestore();
      // Firestore's hard limit is 1,048,576 bytes for the whole document.
      // 1,100,000 raw chars of fullText alone exceeds it once the other
      // fields and field-name overhead are counted.
      const oversizedText = 'x'.repeat(1_100_000);
      const docRef = db.collection('users').doc('alice-uid').collection('documents').doc('doc-oversized');
      let rejected = false;
      let errorDetail = '';
      try {
        await docRef.set({ title: 'Oversized Document', fullText: oversizedText, userId: 'alice-uid' });
      } catch (err: any) {
        rejected = true;
        errorDetail = err?.code ? `${err.code}: ${err.message}` : String(err?.message || err);
      }
      check('R6', 'A document whose fullText pushes it past Firestore\'s 1 MiB limit is rejected by Firestore itself (the exact failure saveDocumentToFirestore now surfaces instead of swallowing)', rejected, errorDetail);
    }

    // ── R7: realistic volume — the Rockland Trust/Verizon fixture set, written and read back for real ──
    {
      const alice = testEnv.authenticatedContext('carol-uid');
      const db = alice.firestore();
      const fillers = [1, 2, 3, 4].map((n) => fillerDocument(`doc-filler-${n}`, `Unrelated Filing ${n}.pdf`, 28000));
      const allDocs = [...fillers, rocklandTrustMarch];
      for (const doc of allDocs) {
        await db.collection('users').doc('carol-uid').collection('documents').doc(doc.id).set({ title: doc.title, fullText: doc.fullText, userId: 'carol-uid' });
      }
      const snapshot = await db.collection('users').doc('carol-uid').collection('documents').get();
      const readBackIds = snapshot.docs.map((d) => d.id).sort();
      const expectedIds = allDocs.map((d) => d.id).sort();
      const allPresent = JSON.stringify(readBackIds) === JSON.stringify(expectedIds);
      const rocklandDoc = snapshot.docs.find((d) => d.id === rocklandTrustMarch.id);
      const contentIntact = rocklandDoc?.data()?.fullText?.includes('VERIZON WIRELESS PAYMENT') === true;
      check('R7', `All ${allDocs.length} documents (4 large fillers + the Rockland Trust statement) round-trip through a real collection write+read with content intact`, allPresent && contentIntact,
        `allPresent=${allPresent}, contentIntact=${contentIntact}, readBackIds=${JSON.stringify(readBackIds)}`);
    }

    // ── R8: the one orderBy+limit query pattern the app actually uses (fetchChatMessagesFromFirestore) needs no manual index ──
    {
      const alice = testEnv.authenticatedContext('dave-uid');
      const db = alice.firestore();
      const messages = [
        { id: 'm1', timestampAsc: 100, text: 'first' },
        { id: 'm2', timestampAsc: 300, text: 'third' },
        { id: 'm3', timestampAsc: 200, text: 'second' }
      ];
      for (const m of messages) {
        await db.collection('users').doc('dave-uid').collection('chat_messages').doc(m.id).set({ text: m.text, timestampAsc: m.timestampAsc, userId: 'dave-uid' });
      }
      let queryOk = false; let orderCorrect = false; let errorDetail = '';
      try {
        const snap = await db.collection('users').doc('dave-uid').collection('chat_messages').orderBy('timestampAsc', 'asc').limit(50).get();
        queryOk = true;
        orderCorrect = snap.docs.map((d) => d.data().text).join(',') === 'first,second,third';
      } catch (err: any) {
        errorDetail = err?.code ? `${err.code}: ${err.message}` : String(err?.message || err);
      }
      check('R8', 'orderBy("timestampAsc")+limit(50) — the one query pattern the app uses — runs against the emulator with no composite index required', queryOk && orderCorrect,
        queryOk ? `orderCorrect=${orderCorrect}` : errorDetail);
    }
  } finally {
    await testEnv!.cleanup();
  }

  console.log('\n=== Firestore Emulator Verification — Results ===\n');
  let totalPass = 0;
  for (const r of results) {
    if (r.pass) totalPass++;
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.id}: ${r.name}${r.detail ? `\n       ${r.detail}` : ''}`);
  }
  console.log(`\nTOTAL: ${totalPass}/${results.length} passed\n`);
  if (totalPass < results.length) process.exitCode = 1;
}

main().catch((err) => { console.error('Suite crashed:', err); process.exitCode = 1; });
