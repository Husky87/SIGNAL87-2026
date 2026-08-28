import React, { useState } from 'react';
import { ExternalLink, Loader2, X } from 'lucide-react';
import { PricingPlans } from './PricingPlans';
import { openBillingPortal } from '../lib/billing';
import { useBackDismiss } from '../lib/useBackDismiss';

interface SubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Show billing management instead of plans once the account is paying. */
  subscribed: boolean;
}

/**
 * Subscribing, reachable before the wall comes down.
 *
 * The paywall alone only ever catches people at the end of the trial. This is
 * the same offer available from the trial banner and the sidebar at any point,
 * which is where anyone who has already decided will look for it.
 */
export const SubscribeModal: React.FC<SubscribeModalProps> = ({ isOpen, onClose, subscribed }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBackDismiss(isOpen, onClose);
  if (!isOpen) return null;

  const manage = async () => {
    setError(null);
    setBusy(true);
    try {
      await openBillingPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the billing portal.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[var(--ink)]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-2xl w-full max-w-[560px] my-8 p-5 sm:p-6 space-y-5 relative">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--raised)] transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {subscribed ? (
          <div className="space-y-4 text-center pt-2">
            <h2 className="text-[20px] text-[var(--ink)] m-0" style={{ fontWeight: 600, letterSpacing: '-0.03em' }}>
              Your subscription is active
            </h2>
            <p className="m-0 text-[13.5px] text-[var(--ink-2)]" style={{ lineHeight: 1.6 }}>
              Invoices, payment method and cancellation are handled in Stripe's billing portal.
            </p>
            <button
              type="button"
              onClick={manage}
              disabled={busy}
              className="w-full min-h-[44px] rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-[13.5px] font-medium hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer inline-flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
              Manage billing
            </button>
            {error && <p className="m-0 text-[12.5px] text-[var(--danger)]">{error}</p>}
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            <div className="text-center space-y-1.5">
              <h2 className="text-[20px] text-[var(--ink)] m-0" style={{ fontWeight: 600, letterSpacing: '-0.03em' }}>
                Subscribe to Signal87
              </h2>
              <p className="m-0 text-[13.5px] text-[var(--ink-2)]">
                Keep your workspace, your documents and your saved answers.
              </p>
            </div>
            <PricingPlans ctaLabel="Subscribe" />
          </div>
        )}
      </div>
    </div>
  );
};
