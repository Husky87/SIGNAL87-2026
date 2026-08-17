import type { Config } from '@netlify/functions';
import { generateWithFallback } from '../../src/lib/aiFallbackService.js';

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method Not Allowed' }, { status: 405, headers: { Allow: 'POST' } });
  }

  if (!Netlify.env.get('GEMINI_API_KEY') && !Netlify.env.get('OPENAI_API_KEY')) {
    return Response.json(
      {
        error: 'AI service is not configured',
        details: 'Neither GEMINI_API_KEY nor OPENAI_API_KEY is set in the environment'
      },
      { status: 500 }
    );
  }

  try {
    const { documentText, documentTitle, documentType } = await req.json();

    if (!documentText || documentText.trim().length === 0) {
      return Response.json({ error: 'Document text is required' }, { status: 400 });
    }

    const maxLength = 3000;
    const truncatedText = documentText.length > maxLength
      ? documentText.substring(0, maxLength) + '...'
      : documentText;

    const prompt = `You are a professional document analyst. Generate a thorough, high-quality executive summary for the following ${documentType || 'document'}.

Document Title: ${documentTitle || 'Untitled'}

Document Content:
${truncatedText}

Requirements for the summary:
1. Be comprehensive but concise (2-4 sentences max)
2. Extract the most critical information and key takeaways
3. Highlight any risks, important decisions, or action items
4. Use professional, clear language suitable for executives
5. Focus on what matters most for business decision-making

Generate only the summary text, no additional commentary.`;

    const aiResult = await generateWithFallback({
      prompt,
      systemInstruction: `You are an expert document summarization system for Signal87 AI. Generate clear, thorough executive summaries that capture the essence and critical details of documents. Your summaries should be immediately useful to decision-makers and should highlight key risks, opportunities, and required actions.`,
      model: 'gemini-2.5-flash',
      fallbackModel: 'gpt-4o',
      temperature: 0.3
    });

    return Response.json({
      summary: (aiResult.text || '').trim() || 'Summary generation in progress.',
      provider: aiResult.provider,
      fallbackTriggered: aiResult.fallbackTriggered
    });
  } catch (error: any) {
    console.error('Error in /api/summarize:', error);
    return Response.json(
      {
        error: 'Summary generation failed',
        details: error.message || String(error)
      },
      { status: 500 }
    );
  }
}

export const config: Config = {
  path: '/api/summarize'
};
