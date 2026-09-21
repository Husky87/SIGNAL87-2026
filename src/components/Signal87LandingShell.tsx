import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Database, FileText, Globe2, Search, Sparkles, TrendingUp } from 'lucide-react';
import { Signal87Logo } from './Signal87Logo';
import { NavTab } from './Sidebar';

/* Fires once, the first time the element reaches `threshold` visibility, then
   disconnects — the scroll-triggered graphics below must not replay when the
   user scrolls back up. The observer is only the trigger; the animation itself
   is CSS. */
function useInViewOnce<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || inView) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, threshold]);
  return [ref, inView] as const;
}

interface Signal87LandingShellProps { onOpenEmailAuth: (mode?: 'signup' | 'signin') => void; onSelectTab: (tab: NavTab) => void; onAskQuestion: (question: string) => void; }

export const Signal87LandingShell: React.FC<Signal87LandingShellProps> = ({ onOpenEmailAuth, onSelectTab, onAskQuestion }) => {
  const [value, setValue] = useState('');
  const [solutionsRef, solutionsInView] = useInViewOnce<HTMLDivElement>();
  const [platformRef, platformInView] = useInViewOnce<HTMLDivElement>();
  const submit = (event: FormEvent) => { event.preventDefault(); if (value.trim()) onAskQuestion(value.trim()); };
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f7f3] text-[#20211e]">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-10 sm:py-5 lg:px-14">
        <button className="flex min-h-11 items-center gap-2" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Signal87Logo size={25} /><span className="text-base font-semibold tracking-[-0.04em]">Signal87</span></button>
        <nav className="hidden items-center gap-8 text-xs text-[#72746d] md:flex"><a href="#product">Product</a><a href="#solutions">Solutions</a><a href="#platform">Platform</a></nav>
        <div className="flex items-center gap-1 sm:gap-4"><button className="min-h-11 px-1.5 text-xs text-[#686a63] sm:px-2" onClick={() => onOpenEmailAuth('signin')}>Log in</button><button className="flex min-h-11 items-center gap-1.5 rounded-full bg-[#20211e] px-3 text-xs font-medium text-white sm:gap-2 sm:px-4" onClick={() => onOpenEmailAuth('signup')}>Get started <ArrowRight size={14} /></button></div>
      </header>
      <main>
        <section id="product" className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-10 sm:gap-14 sm:px-10 sm:pb-20 sm:pt-16 lg:grid-cols-[.9fr_1.1fr] lg:px-14 lg:pb-16 lg:pt-14">
          <svg aria-hidden="true" className="pointer-events-none absolute -left-24 top-4 h-[480px] w-[480px] opacity-70" viewBox="0 0 400 400" fill="none">
            <circle cx="200" cy="200" r="16" fill="#69b9c5" opacity="0.5" />
            {[55, 100, 150, 195].map((r, i) => (
              <circle
                key={r}
                cx="200" cy="200" r={r}
                stroke="#69b9c5" strokeWidth="1.5" fill="none"
                style={{
                  transformOrigin: '200px 200px',
                  animation: `hero-ping 3.2s ease-out ${i * 0.5}s infinite`,
                }}
              />
            ))}
          </svg>
          <div className="relative z-10 max-w-xl"><div className="mb-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-[#6c7775]"><Sparkles size={13} /> Intelligence for complex information</div><h1 className="text-[clamp(2.65rem,12vw,5.8rem)] font-medium leading-[.96] tracking-[-.08em]">Ask anything about your documents, data, and more.</h1><p className="mt-7 max-w-lg text-base leading-7 text-[#6d6e67] sm:text-lg">Find, analyze, and understand information across your documents, internal data, and the web — instantly.</p><form onSubmit={submit} className="mt-7 max-w-xl sm:mt-9"><div className="flex min-h-16 items-center gap-3 rounded-full border border-[#d6d8d0] bg-white px-5 py-2 shadow-[0_14px_45px_rgba(32,33,30,.07)] focus-within:border-[#80cbd4]"><Search size={18} className="shrink-0 text-[#69b9c5]" /><input aria-label="Ask Signal87" required value={value} onChange={event => setValue(event.target.value)} placeholder="Ask a question about your information..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9a9c95]" /><button type="submit" aria-label="Ask Signal87" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#20211e] text-white"><ArrowRight size={17} /></button></div><p className="mt-2 pl-5 text-xs text-[#7b7d75]">Sign in to get your answer.</p></form><div className="mt-6 flex flex-wrap gap-x-4 gap-y-3 sm:gap-x-6 text-xs text-[#7b7d75]"><span className="flex items-center gap-2"><Search size={13} /> Search sources</span><span className="flex items-center gap-2"><TrendingUp size={13} /> Analyze data</span><span className="flex items-center gap-2"><Sparkles size={13} /> Surface insights</span></div></div>
          <div className="relative z-10 mx-auto w-full max-w-2xl"><div className="overflow-hidden rounded-2xl border border-[#d9dad3] bg-[#fcfcf9] shadow-[0_30px_90px_rgba(32,33,30,.13)]"><div className="flex h-11 items-center gap-1 border-b border-[#e8e8e1] px-4"><i className="h-2.5 w-2.5 rounded-full bg-[#d8d9d2]" /><i className="h-2.5 w-2.5 rounded-full bg-[#d8d9d2]" /><i className="h-2.5 w-2.5 rounded-full bg-[#d8d9d2]" /><span className="ml-auto text-[10px] text-[#a1a39b]">Signal87 workspace</span></div><div className="grid min-h-[330px] grid-cols-1 sm:min-h-[390px] sm:grid-cols-[176px_1fr]"><aside className="hidden border-r border-[#e8e8e1] sm:block bg-[#f6f6f1] p-4 text-[10px] text-[#85877f]"><div className="mb-7 flex items-center gap-2 font-semibold text-[#20211e]"><Signal87Logo size={15} /> Signal87</div><div className="space-y-4"><div className="rounded-md bg-white px-2.5 py-2 text-[#20211e] shadow-sm">New session</div><div className="flex items-center gap-2"><FileText size={13} /> Documents</div><div className="flex items-center gap-2"><Database size={13} /> Data sources</div><div className="flex items-center gap-2"><Globe2 size={13} /> Web research</div></div></aside><div className="relative min-w-0 p-4 sm:p-6"><div className="mb-5 flex items-center gap-2 rounded-lg border border-[#e4e5de] bg-white px-3 py-3 text-[10px] text-[#85877f]"><Search size={13} /> {value || 'Ask anything about your information...'}</div><div className="rounded-xl border border-[#e3e4dd] bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-[10px] font-medium"><span>Connected sources</span><span className="text-[#69b9c5]">Live</span></div><div className="mt-5 space-y-4 text-[10px] text-[#777970]"><div className="flex items-center gap-3"><FileText size={14} className="text-[#83c8d0]" /> Financials_Q3.pdf <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-[#69b9c5]" /></div><div className="flex items-center gap-3"><Database size={14} className="text-[#83c8d0]" /> Warehouse metrics <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-[#69b9c5]" /></div><div className="flex items-center gap-3"><Globe2 size={14} className="text-[#83c8d0]" /> Market intelligence <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-[#69b9c5]" /></div></div></div><div className="mt-4 rounded-xl border border-[#e3e4dd] bg-white p-4 shadow-sm"><div className="flex justify-between text-[10px] font-medium"><span>Revenue trend</span><span className="text-[#69b9c5]">+24%</span></div><div className="mt-5 flex h-20 items-end gap-2">{[30,44,38,58,52,72,66,88].map(height => <div key={height} className="flex-1 rounded-t-sm bg-[#8ed0d7]" style={{ height: `${height}%` }} />)}</div></div></div></div></div></div>
        </section>
        <section id="solutions" className="border-y border-[#e3e4dd] bg-[#eff0ea] px-5 py-14 sm:px-10 sm:py-20 lg:px-14"><div ref={solutionsRef} className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-center"><div className="max-w-2xl"><div className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#7b817e]">One intelligence layer</div><h2 className="mt-5 text-[clamp(2.4rem,5vw,4.5rem)] font-medium leading-[1] tracking-[-.07em]">From documents to data, to real answers.</h2><p className="mt-6 max-w-xl text-base leading-7 text-[#737870]">Bring your information together and turn scattered sources into clear, defensible decisions.</p></div>
          <svg aria-hidden="true" className="mx-auto w-full max-w-md" viewBox="0 0 400 250" fill="none">
            <g stroke="#69b9c5" strokeWidth="1" opacity="0.55">
              {[
                ['90,70', '180,110'], ['180,110', '150,185'], ['180,110', '270,90'],
                ['270,90', '320,160'], ['150,185', '270,90'], ['90,70', '150,185'],
                ['270,90', '230,200'], ['150,185', '230,200'],
              ].map(([a, b], i) => {
                const [x1, y1] = a.split(',').map(Number);
                const [x2, y2] = b.split(',').map(Number);
                const len = Math.hypot(x2 - x1, y2 - y1);
                return (
                  <line
                    key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                    strokeDasharray={len}
                    strokeDashoffset={solutionsInView ? 0 : len}
                    style={{ transition: `stroke-dashoffset 0.6s ease ${i * 0.08}s` }}
                  />
                );
              })}
            </g>
            {[
              [90, 70, 5, '#69b9c5'], [180, 110, 8, '#20211e'], [150, 185, 5, '#69b9c5'],
              [270, 90, 6, '#69b9c5'], [320, 160, 4, '#83c8d0'], [230, 200, 4, '#83c8d0'],
            ].map(([cx, cy, r, fill], i) => (
              <circle
                key={i} cx={cx as number} cy={cy as number} r={r as number} fill={fill as string}
                style={{
                  opacity: solutionsInView ? 1 : 0,
                  transform: solutionsInView ? 'scale(1)' : 'scale(0.4)',
                  transformOrigin: `${cx}px ${cy}px`,
                  transition: `opacity 0.3s ease ${0.6 + i * 0.06}s, transform 0.3s ease ${0.6 + i * 0.06}s`,
                }}
              />
            ))}
          </svg>
        </div></section>
        <section id="platform" className="px-5 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-14"><div ref={platformRef} className="mx-auto grid max-w-7xl gap-x-10 gap-y-6 lg:grid-cols-2 lg:items-end lg:gap-y-4"><div><div className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#7b817e]">Platform</div><h2 className="mt-5 text-[clamp(2.4rem,5vw,4.5rem)] font-medium leading-[1] tracking-[-.07em]">A secure intelligence workspace for the information that matters.</h2></div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-[#dedfd8] bg-white p-5"><Database size={18} className="text-[#69b9c5]" /><div className="mt-8 text-sm font-medium">Connect</div><p className="mt-2 text-xs leading-5 text-[#777970]">Bring documents, data sources, and web research into one workspace.</p></div><div className="rounded-2xl border border-[#dedfd8] bg-white p-5"><Search size={18} className="text-[#69b9c5]" /><div className="mt-8 text-sm font-medium">Analyze</div><p className="mt-2 text-xs leading-5 text-[#777970]">Ask questions and surface evidence across connected information.</p></div><div className="rounded-2xl border border-[#dedfd8] bg-white p-5"><Sparkles size={18} className="text-[#69b9c5]" /><div className="mt-8 text-sm font-medium">Decide</div><p className="mt-2 text-xs leading-5 text-[#777970]">Turn complex source material into clear, defensible insights.</p></div></div>
          <svg aria-hidden="true" className="mx-auto w-full max-w-sm lg:col-span-2" viewBox="0 55 400 195" fill="none">
            <g style={{
              animation: platformInView ? 'strata-drift 6s ease-in-out infinite' : 'none',
              opacity: platformInView ? 1 : 0,
              transition: 'opacity 0.8s ease',
            }}>
              <path d="M0 100 C 90 70, 160 130, 240 95 S 360 60, 400 90 L 400 250 L 0 250 Z" fill="#20211e" opacity="0.9" />
              <path d="M0 145 C 100 118, 170 178, 260 143 S 370 113, 400 138 L 400 250 L 0 250 Z" fill="#69b9c5" />
              <path d="M0 188 C 110 168, 180 213, 270 183 S 380 158, 400 178 L 400 250 L 0 250 Z" fill="#8ed0d7" opacity="0.85" />
            </g>
          </svg>
        </div></section>
        <section className="border-t border-[#e3e4dd] px-5 py-10 sm:px-10 sm:py-14 lg:px-14"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 sm:flex-row sm:items-center"><div><div className="text-sm font-medium">Ready to explore Signal87?</div><p className="mt-1 text-xs text-[#777970]">Open the workspace and start working with your information.</p></div><button onClick={() => onSelectTab('dashboard')} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#20211e] px-5 text-xs font-medium text-white sm:w-auto">Open workspace <ArrowRight size={14} /></button></div></section>
      </main>
    </div>
  );
};
