import React, { useState } from 'react';
import { getIdToken } from 'firebase/auth';
import { auth } from '../lib/firebase';
import type { BillingPlan } from '../lib/billingPlans';

interface PaywallViewProps {
  userEmail?: string | null;
  onSignOut: () => void;
  onRetryBilling?: () => void;
}

const PLANS: { id: BillingPlan; name: string; price: string; description: string }[] = [
  { id: 'pro_100', name: '100 Documents', price: '$20/month', description: 'For a focused document collection' },
  { id: 'unlimited', name: 'Unlimited', price: '$50/month', description: 'For a growing document collection' },
];

export const PaywallView: React.FC<PaywallViewProps> = ({ userEmail, onSignOut, onRetryBilling }) => {
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleUpgrade = async (plan: BillingPlan) => {
    if (isCheckoutLoading) return;

    setIsCheckoutLoading(true);
    setCheckoutError(null);

    try {
      if (!auth.currentUser) throw new Error('Please sign in again before upgrading.');
      const token = await getIdToken(auth.currentUser);
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan })
      });

      const data = await response.json() as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Unable to start checkout. Please try again.');
      }

      window.location.assign(data.url);
    } catch (error) {
      console.error('Stripe Checkout Error:', error);
      setCheckoutError(error instanceof Error ? error.message : 'Unable to start checkout. Please try again.');
      setIsCheckoutLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[var(--bg)] text-[var(--ink)] flex flex-col items-center justify-center px-5 py-12">
      <div className="max-w-[440px] w-full space-y-8 text-center">
        <div className="flex justify-center items-center gap-3">
          <div
            aria-hidden="true"
            className="w-8 h-8 rounded-xl bg-[#18181b] flex items-center justify-center"
          >
            <span className="text-[#7dd3fc] text-[10px] font-black tracking-[-0.18em]">////</span>
          </div>
          <span className="font-semibold text-[18px] tracking-tight">Signal87</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-[26px]" style={{ fontWeight: 600, letterSpacing: '-0.036em' }}>
            Your free trial has ended
          </h1>
          <p className="text-[14.5px] text-[var(--ink-2)]" style={{ lineHeight: 1.6 }}>
            {userEmail ? `${userEmail} — ` : ''}subscribe to keep using Signal87.
          </p>
        </div>

        <div className="space-y-3 text-left">
          {PLANS.map((plan) => (
            <div key={plan.id} className="bg-[var(--surface)] border border-[var(--rule)] rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-[15px]">{plan.name}</h2>
                  <p className="text-[13px] text-[var(--ink-2)]">{plan.description}</p>
                </div>
                <span className="font-semibold text-[14px] whitespace-nowrap">{plan.price}</span>
              </div>
              <button
                type="button"
                onClick={() => void handleUpgrade(plan.id)}
                disabled={isCheckoutLoading}
                className="w-full py-2.5 bg-[var(--teal)] hover:opacity-90 disabled:opacity-60 disabled:cursor-wait text-white font-medium text-[13.5px] rounded-full cursor-pointer inline-flex items-center justify-center gap-2 transition-all min-h-[44px]"
              >
                {isCheckoutLoading ? 'Opening secure checkout…' : `Choose ${plan.name}`}
              </button>
            </div>
          ))}

          {checkoutError ? (
            <p className="text-[12px] text-red-500 text-center" role="alert">
              {checkoutError}
            </p>
          ) : (
            <p className="text-[12px] text-[var(--muted)] text-center">
              Secure billing powered by Stripe.
            </p>
          )}
        </div>

        {onRetryBilling && <button type="button" onClick={onRetryBilling} className="text-[13px] text-[var(--teal)] underline">Already subscribed? Check access again</button>}

        <button
          type="button"
          onClick={onSignOut}
          className="text-[13px] text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer inline-flex items-center gap-1.5 mx-auto"
        >
          Sign out
        </button>
      </div>
    </main>
  );
};
