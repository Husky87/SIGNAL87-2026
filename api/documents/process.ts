import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithFallback } from '../../src/lib/aiFallbackService.js';
import { requireFirebaseUser } from '../../src/lib/firebaseAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method Not Allowed' }); }
  try { await requireFirebaseUser(req.headers.authorization); } catch (error: any) { return res.status(401).json({ error: 'Unauthorized', details: error?.message || 'Valid Firebase ID token required' }); }
  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'AI service is not configured', details: 'OPENAI_API_KEY or GEMINI_API_KEY is required' });
  try {
    const { title, textContent } = req.body; if (!title) return res.status(400).json({ error: 'Document title is required' });
    const prompt = `Analyze this uploaded document titled "${title}":\n\n${textContent || 'Standard document text'}`;
    const aiResult = await generateWithFallback({ model: 'gpt-4o', fallbackModel: 'gemini-3.6-flash', prompt, systemInstruction: `Extract a concise 2-sentence executive summary, 4 key entities with types, and 2 risk highlights in JSON format. Use only information present in the supplied document text. Never invent facts, figures, entities, or risks.\n{\n  "summary": "...",\n  "entities": [{"name": "...", "type": "Company|Person|Location|Law|Amount|Policy", "relevance": 90}],\n  "riskHighlights": ["...", "..."],\n  "suggestedTags": ["...", "..."]\n}`, temperature: 0.1, responseMimeType: 'application/json' });
    let jsonResult: any = {}; try { jsonResult = JSON.parse(aiResult.text || '{}'); } catch { jsonResult = { summary: 'Document analysis did not return valid structured data.', entities: [], riskHighlights: [], suggestedTags: [] }; }
    return res.json({ ...jsonResult, provider: aiResult.provider, fallbackTriggered: aiResult.fallbackTriggered });
  } catch (error: any) { console.error('Error in /api/documents/process:', error); return res.status(500).json({ error: 'Document processing failed', details: error.message || String(error) }); }
}
