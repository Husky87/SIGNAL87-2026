import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Reports the active AI provider chain without exposing secrets. */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());

  return res.status(200).json({
    status: 'ok',
    app: 'Signal87 AI',
    timestamp: new Date().toISOString(),
    primaryProvider: 'openai',
    fallbackProviders: ['gemini'],
    routingOrder: ['openai', 'gemini'],
    openaiConfigured,
    geminiConfigured,
    canAnswerQuestions: openaiConfigured || geminiConfigured,
    multiProviderFallbackEnabled: openaiConfigured && geminiConfigured
  });
}
