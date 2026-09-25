import React, { useState } from 'react';

interface PaywallViewProps {
  userEmail?: string | null;
  onSignOut: () => void;
  onRefreshBilling: () => void;
}

type CheckoutPlan = 'documents_100' | 'unlimited';

export const PaywallView: React.FC<PaywallViewProps> = ({ userEmail, onSignOut, onRefreshBilling }) => {
  const [loadingPlan, setLoadingPlan] = useState<CheckoutPlan | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleUpgrade = async (plan: CheckoutPlan) => {
    if (loadingPlan) return;

    setLoadingPlan(plan);
    setCheckoutError(null);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setLoadingPlan(null);
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

        <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-2xl p-6 text-left space-y-4">
          <p className="text-[13px] text-[var(--ink-2)]">Both plans include AI search, citation-backed answers, and shared workspace access.</p>
          {([
            { id: 'documents_100', name: '100 documents', price: '$20/month' },
            { id: 'unlimited', name: 'Unlimited documents', price: '$50/month' }
          ] as const).map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => handleUpgrade(plan.id)}
              disabled={loadingPlan !== null}
              className="w-full p-4 border border-[var(--rule)] hover:border-[var(--teal)] disabled:opacity-60 disabled:cursor-wait rounded-xl cursor-pointer flex items-center justify-between text-left transition-colors min-h-[60px]"
            >
              <span className="font-medium text-[14px]">{plan.name}</span>
              <span className="text-[13px] text-[var(--teal)]">{loadingPlan === plan.id ? 'Opening checkout…' : plan.price}</span>
            </button>
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

        <button type="button" onClick={onRefreshBilling} className="text-[13px] text-[var(--teal)] underline cursor-pointer">
          Already subscribed? Check again
        </button>

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
