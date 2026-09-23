/**
 * Meaning-based search index for the user's files.
 *
 * Each document is split into the same passages retrieval uses, each passage is
 * embedded once (via /api/embed), and the compact vectors are saved under
 * users/{uid}/docIndex/{docId}. A document is re-embedded only when its text
 * changes. At question time the question is embedded and every indexed passage
 * gets a similarity score, which retrieval blends with its word-based score.
 *
 * Everything degrades gracefully: if embeddings are unavailable or a document is
 * not indexed yet, search falls back to words alone.
 */
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { hasUsableText } from './extractedText';
import { docText, RetrievalDoc, splitIntoPassages } from './retrieval';
import { EMBEDDING_DIMS, EMBEDDING_MODEL, PackedVector, packedDot, textFingerprint, unpackVector } from './vectorCodec';

const INDEX_COLLECTION = 'docIndex';
/** Bump when splitIntoPassages changes, so every index is rebuilt. */
const CHUNKER_VERSION = 1;
const MAX_PASSAGES_PER_DOC = 1100;
const EMBED_BATCH = 64;

interface IndexEntry {
  fingerprint: string;
  vectors: Array<{ q: Int8Array; scale: number }>;
}

const cache = new Map<string, IndexEntry>();
let loadedForUid: string | null = null;
let loadPromise: Promise<void> | null = null;
let indexingPromise: Promise<void> | null = null;
let disabled = false;
const listeners = new Set<(status: IndexStatus) => void>();

export interface IndexStatus {
  indexing: boolean;
  indexedDocs: number;
  pendingDocs: number;
  available: boolean;
}
let status: IndexStatus = { indexing: false, indexedDocs: 0, pendingDocs: 0, available: true };

function setStatus(next: Partial<IndexStatus>) {
  status = { ...status, ...next };
  listeners.forEach((fn) => fn(status));
}

export function subscribeIndexStatus(fn: (s: IndexStatus) => void): () => void {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

const fingerprintOf = (text: string) => `v${CHUNKER_VERSION}:${EMBEDDING_MODEL}:${EMBEDDING_DIMS}:${textFingerprint(text)}`;

async function embed(texts: string[]): Promise<PackedVector[]> {
  const response = await fetch('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts })
  });
  if (response.status === 503) { disabled = true; setStatus({ available: false }); throw new Error('Embeddings unavailable'); }
  if (!response.ok) throw new Error(`Embedding failed (HTTP ${response.status})`);
  const data = await response.json() as { vectors?: PackedVector[] };
  if (!Array.isArray(data.vectors) || data.vectors.length !== texts.length) throw new Error('Embedding response was incomplete');
  return data.vectors;
}

/** Loads every saved document index for the signed-in user into memory (once per session). */
export async function loadIndex(): Promise<void> {
  const uid = auth?.currentUser?.uid;
  if (!uid || !db) return;
  if (loadedForUid !== uid) { cache.clear(); loadedForUid = uid; loadPromise = null; }
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const snap = await getDocs(collection(db, 'users', uid, INDEX_COLLECTION));
        snap.forEach((d) => {
          const x = d.data() as { fingerprint?: string; vectors?: string[]; scales?: number[] };
          if (!x.fingerprint || !Array.isArray(x.vectors) || !Array.isArray(x.scales)) return;
          cache.set(d.id, {
            fingerprint: x.fingerprint,
            vectors: x.vectors.map((b64, i) => unpackVector({ b64, scale: Number(x.scales![i]) || 0 }))
          });
        });
        setStatus({ indexedDocs: cache.size });
      } catch (error) {
        console.warn('Could not load the search index:', error);
      }
    })();
  }
  return loadPromise;
}

async function indexOne(uid: string, item: RetrievalDoc & { id: string }): Promise<void> {
  const text = docText(item);
  const fingerprint = fingerprintOf(text);
  if (cache.get(item.id)?.fingerprint === fingerprint) return;
  const passages = splitIntoPassages(text).slice(0, MAX_PASSAGES_PER_DOC);
  if (passages.length === 0) return;
  const packed: PackedVector[] = [];
  for (let i = 0; i < passages.length; i += EMBED_BATCH) {
    packed.push(...await embed(passages.slice(i, i + EMBED_BATCH)));
  }
  await setDoc(doc(db, 'users', uid, INDEX_COLLECTION, item.id), {
    fingerprint,
    model: EMBEDDING_MODEL,
    dims: EMBEDDING_DIMS,
    count: packed.length,
    vectors: packed.map((p) => p.b64),
    scales: packed.map((p) => p.scale),
    title: String(item.title || '').slice(0, 200),
    updatedAt: Date.now()
  });
  cache.set(item.id, { fingerprint, vectors: packed.map(unpackVector) });
}

/**
 * Indexes any document that is new or has changed, one at a time in the
 * background. Safe to call often: repeat calls join the run in progress.
 */
export function ensureIndexed(docs: Array<RetrievalDoc & { id?: string }>): Promise<void> {
  if (disabled) return Promise.resolve();
  if (indexingPromise) return indexingPromise;
  indexingPromise = (async () => {
    const uid = auth?.currentUser?.uid;
    if (!uid || !db) return;
    await loadIndex();
    const todo = docs.filter((d): d is RetrievalDoc & { id: string } =>
      !!d.id && hasUsableText(docText(d)) && cache.get(d.id)?.fingerprint !== fingerprintOf(docText(d))
    );
    if (todo.length === 0) { setStatus({ indexing: false, pendingDocs: 0, indexedDocs: cache.size }); return; }
    setStatus({ indexing: true, pendingDocs: todo.length });
    let remaining = todo.length;
    for (const item of todo) {
      if (disabled) break;
      try { await indexOne(uid, item); } catch (error) { console.warn(`Could not index "${item.title}":`, error); }
      remaining -= 1;
      setStatus({ pendingDocs: remaining, indexedDocs: cache.size });
    }
    setStatus({ indexing: false, pendingDocs: 0, indexedDocs: cache.size });
  })().finally(() => { indexingPromise = null; });
  return indexingPromise;
}

/**
 * Embeds the question and returns a scorer for retrieval: similarity for each
 * indexed passage of an up-to-date document, undefined otherwise. Resolves to
 * undefined when meaning-based search isn't available, so callers fall back to
 * word search.
 */
export async function semanticScorer(question: string, docs: Array<RetrievalDoc & { id?: string }>, timeoutMs = 5000):
  Promise<((d: RetrievalDoc, passageIndex: number) => number | undefined) | undefined> {
  if (disabled || !question.trim()) return undefined;
  const run = async () => {
    await loadIndex();
    const usable = docs.filter((d) => d.id && cache.get(d.id)?.fingerprint === fingerprintOf(docText(d)));
    if (usable.length === 0) return undefined;
    const [packedQuestion] = await embed([question]);
    const q = unpackVector(packedQuestion);
    const scores = new Map<string, number[]>();
    for (const d of usable) scores.set(d.id!, cache.get(d.id!)!.vectors.map((v) => packedDot(q, v)));
    return (d: RetrievalDoc, passageIndex: number) => (d.id ? scores.get(d.id)?.[passageIndex] : undefined);
  };
  try {
    return await Promise.race([
      run(),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), timeoutMs))
    ]);
  } catch (error) {
    console.warn('Meaning-based search unavailable for this question:', error);
    return undefined;
  }
}
