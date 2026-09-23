import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseUser } from '../src/lib/firebaseAuth.js';
import { EMBEDDING_DIMS, EMBEDDING_MODEL, packVector } from '../src/lib/vectorCodec.js';

/**
 * Turns passages (or a question) into compact embedding vectors for meaning-based
 * search. The browser stores document vectors in the user's own Firestore space
 * and ranks passages locally, so only this step needs the OpenAI key.
 */
const MAX_TEXTS = 96;
const MAX_CHARS_PER_TEXT = 6000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method Not Allowed' }); }
  try { await requireFirebaseUser(req.headers.authorization); } catch (error: any) {
    return res.status(401).json({ error: 'Unauthorized', details: error?.message || 'Valid Firebase ID token required' });
  }
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return res.status(503).json({ error: 'Embeddings unavailable', details: 'OPENAI_API_KEY is not configured' });

  const texts: unknown = req.body?.texts;
  if (!Array.isArray(texts) || texts.length === 0) return res.status(400).json({ error: 'texts must be a non-empty array' });
  if (texts.length > MAX_TEXTS) return res.status(400).json({ error: `At most ${MAX_TEXTS} texts per request` });
  const input = texts.map((t) => String(t ?? '').slice(0, MAX_CHARS_PER_TEXT) || ' ');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input, dimensions: EMBEDDING_DIMS }),
      signal: controller.signal
    }).finally(() => clearTimeout(timer));
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      return res.status(502).json({ error: 'Embedding request failed', details: `HTTP ${response.status} ${detail}` });
    }
    const data = await response.json() as { data?: Array<{ index: number; embedding: number[] }> };
    const rows = (data.data || []).slice().sort((a, b) => a.index - b.index);
    if (rows.length !== input.length) return res.status(502).json({ error: 'Embedding response was incomplete' });
    return res.json({ model: EMBEDDING_MODEL, dims: EMBEDDING_DIMS, vectors: rows.map((r) => packVector(r.embedding)) });
  } catch (error: any) {
    return res.status(502).json({ error: 'Embedding request failed', details: error?.name === 'AbortError' ? 'timed out' : String(error?.message || error) });
  }
}
