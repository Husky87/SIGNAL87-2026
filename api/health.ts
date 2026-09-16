import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Reports the active AI provider chain without exposing secrets. */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const geminiConfigured = Boolean(
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim()
  );
  const canAnswerQuestions = openaiConfigured || geminiConfigured;

  return res.status(canAnswerQuestions ? 200 : 503).json({
    status: canAnswerQuestions ? 'ok' : 'unavailable',
    app: 'Signal87 AI',
    timestamp: new Date().toISOString(),
    primaryProvider: 'openai',
    fallbackProviders: ['gemini'],
    routingOrder: ['openai', 'gemini'],
    openaiConfigured,
    geminiConfigured,
    canAnswerQuestions,
    multiProviderFallbackEnabled: openaiConfigured && geminiConfigured
  });
}
