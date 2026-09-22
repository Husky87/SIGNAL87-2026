import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithFallback } from '../src/lib/aiFallbackService.js';
import { requireFirebaseUser } from '../src/lib/firebaseAuth.js';

const MAX_DOCS = 5;
const MAX_CHARS_PER_DOC = 30000;
const LIST_KEYS = ['similarities', 'differences', 'missingClauses', 'conflicts', 'repeatedLanguage', 'riskTrends'] as const;

// Flattens whatever the model returned (string, object, list of objects) to text.
function toText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => { const t = toText(v); return t ? `${k}: ${t}` : ''; })
      .filter(Boolean)
      .join('; ');
  }
  return '';
}

// Every list section is returned as an array of strings, whatever the model sent.
function toList(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(toText).filter(Boolean);
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => { const t = toText(v); return t ? `${k}: ${t}` : ''; })
      .filter(Boolean);
  }
  return [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method Not Allowed' }); }
  try { await requireFirebaseUser(req.headers.authorization); } catch (error: any) { return res.status(401).json({ error: 'Unauthorized', details: error?.message || 'Valid Firebase ID token required' }); }
  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'AI service is not configured', details: 'OPENAI_API_KEY or GEMINI_API_KEY is required' });
  try {
    const { documents } = req.body || {};
    if (!documents || !Array.isArray(documents) || documents.length < 2) return res.status(400).json({ error: 'At least 2 documents are required for comparison' });
    if (documents.length > MAX_DOCS) return res.status(400).json({ error: `Compare up to ${MAX_DOCS} documents at a time` });

    const formattedDocs = documents.map((doc: any, idx: number) => {
      const body = String(doc?.fullText || doc?.contentPreview || doc?.summary || 'No content available.').slice(0, MAX_CHARS_PER_DOC);
      return `DOCUMENT ${idx + 1}: ${doc?.title || 'Untitled'}\n${body}`;
    }).join('\n\n');

    const aiResult = await generateWithFallback({
      model: 'gpt-4o',
      fallbackModel: 'gemini-3.6-flash',
      prompt: `Compare the following ${documents.length} documents:\n\n${formattedDocs}`,
      systemInstruction: `You are a multi-document legal, financial, and policy comparative analyst for Signal87 AI. Use only the supplied documents. Do not invent facts, clauses, conflicts, dates, figures, or risks. If something cannot be established from the documents, say so.
Return one JSON object with exactly these keys:
- "summary": a string of 2-4 sentences.
- "similarities", "differences", "missingClauses", "conflicts", "repeatedLanguage", "riskTrends": each an array of plain strings (one finding per string, naming the documents involved). Use [] when there is nothing to report.
Do not nest objects or arrays inside the lists.`,
      temperature: 0.1,
      maxOutputTokens: 2500,
      timeoutMs: 55000,
      responseMimeType: 'application/json'
    });

    let raw: any;
    try { raw = JSON.parse(aiResult.text || '{}'); } catch { raw = { summary: aiResult.text }; }
    const result: Record<string, unknown> = { summary: toText(raw?.summary) || 'No summary was returned.' };
    for (const key of LIST_KEYS) result[key] = toList(raw?.[key]);

    return res.json({ ...result, _provider: aiResult.provider, _fallbackTriggered: aiResult.fallbackTriggered });
  } catch (error: any) { console.error('Error in /api/compare:', error); return res.status(500).json({ error: 'Multi-doc comparison failed', details: error.message || String(error) }); }
}
