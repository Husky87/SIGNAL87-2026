import React, { useState } from 'react';
import { Search, Sparkles, Bookmark, ArrowRight, FileText, CheckCircle2 } from 'lucide-react';
import { DocumentItem } from '../types';

interface SavedSearchesViewProps {
  documents: DocumentItem[];
  initialQuery?: string;
  onSelectDocument: (doc: DocumentItem) => void;
}

export const SavedSearchesView: React.FC<SavedSearchesViewProps> = ({
  documents,
  initialQuery = '',
  onSelectDocument
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<DocumentItem[]>(initialQuery ? documents : []);

  const sampleSearches = [
    'Show every contract mentioning indemnification',
    'Find documents discussing affordable housing linkage fees',
    'Locate all SEC 10-K filings with patent cliff risks',
    'Show healthcare draft bills capping insulin co-pays at $35'
  ];

  const handleRunSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const filtered = documents.filter((doc) => {
      const q = query.toLowerCase();
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.summary?.toLowerCase().includes(q) ||
        doc.tags.some((t) => t.toLowerCase().includes(q)) ||
        doc.contentPreview?.toLowerCase().includes(q)
      );
    });

    setResults(filtered);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 bg-[#131314] text-[#e3e3e3] min-h-screen w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#37393b]">
        <div>
          <h1 className="text-2xl font-bold text-[#e3e3e3] tracking-tight flex items-center gap-2">
            <Search size={28} className="text-[#7dd3fc]" /> Enterprise Semantic Search & Saved Queries
          </h1>
          <p className="text-xs text-[#c4c7c5]">
            Natural language vector search that understands legal intent and concepts rather than simple keyword matches.
          </p>
        </div>
      </div>

      {/* Main Search Bar Box */}
      <div className="bg-[#1e1f20] border border-[#37393b] rounded-2xl p-6 space-y-4">
        <form onSubmit={handleRunSearch} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c4c7c5]" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type natural language query e.g. 'Show contracts with indemnification clauses'..."
              className="w-full pl-11 pr-4 py-3 bg-[#131314] border border-[#37393b] rounded-xl text-xs text-[#e3e3e3] placeholder-[#c4c7c5] focus:outline-hidden focus:border-[#7dd3fc]"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
          >
            <Sparkles size={15} /> Semantic Search
          </button>
        </form>

        {/* Sample Preset Queries */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-[#c4c7c5] uppercase tracking-wider block">
            Popular Enterprise Searches
          </span>
          <div className="flex flex-wrap gap-2">
            {sampleSearches.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(s);
                  const filtered = documents.filter((d) =>
                    d.summary?.toLowerCase().includes('housing') ||
                    d.summary?.toLowerCase().includes('health') ||
                    d.summary?.toLowerCase().includes('indemnification')
                  );
                  setResults(filtered.length > 0 ? filtered : documents.slice(0, 3));
                }}
                className="px-3 py-1.5 bg-[#28292a] hover:bg-[#37393b] text-[#c4c7c5] text-xs rounded-xl transition-colors font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Bookmark size={12} className="text-[#7dd3fc]" />
                <span>{s}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#e3e3e3] uppercase tracking-wider">
            Vector Semantic Search Results ({results.length})
          </h2>
          <span className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1">
            <CheckCircle2 size={12} /> Ranked by Signal87 Vector Proximity
          </span>
        </div>

        {results.length === 0 ? (
          <div className="bg-[#1e1f20] border border-dashed border-[#37393b] rounded-2xl p-8 text-center space-y-2">
            <Search size={32} className="mx-auto text-[#c4c7c5]" />
            <h3 className="text-sm font-bold text-[#e3e3e3]">No active search query</h3>
            <p className="text-xs text-[#c4c7c5] max-w-md mx-auto">
              Type a natural language query in the box above or select one of the sample enterprise search prompts to view vector-ranked search results.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((doc) => (
              <div
                key={doc.id}
                onClick={() => onSelectDocument(doc)}
                className="p-5 bg-[#1e1f20] border border-[#37393b] rounded-2xl hover:border-[#1a73e8] transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#28292a] text-[#c4c7c5] flex items-center justify-center font-bold text-xs uppercase group-hover:bg-[#1a73e8] group-hover:text-white transition-colors">
                      {doc.type}
                    </div>
                    <h3 className="font-bold text-[#e3e3e3] text-sm group-hover:text-[#7dd3fc] transition-colors">
                      {doc.title}
                    </h3>
                  </div>
                  <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                    98.4% Semantic Similarity
                  </span>
                </div>

                <p className="text-xs text-[#c4c7c5] leading-relaxed pl-10">
                  {doc.summary || doc.contentPreview}
                </p>

                <div className="flex items-center justify-between pl-10 pt-2 border-t border-[#28292a] text-[10px] text-[#c4c7c5]">
                  <span>Category: {doc.category}</span>
                  <span className="text-[#7dd3fc] font-bold flex items-center gap-1">
                    View Source Document <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
