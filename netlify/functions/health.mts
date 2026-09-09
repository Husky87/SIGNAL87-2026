import type { Config } from '@netlify/functions';

/** Reports whether the deployment can answer questions using the configured provider chain. */
export default async function handler(_req: Request) {
  const openaiConfigured = Boolean(Netlify.env.get('OPENAI_API_KEY')?.trim());
  const grokConfigured = Boolean(Netlify.env.get('XAI_API_KEY')?.trim());

  return Response.json({
    status: 'ok',
    app: 'Signal87 AI',
    timestamp: new Date().toISOString(),
    primaryProvider: 'openai',
    fallbackProvider: 'grok',
    openaiConfigured,
    grokConfigured,
    canAnswerQuestions: openaiConfigured || grokConfigured,
    multiProviderFallbackEnabled: openaiConfigured && grokConfigured
  });
}

export const config: Config = {
  path: '/api/health'
};
