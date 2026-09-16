import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Calendar, FileText, Columns, DollarSign, Clock, Plus, Paperclip, Search, StickyNote, Sparkles } from 'lucide-react';
import { User } from '../lib/firebase';
import { ChatSessionSummary } from './Sidebar';

interface DashboardViewProps {
  currentUser?: User | null;
  recentSessions: ChatSessionSummary[];
  onAskQuestion: (question: string) => void;
  onOpenSession: (id: string) => void;
  onOpenUpload: () => void;
}

const SUGGESTIONS = [
  { icon: Calendar, text: 'When does this contract end?' },
  { icon: FileText, text: 'Summarize this in plain English' },
  { icon: Columns, text: "What's different between these two?" },
  { icon: DollarSign, text: 'Pull out all the dollar amounts' }
];

const QUICK_ACTIONS = [
  { icon: FileText, label: 'Summarize a document', question: 'Summarize the latest document in my workspace.' },
  { icon: Search, label: 'Find my notes', question: 'Find the most relevant notes in my workspace.' },
  { icon: StickyNote, label: 'Start with a note', question: '' }
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  recentSessions,
  onAskQuestion,
  onOpenSession,
  onOpenUpload
}) => {
  const [query, setQuery] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    onAskQuestion(trimmed);
    setQuery('');
  };

  useEffect(() => {
    if (!showAttachMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAttachMenu]);

  const firstName = currentUser?.displayName?.split(' ')[0] || 'there';
  const recent = recentSessions
    .filter((s) => s.title && s.title !== 'New Research Session' && s.title !== 'New Chat')
    .slice(0, 6);

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg)] text-[var(--ink)]">
      <div className="mx-auto w-full max-w-[760px] px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
            <Sparkles size={13} className="text-[var(--teal)]" />
            Signal87 workspace
          </div>
          <div className="hidden text-[11px] text-[var(--muted)] sm:block">Private · Verified workspace</div>
        </div>

        <section className="mt-8">
          <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.055em] sm:text-[44px]">
            Good morning, {firstName}.
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[var(--ink-2)] sm:text-[16px]">
            Ask a question, search your files, or get started with a note.
          </p>
        </section>

        <section className="mt-8">
          <div className="rounded-[24px] border border-[var(--rule)] bg-[var(--surface)] p-2 shadow-[0_16px_50px_rgba(27,27,24,.06)] focus-within:border-[var(--teal)]/50">
            <div className="flex items-center gap-2">
              <div ref={attachMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAttachMenu((prev) => !prev)}
                  aria-label="Add attachment"
                  aria-expanded={showAttachMenu}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-2)] hover:bg-[var(--raised)]"
                >
                  <Plus size={18} />
                </button>
                {showAttachMenu && (
                  <div className="absolute left-0 top-12 z-20 w-56 rounded-2xl border border-[var(--rule)] bg-[var(--surface)] p-1.5 shadow-xl">
                    <button
                      type="button"
                      onClick={() => { onOpenUpload(); setShowAttachMenu(false); }}
                      className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3.5 text-left text-[13px] text-[var(--ink)] hover:bg-[var(--raised)]"
                    >
                      <Paperclip size={15} className="text-[var(--muted)]" />
                      Upload documents
                    </button>
                  </div>
                )}
              </div>

              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask a question, search your files, or search the web..."
                className="min-w-0 flex-1 bg-transparent px-1 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
              />

              <button
                type="button"
                onClick={handleSend}
                disabled={!query.trim()}
                aria-label="Ask"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${query.trim() ? 'bg-[var(--teal)] text-white' : 'bg-[var(--raised)] text-[var(--muted)]'}`}
              >
                <ArrowUp size={17} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 flex flex-wrap gap-2.5">
          {QUICK_ACTIONS.map(({ icon: Icon, label, question }) => (
            <button
              key={label}
              type="button"
              onClick={() => question ? onAskQuestion(question) : onOpenUpload()}
              className="flex min-h-[42px] items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--surface)] px-3.5 text-[12px] font-medium text-[var(--ink-2)] hover:border-[var(--teal)]/40 hover:text-[var(--ink)]"
            >
              <Icon size={14} className="text-[var(--teal)]" />
              {label}
            </button>
          ))}
        </section>

        <section className="mt-12">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Recent</h2>
            <span className="text-[11px] text-[var(--muted)]">Your latest work</span>
          </div>

          {recent.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--surface)]">
              {recent.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenSession(s.id)}
                  className={`flex min-h-[58px] w-full items-center justify-between gap-4 px-4 text-left hover:bg-[var(--raised)] sm:px-5 ${idx < recent.length - 1 ? 'border-b border-[var(--rule-2)]' : ''}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Clock size={14} className="shrink-0 text-[var(--muted)]" />
                    <span className="truncate text-[14px] text-[var(--ink)]">{s.title}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--muted)]">{s.timestamp}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--rule)] bg-[var(--surface)] px-5 py-8 text-center">
              <p className="text-[13px] text-[var(--ink-2)]">Your recent questions will appear here.</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">Start by asking something above.</p>
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          {SUGGESTIONS.map(({ icon: Icon, text }) => (
            <button
              key={text}
              type="button"
              onClick={() => onAskQuestion(text)}
              className="flex min-h-[54px] items-center gap-3 rounded-2xl border border-[var(--rule)] bg-[var(--surface)] px-4 text-left hover:bg-[var(--raised)]"
            >
              <Icon size={14} className="shrink-0 text-[var(--teal)]" />
              <span className="text-[13px] text-[var(--ink-2)]">{text}</span>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
};
