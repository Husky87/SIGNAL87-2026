import React, { useState } from 'react';
import { Signal87Logo } from './Signal87Logo';
import {
  Sparkles,
  Shield,
  Search,
  FileText,
  GitFork,
  ArrowRight,
  ArrowUpRight,
  Zap
} from 'lucide-react';
import { Footer } from './Footer';
import { NavTab } from './Sidebar';

const SERIF = '"Newsreader", Georgia, "Times New Roman", serif';
const SANS = '"Public Sans", -apple-system, BlinkMacSystemFont, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

interface LandingPageViewProps {
  onGoogleSignIn: () => void;
  onEnterDemo: () => void;
  onOpenPrivacy: () => void;
  onOpenBlog: () => void;
  onOpenMedia: () => void;
  onSelectTab: (tab: NavTab) => void;
}

const EXAMPLE_QUESTIONS = [
  "Summarize the indemnity caps and liability limits across active agreements",
  "Which clauses reference governing law in Delaware or New York?",
  "Compare force majeure provisions across all 2025 vendor contracts",
  "Extract key renewal dates and termination notice requirements"
];

const ROMAN_NUMERALS = ['I.', 'II.', 'III.', 'IV.'];

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onGoogleSignIn,
  onEnterDemo,
  onOpenPrivacy,
  onOpenBlog,
  onOpenMedia,
  onSelectTab
}) => {
  const [activeSource, setActiveSource] = useState<string>('Research report');
  const [followUpInput, setFollowUpInput] = useState<string>('');

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] font-sans antialiased flex flex-col selection:bg-[var(--accent)] selection:text-[var(--paper)] s87-app">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-[var(--paper)]/95 backdrop-blur-md border-b border-[var(--rule)] px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo Left */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none cursor-pointer text-left border-0 p-0 bg-transparent"
            title="Scroll to top"
          >
            <Signal87Logo size={30} />
            <span
              className="text-xl tracking-tight text-[var(--ink)]"
              style={{ fontFamily: SERIF, fontWeight: 600 }}
            >
              Signal87 AI
            </span>
          </button>

          {/* Center Navigation Pill Bar */}
          <nav className="hidden lg:flex items-center gap-1 bg-[var(--card)] border border-[var(--rule)] rounded-full px-4 py-1.5 text-xs font-medium text-[var(--ink-2)]">
            <a href="#mockup" className="px-3 py-1 hover:text-[var(--ink)] transition-colors cursor-pointer">
              Computer
            </a>
            <a href="#capabilities" className="px-3 py-1 hover:text-[var(--ink)] transition-colors cursor-pointer">
              Legislative
            </a>
            <a href="#capabilities" className="px-3 py-1 hover:text-[var(--ink)] transition-colors cursor-pointer">
              How it works
            </a>
            <a href="#capabilities" className="px-3 py-1 hover:text-[var(--ink)] transition-colors cursor-pointer">
              Pricing
            </a>
            <a href="#team" className="px-3 py-1 hover:text-[var(--ink)] transition-colors cursor-pointer">
              Team
            </a>
            <button onClick={onOpenBlog} className="px-3 py-1 hover:text-[var(--ink)] transition-colors cursor-pointer">
              Blog
            </button>
          </nav>

          {/* Right Action CTA */}
          <div className="flex items-center gap-3">
            <button
              onClick={onGoogleSignIn}
              className="text-xs font-bold text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            >
              Log in
            </button>
            <button
              onClick={onEnterDemo}
              className="px-4 py-2 border border-[var(--accent)] bg-[var(--accent-soft)] hover:bg-[var(--accent)] text-[var(--accent)] hover:text-[var(--paper)] text-xs font-bold rounded-[4px] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Zap size={13} className="text-[var(--accent)]" />
              <span>Try Demo</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <section className="relative pt-10 pb-16 sm:pt-16 sm:pb-24 px-4 sm:px-8 overflow-hidden bg-[var(--paper)] flex-1">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Left Column: Big Display Typography */}
          <div className="lg:col-span-6 space-y-6 text-left">
            {/* Kicker text */}
            <div
              className="text-xs font-mono font-semibold tracking-[0.09em] text-[var(--accent)] uppercase"
              style={{ fontFamily: MONO }}
            >
              Counsel's reading room
            </div>

            {/* Massive Serif Headline */}
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl text-[var(--ink)]"
              style={{
                fontFamily: SERIF,
                fontWeight: 500,
                letterSpacing: '-0.022em',
                lineHeight: 1.08
              }}
            >
              What shall we examine in your{' '}
              <span className="italic text-[var(--accent)]">records</span>?
            </h1>

            {/* Sub-line */}
            <p className="text-base text-[var(--ink-2)] max-w-lg leading-relaxed">
              Every finding returns with the clause and the page it rests on.
            </p>

            {/* Example Question Rows */}
            <div className="space-y-2 pt-2">
              {EXAMPLE_QUESTIONS.map((q, idx) => (
                <div
                  key={idx}
                  onClick={onEnterDemo}
                  className="p-3 bg-[var(--card)] border border-[var(--rule)] hover:border-[var(--accent)] rounded-[4px] cursor-pointer transition-colors flex items-center gap-3 text-left shadow-2xs"
                >
                  <span
                    className="text-xs font-mono font-bold text-[var(--accent)] flex-shrink-0"
                    style={{ fontFamily: MONO }}
                  >
                    {ROMAN_NUMERALS[idx]}
                  </span>
                  <span
                    className="text-[14.5px] text-[var(--ink)] leading-tight"
                    style={{ fontFamily: SERIF }}
                  >
                    {q}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="pt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={onGoogleSignIn}
                className="px-6 py-3 bg-[var(--accent)] hover:opacity-90 text-[var(--paper)] font-bold text-sm rounded-[4px] shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Sign In with Google</span>
                <ArrowUpRight size={18} />
              </button>

              <button
                onClick={onEnterDemo}
                className="px-6 py-3 bg-[var(--raised)] hover:bg-[var(--raised)]/80 text-[var(--ink)] border border-[var(--rule)] font-bold text-sm rounded-[4px] transition-all flex items-center gap-2 cursor-pointer"
              >
                <Zap size={16} className="text-[var(--accent)]" />
                <span>Instant Demo Access</span>
              </button>
            </div>
          </div>

          {/* Right Column: UI Mockup Card */}
          <div id="mockup" className="lg:col-span-6 relative">
            {/* Citation Badge */}
            <div className="absolute -top-4 right-4 z-20 bg-[var(--card)] border border-[var(--rule)] rounded-[4px] px-3.5 py-1.5 text-right shadow-md">
              <span
                className="text-[9px] font-mono text-[var(--slate)] uppercase tracking-[0.09em] block font-bold"
                style={{ fontFamily: MONO }}
              >
                GROUNDED
              </span>
              <span className="text-xs font-bold text-[var(--ink)]">32 citations attached</span>
            </div>

            {/* Main Interactive Card Container */}
            <div className="bg-[var(--card)] border border-[var(--rule)] rounded-[6px] p-5 shadow-lg space-y-4 relative">
              {/* Inside Header Bar */}
              <div className="flex items-center justify-between border-b border-[var(--rule-2)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--verify)]" />
                  <span
                    className="text-[10px] font-mono font-bold text-[var(--ink)] uppercase tracking-[0.09em]"
                    style={{ fontFamily: MONO }}
                  >
                    INDEXED RECORDS
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[var(--slate)]" style={{ fontFamily: MONO }}>
                  4 FILES READY
                </span>
              </div>

              {/* Two Column Interface Inside Card */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                {/* Active Sources List */}
                <div className="sm:col-span-4 space-y-2 border-r border-[var(--rule-2)] sm:pr-3">
                  <span
                    className="text-[9px] font-mono font-bold text-[var(--slate)] uppercase tracking-[0.09em] block mb-1"
                    style={{ fontFamily: MONO }}
                  >
                    ACTIVE SOURCES
                  </span>

                  {[
                    { title: 'Research report', status: 'READING' },
                    { title: 'Service agreement', status: 'READY' },
                    { title: 'Budget workbook', status: 'READY' },
                    { title: 'Meeting notes', status: 'READY' }
                  ].map((src) => (
                    <div
                      key={src.title}
                      onClick={() => setActiveSource(src.title)}
                      className={`p-2 rounded-[4px] border text-left cursor-pointer transition-all flex items-center justify-between text-xs ${
                        activeSource === src.title
                          ? 'bg-[var(--raised)] border-[var(--rule)] text-[var(--ink)] font-bold'
                          : 'bg-[var(--card)] border border-[var(--rule-2)] text-[var(--ink-2)] hover:bg-[var(--raised)]'
                      }`}
                    >
                      <span className="truncate pr-1 text-[11px]">{src.title}</span>
                      <span
                        className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--raised)] text-[var(--slate)]"
                        style={{ fontFamily: MONO }}
                      >
                        {src.status}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Answer Detail */}
                <div className="sm:col-span-8 space-y-4 text-left">
                  <div className="flex items-center gap-1.5 text-[var(--accent)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                    <span
                      className="text-[10px] font-mono font-bold uppercase tracking-[0.09em]"
                      style={{ fontFamily: MONO }}
                    >
                      FINDING SUMMARY
                    </span>
                  </div>

                  <div>
                    <h2
                      className="text-xl text-[var(--ink)]"
                      style={{ fontFamily: SERIF, fontWeight: 500 }}
                    >
                      Project risks & liability caps
                    </h2>
                    <p className="text-[10px] font-mono text-[var(--slate)] mt-0.5" style={{ fontFamily: MONO }}>
                      14 findings · 8 sources · 32 cited details
                    </p>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[var(--raised)] border border-[var(--rule)] p-2 rounded-[4px] text-left">
                      <span className="text-base font-bold text-[var(--ink)] block" style={{ fontFamily: SERIF }}>14</span>
                      <span className="text-[8px] font-mono text-[var(--slate)] uppercase font-bold" style={{ fontFamily: MONO }}>FINDINGS</span>
                    </div>
                    <div className="bg-[var(--raised)] border border-[var(--rule)] p-2 rounded-[4px] text-left">
                      <span className="text-base font-bold text-[var(--ink)] block" style={{ fontFamily: SERIF }}>8</span>
                      <span className="text-[8px] font-mono text-[var(--slate)] uppercase font-bold" style={{ fontFamily: MONO }}>SOURCES</span>
                    </div>
                    <div className="bg-[var(--raised)] border border-[var(--rule)] p-2 rounded-[4px] text-left">
                      <span className="text-base font-bold text-[var(--ink)] block" style={{ fontFamily: SERIF }}>32</span>
                      <span className="text-[8px] font-mono text-[var(--slate)] uppercase font-bold" style={{ fontFamily: MONO }}>CITATIONS</span>
                    </div>
                  </div>

                  {/* Composer */}
                  <div className="bg-[var(--card)] border border-[var(--rule)] rounded-[4px] p-2 flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--accent)] font-bold" style={{ fontFamily: MONO }}>&gt;</span>
                    <input
                      type="text"
                      value={followUpInput}
                      onChange={(e) => setFollowUpInput(e.target.value)}
                      placeholder="Ask anything..."
                      className="bg-transparent border-none text-xs text-[var(--ink)] placeholder-[var(--slate)] focus:outline-hidden w-full"
                    />
                    <button
                      onClick={onEnterDemo}
                      className="px-3 py-1 bg-[var(--accent)] hover:opacity-95 text-[var(--paper)] text-[10px] font-mono font-bold rounded-[3px] cursor-pointer flex-shrink-0"
                      style={{ fontFamily: MONO }}
                    >
                      Ask
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section id="capabilities" className="py-16 px-4 sm:px-8 bg-[var(--card)] border-t border-[var(--rule)]">
        <div className="max-w-7xl mx-auto space-y-8 text-center">
          <div className="space-y-2">
            <span
              className="text-xs font-mono text-[var(--accent)] font-bold uppercase tracking-[0.09em]"
              style={{ fontFamily: MONO }}
            >
              Grounded Legal Intelligence
            </span>
            <h2 className="text-2xl sm:text-3xl font-normal text-[var(--ink)]" style={{ fontFamily: SERIF }}>
              Why Legal & Regulatory Teams Trust Signal87
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-6 bg-[var(--raised)] border border-[var(--rule)] rounded-[6px] space-y-3">
              <FileText className="text-[var(--accent)]" size={22} />
              <h3 className="font-normal text-[var(--ink)] text-lg" style={{ fontFamily: SERIF }}>Direct Paragraph Citations</h3>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                Click any citation to open the exact page and paragraph in your PDF repo. Zero guesswork or hallucinated clauses.
              </p>
            </div>

            <div className="p-6 bg-[var(--raised)] border border-[var(--rule)] rounded-[6px] space-y-3">
              <GitFork className="text-[var(--accent)]" size={22} />
              <h3 className="font-normal text-[var(--ink)] text-lg" style={{ fontFamily: SERIF }}>Multi-Contract Matrix</h3>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                Compare indemnity caps, renewal dates, and compliance clauses across dozens of active vendor agreements simultaneously.
              </p>
            </div>

            <div className="p-6 bg-[var(--raised)] border border-[var(--rule)] rounded-[6px] space-y-3">
              <Shield className="text-[var(--verify)]" size={22} />
              <h3 className="font-normal text-[var(--ink)] text-lg" style={{ fontFamily: SERIF }}>Strict Zero Training Policy</h3>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                Your confidential documents and query history are isolated in Firestore and never used for public model training.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Leadership & Team Section */}
      <section id="team" className="py-16 sm:py-24 px-4 sm:px-8 bg-[var(--paper)] border-t border-[var(--rule)]">
        <div className="max-w-5xl mx-auto space-y-12 text-center">
          <div className="space-y-3">
            <span
              className="text-xs font-mono font-bold text-[var(--accent)] uppercase tracking-[0.09em]"
              style={{ fontFamily: MONO }}
            >
              Executive Leadership
            </span>
            <h2 className="text-2xl sm:text-4xl text-[var(--ink)]" style={{ fontFamily: SERIF }}>
              Spearheaded by Enterprise AI Pioneers
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-2)] max-w-xl mx-auto">
              Founded on a single uncompromising thesis: enterprise research AI must be completely verifiable, citation-backed, and immune to memory loss.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <div className="bg-[var(--card)] p-6 sm:p-8 rounded-[6px] border border-[var(--rule)] space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-[4px] bg-[var(--accent)] text-[var(--paper)] font-bold text-base flex items-center justify-center">
                  MB
                </div>
                <div>
                  <h3 className="text-lg text-[var(--ink)]" style={{ fontFamily: SERIF }}>Michael Benezra</h3>
                  <span className="text-xs font-mono text-[var(--accent)] font-bold block" style={{ fontFamily: MONO }}>
                    Chief Executive Officer & Co-Founder
                  </span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
                Michael Benezra leads Signal87’s strategic direction, enterprise partnerships, and legal tech innovation. Under his leadership, Signal87 has pioneered verifiable document memory for high-stakes municipal, legislative, and corporate governance teams.
              </p>
            </div>

            <div className="bg-[var(--card)] p-6 sm:p-8 rounded-[6px] border border-[var(--rule)] space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-[4px] bg-[var(--raised)] text-[var(--ink)] border border-[var(--rule)] font-bold text-base flex items-center justify-center">
                  MC
                </div>
                <div>
                  <h3 className="text-lg text-[var(--ink)]" style={{ fontFamily: SERIF }}>Michael Chavira</h3>
                  <span className="text-xs font-mono text-[var(--accent)] font-bold block" style={{ fontFamily: MONO }}>
                    Co-Founder & Chief Systems Architect
                  </span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-[var(--ink-2)] leading-relaxed">
                Michael Chavira architects Signal87's ultra-low latency vector pipelines, long-context memory stores, and distributed OCR parsing nodes. His engineering principles ensure sub-second citation verification with zero data leakage.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer
        onSelectTab={onSelectTab}
        onOpenPrivacy={onOpenPrivacy}
        onOpenBlog={onOpenBlog}
        onOpenMedia={onOpenMedia}
      />
    </div>
  );
};
