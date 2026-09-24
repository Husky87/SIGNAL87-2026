/** Answers read as clean prose, but every sentence still knows which sources it came from. */
import assert from 'node:assert/strict';
import { getShowCitationNumbers } from '../src/lib/citationDisplay';
import { answerSentences, chipCitations, exportAnswerText, findSearchPhrase, splitSentences, stripSentinels } from '../src/lib/citationSegments';

// Numbers are hidden unless someone turned them on (and there's no storage here at all).
assert.equal(getShowCitationNumbers(), false, 'citation numbers are hidden by default');

const answer = `The loan is **$4,250,000** at 9.5% [1][2]. Michael R. Benezra signed it on Jan. 5, 2026. [2] It closes next week.

- The rate is fixed [1].
- There is no prepayment penalty.
- The lender is ROK Financial [2]

\`\`\`js
arr[1] = total [1]
\`\`\``;
const sentences = answerSentences(answer);
const find = (start: string) => sentences.find((s) => s.text.startsWith(start));

// [1][2] on one sentence maps to both.
assert.deepEqual(find('The loan is')?.cites, [1, 2]);
// A marker written after the full stop belongs to the sentence before it, and "R." / "Jan." don't split it.
assert.deepEqual(find('Michael R. Benezra')?.cites, [2]);
assert.equal(find('Michael R. Benezra')?.text, 'Michael R. Benezra signed it on Jan. 5, 2026.');
// Unmarked sentences map to nothing.
assert.deepEqual(find('It closes')?.cites, []);
assert.deepEqual(find('There is no prepayment')?.cites, []);
// Bullets map on their own.
assert.deepEqual(find('The rate is fixed')?.cites, [1]);
assert.deepEqual(find('The lender is ROK')?.cites, [2]);
// Markers are removed from the sentence text, and code is not treated as prose.
assert.ok(sentences.every((s) => !/\[\d\]/.test(s.text)), 'no [n] left in sentence text');
assert.ok(!sentences.some((s) => s.text.includes('arr[1]')), 'code blocks are skipped');

// Markers inside bold stay with their sentence; hiding them leaves no " ." behind.
const bold = splitSentences('Sure. **Revenue was $5M [1].** Costs fell [2]!').filter((s) => !s.gap);
assert.deepEqual(bold.map((s) => s.cites), [[], [1], [2]]);
assert.equal(stripSentinels(bold[1].text), '**Revenue was $5M.**');

// A chip that collapses versions covers citations of any of its versions.
assert.deepEqual(
  chipCitations(
    [{ docId: 'resume-v3', docTitle: 'Resume Michael.pdf', versions: 3 }, { docId: 'loan', docTitle: 'Term sheet' }],
    [{ docId: 'resume-v1', docTitle: 'Resume Michael (2).pdf' }, { docId: 'loan', docTitle: 'Term sheet' }, { docId: 'resume-v3', docTitle: 'Resume Michael.pdf' }]
  ),
  [[1, 3], [2]]
);

// Exports keep the numbers and add a Sources list.
assert.equal(
  exportAnswerText('Rate is 9.5% [1]. Lender is ROK [2].', [{ docId: 'a', docTitle: 'Term sheet' }, { docId: 'b', docTitle: 'Lender letter' }]),
  'Rate is 9.5% [1]. Lender is ROK [2].\n\nSources\n[1] Term sheet\n[2] Lender letter'
);

// The viewer search is only pre-filled with a phrase the file really contains.
const doc = 'Borrower: Mount Horeb Lodge #10. Loan amount: $4,250,000. Lender: ROK Financial. Rate: 9.5%.';
assert.equal(findSearchPhrase(doc, 'The loan is **$4,250,000** from ROK Financial [1].', 'A summary of the bridge loan...'), '$4,250,000');
assert.equal(findSearchPhrase(doc, 'Bridge loans are short-term.', 'Nothing here matches...'), '');

// Markers glued to words ("Perplexity[1][2][3].") are recognised and hidden.
{
  const glued = answerSentences('He partnered with NVIDIA and Perplexity[1][2][3]. He studied at Harvard[1].');
  assert.deepEqual(glued.map((x) => x.cites), [[1, 2, 3], [1]], 'glued marker runs map to their sentences');
  assert.ok(glued.every((x) => !/\[\d/.test(stripSentinels(x.text))), 'no [n] left in the visible text');
  assert.ok(stripSentinels(glued[0].text).includes('Perplexity.'), 'punctuation closes up after the hidden markers');
}

console.log('citation display: 18 checks passed');
