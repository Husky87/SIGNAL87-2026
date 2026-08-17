import type { Config } from '@netlify/functions';

/**
 * Reports whether the deployment can actually answer questions.
 *
 * This existed only in the local dev server, so the one check that would have
 * told us whether production had working AI credentials 404'd in production.
 *
 * Reports only whether each key is present and non-empty — never the key, never
 * a prefix of it.
 */
export default async function handler(_req: Request) {
  const geminiConfigured = Boolean(Netlify.env.get('GEMINI_API_KEY')?.trim());
  const openaiConfigured = Boolean(Netlify.env.get('OPENAI_API_KEY')?.trim());

  return Response.json({
    status: 'ok',
    app: 'Signal87 AI',
    timestamp: new Date().toISOString(),
    geminiConfigured,
    openaiConfigured,
    // The plain-language answer to "are the APIs working?". False here means no
    // question can be answered, whatever the rest of the platform does.
    canAnswerQuestions: geminiConfigured || openaiConfigured,
    multiProviderFallbackEnabled: geminiConfigured && openaiConfigured
  });
}

export const config: Config = {
  path: '/api/health'
};
