import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithFallback } from '../../src/lib/aiFallbackService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'AI service is not configured',
      details: 'Neither GEMINI_API_KEY nor OPENAI_API_KEY is set in the environment'
    });
  }

  try {
    const { title, templateName, documents, customInstructions } = req.body;

    const docContext = (documents || [])
      .map((doc: any) => `- ${doc.title}: ${doc.fullText || doc.contentPreview || doc.summary || 'No content available.'}`)
      .join('\n');

    const prompt = `Report Title: ${title || 'Intelligence Brief'}
Report Type: ${templateName || 'Executive Briefing'}
Custom Focus: ${customInstructions || 'Comprehensive synthesis'}

Attached Documents Context:
${docContext || 'Entire repository knowledge'}`;

    const aiResult = await generateWithFallback({
      prompt,
      systemInstruction: `You are an elite government, legal, and financial intelligence report generator for Signal87 AI.
Generate a publication-grade report formatted in markdown with headers (#, ##, ###), bullet points, key metrics callouts, and citation footnotes ([1], [2]).
Maintain a neutral, authoritative, enterprise tone.`,
      model: 'gemini-2.5-flash',
      fallbackModel: 'gpt-4o',
      temperature: 0.2
    });

    return res.json({
      reportText: aiResult.text || 'Report generated successfully.',
      provider: aiResult.provider,
      fallbackTriggered: aiResult.fallbackTriggered,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in /api/reports/generate:', error);
    return res.status(500).json({ error: 'Report generation failed', details: error.message || String(error) });
  }
}
