import React, { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Layers,
  MessageSquareText,
  Quote,
  RefreshCw,
  Scale,
  ScanText,
  Search,
  ShieldCheck,
  Upload
} from 'lucide-react';
import { Signal87Logo } from './Signal87Logo';
import '@fontsource-variable/manrope';
import '../signalFieldLanding.css';

interface SignalFieldLandingProps {
  onOpenEmailAuth: (mode?: 'signup' | 'signin') => void;
  onAskQuestion: (question: string) => void;
}

const LinkedInMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M5.4 7.5H2V22h3.4V7.5ZM3.7 2A2 2 0 1 0 3.7 6a2 2 0 0 0 0-4ZM22 13.7c0-4.3-2.3-6.3-5.4-6.3-2.5 0-3.6 1.4-4.2 2.3V7.5H9V22h3.4v-7.2c0-1.9.4-3.8 2.8-3.8 2.4 0 2.4 2.2 2.4 3.9V22H22v-8.3Z" />
  </svg>
);

/* ---------- motion helpers ---------- */

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduce;
}

/* True once the element has been seen; never flips back, so nothing replays on scroll-up. */
function useInViewOnce<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, threshold]);
  return [ref, inView] as const;
}

/* Fades and lifts its children in the first time they scroll into view. */
const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string; as?: 'div' | 'li' }> = ({ children, delay = 0, className = '', as = 'div' }) => {
  const [ref, inView] = useInViewOnce<HTMLDivElement>(0.15);
  const Tag = as as any;
  return (
    <Tag ref={ref} className={`sf-reveal ${inView ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}s` }}>
      {children}
    </Tag>
  );
};

/* Hero demo loop: types a question, "thinks", shows the answer, then clears and moves on.
   Under reduced motion it shows the first question and answer statically. */
type DemoPhase = 'typing' | 'thinking' | 'answer' | 'clearing';
function useHeroDemo(count: number, getText: (i: number) => string, active: boolean) {
  const reduce = usePrefersReducedMotion();
  const [state, setState] = useState<{ index: number; text: string; phase: DemoPhase }>({ index: 0, text: '', phase: 'typing' });
  useEffect(() => {
    if (!active || reduce) return;
    let i = 0, pos = 0;
    let timer: ReturnType<typeof setTimeout>;
    const typeNext = () => {
      const q = getText(i);
      pos += 1;
      setState({ index: i, text: q.slice(0, pos), phase: 'typing' });
      if (pos < q.length) { timer = setTimeout(typeNext, 38); return; }
      timer = setTimeout(() => {
        setState({ index: i, text: q, phase: 'thinking' });
        timer = setTimeout(() => {
          setState({ index: i, text: q, phase: 'answer' });
          timer = setTimeout(clear, 4200);
        }, 1100);
      }, 250);
    };
    const clear = () => {
      const q = getText(i);
      pos -= 2;
      setState({ index: i, text: q.slice(0, Math.max(pos, 0)), phase: 'clearing' });
      if (pos > 0) { timer = setTimeout(clear, 14); return; }
      i = (i + 1) % count; pos = 0;
      timer = setTimeout(typeNext, 450);
    };
    setState({ index: 0, text: '', phase: 'typing' });
    timer = setTimeout(typeNext, 1500);
    return () => clearTimeout(timer);
  }, [active, reduce, count, getText]);
  if (reduce) return { index: 0, text: getText(0), phase: 'answer' as DemoPhase };
  return state;
}

/* Advances an index every `ms` while `active` (paused under reduced motion). */
function useCycle(count: number, active: boolean, ms: number) {
  const reduce = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active || reduce) return;
    const id = setInterval(() => setIndex((v) => (v + 1) % count), ms);
    return () => clearInterval(id);
  }, [active, reduce, count, ms, tick]);
  // Picking a step by hand restarts the timer so it gets its full time on screen.
  const choose = (i: number) => { setIndex(i); setTick((t) => t + 1); };
  return [index, choose] as const;
}

/* ---------- content ---------- */

const HERO_DEMO = [
  {
    q: 'Which of our leases have a change-of-control clause?',
    a: 'Two of the five leases do. Harbor Street requires landlord consent; Northwind allows termination.',
    src: ['Harbor_St_Lease.pdf', 'Northwind_Lease.pdf']
  },
  {
    q: 'What changed between the 2024 and 2026 rent rolls?',
    a: 'Occupancy rose from 88% to 94%, three units were repriced, and one tenant left in March.',
    src: ['Rent_Roll_2024.xlsx', 'Rent_Roll_2026.xlsx']
  },
  {
    q: 'Summarize the prepayment terms across these loans.',
    a: 'Loans A and C allow prepayment without penalty after year two. Loan B charges a step-down fee through year five.',
    src: ['Loan_A.pdf', 'Loan_B.pdf', 'Loan_C.pdf']
  },
  {
    q: 'Does the Q2 filing match our notice-period policy?',
    a: 'No. The filing states a 45-day notice period; the policy requires 30 days.',
    src: ['Q2_Report.pdf', 'Disclosure_Policy.docx']
  }
];
const heroQuestion = (i: number) => HERO_DEMO[i].q;

const HOW_STEPS = [
  { icon: Upload, title: 'Upload your files', body: 'Add PDFs, Word documents and spreadsheets. They are stored privately under your account.' },
  { icon: ScanText, title: 'Signal87 reads them', body: 'Text and tables are pulled from every page, so the whole document is available to search and question.' },
  { icon: MessageSquareText, title: 'Ask in plain English', body: 'Your question and the relevant document text go to leading AI models, instructed to answer only from your sources.' },
  { icon: Quote, title: 'Verify the answer', body: 'Every answer names the documents it used. Open any source and search straight to the passage.' }
];

const StepVisual: React.FC<{ step: number }> = ({ step }) => {
  if (step === 0) {
    return (
      <div className="sf-visual__stack">
        {[
          { name: 'Loan_Agreement_A.pdf', icon: FileText, d: 0 },
          { name: 'Lease_Harvard_St.docx', icon: FileText, d: 0.22 },
          { name: 'Rent_Roll_2026.xlsx', icon: FileSpreadsheet, d: 0.44 }
        ].map(({ name, icon: Icon, d }) => (
          <div key={name} className="sf-file sf-pop" style={{ animationDelay: `${d}s` }}>
            <div className="sf-file__row"><Icon size={15} /><span>{name}</span><CheckCircle2 size={14} className="sf-file__ok sf-pop" style={{ animationDelay: `${d + 1}s` }} /></div>
            <div className="sf-file__bar"><i className="sf-fill" style={{ animationDelay: `${d + 0.15}s` }} /></div>
          </div>
        ))}
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className="sf-page">
        <div className="sf-page__head"><span>Loan_Agreement_A.pdf · page 14</span><em className="sf-pop" style={{ animationDelay: '1.5s' }}>Text extracted</em></div>
        <div className="sf-page__lines">{[92, 78, 86, 64, 90, 72, 84, 58, 80].map((w, i) => <i key={i} style={{ width: `${w}%` }} />)}</div>
        <span className="sf-scan" aria-hidden="true" />
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="sf-route">
        <div className="sf-route__q sf-pop">Summarize the prepayment terms across these loans.</div>
        <svg viewBox="0 0 300 96" fill="none" aria-hidden="true">
          {[40, 150, 260].map((x, i) => (
            <path key={x} d={`M${x} 6 C ${x} 52, 150 42, 150 84`} className="sf-dash" style={{ animationDelay: `${0.35 + i * 0.18}s` }} />
          ))}
          <circle cx="150" cy="86" r="7" className="sf-route__node" />
        </svg>
        <div className="sf-route__labels"><span>Loan A</span><span>Loan B</span><span>Loan C</span></div>
      </div>
    );
  }
  return (
    <div className="sf-answer">
      <p className="sf-pop">Loans A and C allow prepayment without penalty after year two. <b>Loan A</b> <b>Loan C</b></p>
      <p className="sf-pop" style={{ animationDelay: '0.5s' }}>Loan B applies a step-down fee through year five. <b>Loan B</b></p>
      <blockquote className="sf-pop" style={{ animationDelay: '1s' }}>
        “…may prepay the Loan <mark>without premium or penalty</mark> at any time after the second anniversary…”
        <small>Loan_Agreement_A.pdf</small>
      </blockquote>
    </div>
  );
};

const PIPELINE = [
  { label: 'Your files', sub: 'PDF · Word · Excel' },
  { label: 'Text extraction', sub: 'Every page, tables included' },
  { label: 'Your question', sub: 'Plus the relevant text' },
  { label: 'AI models', sub: 'Primary + automatic fallback' },
  { label: 'Answer', sub: 'With named sources' }
];

const HoodArt: React.FC<{ kind: string }> = ({ kind }) => {
  if (kind === 'extract') {
    return (
      <div className="sf-art sf-art--extract">
        <div className="sf-art__page">{[88, 70, 94, 62, 80].map((w, i) => <i key={i} style={{ width: `${w}%` }} />)}<span className="sf-scan" /></div>
        <div className="sf-art__arrow" />
        <div className="sf-art__text"><b>Aa</b><small>searchable</small></div>
      </div>
    );
  }
  if (kind === 'grounded') {
    return (
      <div className="sf-art sf-art--grounded">
        <p>“…prepay <mark>without premium or penalty</mark> after the second anniversary…”</p>
        <span>Loan_A.pdf</span>
      </div>
    );
  }
  if (kind === 'redundancy') {
    return (
      <div className="sf-art sf-art--redundancy">
        <svg viewBox="0 0 215 90" fill="none" aria-hidden="true">
          <path d="M20 45 H80" className="sf-line" />
          <path d="M80 45 C 110 45, 110 20, 140 20" className="sf-line sf-line--a" />
          <path d="M80 45 C 110 45, 110 70, 140 70" className="sf-line sf-line--b" />
          <circle cx="20" cy="45" r="6" className="sf-node" />
          <circle cx="150" cy="20" r="8" className="sf-node sf-node--a" />
          <circle cx="150" cy="70" r="8" className="sf-node sf-node--b" />
          <text x="164" y="23.5" className="sf-art__svgtext">Primary</text>
          <text x="164" y="73.5" className="sf-art__svgtext">Fallback</text>
        </svg>
      </div>
    );
  }
  return (
    <div className="sf-art sf-art--private">
      <span className="sf-ring" /><span className="sf-ring sf-ring--2" />
      <KeyRound size={22} />
    </div>
  );
};

const UNDER_THE_HOOD = [
  { art: 'extract', icon: ScanText, title: 'Full-text extraction', body: 'Signal87 parses PDFs, Word files and spreadsheets into searchable text, so questions reach the whole document, not a summary.' },
  { art: 'grounded', icon: Quote, title: 'Grounded answers', body: 'Models are instructed to use only the documents you supply, to name the ones they used, and to say so when the answer is not there.' },
  { art: 'redundancy', icon: RefreshCw, title: 'Model redundancy', body: 'Requests go to a leading model first and fall back automatically to a second provider, so an outage does not stop your work.' },
  { art: 'private', icon: KeyRound, title: 'Private by account', body: 'Every request is checked against your sign-in before anything is read, and your files stay under your account.' }
];

const COMPARE_DOCS = [
  { name: 'Lease_2024.pdf', rows: ['Term: 10 years', 'Rent escalator: 3%', 'Assignment: consent required', 'Renewal: two 5-year options'] },
  { name: 'Lease_2026.pdf', rows: ['Term: 10 years', 'Rent escalator: 4%', 'Assignment: not addressed', 'Renewal: one 5-year option'] }
];
const COMPARE_KINDS = ['same', 'diff', 'missing', 'diff'] as const;

const USE_CASES = [
  {
    icon: Scale, title: 'Legal',
    items: ['Find every change-of-control clause', 'Compare a redline to your template', 'Draft a memo from sourced answers'],
    q: 'Which of these agreements have a change-of-control clause?',
    a: 'Two of the five: the Northwind MSA requires consent on a change of control, and the Harbor lease allows termination.',
    src: ['Northwind_MSA.pdf', 'Harbor_Lease.pdf']
  },
  {
    icon: ShieldCheck, title: 'Compliance',
    items: ['Check filings against internal policy', 'Pull evidence for an audit', 'Spot gaps before a regulator does'],
    q: 'Do any filings contradict our notice-period policy?',
    a: 'One does: the Q2 report states a 45-day notice period, while the policy requires 30 days.',
    src: ['Q2_Report.pdf', 'Disclosure_Policy.docx']
  },
  {
    icon: Building2, title: 'Real estate & finance',
    items: ['Summarize loan and lease terms', 'Review diligence files for gaps', 'Compare lender term sheets'],
    q: 'Summarize the prepayment terms across these loans.',
    a: 'Loans A and C allow prepayment without penalty after year two. Loan B charges a step-down fee through year five.',
    src: ['Loan_A.pdf', 'Loan_B.pdf', 'Loan_C.pdf']
  }
];

/* ---------- page ---------- */

export const SignalFieldLanding: React.FC<SignalFieldLandingProps> = ({ onOpenEmailAuth, onAskQuestion }) => {
  const [question, setQuestion] = useState('');
  const [focused, setFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [howRef, howInView] = useInViewOnce<HTMLDivElement>(0.25);
  const [pipeRef, pipeInView] = useInViewOnce<HTMLDivElement>(0.3);
  const [compareRef, compareInView] = useInViewOnce<HTMLDivElement>(0.3);
  const [activeStep, chooseStep] = useCycle(HOW_STEPS.length, howInView, 3600);
  const [usesRef, usesInView] = useInViewOnce<HTMLDivElement>(0.3);
  const [activeUse, chooseUse] = useCycle(3, usesInView, 5200);
  const demoActive = !question && !focused;
  const demo = useHeroDemo(HERO_DEMO.length, heroQuestion, demoActive);
  const demoItem = HERO_DEMO[demo.index];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (cleanQuestion) onAskQuestion(cleanQuestion);
  };

  return (
    <div className="signal-landing">
      <div className={`sf-header-wrap ${scrolled ? 'is-scrolled' : ''}`}>
        <header className="signal-header">
          <button type="button" className="signal-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Signal87 home">
            <Signal87Logo size={27} /><span>Signal87</span>
          </button>
          <nav aria-label="Primary navigation"><a href="#platform">Platform</a><a href="#how-it-works">How it works</a><a href="#compare">Compare</a><a href="#partners">Partners</a><a href="/team">Team</a><a href="/privacy">Security</a></nav>
          <div className="signal-header__actions"><button type="button" onClick={() => onOpenEmailAuth('signin')}>Log in</button><button type="button" className="signal-primary" onClick={() => onOpenEmailAuth('signup')}>Start exploring <ArrowRight size={14} /></button></div>
        </header>
      </div>

      <main>
        <section className="signal-hero">
          <div className="signal-field" aria-hidden="true">
            <div className="signal-field__glow" />
            {Array.from({ length: 9 }, (_, index) => <i key={index} style={{ '--line': index } as React.CSSProperties} />)}
            <span className="signal-field__pulse pulse-one" /><span className="signal-field__pulse pulse-two" />
          </div>
          <div className="signal-hero__eyebrow sf-enter" style={{ animationDelay: '0.05s' }}><span>Signal87 / Document intelligence</span><span>For legal, compliance &amp; real estate teams</span></div>
          <div className="signal-hero__copy">
            <h1><span className="sf-enter" style={{ animationDelay: '0.15s' }}>Your data has answers.</span><br /><em className="sf-enter" style={{ animationDelay: '0.3s' }}>Just ask it.</em></h1>
            <p className="sf-enter" style={{ animationDelay: '0.45s' }}>Put your contracts, filings, spreadsheets and loan files in one place. Ask in plain English and get answers that name the files they came from.</p>
            <form className="signal-question sf-enter" style={{ animationDelay: '0.6s' }} onSubmit={submit}>
              <Search size={17} aria-hidden="true" />
              <input
                aria-label="Ask Signal87"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={focused ? 'Ask anything about your data…' : demo.text || ' '}
              />
              <button type="submit" aria-label="Submit question" className={demoActive && demo.phase === 'thinking' ? 'is-pressed' : ''}><ArrowRight size={16} /></button>
            </form>
            <div className="sf-hero-answer sf-enter" style={{ animationDelay: '0.75s' }} aria-hidden="true">
              <div className={`sf-hero-answer__card ${demoActive ? `is-${demo.phase}` : 'is-idle'}`}>
                <div className="sf-hero-answer__status">
                  <span className="sf-hero-answer__dots"><i /><i /><i /></span>
                  <span>{demo.phase === 'answer' ? `Answered from ${demoItem.src.length} files` : 'Reading your files…'}</span>
                </div>
                <p key={`a-${demo.index}`}>{demoItem.a}</p>
                <div className="sf-hero-answer__src">
                  {demoItem.src.map((f, i) => <span key={`${demo.index}-${f}`} style={{ transitionDelay: `${0.35 + i * 0.12}s` }}><FileText size={11} /> {f}</span>)}
                </div>
              </div>
            </div>
          </div>
          <div className="signal-rail">
            <div className="sf-enter" style={{ animationDelay: '0.8s' }}><strong>01</strong><span>Upload</span><p>PDFs, Word files and spreadsheets.</p></div>
            <div className="sf-enter" style={{ animationDelay: '0.92s' }}><strong>02</strong><span>Ask</span><p>One question across every file.</p></div>
            <div className="sf-enter" style={{ animationDelay: '1.04s' }}><strong>03</strong><span>Verify</span><p>Open the source behind each answer.</p></div>
          </div>
          <a href="#platform" className="sf-scroll-cue" aria-label="Scroll to learn more"><span /></a>
        </section>

        <section id="platform" className="signal-demo" aria-labelledby="signal-demo-title">
          <Reveal className="signal-demo__intro">
            <span>Inside the workspace</span>
            <h2 id="signal-demo-title">One question.<br />Every file checked.</h2>
            <p>Signal87 reads across your whole workspace and tells you which documents the answer came from, so you can check it in seconds.</p>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="signal-demo__window" aria-label="Animated preview of the Signal87 workspace">
              <div className="signal-demo__chrome"><i /><i /><i /><span>signal87 / intelligence workspace</span></div>
              <div className="signal-demo__canvas">
                <aside className="signal-demo__sources" aria-hidden="true">
                  <strong>Connected sources</strong>
                  <div><i /><span>Commercial agreements</span></div>
                  <div><i /><span>Policy library</span></div>
                  <div><i /><span>Market intelligence</span></div>
                  <small><b /> 48 sources indexed</small>
                </aside>
                <div className="signal-demo__conversation">
                  <div className="signal-demo__prompt"><span>Ask</span><p>Which renewals require action in the next 60 days?</p></div>
                  <div className="signal-demo__answer">
                    <div className="signal-demo__thinking"><i /><span>Resolving across connected evidence</span></div>
                    <h3>Three agreements require action.</h3>
                    <div className="signal-demo__answer-lines" aria-hidden="true"><i /><i /><i /></div>
                    <div className="signal-demo__evidence"><span>Contract 04</span><span>Amendment 02</span><span>Policy 11</span></div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section id="how-it-works" className="sf-section sf-how" aria-labelledby="sf-how-title">
          <div ref={howRef} className="sf-wrap">
            <Reveal className="sf-heading">
              <span>How it works</span>
              <h2 id="sf-how-title">From a stack of files<br />to an answer you can check.</h2>
              <p>Four steps, in seconds. Signal87 answers from your documents and shows you where each answer came from.</p>
            </Reveal>
            <div className="sf-how__grid">
              <ol className="sf-steps">
                {HOW_STEPS.map(({ icon: Icon, title, body }, i) => {
                  const active = i === activeStep;
                  return (
                    <Reveal as="li" key={title} delay={i * 0.08}>
                      <button type="button" onClick={() => chooseStep(i)} aria-current={active ? 'step' : undefined} className={`sf-step ${active ? 'is-active' : ''}`}>
                        <span className="sf-step__icon"><Icon size={17} /></span>
                        <span className="sf-step__text">
                          <span className="sf-step__title"><small>0{i + 1}</small>{title}</span>
                          <span className="sf-step__body">{body}</span>
                        </span>
                        {active && <span key={`bar-${activeStep}`} className="sf-step__progress" aria-hidden="true" />}
                      </button>
                    </Reveal>
                  );
                })}
              </ol>
              <Reveal delay={0.15}>
                <div className="sf-visual" aria-hidden="true">
                  <div className="sf-visual__chrome"><i /><i /><i /><span>step 0{activeStep + 1} / 04</span></div>
                  <div key={activeStep} className="sf-visual__body"><StepVisual step={activeStep} /></div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="sf-section sf-hood sf-light" aria-labelledby="sf-hood-title">
          <div className="sf-wrap">
            <Reveal className="sf-heading sf-heading--center">
              <span>Under the hood</span>
              <h2 id="sf-hood-title">The technology,<br />in plain terms.</h2>
              <p>No black box. Here is what happens between your question and your answer.</p>
            </Reveal>
            <div ref={pipeRef} className={`sf-pipeline ${pipeInView ? 'is-live' : ''}`} aria-label="Signal87 processing pipeline">
              {PIPELINE.map((stage, i) => (
                <React.Fragment key={stage.label}>
                  <div className="sf-pipeline__stage" style={{ transitionDelay: `${i * 0.18}s` }}>
                    <strong>{stage.label}</strong>
                    <span>{stage.sub}</span>
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <div className="sf-pipeline__link" style={{ transitionDelay: `${i * 0.18 + 0.1}s` }} aria-hidden="true">
                      <i style={{ animationDelay: `${i * 0.35}s` }} />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="sf-cards">
              {UNDER_THE_HOOD.map(({ art, title, body }, i) => (
                <Reveal key={title} delay={i * 0.08}>
                  <div className="sf-card sf-card--art">
                    <HoodArt kind={art} />
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="compare" className="sf-section sf-compare" aria-labelledby="sf-compare-title">
          <div ref={compareRef} className="sf-wrap sf-split sf-split--reverse">
            <Reveal className="sf-heading">
              <span>Compare documents</span>
              <h2 id="sf-compare-title">See where documents agree, differ and conflict.</h2>
              <p>Select two or more files and Signal87 lines them up: shared terms, differences, missing clauses and direct conflicts, in one view.</p>
            </Reveal>
            <Reveal delay={0.12}>
              <div className={`sf-diff ${compareInView ? 'is-live' : ''}`} aria-hidden="true">
                {COMPARE_DOCS.map((doc) => (
                  <div key={doc.name} className="sf-diff__doc">
                    <div className="sf-diff__name"><FileText size={13} /> {doc.name}</div>
                    {doc.rows.map((row, r) => (
                      <div key={row} className={`sf-diff__row is-${COMPARE_KINDS[r]}`} style={{ transitionDelay: `${0.5 + r * 0.3}s` }}>{row}</div>
                    ))}
                  </div>
                ))}
                <div className="sf-diff__legend"><span className="is-same">Same</span><span className="is-diff">Different</span><span className="is-missing">Missing or conflicting</span></div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="sf-section sf-uses" aria-labelledby="sf-uses-title">
          <div ref={usesRef} className="sf-wrap">
            <Reveal className="sf-heading">
              <span>Built for</span>
              <h2 id="sf-uses-title">Teams whose work<br />lives in documents.</h2>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="sf-tabs" role="tablist" aria-label="Teams">
                {USE_CASES.map(({ icon: Icon, title }, i) => (
                  <button key={title} type="button" role="tab" aria-selected={i === activeUse} className={`sf-tab ${i === activeUse ? 'is-active' : ''}`} onClick={() => chooseUse(i)}>
                    <Icon size={15} /> {title}
                    {i === activeUse && <span key={`tp-${activeUse}`} className="sf-tab__progress" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </Reveal>
            <div key={activeUse} className="sf-usecase" role="tabpanel">
              <ul className="sf-usecase__list">
                {USE_CASES[activeUse].items.map((t, i) => (
                  <li key={t} className="sf-pop" style={{ animationDelay: `${i * 0.12}s` }}><CheckCircle2 size={16} />{t}</li>
                ))}
              </ul>
              <div className="sf-chat" aria-hidden="true">
                <div className="sf-chat__q sf-pop">{USE_CASES[activeUse].q}</div>
                <div className="sf-chat__thinking sf-pop" style={{ animationDelay: '0.35s' }}><i /><i /><i /></div>
                <div className="sf-chat__a sf-pop" style={{ animationDelay: '1.1s' }}>
                  <p>{USE_CASES[activeUse].a}</p>
                  <div className="sf-chat__src">{USE_CASES[activeUse].src.map((f, i) => <span key={f} className="sf-pop" style={{ animationDelay: `${1.5 + i * 0.15}s` }}><FileText size={11} /> {f}</span>)}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="partners" className="signal-partners" aria-labelledby="signal-partners-title">
          <Reveal className="signal-partners__heading"><span>Recognition &amp; programs</span><h2 id="signal-partners-title">Built alongside the AI ecosystem.</h2></Reveal>
          <Reveal delay={0.1} className="signal-partners__grid sf-partners-anim">
            <a href="https://theresanaiforthat.com/ai/signal87-ai/" target="_blank" rel="noreferrer" aria-label="Signal87 on There's An AI For That">
              <span className="taaft-mark">TAAFT</span><div><small>Featured on</small><strong>There's An AI For That</strong></div><ArrowRight aria-hidden="true" />
            </a>
            <div><img src="/partners/nvidia.svg" alt="NVIDIA" /><div><small>Member of</small><strong>NVIDIA Inception</strong></div></div>
            <div><img src="/partners/google-cloud.svg" alt="Google Cloud" /><div><small>Supported by</small><strong>Google for Startups Cloud Program</strong></div></div>
          </Reveal>
        </section>

        <section className="sf-cta" aria-labelledby="sf-cta-title">
          <div className="sf-cta__glow" aria-hidden="true" />
          <Reveal className="sf-cta__inner">
            <Layers size={22} aria-hidden="true" />
            <h2 id="sf-cta-title">Start with<br /><em>one question.</em></h2>
            <p>Upload a few files and ask your first question in under a minute.</p>
            <div className="sf-cta__actions">
              <button type="button" className="signal-primary" onClick={() => onOpenEmailAuth('signup')}>Start exploring <ArrowRight size={14} /></button>
              <button type="button" className="sf-ghost" onClick={() => onOpenEmailAuth('signin')}>Log in</button>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="signal-footer">
        <div className="signal-footer__brand"><Signal87Logo size={24} /><div><strong>Signal87</strong><span>Intelligence for complex information.</span></div></div>
        <nav className="signal-footer__company" aria-label="Company links"><a href="/team">Team</a><a href="https://www.linkedin.com/company/108308342/" target="_blank" rel="noreferrer"><LinkedInMark /> LinkedIn</a></nav>
        <nav className="signal-footer__legal" aria-label="Legal links"><a href="/privacy">Privacy</a><a href="/privacy#security">Security</a><a href="/terms">Terms</a></nav>
        <span className="signal-footer__copyright">© {new Date().getFullYear()} Signal87</span>
      </footer>
    </div>
  );
};

