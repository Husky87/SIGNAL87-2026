import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Reports whether the deployment can actually answer questions.
 * Never returns API keys or key prefixes.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const grokConfigured = Boolean(process.env.XAI_API_KEY?.trim());

  return res.status(200).json({
    status: 'ok',
    app: 'Signal87 AI',
    timestamp: new Date().toISOString(),
    primaryProvider: 'openai',
    fallbackProviders: ['gemini', 'grok'],
    routingOrder: ['openai', 'gemini', 'grok'],
    openaiConfigured,
    geminiConfigured,
    grokConfigured,
    canAnswerQuestions: openaiConfigured || geminiConfigured || grokConfigured,
    multiProviderFallbackEnabled: [openaiConfigured, geminiConfigured, grokConfigured].filter(Boolean).length >= 2
  });
}
