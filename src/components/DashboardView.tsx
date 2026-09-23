import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Calendar, FileText, Columns, DollarSign, Clock, Plus, Paperclip, Search, StickyNote, Sparkles } from 'lucide-react';
import { useAutosizeTextarea } from '../lib/useAutosizeTextarea';
import { User } from '../lib/firebase';
import { ChatSessionSummary } from './Sidebar';

interface DashboardViewProps {
  currentUser?: User | null;
  recentSessions: ChatSessionSummary[];
  onAskQuestion: (question: string) => void;
  onOpenSession: (id: string) => void;
  onOpenUpload: () => void;
  onOpenNewNote: () => void;
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
  { icon: StickyNote, label: 'Create a note', question: '' }
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  recentSessions,
  onAskQuestion,
  onOpenSession,
  onOpenUpload,
  onOpenNewNote
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useAutosizeTextarea(query, 160);
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
  // Greeting follows the user's local time (it previously always said "Good morning").
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const recent = recentSessions
    .filter((s) => s.title && s.title !== 'New Research Session' && s.title !== 'New Chat')
    .slice(0, 6);

  return (
    <div className="s87-page flex-1 overflow-y-auto bg-[var(--bg)] text-[var(--ink)]">
      <div className="s87-column pb-10">
        {/* Greeting and ask box sit centered, a little way down the page. */}
        <section className="mt-[6vh] text-center sm:mt-[12vh]">
          <h1 className="s87-page-title">
            {greeting}, {firstName}.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-6 text-[var(--ink-2)] sm:text-[16px]">
            Ask a question, search your files, or get started with a note.
          </p>
        </section>

        <section className="mx-auto mt-8 w-full max-w-[760px]">
          <div className="s87-field s87-home-composer p-2">
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

              <textarea
                ref={inputRef}
                rows={1}
                aria-label="Ask a question"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask a question, search your files, or search the web..."
                className="s87-home-input min-w-0 flex-1 bg-transparent px-1 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
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

        <section className="mx-auto mt-6 flex max-w-[760px] flex-wrap justify-center gap-2.5">
          {QUICK_ACTIONS.map(({ icon: Icon, label, question }) => (
            <button
              key={label}
              type="button"
              onClick={() => question ? onAskQuestion(question) : onOpenNewNote()}
              className="flex min-h-[42px] items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--surface)] px-3.5 text-[12px] font-medium text-[var(--ink-2)] hover:border-[var(--teal)]/40 hover:text-[var(--ink)]"
            >
              <Icon size={14} className="text-[var(--teal)]" />
              {label}
            </button>
          ))}
        </section>

        <section className="mt-16">
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


      </div>
    </div>
  );
};
