/**
 * Whether this account may use the app, and why.
 *
 * Two independent sources decide it: the trial, computed from the Firebase
 * account's own creation time, and the subscription record the Stripe webhook
 * writes to subscriptions/{uid}. The client can read that record but never
 * write it — see firestore.rules — so entitlement cannot be granted from the
 * browser.
 */
import { doc, onSnapshot } from 'firebase/firestore';
import { db, User } from './firebase';
import { getTrialStatus } from './trial';
import { useEffect, useState } from 'react';

/** The client's view of subscriptions/{uid}. Written only by the webhook. */
export interface SubscriptionRecord {
  status: string;
  active: boolean;
  priceId: string | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
}

export type Access =
  /** The subscription record has not arrived yet and the trial is over, so we
   *  genuinely do not know. Never render the paywall in this state. */
  | { state: 'unknown' }
  | { state: 'subscribed'; subscription: SubscriptionRecord }
  | { state: 'trial'; daysRemaining: number }
  | { state: 'expired' };

function readRecord(data: Record<string, unknown> | undefined): SubscriptionRecord | null {
  if (!data) return null;
  return {
    status: typeof data.status === 'string' ? data.status : 'none',
    active: data.active === true,
    priceId: typeof data.priceId === 'string' ? data.priceId : null,
    currentPeriodEnd: typeof data.currentPeriodEnd === 'number' ? data.currentPeriodEnd : null,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd === true
  };
}

/**
 * Live subscription state for one account.
 *
 * onSnapshot rather than a one-off read so that returning from Stripe Checkout
 * unlocks the app the moment the webhook lands, with no refresh and no polling.
 */
export function useSubscription(user: User | null): { record: SubscriptionRecord | null; loaded: boolean } {
  const [record, setRecord] = useState<SubscriptionRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setRecord(null);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    const unsubscribe = onSnapshot(
      doc(db, 'subscriptions', user.uid),
      (snapshot) => {
        setRecord(snapshot.exists() ? readRecord(snapshot.data()) : null);
        setLoaded(true);
      },
      (error) => {
        // Offline, or rules refused the read. Treat as "no subscription" and
        // let the trial decide; failing closed here would lock out a paying
        // customer over a dropped connection.
        console.warn('Subscription read failed:', error);
        setRecord(null);
        setLoaded(true);
      }
    );
    return unsubscribe;
  }, [user]);

  return { record, loaded };
}

/**
 * Resolves the two sources into one answer.
 *
 * A live subscription wins outright. Otherwise the trial applies. The 'unknown'
 * state exists for exactly one case — trial over, subscription not yet loaded —
 * because rendering the paywall there would flash it at a paying customer on
 * every cold start.
 */
export function resolveAccess(
  user: User | null,
  record: SubscriptionRecord | null,
  loaded: boolean
): Access {
  if (!user) return { state: 'expired' };
  if (record?.active) return { state: 'subscribed', subscription: record };

  const trial = getTrialStatus(user);
  if (!trial.isExpired) return { state: 'trial', daysRemaining: trial.daysRemaining };
  if (!loaded) return { state: 'unknown' };
  return { state: 'expired' };
}

export function useAccess(user: User | null): Access {
  const { record, loaded } = useSubscription(user);
  return resolveAccess(user, record, loaded);
}
