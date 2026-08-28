/**
 * Subscription billing, served at /api/billing/* through the hosting rewrites.
 *
 * Two rules shape everything here.
 *
 * First, the client is never trusted with entitlement. A browser can write its
 * own users/{uid} subtree under this project's Firestore rules, so if
 * subscription status lived there anyone could grant themselves a plan from the
 * console. It lives at subscriptions/{uid} instead, which the rules make
 * read-only to the client; the only writer is the Stripe webhook below, running
 * with Admin credentials that bypass rules entirely.
 *
 * Second, no price is ever hardcoded. The plans endpoint reads whatever is
 * active in the connected Stripe account, so changing what you charge is done
 * in Stripe and the app follows — there is no second copy of the price to
 * forget about.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

/** Where the browser is sent back to after checkout. A public URL, so a
 *  plain string param rather than a secret — nothing here needs protecting,
 *  and defineSecret would demand a Secret Manager entry for it. */
const APP_URL = defineString('APP_URL', { default: 'https://signal87.ai' });

function app() {
  if (getApps().length === 0) initializeApp();
  return getApps()[0];
}

function db() {
  app();
  return getFirestore();
}

function stripe(): Stripe {
  // No apiVersion pin: the SDK defaults to the version it was built against,
  // and pinning a different string here is a compile error the moment the
  // dependency moves.
  return new Stripe(STRIPE_SECRET_KEY.value());
}

function appUrl(): string {
  return (APP_URL.value() || 'https://signal87.ai').replace(/\/$/, '');
}

/** The shape the client reads. Mirrors Stripe rather than inventing new states. */
interface SubscriptionRecord {
  status: Stripe.Subscription.Status | 'none';
  /** True only for the statuses that should actually unlock the app. */
  active: boolean;
  priceId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  /** Seconds since epoch, matching Stripe, or null when not on a period. */
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: FieldValue;
}

/**
 * Trialing and active both unlock. past_due deliberately does too: the card
 * failed but Stripe is still retrying, and locking someone out mid-retry is a
 * good way to lose a customer who was going to pay. unpaid/canceled do not.
 */
function isEntitled(status: Stripe.Subscription.Status): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

/**
 * Verifies the caller's Firebase ID token.
 *
 * Every entitlement decision keys off this uid, so a request without a valid
 * token gets nothing — the uid is never read from the body, where a caller
 * could simply name someone else's account.
 */
async function requireUid(req: { get(name: string): string | undefined }): Promise<string | null> {
  const header = req.get('authorization') || req.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const decoded = await getAuth(app()).verifyIdToken(header.slice(7).trim());
    return decoded.uid;
  } catch {
    return null;
  }
}

/* ── GET /api/billing/plans ─────────────────────────────────────────────── */

export const billingPlans = onRequest(
  { secrets: [STRIPE_SECRET_KEY], timeoutSeconds: 30, cors: false },
  async (_req, res) => {
    if (!STRIPE_SECRET_KEY.value()?.trim()) {
      // Billing not configured yet: an empty list is a state the UI renders
      // ("checkout is not available yet"), not an error it has to special-case.
      res.json({ plans: [], configured: false });
      return;
    }
    try {
      const prices = await stripe().prices.list({ active: true, limit: 20, expand: ['data.product'] });
      const plans = prices.data
        .filter((price) => price.recurring && typeof price.product !== 'string' && !price.product.deleted)
        .map((price) => {
          const product = price.product as Stripe.Product;
          return {
            priceId: price.id,
            name: product.name,
            description: product.description,
            features: Array.isArray(product.marketing_features)
              ? product.marketing_features
                  .map((f) => f.name)
                  .filter((n): n is string => typeof n === 'string' && n.length > 0)
              : [],
            unitAmount: price.unit_amount,
            currency: price.currency,
            interval: price.recurring?.interval ?? null,
            intervalCount: price.recurring?.interval_count ?? 1
          };
        })
        // Cheapest first, so the pricing table reads in a predictable order.
        .sort((a, b) => (a.unitAmount ?? 0) - (b.unitAmount ?? 0));

      res.json({ plans, configured: true });
    } catch (error) {
      console.error('billingPlans failed:', error);
      res.status(502).json({ error: 'Could not load plans.', plans: [], configured: true });
    }
  }
);

/* ── POST /api/billing/checkout ─────────────────────────────────────────── */

export const billingCheckout = onRequest(
  { secrets: [STRIPE_SECRET_KEY], timeoutSeconds: 30, cors: false },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Use POST.' });
      return;
    }
    const uid = await requireUid(req);
    if (!uid) {
      res.status(401).json({ error: 'Sign in first.' });
      return;
    }
    const priceId = typeof req.body?.priceId === 'string' ? req.body.priceId : '';
    if (!priceId.startsWith('price_')) {
      res.status(400).json({ error: 'A plan is required.' });
      return;
    }

    try {
      const user = await getAuth(app()).getUser(uid);
      const existing = await db().collection('subscriptions').doc(uid).get();
      const customerId = existing.exists ? (existing.data()?.customerId as string | undefined) : undefined;

      const session = await stripe().checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        // Reusing the customer keeps one billing history per account instead of
        // creating a new Stripe customer on every upgrade attempt.
        ...(customerId ? { customer: customerId } : { customer_email: user.email ?? undefined }),
        // Both are set: client_reference_id survives on the session, and the
        // metadata copy rides along to the subscription object, so the webhook
        // can attribute the payment however the event arrives.
        client_reference_id: uid,
        subscription_data: { metadata: { firebaseUid: uid } },
        metadata: { firebaseUid: uid },
        allow_promotion_codes: true,
        success_url: `${appUrl()}/?checkout=success`,
        cancel_url: `${appUrl()}/?checkout=cancelled`
      });

      if (!session.url) {
        res.status(502).json({ error: 'Stripe did not return a checkout URL.' });
        return;
      }
      res.json({ url: session.url });
    } catch (error) {
      console.error('billingCheckout failed:', error);
      res.status(502).json({ error: 'Could not start checkout.' });
    }
  }
);

/* ── POST /api/billing/portal ───────────────────────────────────────────── */

export const billingPortal = onRequest(
  { secrets: [STRIPE_SECRET_KEY], timeoutSeconds: 30, cors: false },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Use POST.' });
      return;
    }
    const uid = await requireUid(req);
    if (!uid) {
      res.status(401).json({ error: 'Sign in first.' });
      return;
    }
    try {
      const snapshot = await db().collection('subscriptions').doc(uid).get();
      const customerId = snapshot.exists ? (snapshot.data()?.customerId as string | undefined) : undefined;
      if (!customerId) {
        res.status(404).json({ error: 'No billing account yet.' });
        return;
      }
      const session = await stripe().billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl()}/`
      });
      res.json({ url: session.url });
    } catch (error) {
      console.error('billingPortal failed:', error);
      res.status(502).json({ error: 'Could not open the billing portal.' });
    }
  }
);

/* ── POST /api/billing/webhook ──────────────────────────────────────────── */

/** Resolves the Firebase uid a Stripe subscription belongs to. */
async function uidForSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = subscription.metadata?.firebaseUid;
  if (typeof fromMetadata === 'string' && fromMetadata) return fromMetadata;

  // Older subscriptions, or ones created outside this flow, carry the uid only
  // on the customer. Fall back to the stored mapping before giving up.
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  if (!customerId) return null;
  const match = await db().collection('subscriptions').where('customerId', '==', customerId).limit(1).get();
  return match.empty ? null : match.docs[0].id;
}

async function writeSubscription(uid: string, subscription: Stripe.Subscription): Promise<void> {
  const item = subscription.items.data[0];
  const record: SubscriptionRecord = {
    status: subscription.status,
    active: isEntitled(subscription.status),
    priceId: item?.price?.id ?? null,
    customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null,
    subscriptionId: subscription.id,
    currentPeriodEnd: subscription.current_period_end ?? null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    updatedAt: FieldValue.serverTimestamp()
  };
  await db().collection('subscriptions').doc(uid).set(record, { merge: true });
}

export const billingWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], timeoutSeconds: 60, cors: false },
  async (req, res) => {
    const signature = req.get('stripe-signature');
    if (!signature) {
      res.status(400).send('Missing signature.');
      return;
    }

    let event: Stripe.Event;
    try {
      // rawBody, not the parsed body: the signature covers the exact bytes
      // Stripe sent, and re-serialising the parsed JSON will not match.
      event = stripe().webhooks.constructEvent(req.rawBody, signature, STRIPE_WEBHOOK_SECRET.value());
    } catch (error) {
      // An unverified event is indistinguishable from a forged one, and acting
      // on it would let anyone grant themselves a subscription.
      console.error('billingWebhook signature check failed:', error);
      res.status(400).send('Invalid signature.');
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const uid = session.client_reference_id || session.metadata?.firebaseUid;
          const subscriptionId =
            typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
          if (uid && subscriptionId) {
            await writeSubscription(uid, await stripe().subscriptions.retrieve(subscriptionId));
          }
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const uid = await uidForSubscription(subscription);
          if (uid) await writeSubscription(uid, subscription);
          break;
        }
        default:
          // Everything else is acknowledged so Stripe stops retrying it.
          break;
      }
      res.json({ received: true });
    } catch (error) {
      // A 500 asks Stripe to retry, which is what we want for a transient
      // Firestore failure — the event is not lost.
      console.error(`billingWebhook failed handling ${event.type}:`, error);
      res.status(500).send('Handler failed.');
    }
  }
);
