/**
 * Finds which of the documents sent to the model an answer actually drew on.
 *
 * The model is asked to cite with [1], [2] and a citation_manifest, but it does
 * not always do so. When it doesn't, the answer would show no sources at all.
 * This looks for the answer's distinctive details (names, figures, dates,
 * uncommon words) inside each document and returns the documents that clearly
 * contain them. It never guesses: a document needs several distinct matches.
 */

const COMMON_CAPITALIZED = new Set(
  (
    'the a an and or but if then this that these those he she it they we you i his her its their our your my ' +
    'in on at by for from to of with as is are was were be been has have had do does did will would can could ' +
    'should may might must also however overall here there what which who when where why how yes no not ' +
    'january february march april may june july august september october november december ' +
    'monday tuesday wednesday thursday friday saturday sunday want would like let sure based according generally'
  ).split(/\s+/)
);

export interface AttributionDoc {
  id?: string;
  title?: string;
  fullText?: string;
  contentPreview?: string;
  summary?: string;
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, "'");

/** Names, figures, dates and long words from the answer that would only match a document that really says them. */
export function distinctiveTerms(answer: string): string[] {
  const text = answer.replace(/```[\s\S]*?```/g, ' ').replace(/\[\d+(?:\s*,\s*\d+)*\]/g, ' ');
  const terms = new Set<string>();

  // Figures: $4,250,000 / 9.5% / 2026 / 110 → compared without $ and commas.
  for (const m of text.match(/\$?\d[\d,]*(?:\.\d+)?%?/g) || []) {
    const n = m.replace(/[$,%]/g, '');
    if (n.replace(/\D/g, '').length >= 2) terms.add(n);
  }
  // Capitalized words that are not sentence openers or common words (names, companies, places).
  for (const m of text.match(/(?<![.!?]\s)(?<!^)\b[A-Z][a-zA-Z0-9&'-]{2,}/gm) || []) {
    const w = normalize(m);
    if (!COMMON_CAPITALIZED.has(w)) terms.add(w);
  }
  // Long, uncommon words.
  for (const m of text.match(/\b[a-zA-Z]{9,}\b/g) || []) terms.add(normalize(m));
  return [...terms];
}

/** Indices of documents that contain enough of the answer's distinctive terms, strongest first (max 5). */
export function attributeSources(answer: string, docs: AttributionDoc[]): number[] {
  const terms = distinctiveTerms(answer);
  if (terms.length === 0 || docs.length === 0) return [];
  const scores = docs.map((doc) => {
    const hay = normalize(String(doc.fullText || doc.contentPreview || doc.summary || '')).replace(/,/g, '');
    let hits = 0;
    for (const t of terms) if (hay.includes(t)) hits++;
    return hits;
  });
  const best = Math.max(...scores);
  if (best < 2) return [];
  return scores
    .map((score, index) => ({ score, index }))
    .filter((s) => s.score >= 2 && s.score >= best * 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.index);
}
