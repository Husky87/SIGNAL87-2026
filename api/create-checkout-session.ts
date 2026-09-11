import type { VercelRequest, VercelResponse } from '@vercel/node';

const SITE_URL = 'https://www.signal87.ai';

function json(res: VercelResponse, status: number, body: Record<string, unknown>) {
  res.status(status).setHeader('Content-Type', 'application/json').json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!secretKey || !priceId) {
    console.error('Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID.');
    return json(res, 503, { error: 'Billing is not configured yet. Please try again shortly.' });
  }

  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!email || !email.includes('@')) {
    return json(res, 400, { error: 'A valid account email is required.' });
  }

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    customer_email: email,
    success_url: `${SITE_URL}/?billing=success`,
    cancel_url: `${SITE_URL}/?billing=cancelled`,
    'subscription_data[metadata][signal87_email]': email,
  });

  try {
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const session = await stripeResponse.json() as { url?: string; error?: { message?: string } };

    if (!stripeResponse.ok || !session.url) {
      console.error('Stripe Checkout session creation failed:', session.error?.message || session);
      return json(res, 502, { error: 'Unable to start secure checkout. Please try again.' });
    }

    return json(res, 200, { url: session.url });
  } catch (error) {
    console.error('Stripe Checkout request failed:', error);
    return json(res, 500, { error: 'Unable to start secure checkout. Please try again.' });
  }
}
