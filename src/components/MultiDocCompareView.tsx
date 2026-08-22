import React, { useState, useEffect } from 'react';
import {
  GitFork,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Loader2,
  X,
  Layers,
  ArrowRight,
  ShieldAlert,
  Download
} from 'lucide-react';
import { DocumentItem, ComparisonResult } from '../types';

interface MultiDocCompareViewProps {
  documents: DocumentItem[];
  /** Documents pre-selected by whoever navigated here, e.g. Compare in the file library. */
  initialSelectedIds?: string[];
}

export const MultiDocCompareView: React.FC<MultiDocCompareViewProps> = ({
  documents,
  initialSelectedIds
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds ?? []);
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);

  // Re-seed when the caller arrives with a different selection — the view stays
  // mounted across tab switches, so initial state alone would only ever apply once.
  const seedKey = (initialSelectedIds ?? []).join(',');
  useEffect(() => {
    if (seedKey) setSelectedIds(seedKey.split(','));
  }, [seedKey]);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleRunComparison = async () => {
    if (selectedIds.length < 2) return;
    setLoading(true);

    const activeDocs = documents.filter((d) => selectedIds.includes(d.id));

    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: activeDocs })
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(error.error || error.details || 'Failed to compare documents');
      }

      const data = await res.json();
      setComparison(data);
      setLoading(false);
    } catch (err) {
      console.error('Compare API error:', err);
      alert(`Comparison failed: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  };

  const activeDocs = documents.filter((d) => selectedIds.includes(d.id));

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 bg-[var(--bg)] text-[var(--ink)] min-h-[100dvh] w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--rule)]">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight flex items-center gap-2">
            <GitFork size={28} className="text-[var(--accent-ink)]" /> Multi-Document Comparison Matrix
          </h1>
          <p className="text-xs text-[var(--ink-2)]">
            Compare 2 to 50+ contracts, bills, or financial filings simultaneously using Signal87 long-context reasoning.
          </p>
        </div>

        <button
          onClick={handleRunComparison}
          disabled={loading || selectedIds.length < 2}
          className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent)] disabled:opacity-50 text-[var(--accent-contrast)] rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Analyzing Document Collection...
            </>
          ) : (
            <>
              <Sparkles size={16} /> Run Comparative Analysis ({selectedIds.length} Docs)
            </>
          )}
        </button>
      </div>

      {/* Document Selection Strip */}
      <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--rule)] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider">
            Select Documents to Compare ({selectedIds.length} Selected)
          </span>
          <span className="text-[11px] text-[var(--ink-2)] font-mono">Minimum 2 documents required</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {documents.map((doc) => {
            const isSelected = selectedIds.includes(doc.id);
            return (
              <div
                key={doc.id}
                onClick={() => toggleSelect(doc.id)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 min-w-0 ${
 isSelected
 ? 'border-[var(--accent)] bg-[var(--accent)]/30 font-semibold text-[var(--ink)]'
 : 'border-[var(--rule)] bg-[var(--surface-2)] text-[var(--ink-2)] hover:bg-[var(--rule)]'
 }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText size={16} className={`flex-shrink-0 ${isSelected ? 'text-[var(--accent-ink)]' : 'text-[var(--ink-2)]'}`} />
                  <span className="truncate text-[var(--ink)]">{doc.title}</span>
                </div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  className="rounded text-[var(--accent)] focus:ring-[var(--accent)] flex-shrink-0"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparison Results Area */}
      {comparison ? (
        <div className="space-y-6">
          {/* Executive Comparative Summary Box */}
          <div className="p-6 bg-[var(--surface)] text-[var(--ink)] rounded-2xl border border-[var(--rule)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--accent-ink)] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={16} className="text-[var(--accent-ink)]" /> Executive Comparative Synthesis
              </span>
              <span className="text-[10px] bg-[var(--accent)]/40 text-[var(--accent-ink)] px-2 py-0.5 rounded font-mono border border-[var(--accent)]">
                Signal87 Long-Context Multi-Doc Engine
              </span>
            </div>
            <p className="text-[var(--ink-2)] text-xs leading-relaxed font-normal">{comparison.summary}</p>
          </div>

          {/* Side-by-Side Comparison Grid Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Similarities & Overlaps */}
            <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--rule)] space-y-4">
              <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                <CheckCircle2 size={18} className="text-[var(--accent-ink)]" /> Shared Similarities & Overlapping Clauses
              </h3>
              <ul className="space-y-2.5">
                {(comparison.similarities || []).map((item, idx) => (
                  <li key={idx} className="p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--rule)] text-xs text-[var(--ink-2)] leading-relaxed flex items-start gap-2">
                    <span className="text-[var(--accent-ink)] font-bold mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Key Differences */}
            <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--rule)] space-y-4">
              <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                <AlertTriangle size={18} className="text-[var(--warn)]" /> Key Differences & Divergences
              </h3>
              <ul className="space-y-2.5">
                {(comparison.differences || []).map((item, idx) => (
                  <li key={idx} className="p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--rule)] text-xs text-[var(--ink-2)] leading-relaxed flex items-start gap-2">
                    <span className="text-[var(--warn)] font-bold mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Missing Clauses & Omissions */}
            <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--rule)] space-y-4">
              <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                <ShieldAlert size={18} className="text-[var(--danger)]" /> Missing Clauses & Omissions
              </h3>
              <ul className="space-y-2.5">
                {(comparison.missingClauses || []).map((item, idx) => (
                  <li key={idx} className="p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--rule)] text-xs text-[var(--ink-2)] leading-relaxed flex items-start gap-2">
                    <span className="text-[var(--danger)] font-bold mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Conflicts & Risk Trends */}
            <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--rule)] space-y-4">
              <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                <GitFork size={18} className="text-[var(--accent-ink)]" /> Direct Conflicts & Risk Exposure
              </h3>
              <ul className="space-y-2.5">
                {(comparison.conflicts || []).map((item, idx) => (
                  <li key={idx} className="p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--rule)] text-xs text-[var(--ink-2)] leading-relaxed flex items-start gap-2">
                    <span className="text-[var(--accent-ink)] font-bold mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-dashed border-[var(--rule)] rounded-2xl p-10 text-center space-y-3">
          <GitFork size={36} className="mx-auto text-[var(--accent-ink)]" />
          <h3 className="text-sm font-bold text-[var(--ink)]">No active comparison generated yet</h3>
          <p className="text-xs text-[var(--ink-2)] max-w-md mx-auto leading-relaxed">
            Select 2 or more documents from the list above and click <span className="font-bold text-[var(--ink)]">"Run Comparative Analysis"</span> to generate side-by-side legal clause comparisons and conflict matrices.
          </p>
        </div>
      )}
    </div>
  );
};
