/** Citation manifests in every shape the model produces: never shown raw, markers match the sources. */
import assert from 'node:assert/strict';
import { applyCitations, extractCitationManifest } from '../src/lib/citations';

const docs: Record<string, { docId: string; docTitle: string }> = {
  'DOCUMENT 1': { docId: 'a', docTitle: 'Resume.pdf' },
  'DOCUMENT 2': { docId: 'b', docTitle: 'Bio.pdf' },
  'DOCUMENT 3': { docId: 'c', docTitle: 'LinkedIn.pdf' },
  'DOCUMENT 5': { docId: 'e', docTitle: 'Award.pdf' }
};
const resolve = (s: string) => docs[s.toUpperCase()] || null;

// 1. The shape from the screenshot: ```json fence, [{"1":"DOCUMENT 1"}, …], marker 4 skipped.
{
  const raw = 'He founded Signal87 [1]. He studied at Harvard [2] and Washington [3]. He was a 40 Under 40 honoree [5].\n\n```json\n[\n  {"1": "DOCUMENT 1"},\n  {"2": "DOCUMENT 2"},\n  {"3": "DOCUMENT 3"},\n  {"5": "DOCUMENT 5"}\n]\n```';
  const { cleanedText, entries } = extractCitationManifest(raw);
  assert.ok(!cleanedText.includes('```') && !cleanedText.includes('DOCUMENT'), 'manifest removed from the answer');
  const { text, citations } = applyCitations(cleanedText, entries, resolve);
  assert.equal(citations.length, 4);
  assert.ok(text.includes('honoree [4].'), 'skipped marker 5 renumbered to 4 so it matches the 4th source');
}

// 2. The requested format still works.
{
  const r = extractCitationManifest('X [1].\n```citation_manifest\n[{"marker":"[1]","source":"DOCUMENT 2"}]\n```');
  const { text, citations } = applyCitations(r.cleanedText, r.entries, resolve);
  assert.equal(text, 'X [1].');
  assert.equal(citations[0].docId, 'b');
}

// 3. Unfenced manifest at the end, and a plain object map.
{
  const r = extractCitationManifest('Y [2].\ncitation_manifest: {"1": "DOCUMENT 1", "2": "DOCUMENT 3"}');
  assert.equal(r.cleanedText, 'Y [2].');
  const { text, citations } = applyCitations(r.cleanedText, r.entries, resolve);
  assert.equal(text, 'Y [1].');
  assert.equal(citations[0].docId, 'c');
}

// 4. Unresolvable markers disappear without leaving " ."; ordinary JSON code in an answer is left alone.
{
  const { text } = applyCitations('Estate [9]. Done [1].', [{ marker: 1, source: 'DOCUMENT 1' }], resolve);
  assert.equal(text, 'Estate. Done [1].');
  const code = 'Here is the config:\n```json\n{"retries": 3}\n```';
  assert.equal(extractCitationManifest(code).cleanedText, code, 'non-manifest JSON stays');
}

// 5. Same document cited twice under different markers → one source, one number.
{
  const { text, citations } = applyCitations('A [1]. B [2].', [{ marker: 1, source: 'DOCUMENT 1' }, { marker: 2, source: 'DOCUMENT 1' }], resolve);
  assert.equal(citations.length, 1);
  assert.equal(text, 'A [1]. B [1].');
}
// 6. Regressions: years, array indexes, question marks and code are not touched.
{
  const one = [{ marker: 1, source: 'DOCUMENT 1' }];
  assert.equal(applyCitations('Revenue in [2024] rose [1].', one, resolve).text, 'Revenue in [2024] rose [1].');
  assert.equal(applyCitations('arr[0] = 1 [1]', one, resolve).text, 'arr[0] = 1 [1]');
  const code = 'Is it ready ? Yes [1].\n```ts\nconst x = a ? b[1] : c;\n```';
  assert.equal(applyCitations(code, one, resolve).text, code, 'prose spacing and code blocks unchanged');
}
// 7. Markers glued to words, as models usually write them (the "Perplexity[1][2][3]" bug).
{
  const three = [{ marker: 1, source: 'DOCUMENT 1' }, { marker: 2, source: 'DOCUMENT 2' }, { marker: 3, source: 'DOCUMENT 3' }];
  const { text, citations } = applyCitations('Google Cloud, and Perplexity[1][2][3]. Asian capital[1][3].', three, resolve);
  assert.equal(citations.length, 3, 'glued markers are resolved');
  assert.equal(text, 'Google Cloud, and Perplexity[1][2][3]. Asian capital[1][3].');
  assert.equal(applyCitations('Rate[9].', three, resolve).text, 'Rate.', 'an unresolvable glued marker is removed cleanly');
}
console.log('citations: all checks passed');
