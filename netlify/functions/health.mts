import type { Config } from '@netlify/functions';

/** Reports whether the deployment can answer questions using OpenAI -> Gemini. */
export default async function handler(_req: Request) {
  const openaiConfigured = Boolean(Netlify.env.get('OPENAI_API_KEY')?.trim());
  const geminiConfigured = Boolean(Netlify.env.get('GEMINI_API_KEY')?.trim());
  return Response.json({
    status: 'ok', app: 'Signal87 AI', timestamp: new Date().toISOString(),
    primaryProvider: 'openai', fallbackProvider: 'gemini',
    openaiConfigured, geminiConfigured,
    canAnswerQuestions: openaiConfigured || geminiConfigured,
    multiProviderFallbackEnabled: openaiConfigured && geminiConfigured
  });
}
export const config: Config = { path: '/api/health' };
