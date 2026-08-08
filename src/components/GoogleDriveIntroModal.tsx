import React from 'react';
import {
  X,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Lock,
  Cloud,
  FileCheck2,
  Cpu
} from 'lucide-react';

interface GoogleDriveIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectDrive: () => void;
}

export const GoogleDriveIntroModal: React.FC<GoogleDriveIntroModalProps> = ({
  isOpen,
  onClose,
  onConnectDrive
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#18191a] border border-[#37393b] rounded-3xl max-w-xl w-full text-[#e3e3e3] shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-200">
        
        {/* Top Gradient Accent Header */}
        <div className="h-2 bg-gradient-to-r from-[#1a73e8] via-[#34a853] to-[#fbbc05]" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8e918f] hover:text-white p-1.5 rounded-xl hover:bg-[#28292a] transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Badge & Icon */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#28292a] border border-[#37393b] flex items-center justify-center text-[#7dd3fc] shadow-inner">
              <svg className="w-7 h-7 fill-current" viewBox="0 0 87.3 78">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.9 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.4.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.4-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#ea4335"/>
                <path d="m43.65 25 13.75 23.8h27.5c0-1.55-.4-3.1-1.2-4.5l-25.4-44c-.8-1.4-1.9-2.5-3.3-3.3z" fill="#00832d"/>
                <path d="m57.4 48.8-13.75 23.8c1.4.8 2.95 1.2 4.5 1.2h54.8c1.55 0 3.1-.4 4.5-1.2l-13.75-23.8z" fill="#2684fc"/>
                <path d="m13.75 25 13.75 23.8 13.75-23.8-13.75-23.8z" fill="#ffba00"/>
              </svg>
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold uppercase text-[#7dd3fc] tracking-wider bg-[#004a77]/40 px-2.5 py-0.5 rounded-full border border-[#004a77]">
                New Capability
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-snug mt-1">
                Google Workspace AI Ingestion
              </h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#c4c7c5] leading-relaxed">
            Seamlessly port your legal contracts, financial spreadsheets, policy briefs, and Google Docs directly into Signal87 AI workspace for instant zero-hallucination analysis.
          </p>

          {/* 3 Steps Guide */}
          <div className="space-y-3 text-xs">
            <div className="p-3.5 bg-[#131314] border border-[#28292a] rounded-2xl flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-[#1a73e8]/20 text-[#7dd3fc] flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 border border-[#1a73e8]/30">
                1
              </div>
              <div>
                <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Lock size={13} className="text-emerald-400" />
                  OAuth 2.0 Secure Authentication
                </h4>
                <p className="text-[11px] text-[#8e918f] mt-0.5 leading-relaxed">
                  Connect your Google account with read-only permissions. Signal87 never modifies or stores your Workspace credentials.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-[#131314] border border-[#28292a] rounded-2xl flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-[#34a853]/20 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 border border-[#34a853]/30">
                2
              </div>
              <div>
                <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Cloud size={13} className="text-[#7dd3fc]" />
                  Multi-File Cloud Selector
                </h4>
                <p className="text-[11px] text-[#8e918f] mt-0.5 leading-relaxed">
                  Select single files or batch-port entire folders including Google Docs, Sheets, Slides, PDFs, and Word files.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-[#131314] border border-[#28292a] rounded-2xl flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-[#fbbc05]/20 text-amber-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 border border-[#fbbc05]/30">
                3
              </div>
              <div>
                <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Cpu size={13} className="text-amber-400" />
                  Automated OCR & Vector Memory
                </h4>
                <p className="text-[11px] text-[#8e918f] mt-0.5 leading-relaxed">
                  Signal87 automatically parses entities, risk clauses, and vector embeddings so you can query files immediately.
                </p>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#28292a]">
            <button
              onClick={onClose}
              className="w-full sm:w-auto text-xs text-[#8e918f] hover:text-white font-medium cursor-pointer py-2 px-3 text-center"
            >
              Explore Workspace First
            </button>

            <button
              onClick={() => {
                onClose();
                onConnectDrive();
              }}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#1a73e8] to-sky-500 hover:from-[#1557b0] hover:to-sky-400 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg active:scale-95"
            >
              <Sparkles size={16} />
              <span>Connect Google Workspace Now</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
