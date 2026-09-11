import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';

const WEBHOOK_TOLERANCE_SECONDS = 300;

type StripeEvent = {
  id?: string;
  type?: string;
  created?: number;
  data?: { object?: Record<string, any> };
};

function json(res: VercelResponse, status: number, body: Record<string, unknown>) {
  res.status(status).setHeader('Content-Type', 'application/json').json(body);
}

function rawBody(req: VercelRequest): string {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  return JSON.stringify(req.body ?? {});
}

function verifyStripeSignature(payload: string, signature: string, secret: string): boolean {
  const parts = signature.split(',');
  const timestampPart = parts.find((part) => part.startsWith('t='));
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  const timestamp = Number(timestampPart?.slice(2));

  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');

  return signatures.some((candidate) => {
    try {
      return timingSafeEqual(Buffer.from(candidate, 'utf8'), Buffer.from(expected, 'utf8'));
    } catch {
      return false;
    }
  });
}

function subscriptionState(subscription: Record<string, any>) {
  return {
    stripeCustomerId: subscription.customer ?? null,
    stripeSubscriptionId: subscription.id ?? null,
    status: subscription.status ?? 'unknown',
    priceId: subscription.items?.data?.[0]?.price?.id ?? null,
    currentPeriodEnd: subscription.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    email: subscription.metadata?.signal87_email ?? null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Stripe webhook is not configured. Set STRIPE_WEBHOOK_SECRET.');
    return json(res, 503, { error: 'Webhook is not configured.' });
  }

  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') {
    return json(res, 400, { error: 'Missing Stripe signature.' });
  }

  const payload = rawBody(req);
  if (!verifyStripeSignature(payload, signature, webhookSecret)) {
    return json(res, 400, { error: 'Invalid Stripe signature.' });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return json(res, 400, { error: 'Invalid webhook payload.' });
  }

  const object = event.data?.object ?? {};

  // These events are intentionally handled in one place so the endpoint is ready
  // to connect to the application's entitlement store when that persistence layer
  // is enabled. Stripe retries events, so consumers must make event IDs idempotent.
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      console.info('Stripe checkout completed:', {
        eventId: event.id,
        customerId: object.customer,
        subscriptionId: object.subscription,
        email: object.customer_email,
        paymentStatus: object.payment_status,
      });
      break;
    }
    case 'checkout.session.async_payment_failed': {
      console.warn('Stripe checkout payment failed:', {
        eventId: event.id,
        sessionId: object.id,
        customerId: object.customer,
      });
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      console.info('Stripe subscription lifecycle update:', {
        eventId: event.id,
        ...subscriptionState(object),
      });
      break;
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      console.info('Stripe invoice lifecycle update:', {
        eventId: event.id,
        invoiceId: object.id,
        customerId: object.customer,
        subscriptionId: object.subscription,
        status: object.status,
      });
      break;
    }
    default:
      console.info('Stripe event received:', event.type, event.id);
  }

  return json(res, 200, { received: true });
}
