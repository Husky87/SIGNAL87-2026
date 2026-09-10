import React, { useEffect, useState } from 'react';
import { Signal87Logo } from './Signal87Logo';
import { Footer } from './Footer';
import { NavTab } from './Sidebar';
import { ArrowRight, Check, Database, FileText, Globe2, Link2, Play, Search, Sparkles, TrendingUp, Upload, Zap } from 'lucide-react';

interface LandingPageViewProps {
  onOpenEmailAuth: (mode?: 'signup' | 'signin') => void;
  onOpenPrivacy: () => void;
  onOpenBlog: () => void;
  onOpenMedia: () => void;
  onSelectTab: (tab: NavTab) => void;
}

const DEMO_QUERIES = [
  'Summarize the latest contract',
  'Find the biggest revenue drivers',
  'Compare data across business units',
  'What changed since last quarter?'
];

const SOURCE_ITEMS = [
  { icon: FileText, label: 'Financials_Q3.pdf' },
  { icon: Database, label: 'Warehouse metrics' },
  { icon: Globe2, label: 'Market intelligence' }
];

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenEmailAuth,
  onOpenPrivacy,
  onOpenBlog,
  onOpenMedia,
  onSelectTab
}) => {
  const [query, setQuery] = useState('');
  const [queryIndex, setQueryIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const phrase = DEMO_QUERIES[queryIndex];
    const completed = query === phrase;
    const empty = query.length === 0;
    const delay = completed ? 1700 : empty ? 500 : isDeleting ? 35 : 58;

    const timer = window.setTimeout(() => {
      if (!isDeleting && !completed) {
        setQuery(phrase.slice(0, query.length + 1));
      } else if (!isDeleting && completed) {
        setIsDeleting(true);
      } else if (isDeleting && !empty) {
        setQuery(phrase.slice(0, query.length - 1));
      } else {
        setIsDeleting(false);
        setQueryIndex((current) => (current + 1) % DEMO_QUERIES.length);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [query, queryIndex, isDeleting, isPaused]);

  const handleAsk = (event?: React.FormEvent) => {
    event?.preventDefault();
    onOpenEmailAuth('signup');
  };

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-[#f5f5f0] text-[#20211e] antialiased selection:bg-[#b9e8ef] selection:text-[#20211e]">
      <header className="relative z-20 flex items-center justify-between px-6 py-5 sm:px-10 lg:px-16">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex min-h-[44px] items-center gap-2 text-left transition-opacity hover:opacity-70"
          title="Signal87"
        >
          <Signal87Logo size={24} />
          <span className="text-[15px] font-semibold tracking-[-0.04em]">Signal87</span>
        </button>

        <nav className="hidden items-center gap-8 text-[12px] text-[#686963] md:flex">
          <a href="#product" className="transition-colors hover:text-[#20211e]">Product</a>
          <a href="#solutions" className="transition-colors hover:text-[#20211e]">Solutions</a>
          <a href="#platform" className="transition-colors hover:text-[#20211e]">Platform</a>
          <a href="#company" className="transition-colors hover:text-[#20211e]">Company</a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <button type="button" onClick={() => onOpenEmailAuth('signin')} className="min-h-[44px] px-2 text-[12px] font-medium text-[#5f605b] transition-colors hover:text-[#20211e]">Log in</button>
          <button type="button" onClick={() => onOpenEmailAuth('signup')} className="group flex min-h-[40px] items-center gap-2 rounded-full bg-[#20211e] px-4 text-[12px] font-medium text-white transition-transform hover:-translate-y-0.5">Get started <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></button>
        </div>
      </header>

      <main>
        <section id="product" className="relative overflow-hidden px-6 pb-20 pt-16 sm:px-10 sm:pb-28 sm:pt-24 lg:px-16 lg:pt-28">
          <div className="pointer-events-none absolute -left-40 top-20 h-[520px] w-[520px] rounded-full bg-[#d9f3f4]/50 blur-3xl" />
          <div className="pointer-events-none absolute right-[-180px] top-0 h-[620px] w-[620px] rounded-full bg-[#e8e8e1] blur-3xl" />

          <div className="relative mx-auto grid max-w-[1280px] items-center gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
            <div className="max-w-[590px]">
              <div className="mb-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6c7775]"><Sparkles size={13} /> AI for documents, data & decisions</div>
              <h1 className="max-w-[680px] text-[clamp(2.8rem,5.5vw,5.5rem)] font-medium leading-[0.98] tracking-[-0.075em] text-[#20211e]">Ask anything about your documents, data, and more.</h1>
              <p className="mt-7 max-w-[470px] text-[16px] leading-7 text-[#6d6e67] sm:text-[18px]">Signal87 helps you find, analyze, and understand information across your documents, internal data, and the web — instantly.</p>

              <form onSubmit={handleAsk} className="mt-9 max-w-[560px]">
                <div className="relative flex min-h-[62px] items-center rounded-full border border-[#d7d8d1] bg-white/80 p-2 pl-5 shadow-[0_12px_40px_rgba(32,33,30,0.06)] backdrop-blur transition-all focus-within:border-[#83cbd5] focus-within:shadow-[0_12px_45px_rgba(77,183,198,0.16)]">
                  <Search size={17} className="mr-3 shrink-0 text-[#6bb9c5]" />
                  <input aria-label="Ask Signal87 a question" value={query} onChange={(event) => { setQuery(event.target.value); setIsPaused(true); }} onFocus={() => setIsPaused(true)} onBlur={() => setIsPaused(false)} placeholder="Ask a question about your documents, data, or anything..." className="min-w-0 flex-1 bg-transparent text-[14px] text-[#20211e] outline-none placeholder:text-[#989a93]" />
                  <button type="submit" aria-label="Get started" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#20211e] text-white transition-transform hover:scale-105"><ArrowRight size={17} /></button>
                </div>
              </form>

              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-[11px] text-[#74766e]">
                <span className="flex items-center gap-2"><Search size={13} /> Search your sources</span>
                <span className="flex items-center gap-2"><TrendingUp size={13} /> Analyze your data</span>
                <span className="flex items-center gap-2"><Zap size={13} /> Get instant insights</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[700px] lg:pt-4">
              <div className="absolute -inset-8 rounded-[48px] bg-gradient-to-br from-white/70 via-transparent to-[#d8f0f1]/60 blur-2xl" />
              <div className="relative overflow-hidden rounded-[18px] border border-[#d8d9d2] bg-[#fbfbf8] shadow-[0_28px_80px_rgba(32,33,30,0.12)] transition-transform duration-700 hover:-translate-y-1">
                <div className="flex h-10 items-center gap-1 border-b border-[#e7e7e1] px-4"><span className="h-2.5 w-2.5 rounded-full bg-[#d9dad4]" /><span className="h-2.5 w-2.5 rounded-full bg-[#d9dad4]" /><span className="h-2.5 w-2.5 rounded-full bg-[#d9dad4]" /><span className="ml-auto text-[9px] text-[#a1a39b]">Signal87 workspace</span></div>
                <div className="grid min-h-[390px] grid-cols-[150px_1fr] sm:grid-cols-[185px_1fr]">
                  <aside className="border-r border-[#e7e7e1] bg-[#f7f7f3] p-4 text-[10px] text-[#85877f]">
                    <div className="mb-6 flex items-center gap-2 font-semibold text-[#20211e]"><Signal87Logo size={15} /> Signal87</div>
                    <div className="space-y-4"><div className="rounded-md bg-white px-2.5 py-2 text-[#20211e] shadow-sm">New session</div><div className="flex items-center gap-2"><FileText size={13} /> Documents</div><div className="flex items-center gap-2"><Database size={13} /> Data sources</div><div className="flex items-center gap-2"><Globe2 size={13} /> Web research</div><div className="flex items-center gap-2"><Link2 size={13} /> Integrations</div></div>
                  </aside>
                  <div className="relative p-4 sm:p-6">
                    <div className="mb-5 flex items-center gap-2 rounded-lg border border-[#e3e4dd] bg-white px-3 py-2.5 text-[10px] text-[#85877f]"><Search size={13} /> {query || 'Ask anything about your documents...'}</div>
                    <div className="rounded-xl border border-[#e2e3dc] bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-[10px] font-medium text-[#20211e]"><span>Analyzing connected sources</span><span className="text-[#6bb9c5]">Live</span></div><div className="mt-4 space-y-3">{SOURCE_ITEMS.map(({ icon: Icon, label }, index) => <div key={label} className="flex items-center gap-3 text-[10px] text-[#777970]"><Icon size={14} className="text-[#8cc8cf]" /><span className="flex-1">{label}</span><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6bb9c5]" style={{ animationDelay: `${index * 180}ms` }} /></div>)}</div></div>
                    <div className="mt-4 rounded-xl border border-[#e2e3dc] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-[10px] font-medium text-[#20211e]">Revenue trend</span><span className="text-[10px] text-[#6bb9c5]">+24%</span></div><div className="mt-5 flex h-20 items-end gap-2">{[30, 44, 38, 58, 52, 72, 66, 88].map((height, index) => <div key={index} className="flex-1 rounded-t-sm bg-gradient-to-t from-[#b5e3e8] to-[#70c5d0] transition-all duration-700" style={{ height: `${height}%`, animationDelay: `${index * 80}ms` }} />)}</div></div>
                    <div className="absolute -right-5 bottom-5 rounded-xl border border-[#e1e2db] bg-white px-4 py-3 shadow-[0_14px_35px_rgba(32,33,30,0.1)]"><div className="flex items-center gap-2 text-[10px] font-medium text-[#20211e]"><Sparkles size={13} className="text-[#6bb9c5]" /> Found 3 relevant insights</div></div>
                  </div>
                </div>
              </div>
              <div className="absolute -right-4 -top-8 hidden rounded-xl border border-[#e0e1da] bg-white/90 px-4 py-3 text-[10px] text-[#6f7169] shadow-lg backdrop-blur sm:block"><span className="mb-1 block font-medium text-[#20211e]">Connected knowledge</span><span className="flex items-center gap-2"><Check size={12} className="text-[#6bb9c5]" /> Documents</span><span className="flex items-center gap-2"><Check size={12} className="text-[#6bb9c5]" /> Structured data</span><span className="flex items-center gap-2"><Check size={12} className="text-[#6bb9c5]" /> Web sources</span></div>
            </div>
          </div>

          <div className="relative mx-auto mt-20 flex max-w-[900px] flex-wrap items-center justify-center gap-x-10 gap-y-5 border-t border-[#e0e1da] pt-8 text-[11px] text-[#85877f] sm:mt-28"><span className="w-full text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-[#a0a29a]">Built for teams working with complex information</span><span>OpenAI</span><span>Notion</span><span>Anthropic</span><span className="font-semibold tracking-tight">stripe</span><span>Databricks</span></div>
        </section>

        <section id="solutions" className="border-y border-[#e3e4dd] bg-[#f0f1eb] px-6 py-20 sm:px-10 sm:py-28 lg:px-16">
          <div className="mx-auto grid max-w-[1280px] items-center gap-14 lg:grid-cols-[0.75fr_1.25fr] lg:gap-24">
            <div><div className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7b817e]">Built for modern teams</div><h2 className="max-w-[480px] text-[clamp(2.3rem,4vw,4.2rem)] font-medium leading-[1.02] tracking-[-0.065em] text-[#202b30]">From documents to data, to real answers.</h2><p className="mt-6 max-w-[420px] text-[15px] leading-7 text-[#737870]">Bring your information together so you can get deeper insights, faster. Combine documents, structured data, and live information with the power of AI.</p><div className="mt-8 space-y-5"><div className="flex gap-3"><div className="mt-0.5 rounded-full bg-white p-2"><FileText size={16} /></div><div><h3 className="text-[13px] font-semibold">Document intelligence</h3><p className="mt-1 text-[12px] leading-5 text-[#7b7e76]">Summarize, compare, and extract key insights from your documents.</p></div></div><div className="flex gap-3"><div className="mt-0.5 rounded-full bg-white p-2"><TrendingUp size={16} /></div><div><h3 className="text-[13px] font-semibold">Data analysis</h3><p className="mt-1 text-[12px] leading-5 text-[#7b7e76]">Ask questions, find trends, and turn your data into actionable insights.</p></div></div><div className="flex gap-3"><div className="mt-0.5 rounded-full bg-white p-2"><Globe2 size={16} /></div><div><h3 className="text-[13px] font-semibold">Live knowledge</h3><p className="mt-1 text-[12px] leading-5 text-[#7b7e76]">Connect to your tools, the web, and the information your team already has.</p></div></div></div></div>
            <div className="relative rounded-[20px] border border-[#dfe1d9] bg-[#fafaf6] p-4 shadow-[0_24px_70px_rgba(32,33,30,0.07)] sm:p-6"><div className="mb-4 flex items-center gap-2 rounded-lg border border-[#e5e6df] bg-white px-4 py-3 text-[11px] text-[#73766d]"><Search size={14} /> What are the key growth drivers across our business?</div><div className="grid gap-4 sm:grid-cols-[1fr_0.7fr]"><div className="rounded-xl border border-[#e5e6df] bg-white p-5"><div className="flex items-center justify-between text-[11px] font-semibold"><span>Here are the key growth drivers:</span><Sparkles size={14} className="text-[#6bb9c5]" /></div><div className="mt-5 space-y-4 text-[11px] text-[#73766d]"><div className="flex justify-between border-b border-[#eeeeea] pb-3"><span>1. Product expansion</span><span className="font-medium text-[#6bb9c5]">+42%</span></div><div className="flex justify-between border-b border-[#eeeeea] pb-3"><span>2. Enterprise adoption</span><span className="font-medium text-[#6bb9c5]">+28%</span></div><div className="flex justify-between"><span>3. International markets</span><span className="font-medium text-[#6bb9c5]">+19%</span></div></div><p className="mt-6 text-[11px] leading-5 text-[#85877f]">The primary driver of growth is product expansion, which contributed the largest share of total revenue increase.</p></div><div className="rounded-xl border border-[#e5e6df] bg-white p-5"><div className="text-[11px] font-semibold">Revenue by segment</div><div className="mt-8 flex h-32 items-end gap-3">{[42, 28, 19, 11].map((value, index) => <div key={value} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t bg-[#8ccfd8]" style={{ height: `${value * 2.1}px`, opacity: 1 - index * 0.12 }} /><span className="text-[9px] text-[#999b93]">{['Ent.', 'SMB', 'Intl.', 'Other'][index]}</span></div>)}</div></div></div><div className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full border border-[#b9e5e9] opacity-70" /></div>
          </div>
        </section>

        <section id="platform" className="px-6 py-20 sm:px-10 sm:py-28 lg:px-16"><div className="mx-auto max-w-[1280px]"><div className="mb-12 max-w-[540px]"><div className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7b817e]">More than a search engine</div><h2 className="text-[clamp(2.3rem,4vw,4rem)] font-medium leading-[1.02] tracking-[-0.065em]">Your AI copilot for complex information.</h2><p className="mt-6 text-[15px] leading-7 text-[#73766d]">Signal87 understands your context, reasons across sources, and helps you make better decisions — faster.</p></div><div className="grid border-y border-[#e0e1da] sm:grid-cols-4">{[{icon: Search, title: 'Find', body: 'Instantly locate the right information across all your sources.'}, {icon: Sparkles, title: 'Understand', body: 'Get clear, contextual answers with citations.'}, {icon: FileText, title: 'Compare', body: 'See differences, find patterns, and make smarter decisions.'}, {icon: Zap, title: 'Act', body: 'Turn insights into action with your existing workflows.'}].map(({ icon: Icon, title, body }) => <div key={title} className="border-b border-[#e0e1da] py-7 sm:border-b-0 sm:border-r sm:px-7 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0"><Icon size={18} className="mb-6 text-[#6bb9c5]" /><h3 className="text-[16px] font-medium">{title}</h3><p className="mt-3 text-[12px] leading-5 text-[#7b7e76]">{body}</p></div>)}</div><div className="mt-10 flex flex-wrap gap-3"><button type="button" onClick={() => onOpenEmailAuth('signup')} className="group flex items-center gap-2 rounded-full bg-[#20211e] px-5 py-3 text-[12px] font-medium text-white transition-transform hover:-translate-y-0.5">Get started <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></button><button type="button" onClick={() => onOpenMedia()} className="flex items-center gap-2 rounded-full px-5 py-3 text-[12px] font-medium text-[#666961] transition-colors hover:text-[#20211e]"><Play size={13} /> Watch demo</button></div></div></section>

        <section id="company" className="relative overflow-hidden border-t border-[#e0e1da] bg-[#eef0e9] px-6 py-24 text-center sm:px-10 sm:py-32 lg:px-16"><div className="pointer-events-none absolute -bottom-48 left-1/2 h-[420px] w-[900px] -translate-x-1/2 rounded-[50%] border border-white/80 bg-white/30 blur-sm" /><div className="relative mx-auto max-w-[620px]"><div className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7b817e]">Join forward-thinking teams</div><h2 className="text-[clamp(2.2rem,4vw,3.8rem)] font-medium leading-[1.03] tracking-[-0.06em] text-[#202b30]">The next generation of information work is here.</h2><p className="mx-auto mt-6 max-w-[430px] text-[14px] leading-6 text-[#737870]">Combine your documents, data, and the web with AI. Get started with Signal87 today.</p><button type="button" onClick={() => onOpenEmailAuth('signup')} className="group mt-8 inline-flex items-center gap-2 rounded-full bg-[#20211e] px-6 py-3.5 text-[12px] font-medium text-white transition-transform hover:-translate-y-0.5">Get started <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></button></div></section>
      </main>

      <Footer onSelectTab={onSelectTab} onOpenPrivacy={onOpenPrivacy} onOpenBlog={onOpenBlog} onOpenMedia={onOpenMedia} />
    </div>
  );
};
