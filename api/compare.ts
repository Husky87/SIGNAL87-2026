import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithFallback } from '../src/lib/aiFallbackService.js';
import { requireFirebaseUser } from '../src/lib/firebaseAuth.js';

// Comparison needs each document present as a whole (or a clearly-labeled
// excerpt of one), not relevance-ranked snippets — unlike chat/research,
// dropping a document here isn't the right failure mode. Previously there
// was no ceiling at all (docs/phase-0-audit.md §1.2 row 7, test B6),
// risking a hard rejection from the model once documents got large enough
// to exceed its actual context window. A fair per-document share, openly
// disclosed when it truncates, keeps every document represented instead.
const MAX_COMPARE_TOTAL_CHARS = 300_000;

function fairShareTruncate(text: string, maxChars: number): { body: string; truncated: boolean } {
  if (text.length <= maxChars) return { body: text, truncated: false };
  return { body: `${text.slice(0, maxChars)}\n[TRUNCATED — this document exceeds its fair share of this comparison's length budget; only the portion above was analyzed.]`, truncated: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method Not Allowed' }); }
  try { await requireFirebaseUser(req.headers.authorization); } catch (error: any) { return res.status(401).json({ error: 'Unauthorized', details: error?.message || 'Valid Firebase ID token required' }); }
  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'AI service is not configured', details: 'OPENAI_API_KEY or GEMINI_API_KEY is required' });
  try {
    const { documents } = req.body; if (!documents || !Array.isArray(documents) || documents.length < 2) return res.status(400).json({ error: 'At least 2 documents are required for comparison' });
    const perDocShare = Math.floor(MAX_COMPARE_TOTAL_CHARS / documents.length);
    const truncatedTitles: string[] = [];
    const formattedDocs = documents.map((doc: any, idx: number) => {
      const raw = doc.fullText || doc.contentPreview || doc.summary || 'No content available.';
      const { body, truncated } = fairShareTruncate(raw, perDocShare);
      if (truncated) truncatedTitles.push(doc.title || `Document ${idx + 1}`);
      return `DOCUMENT ${idx + 1}: ${doc.title}\n${body}`;
    }).join('\n\n');
    const truncationNotice = truncatedTitles.length ? `\n\nNOTE: the following documents were too long to include in full and were truncated to a fair share of this comparison's length budget — treat any finding about them as based only on the included portion, and say so if asked: ${truncatedTitles.join(', ')}.` : '';
    const aiResult = await generateWithFallback({ model: 'gpt-4o', fallbackModel: 'gemini-3.6-flash', prompt: `Compare the following ${documents.length} documents in detail:\n\n${formattedDocs}${truncationNotice}`, systemInstruction: `You are a multi-document legal, financial, and policy comparative analyst for Signal87 AI. Use only the supplied documents. Do not invent facts, clauses, conflicts, dates, figures, or risks. If something cannot be established from the documents, say so.\nProvide JSON with: summary, similarities, differences, missingClauses, conflicts, repeatedLanguage, riskTrends.`, temperature: 0.1, responseMimeType: 'application/json' });
    let jsonResult: any; try { jsonResult = JSON.parse(aiResult.text || '{}'); } catch { jsonResult = { summary: aiResult.text, similarities: [], differences: [], missingClauses: [], conflicts: [], repeatedLanguage: [], riskTrends: [] }; }
    return res.json({ ...jsonResult, _provider: aiResult.provider, _fallbackTriggered: aiResult.fallbackTriggered, _truncatedDocuments: truncatedTitles });
  } catch (error: any) { console.error('Error in /api/compare:', error); return res.status(500).json({ error: 'Multi-doc comparison failed', details: error.message || String(error) }); }
}
