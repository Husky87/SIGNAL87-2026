import React from 'react';
import { LogOut } from 'lucide-react';
import { Signal87Logo } from './Signal87Logo';
import { PricingPlans } from './PricingPlans';

interface PaywallViewProps {
  userEmail?: string | null;
  onSignOut: () => void;
}

/**
 * Shown once the trial is over and no subscription is active.
 *
 * This used to be a mailto: link labelled "billing coming soon", which asked
 * someone who had just finished evaluating the product to compose an email and
 * wait. It now carries the real plans and goes straight to Stripe Checkout.
 */
export const PaywallView: React.FC<PaywallViewProps> = ({ userEmail, onSignOut }) => {
  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--ink)] flex flex-col items-center justify-center px-4 sm:px-5 py-10 sm:py-12">
      <div className="max-w-[560px] w-full space-y-7 text-center">
        <div className="flex justify-center">
          <Signal87Logo size={32} showText={true} />
        </div>

        <div className="space-y-2">
          <h1 className="text-[26px]" style={{ fontWeight: 600, letterSpacing: '-0.036em' }}>
            Your free trial has ended
          </h1>
          <p className="text-[14.5px] text-[var(--ink-2)]" style={{ lineHeight: 1.6 }}>
            {userEmail ? `${userEmail} — ` : ''}subscribe to keep using Signal87. Your documents and
            saved work are exactly where you left them.
          </p>
        </div>

        <PricingPlans
          ctaLabel="Subscribe"
          unconfiguredNote="Online checkout is being finalized. Email us and we'll activate your account directly."
        />

        <button
          onClick={onSignOut}
          className="text-[13px] text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer inline-flex items-center gap-1.5 mx-auto min-h-[44px]"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
};
