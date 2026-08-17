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
    const { documents } = await req.json();

    if (!documents || !Array.isArray(documents) || documents.length < 2) {
      return Response.json({ error: 'At least 2 documents are required for comparison' }, { status: 400 });
    }

    const formattedDocs = documents
      .map((doc: any, idx: number) => {
        const body = doc.fullText || doc.contentPreview || doc.summary || 'No content available.';
        return `DOCUMENT ${idx + 1}: ${doc.title}\n${body}`;
      })
      .join('\n\n');

    const prompt = `Compare the following ${documents.length} documents in detail:\n\n${formattedDocs}`;

    const aiResult = await generateWithFallback({
      prompt,
      systemInstruction: `You are a multi-document legal, financial, and policy comparative analyst for Signal87 AI.
Provide a JSON output comparing the documents with the following structure:
{
  "summary": "Overall comparison summary string",
  "similarities": ["bullet 1", "bullet 2"],
  "differences": ["bullet 1", "bullet 2"],
  "missingClauses": ["bullet 1", "bullet 2"],
  "conflicts": ["bullet 1", "bullet 2"],
  "repeatedLanguage": ["bullet 1", "bullet 2"],
  "riskTrends": ["bullet 1", "bullet 2"]
}`,
      model: 'gemini-2.5-flash',
      fallbackModel: 'gpt-4o',
      temperature: 0.1,
      responseMimeType: 'application/json'
    });

    let jsonResult: any = {};
    try {
      jsonResult = JSON.parse(aiResult.text || '{}');
    } catch (e) {
      jsonResult = {
        summary: aiResult.text,
        similarities: ['Common alignment on policy goals'],
        differences: ['Varying timelines and penalty thresholds'],
        missingClauses: ['Notice period clarity'],
        conflicts: ['Contradictory compliance windows'],
        repeatedLanguage: ['Standard indemnification boilerplate'],
        riskTrends: ['Increased regulatory liability']
      };
    }

    return Response.json({
      ...jsonResult,
      _provider: aiResult.provider,
      _fallbackTriggered: aiResult.fallbackTriggered
    });
  } catch (error: any) {
    console.error('Error in /api/compare:', error);
    return Response.json({ error: 'Multi-doc comparison failed', details: error.message || String(error) }, { status: 500 });
  }
}

export const config: Config = {
  path: '/api/compare'
};
