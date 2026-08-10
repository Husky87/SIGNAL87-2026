import React, { useState } from 'react';
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
}

export const MultiDocCompareView: React.FC<MultiDocCompareViewProps> = ({ documents }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);

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
      const data = await res.json();
      setComparison(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const activeDocs = documents.filter((d) => selectedIds.includes(d.id));

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 bg-[#131314] text-[#e3e3e3] min-h-screen w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#37393b]">
        <div>
          <h1 className="text-2xl font-bold text-[#e3e3e3] tracking-tight flex items-center gap-2">
            <GitFork size={28} className="text-[#7dd3fc]" /> Multi-Document Comparison Matrix
          </h1>
          <p className="text-xs text-[#c4c7c5]">
            Compare 2 to 50+ contracts, bills, or financial filings simultaneously using Signal87 long-context reasoning.
          </p>
        </div>

        <button
          onClick={handleRunComparison}
          disabled={loading || selectedIds.length < 2}
          className="px-5 py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
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
      <div className="bg-[#1e1f20] p-5 rounded-2xl border border-[#37393b] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#e3e3e3] uppercase tracking-wider">
            Select Documents to Compare ({selectedIds.length} Selected)
          </span>
          <span className="text-[11px] text-[#c4c7c5] font-mono">Minimum 2 documents required</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {documents.map((doc) => {
            const isSelected = selectedIds.includes(doc.id);
            return (
              <div
                key={doc.id}
                onClick={() => toggleSelect(doc.id)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
 isSelected
 ? 'border-[#1a73e8] bg-[#004a77]/30 font-semibold text-[#e3e3e3]'
 : 'border-[#37393b] bg-[#28292a] text-[#c4c7c5] hover:bg-[#37393b]'
 }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText size={16} className={isSelected ? 'text-[#7dd3fc]' : 'text-[#c4c7c5]'} />
                  <span className="truncate text-[#e3e3e3]">{doc.title}</span>
                </div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  className="rounded text-[#1a73e8] focus:ring-[#1a73e8]"
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
          <div className="p-6 bg-[#1e1f20] text-[#e3e3e3] rounded-2xl border border-[#37393b] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#7dd3fc] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={16} className="text-[#7dd3fc]" /> Executive Comparative Synthesis
              </span>
              <span className="text-[10px] bg-[#004a77]/40 text-[#7dd3fc] px-2 py-0.5 rounded font-mono border border-[#004a77]">
                Signal87 Long-Context Multi-Doc Engine
              </span>
            </div>
            <p className="text-[#c4c7c5] text-xs leading-relaxed font-normal">{comparison.summary}</p>
          </div>

          {/* Side-by-Side Comparison Grid Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Similarities & Overlaps */}
            <div className="bg-[#1e1f20] p-6 rounded-2xl border border-[#37393b] space-y-4">
              <h3 className="text-sm font-bold text-[#e3e3e3] flex items-center gap-2">
                <CheckCircle2 size={18} className="text-[#7dd3fc]" /> Shared Similarities & Overlapping Clauses
              </h3>
              <ul className="space-y-2.5">
                {comparison.similarities.map((item, idx) => (
                  <li key={idx} className="p-3 bg-[#28292a] rounded-xl border border-[#37393b] text-xs text-[#c4c7c5] leading-relaxed flex items-start gap-2">
                    <span className="text-[#7dd3fc] font-bold mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Key Differences */}
            <div className="bg-[#1e1f20] p-6 rounded-2xl border border-[#37393b] space-y-4">
              <h3 className="text-sm font-bold text-[#e3e3e3] flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-400" /> Key Differences & Divergences
              </h3>
              <ul className="space-y-2.5">
                {comparison.differences.map((item, idx) => (
                  <li key={idx} className="p-3 bg-[#28292a] rounded-xl border border-[#37393b] text-xs text-[#c4c7c5] leading-relaxed flex items-start gap-2">
                    <span className="text-amber-400 font-bold mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Missing Clauses & Omissions */}
            <div className="bg-[#1e1f20] p-6 rounded-2xl border border-[#37393b] space-y-4">
              <h3 className="text-sm font-bold text-[#e3e3e3] flex items-center gap-2">
                <ShieldAlert size={18} className="text-rose-400" /> Missing Clauses & Omissions
              </h3>
              <ul className="space-y-2.5">
                {comparison.missingClauses.map((item, idx) => (
                  <li key={idx} className="p-3 bg-[#28292a] rounded-xl border border-[#37393b] text-xs text-[#c4c7c5] leading-relaxed flex items-start gap-2">
                    <span className="text-rose-400 font-bold mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Conflicts & Risk Trends */}
            <div className="bg-[#1e1f20] p-6 rounded-2xl border border-[#37393b] space-y-4">
              <h3 className="text-sm font-bold text-[#e3e3e3] flex items-center gap-2">
                <GitFork size={18} className="text-[#7dd3fc]" /> Direct Conflicts & Risk Exposure
              </h3>
              <ul className="space-y-2.5">
                {comparison.conflicts.map((item, idx) => (
                  <li key={idx} className="p-3 bg-[#28292a] rounded-xl border border-[#37393b] text-xs text-[#c4c7c5] leading-relaxed flex items-start gap-2">
                    <span className="text-[#7dd3fc] font-bold mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#1e1f20] border border-dashed border-[#37393b] rounded-2xl p-10 text-center space-y-3">
          <GitFork size={36} className="mx-auto text-[#7dd3fc]" />
          <h3 className="text-sm font-bold text-[#e3e3e3]">No active comparison generated yet</h3>
          <p className="text-xs text-[#c4c7c5] max-w-md mx-auto leading-relaxed">
            Select 2 or more documents from the list above and click <span className="font-bold text-[#e3e3e3]">"Run Comparative Analysis"</span> to generate side-by-side legal clause comparisons and conflict matrices.
          </p>
        </div>
      )}
    </div>
  );
};
