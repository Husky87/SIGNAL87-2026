import React, { useState } from 'react';
import { ArrowUp, Calendar, FileText, Columns, DollarSign, Clock } from 'lucide-react';
import { User } from '../lib/firebase';
import { ChatSessionSummary } from './Sidebar';

interface DashboardViewProps {
  currentUser?: User | null;
  recentSessions: ChatSessionSummary[];
  onAskQuestion: (question: string) => void;
  onOpenSession: (id: string) => void;
}

const SUGGESTIONS = [
  { icon: Calendar, text: 'When does this contract end?' },
  { icon: FileText, text: 'Summarize this in plain English' },
  { icon: Columns, text: "What's different between these two?" },
  { icon: DollarSign, text: 'Pull out all the dollar amounts' }
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  recentSessions,
  onAskQuestion,
  onOpenSession
}) => {
  const [query, setQuery] = useState('');

  const handleSend = () => {
    if (!query.trim()) return;
    onAskQuestion(query);
    setQuery('');
  };

  const firstName = currentUser?.displayName?.split(' ')[0];
  const recent = recentSessions
    .filter((s) => s.title && s.title !== 'New Research Session' && s.title !== 'New Chat')
    .slice(0, 6);

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg)]">
      <div className="max-w-[640px] w-full mx-auto px-5 py-16 sm:py-24 space-y-8">
        {/* Headline */}
        <div className="space-y-3 text-center">
          <h1
            className="text-[32px] sm:text-[38px] text-[var(--ink)]"
            style={{ fontWeight: 600, letterSpacing: '-0.036em', lineHeight: 1.1 }}
          >
            {firstName ? `What do you want to know, ${firstName}?` : 'What do you want to know?'}
          </h1>
          <p className="text-[16px] text-[var(--ink-2)]">
            Ask about anything you've uploaded. Plain questions work best.
          </p>
        </div>

        {/* One-line composer */}
        <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[26px] p-1.5 flex items-center gap-2">
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
            placeholder="Ask anything"
            className="flex-1 min-w-0 bg-transparent border-0 text-[16px] text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none px-3.5 py-2.5"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!query.trim()}
            aria-label="Ask"
            className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
              query.trim() ? 'bg-[var(--teal)] text-white hover:opacity-90' : 'bg-[var(--raised)] text-[var(--muted)] cursor-not-allowed'
            }`}
          >
            <ArrowUp size={17} strokeWidth={2.6} />
          </button>
        </div>

        {/* Plain-language suggestions */}
        <div className="space-y-2">
          {SUGGESTIONS.map((s, idx) => {
            const Icon = s.icon;
            return (
              <button
                key={idx}
                onClick={() => onAskQuestion(s.text)}
                className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-[11px] hover:bg-[var(--raised)] transition-colors cursor-pointer text-left"
              >
                <span className="w-7 h-7 flex-shrink-0 rounded-full bg-[var(--teal-soft)] text-[var(--teal-deep)] flex items-center justify-center">
                  <Icon size={14} />
                </span>
                <span className="text-[14.5px] text-[var(--ink)]">{s.text}</span>
              </button>
            );
          })}
        </div>

        {/* Recent questions */}
        {recent.length > 0 && (
          <div className="pt-4 border-t border-[var(--rule-2)] space-y-1">
            <h2 className="text-[13px] font-medium text-[var(--muted)] px-3.5 pb-1">Recent</h2>
            {recent.map((s) => (
              <button
                key={s.id}
                onClick={() => onOpenSession(s.id)}
                className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 min-h-[44px] rounded-[11px] hover:bg-[var(--raised)] transition-colors cursor-pointer text-left"
              >
                <span className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Clock size={13} className="text-[var(--muted)] flex-shrink-0" />
                  <span className="text-[14.5px] text-[var(--ink-2)] truncate">{s.title}</span>
                </span>
                <span className="text-[11px] text-[var(--muted)] flex-shrink-0">{s.timestamp}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
