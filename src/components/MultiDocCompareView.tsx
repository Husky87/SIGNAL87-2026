import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  FileText,
  GitCompare,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  X
} from 'lucide-react';
import { DocumentItem } from '../types';

interface MultiDocCompareViewProps {
  documents: DocumentItem[];
  /** Documents pre-selected by whoever navigated here, e.g. Compare in the file library. */
  initialSelectedIds?: string[];
  /** Leaves the comparison screen (back to Files). */
  onBack?: () => void;
}

/** A comparison as the page renders it: every section is a plain list of strings. */
interface NormalizedComparison {
  summary: string;
  similarities: string[];
  differences: string[];
  missingClauses: string[];
  conflicts: string[];
}

const MAX_DOCS = 5;

// The model does not always return the exact shape asked for: a section can come
// back as a string, an object, or a list of objects. Rendering those directly
// crashed the app ("(intermediate value).map is not a function"), so every value
// is flattened to text before it reaches the page.
const toText = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const lead = ['title', 'topic', 'clause', 'issue', 'point', 'name'].map((k) => toText(obj[k])).find(Boolean);
    const body = ['description', 'detail', 'details', 'explanation', 'text', 'summary', 'difference', 'note']
      .map((k) => toText(obj[k]))
      .find(Boolean);
    if (lead && body) return `${lead}: ${body}`;
    if (lead || body) return (lead || body) as string;
    return Object.entries(obj)
      .map(([k, v]) => {
        const t = toText(v);
        return t ? `${k}: ${t}` : '';
      })
      .filter(Boolean)
      .join('; ');
  }
  return '';
};

const toList = (value: unknown): string[] => {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(toText).filter(Boolean);
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const t = toText(v);
        return t ? `${k}: ${t}` : '';
      })
      .filter(Boolean);
  }
  const t = toText(value);
  return t ? [t] : [];
};

const normalizeComparison = (data: any): NormalizedComparison => ({
  summary: toText(data?.summary) || 'No summary was returned.',
  similarities: toList(data?.similarities),
  differences: toList(data?.differences),
  missingClauses: toList(data?.missingClauses),
  conflicts: toList(data?.conflicts)
});

const SECTIONS: Array<{
  key: keyof Omit<NormalizedComparison, 'summary'>;
  title: string;
  icon: React.ReactNode;
  dot: string;
}> = [
  { key: 'similarities', title: 'Similarities', icon: <CheckCircle2 size={16} />, dot: 'var(--teal)' },
  { key: 'differences', title: 'Differences', icon: <GitCompare size={16} />, dot: 'var(--warn, #b7791f)' },
  { key: 'missingClauses', title: 'Missing clauses', icon: <ShieldAlert size={16} />, dot: 'var(--muted)' },
  { key: 'conflicts', title: 'Conflicts', icon: <AlertTriangle size={16} />, dot: 'var(--alert, #c0392b)' }
];

export const MultiDocCompareView: React.FC<MultiDocCompareViewProps> = ({ documents, initialSelectedIds, onBack }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<NormalizedComparison | null>(null);
  const [comparedIds, setComparedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState('');

  // Re-seed when the caller arrives with a different selection — the view stays
  // mounted across tab switches, so initial state alone would only ever apply once.
  const seedKey = (initialSelectedIds ?? []).join(',');
  useEffect(() => {
    if (seedKey) {
      setSelectedIds(seedKey.split(',').slice(0, MAX_DOCS));
      setComparison(null);
      setError(null);
    }
  }, [seedKey]);

  const selectedDocs = useMemo(
    () => selectedIds.map((id) => documents.find((d) => d.id === id)).filter(Boolean) as DocumentItem[],
    [selectedIds, documents]
  );

  const visibleDocs = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? documents.filter((d) => (d.title || '').toLowerCase().includes(q)) : documents;
  }, [documents, filter]);

  const toggleSelect = (id: string) => {
    setError(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= MAX_DOCS) {
        setError(`You can compare up to ${MAX_DOCS} documents at a time.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleRunComparison = async () => {
    if (selectedDocs.length < 2 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: selectedDocs })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.details || data?.error || `Request failed (HTTP ${res.status})`);
      setComparison(normalizeComparison(data));
      setComparedIds(selectedDocs.map((d) => d.id));
    } catch (err) {
      console.error('Compare API error:', err);
      setError(err instanceof Error ? err.message : 'The comparison could not be generated.');
    } finally {
      setLoading(false);
    }
  };

  const resetComparison = () => {
    setComparison(null);
    setError(null);
  };

  const comparedTitles = comparedIds
    .map((id) => documents.find((d) => d.id === id)?.title)
    .filter(Boolean) as string[];

  return (
    <div className="s87-page">
      <div className="s87-column">
        {/* Back */}
        <button
          type="button"
          onClick={comparison ? resetComparison : onBack}
          className="mb-6 inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-2 -ml-2 text-[12px] font-medium text-[var(--muted)] transition hover:text-[var(--ink)]"
        >
          <ArrowLeft size={15} /> {comparison ? 'Back to selection' : 'Back to Files'}
        </button>

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="s87-page-title">Compare documents</h1>
            <p className="s87-page-description">
              {comparison
                ? `Comparing ${comparedTitles.length} documents.`
                : `Pick 2 to ${MAX_DOCS} documents to see where they agree, differ, and conflict.`}
            </p>
          </div>
          {comparison ? (
            <button
              type="button"
              onClick={resetComparison}
              className="flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--surface)] px-5 text-[12px] font-semibold text-[var(--ink)] shadow-sm transition hover:bg-[var(--raised)]"
            >
              <RotateCcw size={15} /> New comparison
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunComparison}
              disabled={loading || selectedDocs.length < 2}
              className="flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--teal)] px-5 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <GitCompare size={15} />}
              {loading ? 'Comparing…' : `Compare${selectedDocs.length ? ` (${selectedDocs.length})` : ''}`}
            </button>
          )}
        </div>

        {error && (
          <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--rule)] bg-[var(--surface)] px-4 py-3 text-[12px] text-[var(--ink-2)]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--alert, #c0392b)' }} />
            <span className="min-w-0 flex-1">{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="shrink-0 text-[var(--muted)] hover:text-[var(--ink)]">
              <X size={14} />
            </button>
          </div>
        )}

        {comparison ? (
          <div className="mt-8 space-y-4">
            {/* Compared documents */}
            <div className="flex flex-wrap gap-2">
              {comparedTitles.map((title, i) => (
                <span key={i} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--rule)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--ink-2)]">
                  <FileText size={12} className="shrink-0 text-[var(--muted)]" />
                  <span className="truncate">{title}</span>
                </span>
              ))}
            </div>

            {/* Summary */}
            <section className="rounded-2xl border border-[var(--rule)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">Summary</h2>
              <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-[var(--ink)]">{comparison.summary}</p>
            </section>

            {/* Sections */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {SECTIONS.map(({ key, title, icon, dot }) => {
                const items = comparison[key];
                return (
                  <section key={key} className="rounded-2xl border border-[var(--rule)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
                    <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ink)]">
                      <span style={{ color: dot }}>{icon}</span>
                      {title}
                      <span className="ml-auto text-[11px] font-normal text-[var(--muted)]">{items.length}</span>
                    </h3>
                    {items.length > 0 ? (
                      <ul className="mt-4 space-y-3">
                        {items.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-[var(--ink-2)]">
                            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
                            <span className="min-w-0">{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-[12px] text-[var(--muted)]">None found.</p>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-8">
            {/* Selected chips */}
            {selectedDocs.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {selectedDocs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => toggleSelect(doc.id)}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--teal-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--teal)] transition hover:opacity-80"
                  >
                    <span className="truncate">{doc.title}</span>
                    <X size={12} className="shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="flex h-11 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--surface)] px-4 shadow-sm">
              <Search size={15} className="text-[var(--muted)]" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search your files…"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
              />
            </div>

            {/* Document list */}
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--surface)] shadow-sm">
              {visibleDocs.length > 0 ? (
                visibleDocs.map((doc, idx) => {
                  const isSelected = selectedIds.includes(doc.id);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => toggleSelect(doc.id)}
                      aria-pressed={isSelected}
                      className={`flex min-h-[56px] w-full items-center gap-3 px-4 text-left transition hover:bg-[var(--raised)] sm:px-5 ${
                        idx < visibleDocs.length - 1 ? 'border-b border-[var(--rule-2)]' : ''
                      } ${isSelected ? 'bg-[var(--teal-soft)]/40' : ''}`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                          isSelected ? 'border-[var(--teal)] bg-[var(--teal)] text-white' : 'border-[var(--rule)] bg-[var(--surface)]'
                        }`}
                      >
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </span>
                      <FileText size={16} className="shrink-0 text-[var(--muted)]" />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink)]">{doc.title}</span>
                    </button>
                  );
                })
              ) : (
                <div className="px-6 py-12 text-center text-[13px] text-[var(--muted)]">
                  {documents.length === 0 ? 'Upload at least two files to compare them.' : 'No files match your search.'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
