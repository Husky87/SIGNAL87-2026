import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyFirebaseIdToken } from '../src/lib/firebaseAuth.js';

const SITE_URL = 'https://signal87.ai';
type CheckoutPlan = 'documents_100' | 'unlimited';
export function checkoutPriceForPlan(plan: unknown, env: NodeJS.ProcessEnv): string | null {
  if (plan === 'documents_100') return env.STRIPE_PRICE_ID_100_DOCUMENTS || null;
  if (plan === 'unlimited') return env.STRIPE_PRICE_ID_UNLIMITED || null;
  return null;
}
function json(res: VercelResponse, status: number, body: Record<string, unknown>) { res.status(status).setHeader('Content-Type', 'application/json').json(body); }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed.' }); }
  let claims;
  try { claims = await verifyFirebaseIdToken(req.headers.authorization); } catch { return json(res, 401, { error: 'Sign in again to start checkout.' }); }
  const plan: unknown = req.body?.plan;
  if (plan !== 'documents_100' && plan !== 'unlimited') return json(res, 400, { error: 'Choose a valid subscription plan.' });
  const secretKey = process.env.STRIPE_SECRET_KEY; const priceId = checkoutPriceForPlan(plan as CheckoutPlan, process.env);
  if (!secretKey || !priceId) { console.error('Stripe is not configured.'); return json(res, 503, { error: 'Billing is not configured yet. Please try again shortly.' }); }
  // Bind checkout to the authenticated account, not an email supplied in the
  // request body. The UID remains on the subscription for later access checks.
  const email = typeof claims.email === 'string' ? claims.email.trim() : '';
  if (!email || !email.includes('@')) return json(res, 400, { error: 'Your account needs an email to start checkout.' });
  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    customer_email: email,
    client_reference_id: claims.sub,
    success_url: `${SITE_URL}/?billing=success`,
    cancel_url: `${SITE_URL}/?billing=cancelled`,
    'subscription_data[metadata][signal87_uid]': claims.sub,
    'subscription_data[metadata][signal87_email]': email
  });
  try {
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
    const session = await stripeResponse.json() as { url?: string; error?: { message?: string } };
    if (!stripeResponse.ok || !session.url) { console.error('Stripe Checkout session creation failed:', session.error?.message || session); return json(res, 502, { error: 'Unable to start secure checkout. Please try again.' }); }
    return json(res, 200, { url: session.url });
  } catch (error) { console.error('Stripe Checkout request failed:', error); return json(res, 500, { error: 'Unable to start secure checkout. Please try again.' }); }
}
