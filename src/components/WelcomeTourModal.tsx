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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-lg w-full text-slate-100 overflow-hidden relative animate-in fade-in zoom-in duration-200">
        {/* Header Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Step 1 Content */}
        {step === 1 ? (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="w-14 h-14 bg-sky-500/10 border border-sky-500/20 rounded-2xl flex items-center justify-center text-sky-400">
              <Signal87Logo size={32} />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-mono font-bold uppercase text-sky-400 tracking-wider bg-sky-950/80 px-2.5 py-1 rounded-full border border-sky-800/80">
                Welcome to Signal87 AI
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-snug">
                Welcome aboard, {userName || 'Executive User'}!
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-medium">
                Your workspace at <strong className="text-slate-200">{userEmail || 'Signal87'}</strong> is officially configured with zero-hallucination document memory and multi-provider AI fallback.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2 font-bold text-white">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>Transactional Welcome Brief Dispatched</span>
              </div>
              <p className="text-[11px] text-slate-400 pl-6 leading-relaxed">
                A confirmation email with your AI memory credentials and security guidelines has been sent to your registered inbox.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-white font-medium cursor-pointer"
              >
                Skip Tour
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Next: Core Capabilities</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          /* Step 2 Content */
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold font-mono">
              <Sparkles size={16} />
              <span>STEP 2 OF 2: WORKSPACE POWERS</span>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                How Signal87 AI Transforms Your Workflow
              </h2>
              <p className="text-xs text-slate-400">
                Enterprise legal, financial, and policy research in three unified steps.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg flex-shrink-0">
                  <Bot size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">AI Workspace & Chat</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Ask questions grounded in your uploaded documents. Citations automatically link to paragraph numbers.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg flex-shrink-0">
                  <GitFork size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">Multi-Doc Contract Comparison</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Compare indemnification caps, notice periods, and liability clauses side-by-side.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg flex-shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">Publication-Grade Executive Briefs</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Export high-impact PDF reports, Markdown summaries, and CSV data tables with one click.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="text-xs text-slate-400 hover:text-white font-medium cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-gradient-to-r from-sky-400 to-emerald-400 hover:opacity-95 text-slate-950 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
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
