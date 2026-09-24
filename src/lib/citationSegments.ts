/**
 * Sentence-level citations for Ask answers.
 *
 * The server returns answer text with [n] markers, where [n] is the nth
 * citation (src/lib/citations.ts renumbers them). To show clean prose while
 * keeping every fact traceable, the client splits each block of the answer into
 * sentences and records which citation numbers each sentence carries. Markers
 * are swapped for invisible sentinels so they survive inline markdown (bold,
 * italics) and can be rendered as hidden or visible superscripts in place.
 */
import { versionStem } from './retrieval';

/** A marker run's numbers, wrapped in private-use characters that never occur in answers. */
const SENTINEL_OPEN = '';
const SENTINEL_CLOSE = '';
export const SENTINEL_PATTERN = /([\d,]+)/g;

// Same rule as the server (src/lib/citations.ts): a run of [1]…[99] markers, "[1, 2]" or
// "[1][2]", allowed right after a word ("Perplexity[1][2]", the usual model style).
// Numbers start at 1, so "arr[0]" and "[2024]" are left alone. The spaces before a
// marker go with it, so hiding it leaves no " ." behind.
const MARKER_RUN = /[ \t]*(?<!\])((?:\[[1-9]\d?(?:\s*[,–-]\s*[1-9]\d?)*\])+)/g;

// "e.g.", "Inc.", "No. 5", "Jan. 5" and initials ("Michael R. Benezra") don't end a sentence.
const ABBREVIATION = /(?:^|[\s(])(?:e\.g|i\.e|etc|inc|ltd|llc|co|corp|mr|mrs|ms|dr|st|no|vs|jr|sr|approx|est|dept|fig|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|[a-z])$/i;

export interface Sentence {
  /** Sentence text; citation markers are sentinels (use stripSentinels for plain text). */
  text: string;
  /** Citation numbers (1-based) this sentence carries, in order of appearance. */
  cites: number[];
  /** Whitespace between sentences. Rendered as-is, never highlighted. */
  gap?: boolean;
}

/** Replaces [n] marker runs with sentinels, leaving inline code untouched. */
export function markSentinels(inline: string): string {
  return String(inline || '')
    .split(/(`[^`\n]*`)/g)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(MARKER_RUN, (_whole, run: string) => {
      const nums = (run.match(/\d{1,2}/g) || []).map(Number).filter((n) => n > 0);
      return nums.length ? `${SENTINEL_OPEN}${[...new Set(nums)].join(',')}${SENTINEL_CLOSE}` : '';
    })))
    .join('');
}

export function stripSentinels(text: string): string {
  return text.replace(SENTINEL_PATTERN, '');
}

function citesIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(SENTINEL_PATTERN)) {
    for (const n of m[1].split(',').map(Number)) if (n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

const count = (s: string, token: string) => s.split(token).length - 1;

/**
 * Splits one block of inline text (a paragraph, list item, heading or table
 * cell) into sentences, each with the citation numbers it carries. A marker
 * written after the full stop ("…$5M. [1] Next") still belongs to the sentence
 * before it.
 */
export function splitSentences(inline: string): Sentence[] {
  const text = markSentinels(inline);
  const out: Sentence[] = [];
  // End punctuation, closing quotes/brackets/emphasis, any markers, then whitespace.
  const boundary = /[.!?]+["'”’)\]*_]*(?:[\d,]+)*(\s+)/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = boundary.exec(text))) {
    const end = m.index + m[0].length - m[1].length;
    const next = text.slice(m.index + m[0].length);
    if (!next) break;
    // The next sentence must not start in lowercase ("approx. two weeks").
    if (/^[a-z]/.test(next)) continue;
    const before = text.slice(start, m.index);
    if (ABBREVIATION.test(before)) continue;
    // Never split inside bold or inline code.
    const sofar = text.slice(0, end);
    if (count(sofar, '**') % 2 === 1 || count(sofar, '`') % 2 === 1) continue;
    const sentence = text.slice(start, end);
    out.push({ text: sentence, cites: citesIn(sentence) });
    out.push({ text: m[1], cites: [], gap: true });
    start = m.index + m[0].length;
  }
  const rest = text.slice(start);
  if (rest) out.push({ text: rest, cites: citesIn(rest) });
  return out;
}

/**
 * Every sentence in a markdown answer with its citation numbers, markers
 * removed. Code blocks are skipped; list items and table cells are sentences
 * of their own. Used for tests and for anything that needs the mapping without
 * rendering.
 */
export function answerSentences(markdown: string): Array<{ text: string; cites: number[] }> {
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let inCode = false;
  const flush = () => { if (paragraph.length) blocks.push(paragraph.join(' ')); paragraph = []; };
  for (const raw of String(markdown || '').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('```')) { flush(); inCode = !inCode; continue; }
    if (inCode) continue;
    if (!line || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flush(); continue; }
    const heading = line.match(/^#+\s*(.*)/);
    const item = line.match(/^(?:[*\-+]|\d+\.)\s+(.*)/);
    if (heading || item) { flush(); blocks.push((heading || item)![1]); continue; }
    if (line.startsWith('|') && line.endsWith('|')) {
      flush();
      if (!/^\|[\s\-:|]+\|$/.test(line)) blocks.push(...line.split('|').slice(1, -1).map((c) => c.trim()));
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return blocks.flatMap((b) => splitSentences(b))
    .filter((s) => !s.gap && s.text.trim())
    .map((s) => ({ text: stripSentinels(s.text).trim(), cites: s.cites }));
}

export interface SourceChip { docId: string; docTitle: string; versions?: number }
export interface CitationRef { docId: string; docTitle: string; snippet?: string }

/**
 * For each source chip, the citation numbers it covers. Chips can collapse
 * several versions of a file into one (the server keeps the newest file's id),
 * so a citation of an older version matches its chip by version name.
 */
export function chipCitations(chips: SourceChip[], citations: CitationRef[]): number[][] {
  const out: number[][] = chips.map(() => []);
  citations.forEach((c, i) => {
    let k = chips.findIndex((chip) => chip.docId === c.docId);
    if (k < 0) {
      const stem = versionStem(c.docTitle);
      k = chips.findIndex((chip) => chip.docTitle === c.docTitle || (stem !== '' && versionStem(chip.docTitle) === stem));
    }
    if (k >= 0) out[k].push(i + 1);
  });
  return out;
}

/** The numbered "Sources" list for exports: "[1] Title" for citations, plus any uncited sources. */
export function exportSourceLines(citations: CitationRef[], chips: SourceChip[] = []): string[] {
  const lines = citations.map((c, i) => `[${i + 1}] ${c.docTitle}`);
  const covered = chipCitations(chips, citations);
  chips.forEach((chip, k) => {
    if (covered[k].length === 0 && !citations.some((c) => c.docId === chip.docId)) lines.push(`- ${chip.docTitle}`);
  });
  return lines;
}

/** Answer text for Copy and PDF: numbered markers kept, with a Sources list at the end. */
export function exportAnswerText(text: string, citations: CitationRef[] = [], chips: SourceChip[] = []): string {
  const body = String(text || '').trim();
  const lines = exportSourceLines(citations, chips);
  return lines.length ? `${body}\n\nSources\n${lines.join('\n')}` : body;
}

const normalize = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ');
const trimPunctuation = (s: string) => s.replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}%]+$/gu, '');

/**
 * A short phrase to pre-fill the document viewer's search so the cited passage
 * is highlighted. Taken from the snippet first, then from the sentence itself,
 * and only returned if it really occurs in the document's text (so the viewer
 * never opens on "No matches").
 */
export function findSearchPhrase(docText: string, sentence: string, snippet?: string): string {
  const hay = normalize(String(docText || '').slice(0, 400000));
  if (!hay) return '';
  const words = (s: string) => stripSentinels(s).replace(/\*+|`/g, '').replace(/\.{3}$|…$/, '').split(/\s+/).map(trimPunctuation).filter(Boolean);
  const windows = (ws: string[], size: number) => ws.length < size ? [] : ws.slice(0, ws.length - size + 1).map((_, i) => ws.slice(i, i + size).join(' '));
  const snippetWords = words(snippet || '');
  const sentenceWords = words(sentence);
  // Figures and names are the most distinctive things a sentence says.
  const figures = (stripSentinels(sentence).match(/\$?\d[\d,]*(?:\.\d+)?%?/g) || []).filter((f) => f.replace(/\D/g, '').length >= 3);
  const names = stripSentinels(sentence).match(/\b[A-Z][\w&'-]+(?:\s+[A-Z][\w&'-]+){1,3}\b/g) || [];
  const candidates = [
    ...windows(snippetWords, 5), ...windows(snippetWords, 4),
    ...windows(sentenceWords, 5), ...figures, ...names, ...windows(sentenceWords, 4)
  ];
  for (const c of candidates) {
    const phrase = trimPunctuation(c);
    if (phrase.length >= 4 && hay.includes(normalize(phrase))) return phrase;
  }
  return '';
}
