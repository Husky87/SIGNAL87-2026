import React, { useState } from 'react';
import { X, Search, FileText, Check } from 'lucide-react';
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

  if (!isOpen) return null;

  const filtered = documents.filter((doc) =>
    doc.title.toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col text-[var(--ink)]">
        <div className="flex items-center justify-between p-5 pb-3 border-b border-[var(--rule-2)]">
          <h2 className="text-[16px]" style={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
            Choose from Files
          </h2>
          <button onClick={onClose} className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded-full cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-3">
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
              return (
                <button
                  key={doc.id}
                  onClick={() => onToggleAttach(doc)}
                  className="w-full flex items-center gap-3 py-3 min-h-[44px] border-b border-[var(--rule-2)] last:border-b-0 text-left cursor-pointer group"
                >
                  <FileText size={17} className="flex-shrink-0 text-[var(--muted)]" />
                  <span className="flex-1 min-w-0 text-[14px] text-[var(--ink)] truncate">{doc.title}</span>
                  <span
                    className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                      isAttached ? 'bg-[var(--teal)] border-[var(--teal)]' : 'border-[var(--rule)] group-hover:border-[var(--ink-2)]'
                    }`}
                  >
                    {isAttached && <Check size={12} className="text-[var(--teal-ink)]" />}
                  </span>
                </button>
              );
            })
          )}
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
