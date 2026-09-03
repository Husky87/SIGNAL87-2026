import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithFallback } from '../src/lib/aiFallbackService.js';

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
    const { documentText, documentTitle, documentType } = req.body;

    if (!documentText || documentText.trim().length === 0) {
      return res.status(400).json({ error: 'Document text is required' });
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
      model: 'gemini-3.6-flash',
      fallbackModel: 'gpt-4o',
      temperature: 0.3
    });

    return res.json({
      summary: (aiResult.text || '').trim() || 'Summary generation in progress.',
      provider: aiResult.provider,
      fallbackTriggered: aiResult.fallbackTriggered
    });
  } catch (error: any) {
    console.error('Error in /api/summarize:', error);
    return res.status(500).json({
      error: 'Summary generation failed',
      details: error.message || String(error)
    });
  }
}
