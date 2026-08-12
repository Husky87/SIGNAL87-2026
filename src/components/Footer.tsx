import React from 'react';
import { NavTab } from './Sidebar';
import { Signal87Logo } from './Signal87Logo';
import { Users, Shield, BookOpen, Tv, Lock, Sparkles, CheckCircle2 } from 'lucide-react';

interface FooterProps {
  onSelectTab: (tab: NavTab) => void;
  onOpenPrivacy: () => void;
  onOpenBlog: () => void;
  onOpenMedia: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectTab,
  onOpenPrivacy,
  onOpenBlog,
  onOpenMedia
}) => {
  return (
    <footer
      className="bg-slate-50/90 border-t border-slate-200 pt-10 px-4 sm:px-8 text-slate-800 font-sans mt-auto"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Main Grid: Brand + 2 Column Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Brand & Platform Summary */}
          <div className="space-y-3 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <Signal87Logo size={32} />
              <span className="font-extrabold text-slate-900 text-lg tracking-tight">Signal87</span>
              <span className="text-[10px] bg-slate-200/70 text-slate-800 px-2 py-0.5 rounded-full font-mono font-bold border border-slate-300/80">
                AI Memory
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Signal87 AI is the enterprise document memory and legal AI research platform engineered for real-time citation synthesis and zero-hallucination verification.
            </p>
            <div className="pt-1 flex items-center gap-2">
              <span className="text-[10px] bg-emerald-100/80 text-emerald-900 border border-emerald-300/80 px-2.5 py-1 rounded-full font-mono font-bold flex items-center gap-1.5">
                <Lock size={11} className="text-emerald-700" /> Zero Training Guard
              </span>
            </div>
          </div>

          {/* Column 1: Company & Media */}
          <div className="space-y-3">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-slate-400 block">
              Company & Media
            </span>
            <ul className="space-y-1 text-xs">
              <li>
                <button
                  onClick={() => onSelectTab('team')}
                  className="w-full text-left py-1.5 px-2 -mx-2 text-slate-900 font-bold hover:text-[var(--teal)] hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer min-h-[38px] flex items-center gap-2"
                >
                  <Users size={14} className="text-slate-500" />
                  <span>Team</span>
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenBlog}
                  className="w-full text-left py-1.5 px-2 -mx-2 text-slate-900 font-bold hover:text-[var(--teal)] hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer min-h-[38px] flex items-center gap-2"
                >
                  <BookOpen size={14} className="text-slate-500" />
                  <span>Blog & Insights</span>
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenMedia}
                  className="w-full text-left py-1.5 px-2 -mx-2 text-slate-900 font-bold hover:text-[var(--teal)] hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer min-h-[38px] flex items-center gap-2"
                >
                  <Tv size={14} className="text-slate-500" />
                  <span>Media & Press</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Governance & Security */}
          <div className="space-y-3">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-slate-400 block">
              Trust & Legal
            </span>
            <ul className="space-y-1 text-xs">
              <li>
                <button
                  onClick={() => onSelectTab('privacy')}
                  className="w-full text-left py-1.5 px-2 -mx-2 text-slate-900 font-bold hover:text-emerald-700 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer min-h-[38px] flex items-center gap-2"
                >
                  <Shield size={14} className="text-emerald-600" />
                  <span>Privacy Policy</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('terms')}
                  className="w-full text-left py-1.5 px-2 -mx-2 text-slate-900 font-bold hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer min-h-[38px] flex items-center gap-2"
                >
                  <BookOpen size={14} className="text-slate-500" />
                  <span>Terms of Service</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <p className="text-center sm:text-left">
            © 2026 Signal87 AI Inc. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-600" /> AES-256 Encrypted
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 size={12} className="text-[var(--teal)]" /> Firestore Synced
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
