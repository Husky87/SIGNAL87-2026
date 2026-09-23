/** Recent questions: the session list is rebuilt from stored conversations and never wiped. */
import assert from 'node:assert/strict';
import { formatRelative, recoverSessions, titleFromMessages } from '../src/lib/chatSessions';

const t0 = 1790000000000;
// The bug: the saved list had been overwritten with one empty placeholder, but the conversations were still stored.
const listed = [{ id: `s_${t0 + 5000}`, title: 'New Research Session', timestamp: 'Just now' }];
const stored = [
  { id: `s_${t0}`, messages: [{ id: `msg-${t0 + 10}`, role: 'user', text: 'Who is financing Harvard Street?' }, { id: `msg-${t0 + 20}`, role: 'assistant', text: 'ROK Financial…' }] },
  { id: `s_${t0 - 86400000}`, messages: [{ id: `msg-${t0 - 86400000}`, role: 'user', text: 'What companies am I involved with?' }] },
  { id: 's_empty', messages: [{ id: 'x', role: 'assistant', text: 'hello' }] }
];
const sessions = recoverSessions(listed, stored);
assert.equal(sessions.length, 3, 'two recovered conversations plus the current empty session');
assert.equal(sessions[0].id, `s_${t0 + 5000}`, 'newest first');
assert.equal(sessions[1].title, 'Who is financing Harvard Street?');
assert.equal(sessions[2].title, 'What companies am I involved with?');
assert.ok(!sessions.some((s) => s.id === 's_empty'), 'a stored chat with no user question is not listed');

// A listed placeholder gets its real title once it has a question.
const renamed = recoverSessions([{ id: `s_${t0}`, title: 'New Research Session', timestamp: '' }], [stored[0]]);
assert.equal(renamed[0].title, 'Who is financing Harvard Street?');

assert.equal(titleFromMessages([{ role: 'user', text: 'x'.repeat(80) }])?.length, 61);
assert.equal(formatRelative(t0 - 30000, t0), 'Just now');
assert.equal(formatRelative(t0 - 5 * 60000, t0), '5m ago');
console.log('chat sessions: all checks passed');
