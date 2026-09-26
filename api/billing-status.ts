import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyFirebaseIdToken } from '../src/lib/firebaseAuth.js';
import { hasActiveSubscription } from '../src/lib/stripeBilling.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  let account: Awaited<ReturnType<typeof verifyFirebaseIdToken>>;
  try { account = await verifyFirebaseIdToken(req.headers.authorization); }
  catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return res.status(503).json({ error: 'Billing is not configured' });
  const email = typeof account.email === 'string' ? account.email.trim() : '';
  if (!email) return res.status(400).json({ error: 'Account email is missing' });
  try {
    const allowedPrices = [process.env.STRIPE_PRICE_ID, process.env.STRIPE_PRICE_ID_100].filter((price): price is string => Boolean(price));
    const active = await hasActiveSubscription(secret, account.sub, email, account.email_verified === true, allowedPrices);
    return res.status(200).json({ active });
  } catch (error) {
    console.error('Subscription verification failed:', error);
    return res.status(502).json({ error: 'Unable to verify subscription' });
  }
}
