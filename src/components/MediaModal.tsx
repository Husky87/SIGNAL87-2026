import React from 'react';
import { X, Tv, Mail, Download, ExternalLink, Shield, FileText, Sparkles, Building2 } from 'lucide-react';
import { Signal87Logo } from './Signal87Logo';

interface MediaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MediaModal: React.FC<MediaModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
          <div className="p-2.5 bg-slate-950 text-white rounded-2xl flex items-center justify-center">
            <Tv size={24} className="text-[#7dd3fc]" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Media, Press & Brand Kit
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Press releases, brand assets, executive bios, and media inquiries for Signal87 AI.
            </p>
          </div>
        </div>

        {/* Fast Bio Overview */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center gap-2">
            <Signal87Logo size={24} />
            <span className="font-extrabold text-slate-900 text-sm">About Signal87 AI Inc.</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
            Signal87 AI is the enterprise document memory and legal AI research platform engineered for real-time verification and zero-hallucination citation synthesis. Founded by <strong className="text-slate-900">Michael Benezra</strong> (CEO & Co-Founder) and <strong className="text-slate-900">Michael Chavira</strong> (Co-Founder & Chief Systems Architect), Signal87 empowers legal, corporate governance, and legislative research teams across North America.
          </p>
        </div>

        {/* Media Contact & Brand Assets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-2xs">
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2 uppercase tracking-wider">
              <Mail size={15} className="text-blue-600" /> Press Contact
            </h3>
            <p className="text-xs text-slate-600">
              For interview requests, executive commentary, or media accreditation:
            </p>
            <a
              href="mailto:press@signal87.ai"
              className="text-xs font-bold text-blue-600 hover:underline block pt-1"
            >
              press@signal87.ai
            </a>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-2xs">
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2 uppercase tracking-wider">
              <Download size={15} className="text-emerald-600" /> Official Brand Kit
            </h3>
            <p className="text-xs text-slate-600">
              Vector SVG logos, executive headshots, and brand guidelines.
            </p>
            <button
              onClick={() => alert('Signal87 Official Brand Kit & Press Assets Downloaded.')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1 mt-1"
            >
              <Download size={13} /> Download Press Pack (.zip)
            </button>
          </div>
        </div>

        {/* Recent Press Coverage & Releases */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
            Recent Press Releases & News
          </h3>

          <div className="space-y-2.5">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start justify-between gap-3 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-slate-400 block">July 2026 • Press Release</span>
                <span className="font-bold text-slate-900 block">
                  Signal87 AI Unveils Multi-Document Citation Verification Engine with Sub-Second Latency
                </span>
                <p className="text-slate-500 text-[11px] line-clamp-1">
                  Signal87 launches enterprise platform eliminating AI memory loss across 50+ simultaneous contract comparisons.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start justify-between gap-3 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-slate-400 block">April 2026 • LegalTech Today</span>
                <span className="font-bold text-slate-900 block">
                  How Executive Leadership at Signal87 Reimagined Verifiable Legal Search
                </span>
                <p className="text-slate-500 text-[11px] line-clamp-1">
                  Michael Benezra and Michael Chavira discuss zero-training mandates and grounded legal search in modern corporate governance.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Signal87 Media & Relations</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
