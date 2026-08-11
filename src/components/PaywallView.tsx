import React from 'react';
import { Check, LogOut } from 'lucide-react';
import { Signal87Logo } from './Signal87Logo';

interface PaywallViewProps {
  userEmail?: string | null;
  onSignOut: () => void;
}

const PLAN_FEATURES = [
  'Unlimited document uploads',
  'AI-powered search and analysis',
  'Citation-backed answers',
  'Shared workspace access'
];

export const PaywallView: React.FC<PaywallViewProps> = ({ userEmail, onSignOut }) => {
  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--ink)] flex flex-col items-center justify-center px-5 py-12">
      <div className="max-w-[440px] w-full space-y-8 text-center">
        <div className="flex justify-center">
          <Signal87Logo size={32} showText={true} />
        </div>

        <div className="space-y-2">
          <h1 className="text-[26px]" style={{ fontWeight: 600, letterSpacing: '-0.036em' }}>
            Your free trial has ended
          </h1>
          <p className="text-[14.5px] text-[var(--ink-2)]" style={{ lineHeight: 1.6 }}>
            {userEmail ? `${userEmail} — ` : ''}subscribe to keep using Signal87.
          </p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-2xl p-6 text-left space-y-4">
          <ul className="space-y-2.5">
            {PLAN_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2.5 text-[14px] text-[var(--ink)]">
                <Check size={15} className="flex-shrink-0 text-[var(--teal)]" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <a
            href="mailto:billing@signal87.ai?subject=Signal87%20Subscription"
            className="w-full py-2.5 bg-[var(--teal)] hover:opacity-90 text-white font-medium text-[13.5px] rounded-full cursor-pointer inline-flex items-center justify-center transition-all min-h-[44px]"
          >
            Upgrade — billing coming soon
          </a>
          <p className="text-[12px] text-[var(--muted)] text-center">
            Online checkout is being finalized. Email us and we'll activate your account directly.
          </p>
        </div>

        <button
          onClick={onSignOut}
          className="text-[13px] text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer inline-flex items-center gap-1.5 mx-auto"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
};
