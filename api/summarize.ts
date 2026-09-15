import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithFallback } from '../src/lib/aiFallbackService.js';
import { requireFirebaseUser } from '../src/lib/firebaseAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method Not Allowed' }); }
  try { await requireFirebaseUser(req.headers.authorization); } catch (error: any) { return res.status(401).json({ error: 'Unauthorized', details: error?.message || 'Valid Firebase ID token required' }); }
  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'AI service is not configured', details: 'OPENAI_API_KEY or GEMINI_API_KEY is required' });
  try {
    const { documentText, documentTitle, documentType } = req.body;
    if (!documentText || documentText.trim().length === 0) return res.status(400).json({ error: 'Document text is required' });
    const maxLength = 3000; const truncatedText = documentText.length > maxLength ? documentText.substring(0, maxLength) + '...' : documentText;
    const aiResult = await generateWithFallback({ model: 'gpt-4o', fallbackModel: 'gemini-3.6-flash', prompt: `You are a professional document analyst. Generate a thorough, high-quality executive summary for the following ${documentType || 'document'}.\n\nDocument Title: ${documentTitle || 'Untitled'}\n\nDocument Content:\n${truncatedText}\n\nRequirements: 2-4 sentences; extract critical information and takeaways; highlight risks, decisions, or action items; use professional executive language; use only supplied content. Generate only the summary text.`, systemInstruction: 'You are an expert document summarization system for Signal87 AI. Use only the supplied source content and clearly acknowledge when the source does not establish a claim.', temperature: 0.3 });
    return res.json({ summary: (aiResult.text || '').trim() || 'Summary generation in progress.', provider: aiResult.provider, fallbackTriggered: aiResult.fallbackTriggered });
  } catch (error: any) { console.error('Error in /api/summarize:', error); return res.status(500).json({ error: 'Summary generation failed', details: error.message || String(error) }); }
}
