import React, { FormEvent, useState } from 'react';
import { ArrowRight, Search, Users } from 'lucide-react';
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

export const SignalFieldLanding: React.FC<SignalFieldLandingProps> = ({ onOpenEmailAuth, onAskQuestion }) => {
  const [question, setQuestion] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (cleanQuestion) onAskQuestion(cleanQuestion);
  };

  return (
    <div className="signal-landing">
      <header className="signal-header">
        <button type="button" className="signal-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Signal87 home">
          <Signal87Logo size={27} /><span>Signal87</span>
        </button>
        <nav aria-label="Primary navigation"><a href="#platform">Platform</a><a href="#partners">Partners</a><a href="/team">Team</a><a href="/privacy">Security</a></nav>
        <div className="signal-header__actions"><button type="button" onClick={() => onOpenEmailAuth('signin')}>Log in</button><button type="button" className="signal-primary" onClick={() => onOpenEmailAuth('signup')}>Start exploring <ArrowRight size={14} /></button></div>
      </header>

      <main>
        <section className="signal-hero">
          <div className="signal-field" aria-hidden="true">
            <div className="signal-field__glow" />
            {Array.from({ length: 9 }, (_, index) => <i key={index} style={{ '--line': index } as React.CSSProperties} />)}
            <span className="signal-field__pulse pulse-one" /><span className="signal-field__pulse pulse-two" />
          </div>
          <div className="signal-hero__eyebrow"><span>Signal87 / Intelligence workspace</span><span>Evidence in. Clarity out.</span></div>
          <div className="signal-hero__copy">
            <h1>Ask deeper.<br /><em>Decide faster.</em></h1>
            <p>Interrogate every source at once. Signal87 turns fragmented information into precise, defensible intelligence.</p>
            <form className="signal-question" onSubmit={submit}>
              <Search size={17} aria-hidden="true" />
              <input aria-label="Ask Signal87" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask anything across your information…" />
              <button type="submit" aria-label="Submit question"><ArrowRight size={16} /></button>
            </form>
          </div>
          <div className="signal-rail" id="platform">
            <div><strong>01</strong><span>Connect</span><p>Bring every source into one secure field.</p></div>
            <div><strong>02</strong><span>Interrogate</span><p>Ask across documents, data, and the web.</p></div>
            <div><strong>03</strong><span>Resolve</span><p>Trace every conclusion back to evidence.</p></div>
          </div>
        </section>
      </main>

      <footer id="partners" className="signal-trust">
        <div className="signal-trust__intro"><span>Signal87</span><p>Intelligence for complex information.</p></div>
        <div className="signal-trust__links" aria-label="Signal87 partners and profiles">
          <a href="/team" aria-label="Meet the Signal87 leadership team"><Users aria-hidden="true" /><span>Leadership Team</span></a>
          <a href="https://www.linkedin.com/company/108308342/" target="_blank" rel="noreferrer" aria-label="Signal87 on LinkedIn"><LinkedInMark /><span>LinkedIn</span></a>
          <a href="https://theresanaiforthat.com/ai/signal87-ai/" target="_blank" rel="noreferrer"><span className="taaft-mark">TAAFT</span><span>There's An AI For That</span></a>
          <div><img src="/partners/nvidia.svg" alt="" /><span>NVIDIA Inception</span></div>
          <div><img src="/partners/google-cloud.svg" alt="" /><span>Google Cloud for Startups</span></div>
        </div>
      </footer>
    </div>
  );
};
