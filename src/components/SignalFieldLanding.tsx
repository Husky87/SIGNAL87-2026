import React, { FormEvent, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
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
          <div className="signal-rail">
            <div><strong>01</strong><span>Connect</span><p>Bring every source into one secure field.</p></div>
            <div><strong>02</strong><span>Interrogate</span><p>Ask across documents, data, and the web.</p></div>
            <div><strong>03</strong><span>Resolve</span><p>Trace every conclusion back to evidence.</p></div>
          </div>
        </section>

        <section id="platform" className="signal-demo" aria-labelledby="signal-demo-title">
          <div className="signal-demo__intro">
            <span>Inside the workspace</span>
            <h2 id="signal-demo-title">One question.<br />Every relevant signal.</h2>
            <p>Watch Signal87 move from a complex request to an evidence-backed answer—without losing the trail between them.</p>
          </div>
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
        </section>

        <section id="partners" className="signal-partners" aria-labelledby="signal-partners-title">
          <div className="signal-partners__heading"><span>Recognition &amp; programs</span><h2 id="signal-partners-title">Built alongside the AI ecosystem.</h2></div>
          <div className="signal-partners__grid">
            <a href="https://theresanaiforthat.com/ai/signal87-ai/" target="_blank" rel="noreferrer" aria-label="Signal87 on There's An AI For That">
              <span className="taaft-mark">TAAFT</span><div><small>Featured on</small><strong>There's An AI For That</strong></div><ArrowRight aria-hidden="true" />
            </a>
            <div><img src="/partners/nvidia.svg" alt="NVIDIA" /><div><small>Member of</small><strong>NVIDIA Inception</strong></div></div>
            <div><img src="/partners/google-cloud.svg" alt="Google Cloud" /><div><small>Supported by</small><strong>Google for Startups Cloud Program</strong></div></div>
          </div>
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
