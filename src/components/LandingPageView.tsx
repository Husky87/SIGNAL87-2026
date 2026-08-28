import React, { useState } from 'react';
import { Signal87Logo } from './Signal87Logo';
import { Footer } from './Footer';
import { NavTab } from './Sidebar';
import { PricingPlans } from './PricingPlans';
import { TRIAL_DAYS } from '../lib/trial';

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
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden overscroll-x-none bg-[var(--ink-surface)] text-[var(--on-ink)] antialiased flex flex-col selection:bg-[var(--accent)] selection:text-[var(--accent-contrast)] s87-app">
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 sm:px-8 pt-5">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2 min-h-[44px] px-1 -mx-1 bg-transparent border-0 text-left cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
          title="Signal87"
        >
          <Signal87Logo size={18} />
          <span className="text-[13px] font-medium tracking-tight text-[var(--on-ink)]">
            Signal87
          </span>
        </button>

        <div className="flex items-center gap-2">
          <a
            href="#pricing"
            className="hidden sm:inline-flex items-center min-h-[44px] px-3.5 text-[13px] font-medium text-[var(--on-ink)]/55 hover:text-[var(--on-ink)] transition-colors"
          >
            Pricing
          </a>
          <button
            type="button"
            onClick={() => onOpenEmailAuth('signin')}
            className="min-h-[44px] px-3.5 text-[13px] font-medium text-[var(--on-ink)]/55 hover:text-[var(--on-ink)] transition-colors cursor-pointer"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => onOpenEmailAuth('signup')}
            /* 44px on a phone, where this is a thumb target and its Log in
               sibling is already 44; the deliberate 40 is kept from sm up so
               the desktop header is unchanged. */
            className="min-h-[44px] sm:min-h-[40px] px-4 bg-[var(--accent-ink)] hover:opacity-90 text-[var(--ink-surface)] text-[13px] font-semibold rounded-full cursor-pointer transition-opacity"
          >
            Sign up
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] px-5 sm:px-8 min-h-[100dvh] w-full max-w-full">
        <div className="flex items-end justify-center pb-5 sm:pb-7">
          <h1 className="text-[1.65rem] leading-[1.15] sm:text-[2.75rem] sm:leading-[1.12] font-semibold tracking-tight text-[var(--on-ink)] text-center max-w-[18ch] sm:max-w-[640px]">
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
                  'radial-gradient(ellipse at center, rgb(var(--accent-rgb) / 0.2) 0%, rgb(var(--accent-rgb) / 0.06) 42%, transparent 70%)',
                filter: 'blur(10px)'
              }}
            />

            <div
              className="s87-field-dark relative flex items-center gap-3 pl-4 sm:pl-5 pr-3 min-h-[52px] sm:min-h-[56px] text-left"
            >
              <span
                className="flex-shrink-0 text-[15px] sm:text-base font-medium text-[var(--accent-ink)] select-none"
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
                className="flex-1 min-w-0 bg-transparent border-0 text-base text-[var(--on-ink)] placeholder:text-[var(--on-ink)]/30 focus:outline-none py-3 caret-[var(--accent-ink)]"
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
                  className="min-h-[44px] px-3 py-2 text-[13px] sm:text-sm text-[var(--on-ink)]/35 hover:text-[var(--on-ink)]/70 transition-colors cursor-pointer"
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </main>

      {/* Paper band under the dark hero. The plans read as an offer rather than
          another slab of the hero, and PricingPlans is already built on the
          light tokens, so it needs no dark variant. */}
      <section id="pricing" className="bg-[var(--bg)] text-[var(--ink)] px-5 sm:px-8 py-16 sm:py-20">
        <div className="max-w-[720px] mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-[26px] sm:text-[30px] m-0" style={{ fontWeight: 600, letterSpacing: '-0.03em' }}>
              Simple pricing
            </h2>
            <p className="m-0 text-[14.5px] text-[var(--ink-2)]" style={{ lineHeight: 1.6 }}>
              Start with {TRIAL_DAYS} days free. No card required to try it — bring your documents and
              ask them something.
            </p>
          </div>

          {/* A signed-out visitor has no account to bill, so the plan buttons
              open sign-up; checkout happens once they are in. */}
          <PricingPlans
            ctaLabel="Start free trial"
            onSelect={() => onOpenEmailAuth('signup')}
            unconfiguredNote="Online checkout is opening shortly. Start your free trial now and we'll be in touch."
          />

          <div className="text-center">
            <button
              type="button"
              onClick={() => onOpenEmailAuth('signup')}
              className="min-h-[44px] px-6 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-[13.5px] font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Create your account
            </button>
          </div>
        </div>
      </section>

      <section id="team" className="px-5 sm:px-8 py-16 sm:py-20 border-t border-[var(--rule)]/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--on-ink)]">
            Team
          </h2>
          <p className="mt-3 text-[15px] text-[var(--on-ink)]/45 leading-relaxed max-w-xl">
            Enterprise research AI should be verifiable. Every finding needs a citation, and nothing should disappear from memory.
          </p>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <article className="p-5 sm:p-6 rounded-[14px] bg-[var(--ink-surface-3)] border border-[var(--rule)]/10">
              <h3 className="text-[15px] font-semibold text-[var(--on-ink)]">Michael Benezra</h3>
              <p className="text-[13px] text-[var(--on-ink)]/45">CEO & Co-Founder</p>
              <p className="mt-4 text-[14px] leading-relaxed text-[var(--on-ink)]/55">
                Leads strategy, partnerships, and product direction. Focused on verifiable document memory for legal, municipal, and corporate teams.
              </p>
            </article>
            <article className="p-5 sm:p-6 rounded-[14px] bg-[var(--ink-surface-3)] border border-[var(--rule)]/10">
              <h3 className="text-[15px] font-semibold text-[var(--on-ink)]">Michael Chavira</h3>
              <p className="text-[13px] text-[var(--on-ink)]/45">Co-Founder & Chief Systems Architect</p>
              <p className="mt-4 text-[14px] leading-relaxed text-[var(--on-ink)]/55">
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
