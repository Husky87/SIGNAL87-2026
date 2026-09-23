/**
 * Saved memory: short facts the user asks Signal87 to remember ("Remember that
 * Crewstone is our co-GP"). Stored under users/{uid}/memories, sent with every
 * question, editable in Settings → Memory.
 */
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { parseMemoryCommand } from './memoryCommands';

export { parseMemoryCommand };

export interface MemoryFact {
  id: string;
  text: string;
  createdAt: number;
  source: 'chat' | 'settings';
}

export type MemoryEvent =
  | { type: 'saved'; text: string }
  | { type: 'forgotten'; text: string }
  | { type: 'not-found'; text: string };

const COLLECTION = 'memories';
export const MAX_MEMORIES = 60;
export const MAX_MEMORY_CHARS = 300;

let cache: MemoryFact[] | null = null;
let cacheUid: string | null = null;
const listeners = new Set<(facts: MemoryFact[]) => void>();

function uid(): string | null { return auth?.currentUser?.uid ?? null; }
function notify() { const facts = cache || []; listeners.forEach((fn) => fn(facts)); }

export function subscribeMemories(fn: (facts: MemoryFact[]) => void): () => void {
  listeners.add(fn);
  if (cache) fn(cache);
  return () => listeners.delete(fn);
}

export async function loadMemories(force = false): Promise<MemoryFact[]> {
  const id = uid();
  if (!id || !db) return [];
  if (!force && cache && cacheUid === id) return cache;
  try {
    const snap = await getDocs(query(collection(db, 'users', id, COLLECTION), orderBy('createdAt', 'asc')));
    const facts: MemoryFact[] = [];
    snap.forEach((d) => {
      const x = d.data() as Partial<MemoryFact>;
      if (typeof x.text === 'string' && x.text.trim()) facts.push({ id: d.id, text: x.text, createdAt: Number(x.createdAt) || 0, source: x.source === 'settings' ? 'settings' : 'chat' });
    });
    cache = facts;
    cacheUid = id;
    notify();
    return facts;
  } catch (error) {
    console.warn('Could not load saved memory:', error);
    return cache || [];
  }
}

export async function addMemory(text: string, source: MemoryFact['source'] = 'chat'): Promise<MemoryFact | null> {
  const id = uid();
  const clean = text.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '').slice(0, MAX_MEMORY_CHARS);
  if (!id || !db || clean.length < 3) return null;
  const facts = await loadMemories();
  const existing = facts.find((f) => f.text.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  if (facts.length >= MAX_MEMORIES) throw new Error(`Memory is full (${MAX_MEMORIES} facts). Remove some in Settings → Memory.`);
  const fact: MemoryFact = { id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: clean, createdAt: Date.now(), source };
  await setDoc(doc(db, 'users', id, COLLECTION, fact.id), { text: fact.text, createdAt: fact.createdAt, source: fact.source });
  cache = [...facts, fact];
  notify();
  return fact;
}

export async function deleteMemory(factId: string): Promise<void> {
  const id = uid();
  if (!id || !db) return;
  await deleteDoc(doc(db, 'users', id, COLLECTION, factId));
  cache = (cache || []).filter((f) => f.id !== factId);
  notify();
}

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) || []);

/** Applies a remember/forget command and describes what happened, for the answer. */
export async function applyMemoryCommand(command: { type: 'remember' | 'forget'; text: string }): Promise<MemoryEvent> {
  if (command.type === 'remember') {
    const fact = await addMemory(command.text, 'chat');
    return { type: 'saved', text: fact?.text || command.text };
  }
  const facts = await loadMemories();
  const target = words(command.text);
  let best: MemoryFact | null = null;
  let bestScore = 0;
  for (const f of facts) {
    const fw = words(f.text);
    let overlap = 0;
    target.forEach((w) => { if (fw.has(w)) overlap++; });
    const score = overlap / Math.max(1, target.size);
    if (score > bestScore) { bestScore = score; best = f; }
  }
  if (!best || bestScore < 0.5) return { type: 'not-found', text: command.text };
  await deleteMemory(best.id);
  return { type: 'forgotten', text: best.text };
}
