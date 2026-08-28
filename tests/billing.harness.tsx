/**
 * The subscription surfaces, rendered without an account.
 *
 * PaywallView and TrialBanner only appear for a signed-in user at a particular
 * point in their trial, which makes them awkward to look at. ?view= renders
 * each one directly; the plans they show come from the same /api/billing/plans
 * call the real app makes, which the e2e stubs.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PaywallView } from '../src/components/PaywallView';
import { TrialBanner } from '../src/components/TrialBanner';
import { SubscribeModal } from '../src/components/SubscribeModal';
import '../src/index.css';

const view = new URLSearchParams(location.search).get('view') || 'paywall';

function Harness() {
  if (view === 'banner') {
    return (
      <div className="s87-app bg-[var(--paper)] text-[var(--ink)] min-h-[100dvh]">
        <TrialBanner daysRemaining={4} onUpgrade={() => {}} />
        <TrialBanner daysRemaining={1} onUpgrade={() => {}} />
        <div className="p-6 text-[13px] text-[var(--ink-2)]">Above: the quiet strip, then the last-two-days one.</div>
      </div>
    );
  }
  if (view === 'modal') {
    return (
      <div className="s87-app bg-[var(--paper)] min-h-[100dvh]">
        <SubscribeModal isOpen onClose={() => {}} subscribed={false} />
      </div>
    );
  }
  if (view === 'managed') {
    return (
      <div className="s87-app bg-[var(--paper)] min-h-[100dvh]">
        <SubscribeModal isOpen onClose={() => {}} subscribed={true} />
      </div>
    );
  }
  return (
    <div className="s87-app">
      <PaywallView userEmail="counsel@signal87.ai" onSignOut={() => {}} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
