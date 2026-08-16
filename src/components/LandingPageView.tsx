import React, { useState } from 'react';
import { Signal87Logo } from './Signal87Logo';
import { Footer } from './Footer';
import { NavTab } from './Sidebar';

interface LandingPageViewProps {
  onOpenEmailAuth: (mode?: 'signup' | 'signin') => void;
  onOpenPrivacy: () => void;
  onOpenBlog: () => void;
  onOpenMedia: () => void;
  onSelectTab: (tab: NavTab) => void;
}

const SUGGESTIONS = [
  'Summarize the latest contract',
  'What are the key risks mentioned?',
  'Compare clauses across versions'
];

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenEmailAuth,
  onOpenPrivacy,
  onOpenBlog,
  onOpenMedia,
  onSelectTab
}) => {
  const [query, setQuery] = useState('');

  const handleAsk = (event?: React.FormEvent) => {
    event?.preventDefault();
    onOpenEmailAuth();
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden overscroll-x-none bg-[#0F1010] text-[#F3F3EE] antialiased flex flex-col selection:bg-[var(--accent)] selection:text-[var(--teal-ink)] s87-app">
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 sm:px-8 pt-5">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2 min-h-[44px] px-1 -mx-1 bg-transparent border-0 text-left cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
          title="Signal87"
        >
          <Signal87Logo size={18} />
          <span className="text-[13px] font-medium tracking-tight text-[#F3F3EE]">
            Signal87
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenEmailAuth('signin')}
            className="min-h-[44px] px-3.5 text-[13px] font-medium text-white/55 hover:text-white transition-colors cursor-pointer"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => onOpenEmailAuth('signup')}
            className="min-h-[40px] px-4 bg-[#20B8CD] hover:opacity-90 text-[#0F1010] text-[13px] font-semibold rounded-full cursor-pointer transition-opacity"
          >
            Sign up
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] px-5 sm:px-8 min-h-[100dvh] w-full max-w-full">
        <div className="flex items-end justify-center pb-5 sm:pb-7">
          <h1 className="text-[1.65rem] leading-[1.15] sm:text-[2.75rem] sm:leading-[1.12] font-semibold tracking-tight text-[#F3F3EE] text-center max-w-[18ch] sm:max-w-[640px]">
            Ask anything about your documents
          </h1>
        </div>

        <form onSubmit={handleAsk} className="w-full max-w-[640px] mx-auto">
          <label htmlFor="landing-ask" className="sr-only">
            Search your documents
          </label>

          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-3 sm:-inset-4 rounded-[32px]"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(32,184,205,0.2) 0%, rgba(32,184,205,0.06) 42%, transparent 70%)',
                filter: 'blur(10px)'
              }}
            />

            <div
              className="s87-field relative flex items-center gap-3 pl-4 sm:pl-5 pr-3 min-h-[52px] sm:min-h-[56px] text-left" 
            >
              <span
                className="flex-shrink-0 text-[15px] sm:text-base font-medium text-[#20B8CD] select-none"
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                aria-hidden="true"
              >
                &gt;_
              </span>
              <input
                id="landing-ask"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your documents..."
                className="flex-1 min-w-0 bg-transparent border-0 text-base text-[#F3F3EE] placeholder:text-white/30 focus:outline-none py-3 caret-[#20B8CD]"
              />
            </div>
          </div>
        </form>

        <div className="flex items-start justify-center pt-5 sm:pt-7">
          <ul className="space-y-2.5 text-center">
            {SUGGESTIONS.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => setQuery(suggestion)}
                  className="min-h-[44px] px-3 py-2 text-[13px] sm:text-sm text-white/35 hover:text-white/70 transition-colors cursor-pointer"
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </main>

      <section id="team" className="px-5 sm:px-8 py-16 sm:py-20 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F3F3EE]">
            Team
          </h2>
          <p className="mt-3 text-[15px] text-white/45 leading-relaxed max-w-xl">
            Enterprise research AI should be verifiable. Every finding needs a citation, and nothing should disappear from memory.
          </p>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <article className="p-5 sm:p-6 rounded-[14px] bg-[#161818] border border-white/10">
              <h3 className="text-[15px] font-semibold text-[#F3F3EE]">Michael Benezra</h3>
              <p className="text-[13px] text-white/45">CEO & Co-Founder</p>
              <p className="mt-4 text-[14px] leading-relaxed text-white/55">
                Leads strategy, partnerships, and product direction. Focused on verifiable document memory for legal, municipal, and corporate teams.
              </p>
            </article>
            <article className="p-5 sm:p-6 rounded-[14px] bg-[#161818] border border-white/10">
              <h3 className="text-[15px] font-semibold text-[#F3F3EE]">Michael Chavira</h3>
              <p className="text-[13px] text-white/45">Co-Founder & Chief Systems Architect</p>
              <p className="mt-4 text-[14px] leading-relaxed text-white/55">
                Builds the retrieval, parsing, and citation pipeline. Focused on fast, grounded answers without leaking data.
              </p>
            </article>
          </div>
        </div>
      </section>

      <Footer
        onSelectTab={onSelectTab}
        onOpenPrivacy={onOpenPrivacy}
        onOpenBlog={onOpenBlog}
        onOpenMedia={onOpenMedia}
      />
    </div>
  );
};
