import React, { FormEvent, useState } from 'react';
import { ArrowRight, ArrowUpRight, Search } from 'lucide-react';
import { Signal87Logo } from './Signal87Logo';
import '@fontsource-variable/manrope';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/newsreader';
import '../landingConcepts.css';

export type LandingConcept = '1' | '2' | '3';
export type LandingFont = 'manrope' | 'space' | 'editorial';

interface LandingConceptPreviewProps {
  concept: LandingConcept;
  font?: LandingFont;
  onOpenEmailAuth: (mode?: 'signup' | 'signin') => void;
  onAskQuestion: (question: string) => void;
}

const conceptNames: Record<LandingConcept, string> = {
  '1': 'Orbital clarity',
  '2': 'Signal field',
  '3': 'Living index',
};

const fontNames: Record<LandingFont, string> = {
  manrope: 'Manrope',
  space: 'Space Grotesk',
  editorial: 'Newsreader',
};

const FontSwitcher: React.FC<{ active: LandingFont }> = ({ active }) => (
  <aside className="font-switcher" aria-label="Typography options">
    <span>Typography</span>
    {(Object.keys(fontNames) as LandingFont[]).map((font, index) => (
      <a key={font} href={`?landing=2&font=${font}`} className={font === active ? 'is-active' : ''} aria-current={font === active ? 'page' : undefined}>
        <small>0{index + 1}</small>{fontNames[font]}
      </a>
    ))}
  </aside>
);

const ConceptSwitcher: React.FC<{ active: LandingConcept; dark?: boolean }> = ({ active, dark = false }) => (
  <aside className={`concept-switcher ${dark ? 'concept-switcher--dark' : ''}`} aria-label="Landing page concepts">
    <span className="concept-switcher__label">Design concepts</span>
    {(['1', '2', '3'] as LandingConcept[]).map((item) => (
      <a key={item} href={`?landing=${item}`} className={item === active ? 'is-active' : ''} aria-current={item === active ? 'page' : undefined}>
        <span>0{item}</span>
        {conceptNames[item]}
      </a>
    ))}
  </aside>
);

const LinkedInMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5.4 7.5H2V22h3.4V7.5ZM3.7 2A2 2 0 1 0 3.7 6a2 2 0 0 0 0-4ZM22 13.7c0-4.3-2.3-6.3-5.4-6.3-2.5 0-3.6 1.4-4.2 2.3V7.5H9V22h3.4v-7.2c0-1.9.4-3.8 2.8-3.8 2.4 0 2.4 2.2 2.4 3.9V22H22v-8.3Z" /></svg>
);

const TrustFooter: React.FC<{ dark?: boolean }> = ({ dark = false }) => (
  <footer className={`concept-trust ${dark ? 'concept-trust--dark' : ''}`}>
    <div className="concept-trust__intro">
      <span>Signal87</span>
      <p>Intelligence for complex information.</p>
    </div>
    <div className="concept-trust__links" aria-label="Signal87 partners and profiles">
      <a href="https://www.linkedin.com/company/108308342/" target="_blank" rel="noreferrer" aria-label="Signal87 on LinkedIn">
        <LinkedInMark /><span>LinkedIn</span>
      </a>
      <a href="https://theresanaiforthat.com/ai/signal87-ai/" target="_blank" rel="noreferrer">
        <span className="taaft-mark">TAAFT</span><span>There's An AI For That</span>
      </a>
      <div><img src="/partners/nvidia.svg" alt="" /><span>NVIDIA Inception</span></div>
      <div><img src="/partners/google-cloud.svg" alt="" /><span>Google Cloud for Startups</span></div>
    </div>
  </footer>
);

const Header: React.FC<{ dark?: boolean; onLogin: () => void; onStart: () => void }> = ({ dark = false, onLogin, onStart }) => (
  <header className={`concept-header ${dark ? 'concept-header--dark' : ''}`}>
    <a href="/" className="concept-brand" aria-label="Signal87 home"><Signal87Logo size={27} /><span>Signal87</span></a>
    <nav aria-label="Primary navigation"><a href="#platform">Platform</a><a href="#use-cases">Use cases</a><a href="#security">Security</a></nav>
    <div className="concept-header__actions"><button type="button" onClick={onLogin}>Log in</button><button type="button" className="concept-primary" onClick={onStart}>Start exploring <ArrowRight size={14} /></button></div>
  </header>
);

const QuestionBar: React.FC<{ dark?: boolean; onAskQuestion: (question: string) => void }> = ({ dark = false, onAskQuestion }) => {
  const [question, setQuestion] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (cleanQuestion) onAskQuestion(cleanQuestion);
  };
  return (
    <form className={`concept-question ${dark ? 'concept-question--dark' : ''}`} onSubmit={submit}>
      <Search size={17} aria-hidden="true" />
      <input aria-label="Ask Signal87" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask anything across your information…" />
      <button type="submit" aria-label="Submit question"><ArrowRight size={16} /></button>
    </form>
  );
};

const OrbitalClarity: React.FC<Omit<LandingConceptPreviewProps, 'concept'>> = ({ onOpenEmailAuth, onAskQuestion }) => (
  <div className="concept-page concept-one">
    <ConceptSwitcher active="1" />
    <Header onLogin={() => onOpenEmailAuth('signin')} onStart={() => onOpenEmailAuth('signup')} />
    <main>
      <section className="concept-one__hero">
        <div className="concept-one__copy">
          <p className="concept-kicker"><span />Knowledge, resolved</p>
          <h1>Turn complexity into a <em>clear signal.</em></h1>
          <p className="concept-lede">Signal87 connects documents, data, and live research into one intelligence layer—so teams can move from evidence to decisions without losing the source.</p>
          <QuestionBar onAskQuestion={onAskQuestion} />
          <div className="concept-proof"><span>Source-linked answers</span><span>Enterprise security</span><span>Built for real work</span></div>
        </div>
        <div className="orbital-stage" aria-hidden="true">
          <div className="orbital-stage__grid" />
          <div className="orbital-stage__halo halo-a" />
          <div className="orbital-stage__halo halo-b" />
          <div className="orbital-stage__halo halo-c" />
          <div className="orbital-stage__core"><i /><i /><i /></div>
          <div className="orbital-stage__node node-a" />
          <div className="orbital-stage__node node-b" />
          <div className="orbital-stage__node node-c" />
          <div className="orbital-stage__caption"><span>87</span><small>Signals aligned<br />in real time</small></div>
        </div>
      </section>
      <section className="concept-one__strip" id="platform">
        <span>One intelligence layer</span><h2>Your information already holds the answer.</h2><a href="#use-cases">See how it works <ArrowUpRight size={15} /></a>
      </section>
    </main>
    <TrustFooter />
  </div>
);

const SignalField: React.FC<Omit<LandingConceptPreviewProps, 'concept'>> = ({ font = 'manrope', onOpenEmailAuth, onAskQuestion }) => (
  <div className={`concept-page concept-two concept-two--${font}`}>
    <ConceptSwitcher active="2" dark />
    <FontSwitcher active={font} />
    <Header dark onLogin={() => onOpenEmailAuth('signin')} onStart={() => onOpenEmailAuth('signup')} />
    <main>
      <section className="concept-two__hero">
        <div className="signal-field" aria-hidden="true">
          <div className="signal-field__glow" />
          {Array.from({ length: 9 }, (_, index) => <i key={index} style={{ '--line': index } as React.CSSProperties} />)}
          <span className="signal-field__pulse pulse-one" /><span className="signal-field__pulse pulse-two" />
        </div>
        <div className="concept-two__eyebrow"><span>Signal87 / Intelligence workspace</span><span>Evidence in. Clarity out.</span></div>
        <div className="concept-two__copy">
          <h1>Ask deeper.<br /><em>Decide faster.</em></h1>
          <p>Interrogate every source at once. Signal87 turns fragmented information into precise, defensible intelligence.</p>
          <QuestionBar dark onAskQuestion={onAskQuestion} />
        </div>
        <div className="concept-two__rail">
          <div><strong>01</strong><span>Connect</span><p>Bring every source into one secure field.</p></div>
          <div><strong>02</strong><span>Interrogate</span><p>Ask across documents, data, and the web.</p></div>
          <div><strong>03</strong><span>Resolve</span><p>Trace every conclusion back to evidence.</p></div>
        </div>
      </section>
    </main>
    <TrustFooter dark />
  </div>
);

const LivingIndex: React.FC<Omit<LandingConceptPreviewProps, 'concept'>> = ({ onOpenEmailAuth, onAskQuestion }) => (
  <div className="concept-page concept-three">
    <ConceptSwitcher active="3" />
    <Header onLogin={() => onOpenEmailAuth('signin')} onStart={() => onOpenEmailAuth('signup')} />
    <main>
      <section className="concept-three__hero">
        <div className="concept-three__number" aria-hidden="true">87</div>
        <div className="concept-three__copy">
          <p className="concept-kicker"><span />The living intelligence index</p>
          <h1>Everything you know.<br /><em>Finally connected.</em></h1>
          <div className="concept-three__intro"><p>Signal87 creates a living map of your information—connecting context, evidence, and decisions as your organization evolves.</p><button type="button" onClick={() => onOpenEmailAuth('signup')}>Enter the workspace <ArrowRight size={15} /></button></div>
        </div>
        <div className="index-stage" aria-hidden="true">
          <div className="index-plane plane-one"><span>Context</span><i /></div>
          <div className="index-plane plane-two"><span>Evidence</span><i /></div>
          <div className="index-plane plane-three"><span>Decision</span><i /></div>
          <div className="index-thread thread-one" /><div className="index-thread thread-two" />
        </div>
        <div className="concept-three__ask"><span>Start with a question</span><QuestionBar onAskQuestion={onAskQuestion} /></div>
      </section>
      <section className="concept-three__manifesto" id="platform"><span>Designed for complexity</span><p>Not another place to store information. A place to understand it.</p></section>
    </main>
    <TrustFooter />
  </div>
);

export const LandingConceptPreview: React.FC<LandingConceptPreviewProps> = ({ concept, ...props }) => {
  if (concept === '2') return <SignalField {...props} />;
  if (concept === '3') return <LivingIndex {...props} />;
  return <OrbitalClarity {...props} />;
};
