import React from 'react';
import { Shield, X, CheckCircle2, Lock, FileText, Database, Server } from 'lucide-react';
import { Signal87Logo } from './Signal87Logo';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 relative my-8 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
          <div className="p-2.5 bg-[var(--teal-soft)] rounded-2xl flex items-center justify-center">
            <Shield size={24} className="text-[#7dd3fc]" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Privacy Policy & Data Security
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Signal87 AI Enterprise Data Protection, Zero-Training Guarantee & Encryption
            </p>
          </div>
        </div>

        {/* Key Guarantees Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-2.5">
            <Lock size={18} className="text-emerald-600 flex-shrink-0" />
            <div>
              <span className="text-xs font-bold text-slate-900 block">Zero AI Training</span>
              <span className="text-[10px] text-slate-500">Your documents are never used for model training.</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-2.5">
            <Database size={18} className="text-[var(--teal)] flex-shrink-0" />
            <div>
              <span className="text-xs font-bold text-slate-900 block">AES-256 & TLS 1.3</span>
              <span className="text-[10px] text-slate-500">Encrypted at rest and during transit.</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-2.5">
            <Server size={18} className="text-purple-600 flex-shrink-0" />
            <div>
              <span className="text-xs font-bold text-slate-900 block">Firestore Security</span>
              <span className="text-[10px] text-slate-500">Isolated tenant data isolation.</span>
            </div>
          </div>
        </div>

        {/* Body Sections */}
        <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
          <section className="space-y-1.5">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">1. Executive Commitment</h3>
            <p className="text-slate-600">
              At Signal87 AI, confidentiality is paramount. Signal87 is engineered specifically for legal, legislative, financial, and executive document intelligence. We strictly adhere to enterprise privacy policies ensuring your uploaded PDFs, contracts, ordinances, and research prompts remain completely private and under your exclusive control.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">2. Strict Zero-Training Mandate</h3>
            <p className="text-slate-600">
              Nothing you upload or ask — no document, no piece of a document, no chat message — is ever used to train Google Gemini or any other AI model. Your data passes through secure server memory and is stored only in your own private database.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">3. Document Storage & Firebase Firestore</h3>
            <p className="text-slate-600">
              Documents you upload to Signal87 are read, made searchable, and stored securely using Firebase Firestore with strict access rules. Only signed-in members of your organization can see or search them.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">4. Compliance & Audit Verification</h3>
            <p className="text-slate-600">
              Signal87 logs all system actions into an immutable audit trail. Administrators can review query timestamps, model engine routing, and user activity anytime from the Admin Console.
            </p>
          </section>
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium">Effective Date: July 2026</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[var(--ink)] hover:opacity-90 text-[var(--teal-ink)] font-bold rounded-xl transition-colors cursor-pointer"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
