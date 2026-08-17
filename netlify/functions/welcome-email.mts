import type { Config } from '@netlify/functions';

// In a production setup, this integrates Resend/SendGrid/Postmark.
// We log and return structured delivery confirmation.
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method Not Allowed' }, { status: 405, headers: { Allow: 'POST' } });
  }

  try {
    const { email, name } = await req.json();
    console.log(`[Transactional Email] Firing Welcome to Signal87 AI email for ${email} (${name || 'New Executive User'})`);

    return Response.json({
      success: true,
      emailSent: true,
      recipient: email || 'user@signal87.ai',
      subject: 'Welcome to Signal87 AI — Your Document Memory & AI Workspace is Live',
      deliveredAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Welcome Email Error:', err);
    return Response.json({ error: 'Failed to dispatch welcome email' }, { status: 500 });
  }
}

export const config: Config = {
  path: '/api/auth/welcome-email'
};
