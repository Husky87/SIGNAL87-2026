import React, { useState } from 'react';
import { Signal87Logo } from './Signal87Logo';
import { Sparkles, ShieldCheck, FileText, Bot, GitFork, ArrowRight, CheckCircle2, X } from 'lucide-react';

interface WelcomeTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string | null;
  userEmail?: string | null;
}

export const WelcomeTourModal: React.FC<WelcomeTourModalProps> = ({
  isOpen,
  onClose,
  userName,
  userEmail
}) => {
  const [step, setStep] = useState<1 | 2>(1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--ink)]/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-2xl max-w-lg w-full text-[var(--ink)] overflow-hidden relative animate-in fade-in zoom-in duration-200">
        {/* Header Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--muted)] hover:text-[var(--ink)] p-1 rounded-lg hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Step 1 Content */}
        {step === 1 ? (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="w-14 h-14 bg-[var(--accent-soft)] border border-[var(--accent)]/20 rounded-2xl flex items-center justify-center text-[var(--accent)]">
              <Signal87Logo size={32} />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-mono font-bold uppercase text-[var(--accent)] tracking-wider bg-[var(--accent-soft)] px-2.5 py-1 rounded-full border border-[var(--accent)]/20">
                Welcome to Signal87 AI
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] tracking-tight leading-snug">
                Welcome aboard, {userName || 'Executive User'}!
              </h2>
              <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed font-medium">
                Your workspace at <strong className="text-[var(--ink)]">{userEmail || 'Signal87'}</strong> is officially configured with zero-hallucination document memory and multi-provider AI fallback.
              </p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-xl p-4 space-y-2.5 text-xs text-[var(--ink-2)]">
              <div className="flex items-center gap-2 font-bold text-[var(--ink)]">
                <CheckCircle2 size={16} className="text-[var(--ok)]" />
                <span>Transactional Welcome Brief Dispatched</span>
              </div>
              <p className="text-[11px] text-[var(--muted)] pl-6 leading-relaxed">
                A confirmation email with your AI memory credentials and security guidelines has been sent to your registered inbox.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={onClose}
                className="text-xs text-[var(--muted)] hover:text-[var(--ink)] font-medium cursor-pointer"
              >
                Skip Tour
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2.5 bg-[var(--accent)] hover:opacity-90 text-[var(--accent-contrast)] font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Next: Core Capabilities</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          /* Step 2 Content */
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-2 text-[var(--warn)] text-xs font-bold font-mono">
              <Sparkles size={16} />
              <span>STEP 2 OF 2: WORKSPACE POWERS</span>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] tracking-tight">
                How Signal87 AI Transforms Your Workflow
              </h2>
              <p className="text-xs text-[var(--muted)]">
                Enterprise legal, financial, and policy research in three unified steps.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[var(--surface)] border border-[var(--rule)] rounded-xl flex items-start gap-3">
                <div className="p-2 bg-[var(--accent)]/20 text-[var(--accent-ink)] rounded-lg flex-shrink-0">
                  <Bot size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-[var(--ink)] text-xs">AI Workspace & Chat</h4>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                    Ask questions grounded in your uploaded documents. Citations automatically link to paragraph numbers.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[var(--surface)] border border-[var(--rule)] rounded-xl flex items-start gap-3">
                <div className="p-2 bg-[var(--ok)]/15 text-[var(--ok)] rounded-lg flex-shrink-0">
                  <GitFork size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-[var(--ink)] text-xs">Multi-Doc Contract Comparison</h4>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                    Compare indemnification caps, notice periods, and liability clauses side-by-side.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[var(--surface)] border border-[var(--rule)] rounded-xl flex items-start gap-3">
                <div className="p-2 bg-[var(--warn-soft)] text-[var(--warn)] rounded-lg flex-shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-[var(--ink)] text-xs">Publication-Grade Executive Briefs</h4>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                    Export high-impact PDF reports, Markdown summaries, and CSV data tables with one click.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="text-xs text-[var(--muted)] hover:text-[var(--ink)] font-medium cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-[var(--accent)] hover:opacity-90 text-[var(--accent-contrast)] font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Start Exploring Workspace</span>
                <CheckCircle2 size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
