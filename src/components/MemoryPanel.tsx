import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { addMemory, deleteMemory, loadMemories, MAX_MEMORIES, MAX_MEMORY_CHARS, MemoryFact, subscribeMemories } from '../lib/memoryStore';

/** Settings → Memory: the facts Signal87 remembers about you, which you can add to or remove. */
export const MemoryPanel: React.FC = () => {
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeMemories(setFacts);
    void loadMemories(true);
    return unsubscribe;
  }, []);

  const add = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addMemory(draft, 'settings');
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that fact.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try { await deleteMemory(id); } catch { setError('Could not remove that fact. Try again.'); }
  };

  return (
    <div>
      <p className="text-sm text-[var(--ink-2)]">
        Signal87 uses these facts in every answer. Add them here, or say “Remember that …” in Ask. Say “Forget …” to remove one.
      </p>
      <div className="mt-4 flex gap-2">
        <label htmlFor="memory-draft" className="sr-only">New fact to remember</label>
        <input
          id="memory-draft"
          value={draft}
          maxLength={MAX_MEMORY_CHARS}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }}
          placeholder="e.g. Crewstone is our co-GP on Harvard Street"
          className="min-w-0 flex-1 rounded-lg border border-[var(--rule)] bg-[var(--surface)] px-3 py-2.5 text-sm"
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={!draft.trim() || busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--teal)] px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          <Plus size={14} /> Add
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-[var(--alert,#c0392b)]">{error}</p>}
      {facts.length === 0 ? (
        <p className="mt-4 text-xs text-[var(--muted)]">Nothing saved yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--rule-2)] overflow-hidden rounded-lg border border-[var(--rule)]">
          {facts.map((fact) => (
            <li key={fact.id} className="flex items-start gap-3 bg-[var(--surface)] px-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1 text-[var(--ink)]">{fact.text}</span>
              <button type="button" onClick={() => void remove(fact.id)} aria-label={`Remove: ${fact.text}`} className="shrink-0 rounded p-1 text-[var(--muted)] hover:text-[var(--ink)]">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-[var(--muted)]">{facts.length} of {MAX_MEMORIES} saved</p>
    </div>
  );
};
