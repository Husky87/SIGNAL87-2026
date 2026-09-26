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

export const config = { api: { bodyParser: false } };

async function rawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 1024 * 1024) throw new Error('Webhook payload exceeds 1 MB');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('utf8');
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

  let payload: string;
  try {
    payload = await rawBody(req);
  } catch {
    return json(res, 413, { error: 'Webhook payload could not be read.' });
  }
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

  // Stripe stores the subscription state. /api/billing-status reads the current
  // subscription directly, including renewals and cancellations, so webhook
  // delivery order cannot grant or revoke access incorrectly. Keep these verified
  // events for operational visibility; the success URL grants no access itself.
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
