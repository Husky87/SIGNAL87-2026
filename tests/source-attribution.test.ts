/** Answers that use the files show those files as sources, even when the model forgets to cite. */
import assert from 'node:assert/strict';
import { attributeSources, distinctiveTerms } from '../src/lib/sourceAttribution';

const bio = { id: 'bio', title: 'Board bio', fullText: 'Michael R. Benezra is the founder and CEO of Signal87 AI. He is a Partner at Crewstone International Private Equity.' };
const loan = { id: 'loan', title: 'Term sheet', fullText: 'Borrower: Mount Horeb Lodge #10. Loan amount: $4,250,000. Lender: ROK Financial. Rate: 9.5%.' };
const other = { id: 'other', title: 'Vendor agreement', fullText: 'The Supplier shall deliver goods within thirty days. Payment terms are net forty-five days.' };

assert.ok(distinctiveTerms('The loan is $4,250,000 at 9.5% from ROK Financial.').includes('4250000'));

// Uncited answer about the bio → the bio is the source.
assert.deepEqual(attributeSources('Michael Benezra founded Signal87 AI and is a Partner at Crewstone International.', [other, loan, bio]), [2]);
// Uncited answer about the loan → the term sheet.
assert.deepEqual(attributeSources('The loan is $4,250,000 at 9.5% from ROK Financial, for Mount Horeb.', [bio, other, loan]), [2]);
// Pure general knowledge → no sources invented.
assert.deepEqual(attributeSources('Bridge loans are short-term financing used until permanent capital is in place.', [bio, loan, other]), []);

console.log('source attribution: 4 checks passed');
