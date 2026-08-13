import React, { useState, useMemo } from 'react';
import { X, Search, FileText, Check, BookOpen } from 'lucide-react';
import { DocumentItem } from '../types';

interface AttachExistingDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentItem[];
  attachedIds: string[];
  onToggleAttach: (doc: DocumentItem) => void;
}

export const AttachExistingDocumentModal: React.FC<AttachExistingDocumentModalProps> = ({
  isOpen,
  onClose,
  documents,
  attachedIds,
  onToggleAttach
}) => {
  const [search, setSearch] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filtered = documents.filter((doc) =>
    doc.title.toLowerCase().includes(search.toLowerCase().trim())
  );

  const selectedDoc = documents.find((doc) => doc.id === selectedDocId);
  const isSelectedAttached = selectedDoc ? attachedIds.includes(selectedDoc.id) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-2xl max-w-6xl w-full max-h-[90vh] flex flex-col text-[var(--ink)]">
        <div className="flex items-center justify-between p-5 pb-3 border-b border-[var(--rule-2)]">
          <h2 className="text-[16px]" style={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
            Choose from Files
          </h2>
          <button onClick={onClose} className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded-full cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: Document List */}
          <div className="w-full md:w-1/3 flex flex-col border-r border-[var(--rule-2)] overflow-hidden">
            <div className="px-5 pt-3 pb-2 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" size={15} />
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${documents.length} files`}
                  className="w-full pl-9 pr-3 py-2.5 bg-[var(--raised)] border border-[var(--rule)] rounded-xl text-[15px] text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--teal)] transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {filtered.length === 0 ? (
                <p className="text-[13.5px] text-[var(--ink-2)] text-center py-8">
                  {documents.length === 0 ? 'No documents in your workspace yet.' : 'No files match your search.'}
                </p>
              ) : (
                filtered.map((doc) => {
                  const isAttached = attachedIds.includes(doc.id);
                  const isSelected = selectedDocId === doc.id;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => {
                        setSelectedDocId(doc.id);
                        if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
                          onToggleAttach(doc);
                        }
                      }}
                      className={`w-full flex items-center gap-3 py-3 min-h-[44px] border-b border-[var(--rule-2)] last:border-b-0 text-left cursor-pointer group transition-colors ${
                        isSelected ? 'bg-[var(--raised)]' : 'hover:bg-[var(--bg)]'
                      }`}
                    >
                      <FileText size={17} className="flex-shrink-0 text-[var(--muted)]" />
                      <span className="flex-1 min-w-0 text-[14px] text-[var(--ink)] truncate">{doc.title}</span>
                      <span
                        className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                          isAttached ? 'bg-[var(--teal)] border-[var(--teal)]' : 'border-[var(--rule)] group-hover:border-[var(--ink-2)]'
                        }`}
                      >
                        {isAttached && <Check size={12} className="text-white" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Document Preview */}
          <div className="hidden md:flex flex-col w-2/3 overflow-hidden">
            {selectedDoc ? (
              <>
                <div className="p-4 border-b border-[var(--rule-2)] bg-[var(--bg)] flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={18} className="text-[var(--muted)] flex-shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-medium text-[var(--ink)] truncate">{selectedDoc.title}</h3>
                      <p className="text-[12px] text-[var(--muted)]">{selectedDoc.type.toUpperCase()}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onToggleAttach(selectedDoc)}
                    className={`flex-shrink-0 py-2 px-4 rounded-full font-medium text-[13px] transition-all cursor-pointer ${
                      isSelectedAttached
                        ? 'bg-[var(--raised)] text-[var(--ink)] hover:opacity-80'
                        : 'bg-[var(--teal)] text-white hover:opacity-90'
                    }`}
                  >
                    {isSelectedAttached ? 'Remove' : 'Attach'}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 text-[14.5px] text-[var(--ink-2)]" style={{ lineHeight: 1.6 }}>
                  {selectedDoc.summary && (
                    <div className="space-y-2">
                      <div className="text-[12px] font-medium text-[var(--muted)] uppercase" style={{ letterSpacing: '0.09em' }}>
                        Summary
                      </div>
                      <p className="text-[var(--ink)]">{selectedDoc.summary}</p>
                    </div>
                  )}

                  {selectedDoc.contentPreview && (
                    <div className="pt-4 border-t border-[var(--rule-2)] space-y-2">
                      <div className="text-[12px] font-medium text-[var(--muted)] uppercase" style={{ letterSpacing: '0.09em' }}>
                        Content Preview
                      </div>
                      <p className="text-[var(--ink)]">{selectedDoc.contentPreview.substring(0, 800)}</p>
                      {selectedDoc.contentPreview.length > 800 && (
                        <p className="text-[13px] text-[var(--muted)] italic">... (content continues)</p>
                      )}
                    </div>
                  )}

                  {selectedDoc.riskHighlights && selectedDoc.riskHighlights.length > 0 && (
                    <div className="pt-4 border-t border-[var(--rule-2)] space-y-2">
                      <div className="text-[12px] font-medium text-[var(--muted)] uppercase" style={{ letterSpacing: '0.09em' }}>
                        Key Points
                      </div>
                      <ul className="space-y-1.5 list-disc pl-4 text-[var(--ink)]">
                        {selectedDoc.riskHighlights.slice(0, 5).map((hl, idx) => (
                          <li key={idx}>{hl}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[var(--muted)] text-center px-6">
                <BookOpen size={40} className="opacity-30 mb-3" />
                <p className="text-[14px] text-[var(--ink-2)]">Select a document to preview</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[var(--rule-2)]">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[var(--teal)] hover:opacity-90 text-white font-medium text-[13.5px] rounded-full cursor-pointer transition-all min-h-[44px]"
          >
            Done{attachedIds.length > 0 ? ` (${attachedIds.length} attached)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
