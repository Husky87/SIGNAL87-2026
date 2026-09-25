import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyFirebaseIdToken } from '../src/lib/firebaseAuth.js';
import { hasActiveStripeSubscription } from '../src/lib/stripeEntitlements.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  let claims;
  try {
    claims = await verifyFirebaseIdToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ error: 'Sign in again to check billing.' });
  }
  const email = typeof claims.email === 'string' ? claims.email : '';
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('STRIPE_SECRET_KEY is missing from the billing status endpoint.');
    return res.status(503).json({ error: 'Billing is temporarily unavailable.' });
  }
  if (!email) return res.status(200).json({ active: false });

  try {
    const active = await hasActiveStripeSubscription(claims.sub, email, claims.email_verified === true, secretKey);
    return res.status(200).json({ active });
  } catch (error) {
    console.error('Unable to verify subscription status:', error);
    return res.status(503).json({ error: 'Unable to verify billing right now. Please retry.' });
  }
}
