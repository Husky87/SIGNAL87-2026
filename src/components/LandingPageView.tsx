import React, { useState } from 'react';
import { Signal87Logo } from './Signal87Logo';
import { Footer } from './Footer';
import { NavTab } from './Sidebar';

interface LandingPageViewProps {
  onOpenEmailAuth: () => void;
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

const BAR_GLOW =
  '0 0 0 1px rgba(32, 184, 205, 0.45), 0 0 28px 4px rgba(32, 184, 205, 0.22), 0 0 72px 16px rgba(32, 184, 205, 0.12)';

const BAR_GLOW_FOCUS =
  '0 0 0 1px rgba(32, 184, 205, 0.7), 0 0 36px 6px rgba(32, 184, 205, 0.3), 0 0 88px 20px rgba(32, 184, 205, 0.16)';

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenEmailAuth,
  onOpenPrivacy,
  onOpenBlog,
  onOpenMedia,
  onSelectTab
}) => {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

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
          className="flex items-center gap-2 min-h-0 p-0 bg-transparent border-0 text-left cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
          title="Signal87"
        >
          <Signal87Logo size={18} />
          <span className="text-[13px] font-medium tracking-tight text-[#F3F3EE]">
            Signal87
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenEmailAuth}
          className="min-h-0 h-8 px-2 text-[12px] font-medium text-white/35 hover:text-white/70 transition-colors cursor-pointer"
        >
          Log in
        </button>
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
              className="relative flex items-center gap-3 bg-[#161818] rounded-[22px] pl-4 sm:pl-5 pr-3 min-h-[52px] sm:min-h-[56px] text-left transition-[box-shadow] duration-300"
              style={{ boxShadow: focused ? BAR_GLOW_FOCUS : BAR_GLOW }}
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
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
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

      <div id="team">
        <Footer
          onSelectTab={onSelectTab}
          onOpenPrivacy={onOpenPrivacy}
          onOpenBlog={onOpenBlog}
          onOpenMedia={onOpenMedia}
        />
      </div>
    </div>
  );
};
