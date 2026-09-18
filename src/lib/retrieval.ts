/**
 * Chunk + embed + rank retrieval, replacing "concatenate every document in
 * array order until a character ceiling truncates the rest" (the mechanism
 * behind the Rockland Trust/Verizon bug documented in
 * docs/phase-0-audit.md, test A1b). Selection is now by relevance to the
 * question, not by position in the request.
 *
 * Never a hard dependency: any failure (no OPENAI_API_KEY, network error,
 * malformed response) resolves usedRetrieval=false so the caller can fall
 * back to the previous blind-concatenation behavior rather than breaking
 * a chat request that used to work.
 */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHUNK_CHARS = 1500;
const CHUNK_OVERLAP_CHARS = 150;
/** Hard cap on chunks embedded in one request — bounds worst-case cost/latency
 *  for very large document libraries. ~400 * 1500 chars = ~600,000 chars of
 *  raw corpus considered, well beyond the old 90k/120k hard ceilings. */
const MAX_CHUNKS_PER_REQUEST = 400;
const EMBEDDING_TIMEOUT_MS = 20000;

export interface RetrievalSource {
  /** Stable identifier for reporting which sources were included/omitted. */
  key: string;
  title: string;
  fullText: string;
}

export interface RetrievalOutcome {
  usedRetrieval: boolean;
  fallbackReason?: string;
  /** source key -> selected body text (chunks in original order; may be a subset of fullText) */
  selectedText: Map<string, string>;
  /** source keys where only some chunks were selected (the rest exist but were not relevant enough to fit) */
  partialKeys: Set<string>;
}

function chunkText(text: string, key: string): Array<{ key: string; index: number; text: string }> {
  if (text.length <= CHUNK_CHARS) return [{ key, index: 0, text }];
  const chunks: Array<{ key: string; index: number; text: string }> = [];
  let start = 0;
  let index = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_CHARS, text.length);
    chunks.push({ key, index, text: text.slice(start, end) });
    index++;
    if (end >= text.length) break;
    start = end - CHUNK_OVERLAP_CHARS;
  }
  return chunks;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function embed(inputs: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing.');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs }),
      signal: controller.signal
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`OpenAI embeddings call failed [HTTP ${response.status}]: ${detail}`);
    }
    const data = await response.json();
    const rows: Array<{ embedding: number[]; index: number }> = data.data || [];
    if (rows.length !== inputs.length) throw new Error(`Embeddings response length mismatch: expected ${inputs.length}, got ${rows.length}`);
    const ordered = new Array<number[]>(inputs.length);
    for (const row of rows) ordered[row.index] = row.embedding;
    return ordered;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function retrieveRelevantChunks(query: string, sources: RetrievalSource[], maxTotalChars: number): Promise<RetrievalOutcome> {
  const empty: RetrievalOutcome = { usedRetrieval: false, selectedText: new Map(), partialKeys: new Set() };
  if (!process.env.OPENAI_API_KEY) return { ...empty, fallbackReason: 'OPENAI_API_KEY is not configured; falling back to full-context mode.' };
  if (sources.length === 0) return { usedRetrieval: true, selectedText: new Map(), partialKeys: new Set() };

  try {
    let allChunks = sources.flatMap((s) => chunkText(s.fullText, s.key));
    let corpusTruncated = false;
    if (allChunks.length > MAX_CHUNKS_PER_REQUEST) {
      allChunks = allChunks.slice(0, MAX_CHUNKS_PER_REQUEST);
      corpusTruncated = true;
    }

    const embeddings = await embed([query, ...allChunks.map((c) => c.text)]);
    const queryVec = embeddings[0];
    const chunkVecs = embeddings.slice(1);

    const scored = allChunks.map((c, i) => ({ ...c, score: cosineSimilarity(queryVec, chunkVecs[i]) }));
    scored.sort((a, b) => b.score - a.score);

    const selectedChunkKeys = new Set<string>();
    let usedChars = 0;
    for (const chunk of scored) {
      if (usedChars >= maxTotalChars) break;
      selectedChunkKeys.add(`${chunk.key}::${chunk.index}`);
      usedChars += chunk.text.length;
    }

    const selectedText = new Map<string, string>();
    const partialKeys = new Set<string>();
    for (const source of sources) {
      const sourceChunks = allChunks.filter((c) => c.key === source.key);
      if (sourceChunks.length === 0) continue; // fully cut by MAX_CHUNKS_PER_REQUEST corpus cap
      const kept = sourceChunks.filter((c) => selectedChunkKeys.has(`${c.key}::${c.index}`));
      if (kept.length === 0) continue; // no chunk from this source was relevant enough to fit
      const body = kept.map((c) => c.text).join('\n[...]\n');
      selectedText.set(source.key, body);
      if (kept.length < sourceChunks.length) partialKeys.add(source.key);
    }
    if (corpusTruncated) for (const s of sources) if (!allChunks.some((c) => c.key === s.key)) partialKeys.add(s.key);

    return { usedRetrieval: true, selectedText, partialKeys };
  } catch (err: any) {
    return { ...empty, fallbackReason: err?.message || String(err) };
  }
}
