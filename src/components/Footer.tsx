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
      className="bg-[var(--surface-2)]/90 border-t border-[var(--rule)] pt-10 px-4 sm:px-8 text-[var(--ink)] font-sans mt-auto"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Main Grid: Brand + 2 Column Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Brand & Platform Summary */}
          <div className="space-y-3 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <Signal87Logo size={32} />
              <span className="font-extrabold text-[var(--ink)] text-lg tracking-tight">Signal87</span>
              <span className="text-[10px] bg-[var(--rule)]/70 text-[var(--ink)] px-2 py-0.5 rounded-full font-mono font-bold border border-[var(--rule)]/80">
                AI Memory
              </span>
            </div>
            <p className="text-xs text-[var(--ink-2)] leading-relaxed">
              Signal87 AI is the enterprise document memory and legal AI research platform engineered for real-time citation synthesis and zero-hallucination verification.
            </p>
            <div className="pt-1 flex items-center gap-2">
              <span className="text-[10px] bg-[var(--ok-soft)] text-[var(--ok)] border border-[var(--ok)]/30 px-2.5 py-1 rounded-full font-mono font-bold flex items-center gap-1.5">
                <Lock size={11} className="text-[var(--ok)]" /> Zero Training Guard
              </span>
            </div>
          </div>

          {/* Column 1: Company & Media */}
          <div className="space-y-3">
            <span className="font-bold text-[var(--ink)] uppercase tracking-wider text-[11px] text-[var(--muted)] block">
              Company & Media
            </span>
            <ul className="space-y-1 text-xs">
              <li>
                <a
                  href="/team"
                  className="w-full text-left py-1.5 px-2 -mx-2 text-[var(--ink)] font-bold hover:text-[var(--accent)] hover:bg-[var(--rule)]/50 rounded-lg transition-colors cursor-pointer min-h-[44px] flex items-center gap-2"
                >
                  <Users size={14} className="text-[var(--muted)]" />
                  <span>Team</span>
                </a>
              </li>
              <li>
                <button
                  onClick={onOpenBlog}
                  className="w-full text-left py-1.5 px-2 -mx-2 text-[var(--ink)] font-bold hover:text-[var(--accent)] hover:bg-[var(--rule)]/50 rounded-lg transition-colors cursor-pointer min-h-[44px] flex items-center gap-2"
                >
                  <BookOpen size={14} className="text-[var(--muted)]" />
                  <span>Blog & Insights</span>
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenMedia}
                  className="w-full text-left py-1.5 px-2 -mx-2 text-[var(--ink)] font-bold hover:text-[var(--accent)] hover:bg-[var(--rule)]/50 rounded-lg transition-colors cursor-pointer min-h-[44px] flex items-center gap-2"
                >
                  <Tv size={14} className="text-[var(--muted)]" />
                  <span>Media & Press</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Governance & Security */}
          <div className="space-y-3">
            <span className="font-bold text-[var(--ink)] uppercase tracking-wider text-[11px] text-[var(--muted)] block">
              Trust & Legal
            </span>
            <ul className="space-y-1 text-xs">
              <li>
                <button
                  onClick={() => onSelectTab('privacy')}
                  className="w-full text-left py-1.5 px-2 -mx-2 text-[var(--ink)] font-bold hover:text-[var(--ok)] hover:bg-[var(--rule)]/50 rounded-lg transition-colors cursor-pointer min-h-[44px] flex items-center gap-2"
                >
                  <Shield size={14} className="text-[var(--ok)]" />
                  <span>Privacy Policy</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('terms')}
                  className="w-full text-left py-1.5 px-2 -mx-2 text-[var(--ink)] font-bold hover:text-[var(--ink-2)] hover:bg-[var(--rule)]/50 rounded-lg transition-colors cursor-pointer min-h-[44px] flex items-center gap-2"
                >
                  <BookOpen size={14} className="text-[var(--muted)]" />
                  <span>Terms of Service</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="pt-6 border-t border-[var(--rule)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--muted)] font-medium">
          <p className="text-center sm:text-left">
            © 2026 Signal87 AI Inc. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono text-[var(--muted)]">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={12} className="text-[var(--ok)]" /> AES-256 Encrypted
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 size={12} className="text-[var(--accent)]" /> Firestore Synced
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
