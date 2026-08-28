import React, { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { fetchPlans, formatPrice, Plan, startCheckout } from '../lib/billing';

interface PricingPlansProps {
  /**
   * Overrides the default "go to Stripe Checkout" action. The landing page
   * passes sign-up here: a signed-out visitor has no account to attach a
   * subscription to, so checkout would only fail with "Sign in first".
   */
  onSelect?: (plan: Plan) => void;
  ctaLabel?: string;
  /** Copy shown when the deployment has no Stripe key configured yet. */
  unconfiguredNote?: string;
}

/**
 * The plans on offer, read live from Stripe.
 *
 * Nothing about the price is written down in this repo — not the amount, not
 * the interval, not the feature list. They come from the product and price
 * objects in the connected Stripe account, so changing what you charge is done
 * once, in Stripe, and every surface here follows.
 */
export const PricingPlans: React.FC<PricingPlansProps> = ({ onSelect, ctaLabel, unconfiguredNote }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyPriceId, setBusyPriceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPlans().then((result) => {
      if (cancelled) return;
      setPlans(result.plans);
      setConfigured(result.configured);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = async (plan: Plan) => {
    setError(null);
    if (onSelect) {
      onSelect(plan);
      return;
    }
    setBusyPriceId(plan.priceId);
    try {
      await startCheckout(plan.priceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.');
      setBusyPriceId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-[var(--muted)]">
        <Loader2 size={15} className="animate-spin" /> Loading plans…
      </div>
    );
  }

  // No key, or no active prices. Say so plainly rather than rendering an empty
  // grid that looks like a loading failure.
  if (!configured || plans.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--rule)] bg-[var(--surface)] p-5 text-center space-y-2">
        <p className="m-0 text-[13.5px] text-[var(--ink)]">
          {unconfiguredNote || 'Online checkout is not available yet.'}
        </p>
        <a
          href="mailto:billing@signal87.ai?subject=Signal87%20Subscription"
          className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-[13.5px] font-medium hover:opacity-90 transition-opacity"
        >
          Email us to subscribe
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={`grid gap-4 ${plans.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {plans.map((plan, index) => {
          // With two or more plans the dearest is the one to draw the eye to;
          // with one there is nothing to compare it against.
          const featured = plans.length > 1 && index === plans.length - 1;
          return (
            <div
              key={plan.priceId}
              className={`rounded-2xl border p-5 flex flex-col text-left ${
                featured ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--rule)] bg-[var(--surface)]'
              }`}
            >
              <h3 className="text-[17px] text-[var(--ink)] m-0" style={{ fontWeight: 600 }}>
                {plan.name}
              </h3>
              <div className="mt-1 text-[22px] text-[var(--ink)]" style={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
                {formatPrice(plan)}
              </div>
              {plan.description && (
                <p className="mt-1.5 mb-0 text-[13px] text-[var(--ink-2)]" style={{ lineHeight: 1.55 }}>
                  {plan.description}
                </p>
              )}

              {plan.features.length > 0 && (
                <ul className="mt-4 space-y-2 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[13.5px] text-[var(--ink)]">
                      <Check size={15} className="flex-shrink-0 mt-0.5 text-[var(--accent)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={() => choose(plan)}
                disabled={busyPriceId !== null}
                className={`mt-5 w-full min-h-[44px] rounded-full text-[13.5px] font-medium transition-opacity cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  featured
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] hover:opacity-90'
                    : 'border border-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-soft)]'
                }`}
              >
                {busyPriceId === plan.priceId && <Loader2 size={15} className="animate-spin" />}
                {ctaLabel || `Choose ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="m-0 text-[12.5px] text-[var(--danger)] text-center">{error}</p>}
      <p className="m-0 text-[12px] text-[var(--muted)] text-center">
        Secure checkout by Stripe. Cancel anytime.
      </p>
    </div>
  );
};
