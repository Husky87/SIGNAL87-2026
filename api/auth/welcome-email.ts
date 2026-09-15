import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseUser } from '../../src/lib/firebaseAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method Not Allowed' }); }
  try {
    await requireFirebaseUser(req.headers.authorization);
    const { email, name } = req.body || {};
    if (typeof email !== 'string' || !email.includes('@')) return res.status(400).json({ error: 'Valid email is required' });
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL || 'Signal87 AI <onboarding@signal87.ai>';
    if (!resendKey) return res.status(503).json({ success: false, emailSent: false, error: 'Transactional email provider is not configured' });
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [email], subject: 'Welcome to Signal87 AI — Your Workspace is Live', html: `<p>Welcome${name ? `, ${String(name).replace(/[<>]/g, '')}` : ''}.</p><p>Your Signal87 AI workspace is ready. You can now securely upload documents and use the AI research workspace.</p>` }) });
    if (!response.ok) return res.status(502).json({ success: false, emailSent: false, error: 'Email provider rejected the message' });
    return res.status(200).json({ success: true, emailSent: true, recipient: email, deliveredAt: new Date().toISOString() });
  } catch (error: any) { return res.status(error?.message?.includes('token') || error?.message?.includes('Authorization') ? 401 : 500).json({ error: error?.message || 'Failed to dispatch welcome email' }); }
}
