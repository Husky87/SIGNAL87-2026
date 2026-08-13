import React, { useState } from 'react';
import { Signal87Logo } from './Signal87Logo';
import { FileText, GitFork, Shield, ArrowRight, Search } from 'lucide-react';
import { Footer } from './Footer';
import { NavTab } from './Sidebar';

interface LandingPageViewProps {
  onOpenEmailAuth: () => void;
  onOpenPrivacy: () => void;
  onOpenBlog: () => void;
  onOpenMedia: () => void;
  onSelectTab: (tab: NavTab) => void;
}

const EXAMPLE_QUESTIONS = [
  'Summarize the indemnity caps and liability limits across active agreements',
  'Which clauses reference governing law in Delaware or New York?',
  'Compare force majeure provisions across all 2025 vendor contracts',
  'Extract key renewal dates and termination notice requirements'
];

const SOURCES = [
  { title: 'Research report', status: 'Reading' },
  { title: 'Service agreement', status: 'Ready' },
  { title: 'Budget workbook', status: 'Ready' },
  { title: 'Meeting notes', status: 'Ready' }
];

const FEATURES = [
  {
    icon: FileText,
    title: 'Citations you can open',
    body: 'Click any citation to jump to the exact page and paragraph. No guessed clauses.'
  },
  {
    icon: GitFork,
    title: 'Compare across files',
    body: 'Line up indemnity caps, renewal dates, and clauses across your contracts.'
  },
  {
    icon: Shield,
    title: 'Your files stay yours',
    body: 'Documents and queries stay isolated. Nothing is used to train models.'
  }
];

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenEmailAuth,
  onOpenPrivacy,
  onOpenBlog,
  onOpenMedia,
  onSelectTab
}) => {
  const [query, setQuery] = useState('');
  const [activeSource, setActiveSource] = useState(SOURCES[0].title);
  const [followUp, setFollowUp] = useState('');

  const handleAsk = (event?: React.FormEvent) => {
    event?.preventDefault();
    onOpenEmailAuth();
  };

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased flex flex-col selection:bg-[var(--accent)] selection:text-[var(--teal-ink)] s87-app">
      <header className="sticky top-0 z-50 bg-[var(--paper)]/90 backdrop-blur-md border-b border-[var(--rule)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 min-h-0 p-0 bg-transparent border-0 text-left cursor-pointer hover:opacity-80 transition-opacity"
            title="Scroll to top"
          >
            <Signal87Logo size={28} />
            <span className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">
              Signal87
            </span>
          </button>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={onOpenEmailAuth}
              className="min-h-0 h-9 px-3 text-[13px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={onOpenEmailAuth}
              className="min-h-0 h-9 px-3.5 bg-[var(--accent)] hover:opacity-90 text-[var(--teal-ink)] text-[13px] font-semibold rounded-full transition-opacity cursor-pointer"
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-4 sm:px-6 pt-12 pb-10 sm:pt-20 sm:pb-16">
          <div className="max-w-[720px] mx-auto text-center">
            <h1 className="text-[2rem] leading-[1.15] sm:text-5xl sm:leading-[1.12] font-semibold tracking-tight text-[var(--ink)]">
              Ask your documents anything
            </h1>
            <p className="mt-4 sm:mt-5 text-[15px] sm:text-lg text-[var(--ink-2)] leading-relaxed max-w-xl mx-auto">
              Search contracts, reports, and notes in plain language. Every answer points back to the exact page.
            </p>

            <form onSubmit={handleAsk} className="mt-8 sm:mt-10">
              <label htmlFor="landing-ask" className="sr-only">
                Ask a question about your documents
              </label>
              <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--rule)] rounded-full pl-4 pr-1.5 py-1.5 text-left focus-within:border-[var(--accent)] transition-colors">
                <Search size={18} className="text-[var(--slate)] flex-shrink-0" />
                <input
                  id="landing-ask"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask anything about your files…"
                  className="flex-1 min-w-0 bg-transparent border-0 text-[15px] text-[var(--ink)] placeholder:text-[var(--slate)] focus:outline-none py-2"
                />
                <button
                  type="submit"
                  className="min-h-0 h-9 w-9 sm:w-auto sm:px-4 flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] text-[var(--teal-ink)] text-[13px] font-semibold flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                  aria-label="Ask"
                >
                  <span className="hidden sm:inline">Ask</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>

            <ul className="mt-6 sm:mt-8 text-left space-y-1">
              {EXAMPLE_QUESTIONS.map((question) => (
                <li key={question}>
                  <button
                    type="button"
                    onClick={() => setQuery(question)}
                    className="w-full min-h-0 flex items-start gap-3 px-3 py-2.5 rounded-[10px] text-left text-[13px] sm:text-sm text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--card)] transition-colors cursor-pointer"
                  >
                    <ArrowRight
                      size={14}
                      className="mt-0.5 flex-shrink-0 text-[var(--slate)]"
                    />
                    <span className="leading-snug">{question}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="mockup" className="px-4 sm:px-6 pb-16 sm:pb-24">
          <div className="max-w-[760px] mx-auto">
            <div className="bg-[var(--card)] border border-[var(--rule)] rounded-[16px] overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[var(--rule-2)]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--verify)] flex-shrink-0" />
                  <span className="text-[12px] font-medium text-[var(--ink)] truncate">
                    4 files ready
                  </span>
                </div>
                <span className="text-[12px] text-[var(--slate)] flex-shrink-0">
                  32 citations
                </span>
              </div>

              <div className="px-4 sm:px-5 py-3 border-b border-[var(--rule-2)] overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex items-center gap-2 w-max">
                  {SOURCES.map((source) => {
                    const isActive = activeSource === source.title;
                    return (
                      <button
                        key={source.title}
                        type="button"
                        onClick={() => setActiveSource(source.title)}
                        className={`min-h-0 h-8 px-3 rounded-full text-[12px] whitespace-nowrap transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[var(--raised)] text-[var(--ink)] font-medium'
                            : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--raised)]'
                        }`}
                      >
                        {source.title}
                        {isActive && (
                          <span className="ml-1.5 text-[var(--slate)] font-normal">
                            {source.status}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-4 sm:px-5 pt-5 pb-4 text-left">
                <p className="text-[12px] text-[var(--accent)] font-medium">
                  Finding
                </p>
                <h2 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight text-[var(--ink)]">
                  Project risks & liability caps
                </h2>
                <p className="mt-3 text-[14px] sm:text-[15px] leading-relaxed text-[var(--ink-2)]">
                  The service agreement caps liability at $2 million, excluding indemnity for third-party IP claims.
                  <sup className="ml-0.5 text-[10px] font-semibold text-[var(--accent)]">1</sup>
                  {' '}The research report flags two renewal windows in Q3 and a 60-day termination notice.
                  <sup className="ml-0.5 text-[10px] font-semibold text-[var(--accent)]">2</sup>
                </p>

                <div className="mt-5 space-y-2">
                  <div className="flex items-baseline gap-2 text-[13px]">
                    <span className="w-4 text-[11px] font-semibold text-[var(--accent)] flex-shrink-0">
                      1
                    </span>
                    <span className="text-[var(--ink)] truncate">Service agreement</span>
                    <span className="text-[var(--slate)] flex-shrink-0">p. 14</span>
                  </div>
                  <div className="flex items-baseline gap-2 text-[13px]">
                    <span className="w-4 text-[11px] font-semibold text-[var(--accent)] flex-shrink-0">
                      2
                    </span>
                    <span className="text-[var(--ink)] truncate">Research report</span>
                    <span className="text-[var(--slate)] flex-shrink-0">p. 3</span>
                  </div>
                </div>

                <p className="mt-5 text-[12px] text-[var(--slate)]">
                  14 findings · 8 sources · 32 citations
                </p>
              </div>

              <form
                onSubmit={handleAsk}
                className="px-4 sm:px-5 pb-4"
              >
                <div className="flex items-center gap-2 bg-[var(--paper)] border border-[var(--rule)] rounded-full pl-4 pr-1.5 py-1">
                  <input
                    type="text"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    placeholder="Ask a follow-up…"
                    className="flex-1 min-w-0 bg-transparent border-0 text-[13px] text-[var(--ink)] placeholder:text-[var(--slate)] focus:outline-none py-2"
                  />
                  <button
                    type="submit"
                    className="min-h-0 h-8 px-3 rounded-full bg-[var(--accent)] text-[var(--teal-ink)] text-[12px] font-semibold flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    Ask
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        <section id="capabilities" className="px-4 sm:px-6 py-16 sm:py-20 border-t border-[var(--rule)]">
          <div className="max-w-5xl mx-auto">
            <div className="max-w-xl">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--ink)]">
                Built for documents that matter
              </h2>
              <p className="mt-3 text-[15px] text-[var(--ink-2)] leading-relaxed">
                Answers stay tied to your files. Open the source, compare the clause, and keep the work private.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="text-left">
                  <Icon size={20} className="text-[var(--accent)]" />
                  <h3 className="mt-4 text-[16px] font-semibold tracking-tight text-[var(--ink)]">
                    {title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="team" className="px-4 sm:px-6 py-16 sm:py-20 border-t border-[var(--rule)]">
          <div className="max-w-4xl mx-auto">
            <div className="max-w-xl">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--ink)]">
                Team
              </h2>
              <p className="mt-3 text-[15px] text-[var(--ink-2)] leading-relaxed">
                Enterprise research AI should be verifiable. Every finding needs a citation, and nothing should disappear from memory.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <article className="p-5 sm:p-6 rounded-[14px] bg-[var(--card)] border border-[var(--rule)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--teal-ink)] text-[13px] font-semibold flex items-center justify-center flex-shrink-0">
                    MB
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-[var(--ink)]">
                      Michael Benezra
                    </h3>
                    <p className="text-[13px] text-[var(--ink-2)]">
                      CEO & Co-Founder
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-[14px] leading-relaxed text-[var(--ink-2)]">
                  Leads strategy, partnerships, and product direction. Focused on verifiable document memory for legal, municipal, and corporate teams.
                </p>
              </article>

              <article className="p-5 sm:p-6 rounded-[14px] bg-[var(--card)] border border-[var(--rule)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--raised)] text-[var(--ink)] text-[13px] font-semibold flex items-center justify-center flex-shrink-0">
                    MC
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-[var(--ink)]">
                      Michael Chavira
                    </h3>
                    <p className="text-[13px] text-[var(--ink-2)]">
                      Co-Founder & Chief Systems Architect
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-[14px] leading-relaxed text-[var(--ink-2)]">
                  Builds the retrieval, parsing, and citation pipeline. Focused on fast, grounded answers without leaking data.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>

      <Footer
        onSelectTab={onSelectTab}
        onOpenPrivacy={onOpenPrivacy}
        onOpenBlog={onOpenBlog}
        onOpenMedia={onOpenMedia}
      />
    </div>
  );
};
