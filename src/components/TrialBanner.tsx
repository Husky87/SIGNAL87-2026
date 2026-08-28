import React, { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';

interface TrialBannerProps {
  daysRemaining: number;
  onUpgrade: () => void;
}

/**
 * The one prompt a trialling account sees before the wall.
 *
 * Without it the trial ends as an ambush: the app simply stops working one
 * morning with no warning. It sharpens rather than nags — a quiet strip for
 * most of the trial, an accented one for the last two days — and can be
 * dismissed for the session, but returns on the next load because the deadline
 * has not gone away.
 */
export const TrialBanner: React.FC<TrialBannerProps> = ({ daysRemaining, onUpgrade }) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const urgent = daysRemaining <= 2;
  const label =
    daysRemaining <= 0
      ? 'Your trial ends today'
      : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left in your trial`;

  return (
    <div
      className={`flex items-center gap-2 px-3 sm:px-4 py-2 border-b text-[13px] flex-shrink-0 ${
        urgent
          ? 'bg-[var(--accent-soft)] border-[var(--accent)]/30 text-[var(--ink)]'
          : 'bg-[var(--surface)] border-[var(--rule)] text-[var(--ink-2)]'
      }`}
      role="status"
    >
      <span className="min-w-0 truncate">{label}</span>

      <button
        type="button"
        onClick={onUpgrade}
        className="ml-auto flex-shrink-0 inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-[12.5px] font-medium hover:opacity-90 transition-opacity cursor-pointer"
      >
        Subscribe <ArrowRight size={13} />
      </button>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss trial notice"
        className="flex-shrink-0 w-9 h-9 -mr-1 flex items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
      >
        <X size={14} />
      </button>
    </div>
  );
};
