/**
 * Retrieval: a question must reach the right file even when that file sits far
 * past the old 90k-character cutoff, and small workspaces must still be sent whole.
 */
import assert from 'node:assert/strict';
import { retrieveContext, splitIntoPassages, tokenize } from '../src/lib/retrieval';

const filler = (i: number) => ({
  id: `filler-${i}`,
  title: `Vendor agreement ${i}`,
  fullText: Array.from({ length: 40 }, (_, p) =>
    `Section ${p + 1}. The Supplier shall deliver goods to the Customer within thirty days of each purchase order number ${i}-${p}. Payment terms are net forty-five days.`
  ).join('\n\n')
});

const bio = {
  id: 'bio',
  title: 'Board bio 2026',
  fullText: 'Michael R. Benezra is the founder and CEO of Signal87 AI, a document intelligence company for legal and regulatory teams. He previously served as Consul of Innovation and Economic Affairs.'
};

const loan = {
  id: 'loan',
  title: '110 Harvard Street term sheet',
  fullText: 'Borrower: Mount Horeb Lodge #10. Property: 110 Harvard Street, Dorchester, MA. Loan amount: $4,250,000. Lender: ROK Financial. Rate: 9.5% interest only.'
};

const workspace = [...Array.from({ length: 30 }, (_, i) => filler(i)), loan, bio];
const opts = { budgetChars: 90000, maxDocChars: 28000 };

// 1. Passages and tokens behave.
assert.ok(splitIntoPassages(filler(1).fullText).length > 1, 'long documents split into several passages');
assert.deepEqual(tokenize("Who is Michael Benezra's lender?"), ['michael', 'benezra', 'lender']);

// 2. The reported bug: a person named only in a file far down the list.
{
  const r = retrieveContext(workspace, { question: 'who is michael benezra', ...opts });
  assert.equal(r.stats.mode, 'search');
  assert.equal(r.contextDocs[0]?.id, 'bio', 'the bio is the top document');
  assert.ok(r.text.includes('founder and CEO of Signal87'), 'the bio text reaches the prompt');
  assert.ok(r.workspaceIndex.includes('WORKSPACE FILES (32'), 'the model is told how many files exist');
}

// 3. "Who am I?" resolves through the signed-in user's name.
{
  const r = retrieveContext(workspace, { question: 'what do you know about me?', profile: { name: 'Michael Benezra' }, ...opts });
  assert.equal(r.contextDocs[0]?.id, 'bio');
}

// 4. Numbers and places: the loan question finds the term sheet.
{
  const r = retrieveContext(workspace, { question: 'What is the loan amount on 110 Harvard Street?', ...opts });
  assert.equal(r.contextDocs[0]?.id, 'loan');
  assert.ok(r.text.includes('$4,250,000'));
}

// 5. Short follow-ups borrow the previous question.
{
  const r = retrieveContext(workspace, { question: 'and the rate?', previousQuestions: ['What is the loan amount on 110 Harvard Street?'], ...opts });
  assert.equal(r.contextDocs[0]?.id, 'loan');
}

// 6. Small workspaces are still sent whole, exactly as before.
{
  const r = retrieveContext([loan, bio], { question: 'anything', ...opts });
  assert.equal(r.stats.mode, 'full');
  assert.equal(r.contextDocs.length, 2);
  assert.equal(r.workspaceIndex, '');
}

// 7. Nothing matches: fall back to each file's opening instead of sending nothing.
{
  const r = retrieveContext(workspace, { question: 'zzzz qqqq', ...opts });
  assert.equal(r.stats.mode, 'overview');
  assert.ok(r.contextDocs.length > 0);
}

// 8. The prompt stays inside its budget.
{
  const r = retrieveContext(workspace, { question: 'supplier payment terms purchase order', ...opts });
  assert.ok(r.text.length < 100000, `prompt text ${r.text.length} chars`);
}

console.log('retrieval: 8 checks passed');
