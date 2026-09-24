/**
 * Turns the model's citation markers and manifest into clean text plus a list
 * of cited documents.
 *
 * The model is asked for inline markers ([1], [2]) and a fenced
 * `citation_manifest` block mapping each marker to a source label ("DOCUMENT 2").
 * In practice it varies: it may fence the block as ```json, write objects like
 * {"1": "DOCUMENT 1"}, skip numbers, or leave the block unfenced. Previously any
 * variation left raw JSON in the answer and dropped the citations. This accepts
 * every shape seen so far, always removes the block, and renumbers the markers
 * so [1] is the first cited document, [2] the second, matching the sources shown.
 */
export interface ManifestEntry { marker?: number; source: string }
export interface CitedDoc { docId: string; docTitle: string; snippet?: string }

const SOURCE_LABEL = /^(DOCUMENT|INGESTED ACTIVE FILE)\s+\d+$/i;
const markerNumber = (value: unknown): number | undefined => {
  const m = String(value ?? '').match(/\d+/);
  return m ? Number(m[0]) : undefined;
};

/** Reads any manifest shape into { marker, source } entries. Returns null if it isn't a manifest. */
export function parseManifestValue(value: unknown): ManifestEntry[] | null {
  const out: ManifestEntry[] = [];
  const addPair = (marker: unknown, source: unknown) => {
    const s = String(source ?? '').trim();
    if (SOURCE_LABEL.test(s)) out.push({ marker: markerNumber(marker), source: s });
  };
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      if (typeof item === 'string') { addPair(i + 1, item); return; }
      if (!item || typeof item !== 'object') return;
      const o = item as Record<string, unknown>;
      if ('source' in o || 'label' in o || 'document' in o) { addPair(o.marker ?? o.id ?? o.index ?? i + 1, o.source ?? o.label ?? o.document); return; }
      for (const [k, v] of Object.entries(o)) addPair(k, v);
    });
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) addPair(k, v);
  } else {
    return null;
  }
  return out.length ? out : null;
}

/** Removes the manifest (fenced as citation_manifest, json, or nothing, or left unfenced at the end) and parses it. */
export function extractCitationManifest(text: string): { cleanedText: string; entries: ManifestEntry[] } {
  let cleaned = String(text || '');
  let entries: ManifestEntry[] = [];
  const fence = /```[ \t]*(citation_manifest|citations?|json|javascript)?[ \t]*\n?([\s\S]*?)```/gi;
  const blocks: Array<{ start: number; end: number; entries: ManifestEntry[] }> = [];
  let m: RegExpExecArray | null;
  while ((m = fence.exec(cleaned))) {
    const label = (m[1] || '').toLowerCase();
    let parsed: ManifestEntry[] | null = null;
    try { parsed = parseManifestValue(JSON.parse(m[2].trim())); } catch { parsed = null; }
    // A labelled manifest is always removed; a json/unlabelled block only if it really is a manifest.
    if (parsed || label.startsWith('citation')) blocks.push({ start: m.index, end: m.index + m[0].length, entries: parsed || [] });
  }
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (!entries.length && b.entries.length) entries = b.entries;
    cleaned = cleaned.slice(0, b.start) + cleaned.slice(b.end);
  }
  if (!blocks.length) {
    // Unfenced manifest at the very end: "citation_manifest: [ … ]" or just "[{…}]".
    const tail = cleaned.match(/(?:\n|^)[ \t]*(?:citation_manifest\s*:?\s*)?(\[[\s\S]*\]|\{[\s\S]*\})\s*$/i);
    if (tail && tail.index !== undefined && /DOCUMENT|INGESTED ACTIVE FILE/i.test(tail[1])) {
      try {
        const parsed = parseManifestValue(JSON.parse(tail[1]));
        if (parsed) { entries = parsed; cleaned = cleaned.slice(0, tail.index); }
      } catch { /* not JSON: leave the text alone */ }
    }
  }
  cleaned = cleaned.replace(/^[ \t]*citation_manifest\s*:?\s*$/gim, '');
  return { cleanedText: cleaned.replace(/\n{3,}/g, '\n\n').trim(), entries };
}

/**
 * Maps markers to documents and renumbers them in order of first appearance.
 * Markers that can't be tied to a document are removed (with the space before
 * them, so no stray " ." is left). `single` is the only source, used when the
 * model wrote markers without any manifest.
 */
export function applyCitations(
  text: string,
  entries: ManifestEntry[],
  resolve: (source: string) => CitedDoc | null,
  single: CitedDoc | null = null
): { text: string; citations: CitedDoc[] } {
  const byMarker = new Map<number, CitedDoc>();
  entries.forEach((e, i) => {
    const doc = resolve(e.source);
    if (doc) byMarker.set(e.marker ?? i + 1, doc);
  });
  const citations: CitedDoc[] = [];
  const indexOf = new Map<string, number>();
  const renumber = (prose: string) =>
    // [1]…[99] only (so "[2024]" is left alone), and not right after a word or bracket (so "arr[0]" is left alone).
    prose.replace(/[ \t]*(?<![\w\]])\[(\d{1,2}(?:\s*[,–-]\s*\d{1,2})*)\]/g, (whole, group: string) => {
      const nums = group.split(/\s*[,–-]\s*/).map(Number);
      const labels: number[] = [];
      for (const n of nums) {
        const doc = byMarker.get(n) ?? (entries.length === 0 && single ? single : undefined);
        if (!doc) continue;
        let k = indexOf.get(doc.docId);
        if (!k) { citations.push(doc); k = citations.length; indexOf.set(doc.docId, k); }
        if (!labels.includes(k)) labels.push(k);
      }
      // An unresolvable marker is dropped together with the space before it, so no " ." is left.
      if (!labels.length) return '';
      const lead = /^[ \t]/.test(whole) ? ' ' : '';
      return lead + labels.map((k) => `[${k}]`).join('');
    });
  // Leave code untouched: fenced blocks and inline code keep their brackets and spacing.
  const out = text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) => (i % 2 === 1 ? part : renumber(part)))
    .join('');
  return { text: out, citations: citations.slice(0, 10) };
}
