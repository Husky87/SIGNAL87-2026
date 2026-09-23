/**
 * Workspace retrieval for /api/chat.
 *
 * Before this module, every question sent the full text of the selected files
 * and the server kept only the first ~90k characters, in list order. With more
 * than a handful of files, most of the workspace was silently dropped and the
 * model answered from whatever happened to come first.
 *
 * Now: when everything fits, everything is sent (same as before). When it does
 * not, each document is split into passages, every passage in the workspace is
 * ranked against the question (BM25 plus title and phrase boosts), and only the
 * best passages are sent, grouped by document. Nothing here calls a model, so it
 * adds no latency or cost.
 */

export interface RetrievalDoc {
  id?: string;
  title?: string;
  summary?: string;
  fullText?: string;
  contentPreview?: string;
}

export interface RetrievalProfile {
  name?: string;
  email?: string;
}

export interface RetrievalOptions {
  question: string;
  /** Earlier user turns, newest last. Used to understand short follow-ups. */
  previousQuestions?: string[];
  profile?: RetrievalProfile;
  /** Character budget for document text in the prompt. */
  budgetChars: number;
  /** Per-document cap when everything fits and full text is sent. */
  maxDocChars: number;
  /**
   * Optional meaning-based similarity (cosine, roughly -1..1) for a passage, from
   * the embeddings index. Undefined for passages that are not indexed yet; those
   * are ranked by words alone.
   */
  semanticScore?: (doc: RetrievalDoc, passageIndex: number) => number | undefined;
}

export interface RetrievalStats {
  mode: 'full' | 'search' | 'overview' | 'empty';
  /** True when meaning-based (embedding) scores were used in ranking. */
  semantic?: boolean;
  searchedDocuments: number;
  searchedPassages: number;
  usedDocuments: number;
  usedPassages: number;
}

export interface RetrievalGroup {
  doc: RetrievalDoc;
  passages: Array<{ index: number; text: string }>;
  /** Number of passages the whole document has. */
  total: number;
}

export interface RetrievalResult {
  /** Documents that made it into the prompt, in the order they are labelled DOCUMENT 1, 2, … */
  contextDocs: RetrievalDoc[];
  /** The REPOSITORY DOCUMENTS section, or '' when there is nothing to send. */
  text: string;
  /** A compact list of every file in the workspace, so the model knows what exists. */
  workspaceIndex: string;
  /** The selected passages, grouped by document, in the same order as contextDocs. */
  groups: RetrievalGroup[];
  stats: RetrievalStats;
}

interface Passage {
  docIndex: number;
  passageIndex: number;
  text: string;
  tokens: string[];
  termFreq: Map<string, number>;
  score: number;
}

const PASSAGE_TARGET_CHARS = 1500;
const PASSAGE_OVERLAP_CHARS = 200;
const MAX_PASSAGES_PER_DOC_IN_PROMPT = 6;
const MAX_PASSAGES_IN_PROMPT = 28;
const MAX_INDEX_TITLES = 250;
const MAX_INDEX_CHARS = 7000;
/** Cosine similarity below this is treated as unrelated; at SEMANTIC_STRONG it counts fully. */
const SEMANTIC_FLOOR = 0.15;
const SEMANTIC_STRONG = 0.55;
const LEXICAL_WEIGHT = 0.45;
const MIN_BLENDED_SCORE = 0.12;

const STOPWORDS = new Set(
  (
    'a an and are as at be been being but by can could did do does doing for from had has have having he her hers him his how i if in into is it its ' +
    'just me more most my no nor not of off on once only or other our ours out over own same she should so some such than that the their theirs them ' +
    'then there these they this those through to too under until up very was we were what when where which while who whom why will with would you ' +
    'your yours about above after again against all am any because before below between both during each few further here itself myself ourselves ' +
    'themselves yourself yourselves tell show give find please documents document file files'
  ).split(/\s+/)
);

const SELF_REFERENCE = /\b(i|me|my|mine|myself|we|us|our|ours)\b/i;

export function docText(doc: RetrievalDoc): string {
  return String(doc.fullText || doc.contentPreview || doc.summary || '').trim();
}

/** Lowercased word tokens without stopwords. Keeps numbers, amounts and dates intact-ish. */
export function tokenize(text: string): string[] {
  const matches = String(text || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+(?:[.'][a-z0-9]+)*/g);
  if (!matches) return [];
  return matches.map((t) => t.replace(/'s$/, '')).filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Splits text into ~1.5k-character passages on paragraph and sentence boundaries, with a small overlap. */
export function splitIntoPassages(text: string): string[] {
  const clean = String(text || '').replace(/\r/g, '').trim();
  if (!clean) return [];
  if (clean.length <= PASSAGE_TARGET_CHARS) return [clean];

  const units: string[] = [];
  for (const para of clean.split(/\n{2,}/)) {
    const p = para.trim();
    if (!p) continue;
    if (p.length <= PASSAGE_TARGET_CHARS) { units.push(p); continue; }
    // Long paragraph: break on sentences, then hard-wrap anything still too long.
    const sentences = p.split(/(?<=[.!?;])\s+(?=[A-Z0-9"(])/);
    for (const s of sentences) {
      if (s.length <= PASSAGE_TARGET_CHARS) units.push(s);
      else for (let i = 0; i < s.length; i += PASSAGE_TARGET_CHARS) units.push(s.slice(i, i + PASSAGE_TARGET_CHARS));
    }
  }

  const passages: string[] = [];
  let current = '';
  for (const unit of units) {
    if (current && current.length + unit.length + 2 > PASSAGE_TARGET_CHARS) {
      passages.push(current);
      const tail = current.slice(-PASSAGE_OVERLAP_CHARS);
      const cut = tail.search(/\s/);
      current = (cut >= 0 ? tail.slice(cut + 1) : tail) + '\n\n' + unit;
    } else {
      current = current ? `${current}\n\n${unit}` : unit;
    }
  }
  if (current) passages.push(current);
  return passages;
}

/** Builds the weighted query: the question, the user's name for "I/my" questions, and a lighter echo of the previous question for short follow-ups. */
function buildQuery(options: RetrievalOptions): Map<string, number> {
  const weights = new Map<string, number>();
  const add = (text: string, weight: number) => {
    for (const token of tokenize(text)) weights.set(token, Math.max(weights.get(token) || 0, weight));
  };
  add(options.question, 1);
  const name = options.profile?.name?.trim();
  if (name && SELF_REFERENCE.test(options.question)) add(name, 1);
  const prior = (options.previousQuestions || []).filter(Boolean);
  if (prior.length && tokenize(options.question).length < 8) add(prior[prior.length - 1], 0.5);
  return weights;
}

function termFrequencies(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

export function renderDocuments(groups: RetrievalGroup[], showPassageLabels: boolean): string {
  const blocks = groups.map((group, i) => {
    const n = i + 1;
    const title = group.doc.title || 'Untitled';
    const body = showPassageLabels
      ? group.passages.map((p) => `[Passage ${p.index + 1} of ${group.total}]\n${p.text}`).join('\n\n')
      : group.passages.map((p) => p.text).join('\n\n');
    return `--- DOCUMENT ${n}: ${title} ---\n${body}\n--- END DOCUMENT ${n} ---`;
  });
  return blocks.length ? `REPOSITORY DOCUMENTS:\n${blocks.join('\n\n')}` : '';
}

export function buildWorkspaceIndex(docs: RetrievalDoc[]): string {
  if (docs.length === 0) return '';
  const titles: string[] = [];
  let used = 0;
  for (const doc of docs.slice(0, MAX_INDEX_TITLES)) {
    const title = String(doc.title || 'Untitled').slice(0, 120);
    if (used + title.length > MAX_INDEX_CHARS) break;
    titles.push(`- ${title}`);
    used += title.length + 3;
  }
  const more = docs.length - titles.length;
  return `WORKSPACE FILES (${docs.length} readable file${docs.length === 1 ? '' : 's'} in total; the passages above were selected from all of them):\n${titles.join('\n')}${more > 0 ? `\n- …and ${more} more` : ''}`;
}

export function retrieveContext(docs: RetrievalDoc[], options: RetrievalOptions): RetrievalResult {
  const readable = docs.filter((d) => docText(d).length > 0);
  const empty: RetrievalResult = {
    contextDocs: [],
    text: '',
    workspaceIndex: '',
    groups: [],
    stats: { mode: 'empty', searchedDocuments: 0, searchedPassages: 0, usedDocuments: 0, usedPassages: 0 }
  };
  if (readable.length === 0) return empty;

  // 1. Everything fits: send full text, exactly as before.
  const lengths = readable.map((d) => Math.min(docText(d).length, options.maxDocChars));
  const totalChars = lengths.reduce((a, b) => a + b, 0);
  if (totalChars <= options.budgetChars) {
    const groups = readable.map((doc) => {
      const text = docText(doc);
      const body = text.length <= options.maxDocChars ? text : `${text.slice(0, options.maxDocChars)}\n\n[Document truncated. Use only the supplied portion.]`;
      return { doc, passages: [{ index: 0, text: body }], total: 1 };
    });
    return {
      contextDocs: readable,
      text: renderDocuments(groups, false),
      workspaceIndex: '',
      groups,
      stats: { mode: 'full', searchedDocuments: readable.length, searchedPassages: readable.length, usedDocuments: readable.length, usedPassages: readable.length }
    };
  }

  // 2. Too much to send: split into passages and rank every one against the question.
  const passages: Passage[] = [];
  const passageCounts: number[] = [];
  readable.forEach((doc, docIndex) => {
    const parts = splitIntoPassages(docText(doc));
    passageCounts[docIndex] = parts.length;
    parts.forEach((text, passageIndex) => {
      const tokens = tokenize(text);
      passages.push({ docIndex, passageIndex, text, tokens, termFreq: termFrequencies(tokens), score: 0 });
    });
  });

  const query = buildQuery(options);
  const N = passages.length;
  const avgLen = passages.reduce((a, p) => a + p.tokens.length, 0) / Math.max(1, N) || 1;
  const docFreq = new Map<string, number>();
  for (const term of query.keys()) {
    let df = 0;
    for (const p of passages) if (p.termFreq.has(term)) df++;
    docFreq.set(term, df);
  }
  const idf = (term: string) => {
    const df = docFreq.get(term) || 0;
    return Math.log(1 + (N - df + 0.5) / (df + 0.5));
  };

  const titleTokens = readable.map((d) => new Set(tokenize(d.title || '')));
  const queryTerms = [...query.keys()];
  const bigrams: string[] = [];
  const questionTokens = tokenize(options.question);
  for (let i = 0; i < questionTokens.length - 1; i++) bigrams.push(`${questionTokens[i]} ${questionTokens[i + 1]}`);

  const k1 = 1.2;
  const b = 0.75;
  for (const p of passages) {
    let score = 0;
    for (const term of queryTerms) {
      const tf = p.termFreq.get(term) || 0;
      if (!tf) continue;
      const norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * (p.tokens.length / avgLen)));
      score += (query.get(term) || 1) * idf(term) * norm;
      if (titleTokens[p.docIndex].has(term)) score += 0.6 * idf(term);
    }
    if (score > 0 && bigrams.length) {
      const joined = ` ${p.tokens.join(' ')} `;
      for (const bg of bigrams) if (joined.includes(` ${bg} `)) score += 1.5;
    }
    // Title-only matches still deserve a look at the document's opening.
    if (score === 0 && p.passageIndex === 0) {
      for (const term of queryTerms) if (titleTokens[p.docIndex].has(term)) score += 0.8 * idf(term);
    }
    p.score = score;
  }

  // Blend in meaning-based similarity where the passage is indexed. Words keep
  // exact names and figures precise; meaning finds passages that use other words.
  let semanticUsed = false;
  if (options.semanticScore) {
    const lexMax = Math.max(0, ...passages.map((p) => p.score)) || 1;
    for (const p of passages) {
      const sim = options.semanticScore(readable[p.docIndex], p.passageIndex);
      const lex = p.score / lexMax;
      if (sim === undefined || !Number.isFinite(sim)) { p.score = lex > 0 ? lex * 0.8 : 0; continue; }
      semanticUsed = true;
      const meaning = Math.max(0, Math.min(1, (sim - SEMANTIC_FLOOR) / (SEMANTIC_STRONG - SEMANTIC_FLOOR)));
      p.score = LEXICAL_WEIGHT * lex + (1 - LEXICAL_WEIGHT) * meaning;
      if (p.score < MIN_BLENDED_SCORE) p.score = 0;
    }
  }

  const ranked = passages.filter((p) => p.score > 0).sort((a, b2) => b2.score - a.score);

  const select = (candidates: Passage[]): Passage[] => {
    const chosen: Passage[] = [];
    const perDoc = new Map<number, number>();
    let used = 0;
    for (const p of candidates) {
      if (chosen.length >= MAX_PASSAGES_IN_PROMPT) break;
      const count = perDoc.get(p.docIndex) || 0;
      if (count >= MAX_PASSAGES_PER_DOC_IN_PROMPT) continue;
      if (used + p.text.length > options.budgetChars) continue;
      chosen.push(p);
      perDoc.set(p.docIndex, count + 1);
      used += p.text.length;
    }
    return chosen;
  };

  let mode: RetrievalStats['mode'] = 'search';
  let chosen = select(ranked);
  if (chosen.length === 0) {
    // Nothing matched (e.g. "summarize everything"): give the opening of each file instead.
    mode = 'overview';
    chosen = select(passages.filter((p) => p.passageIndex === 0));
  }

  // Group by document, strongest document first; passages in reading order inside each.
  const bestByDoc = new Map<number, number>();
  for (const p of chosen) bestByDoc.set(p.docIndex, Math.max(bestByDoc.get(p.docIndex) || 0, p.score));
  const docOrder = [...bestByDoc.keys()].sort((a, c) => (bestByDoc.get(c) || 0) - (bestByDoc.get(a) || 0) || a - c);
  const groups = docOrder.map((docIndex) => ({
    doc: readable[docIndex],
    passages: chosen
      .filter((p) => p.docIndex === docIndex)
      .sort((a, c) => a.passageIndex - c.passageIndex)
      .map((p) => ({ index: p.passageIndex, text: p.text })),
    total: passageCounts[docIndex]
  }));

  return {
    contextDocs: groups.map((g) => g.doc),
    text: renderDocuments(groups, true),
    workspaceIndex: buildWorkspaceIndex(readable),
    groups,
    stats: {
      mode,
      semantic: semanticUsed,
      searchedDocuments: readable.length,
      searchedPassages: passages.length,
      usedDocuments: groups.length,
      usedPassages: chosen.length
    }
  };
}
