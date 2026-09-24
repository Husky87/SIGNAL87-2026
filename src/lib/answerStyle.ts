/**
 * How Ask phrases answers. "Conversational" (default) is warm and may offer a
 * next step; "Direct" gives the answer and its sources with no pleasantries or
 * follow-up offers, for teams that want straight answers. Stored per device.
 */
export type AnswerStyle = 'conversational' | 'direct';
const KEY = 'signal87-answer-style';

export function getAnswerStyle(): AnswerStyle {
  try { return localStorage.getItem(KEY) === 'direct' ? 'direct' : 'conversational'; } catch { return 'conversational'; }
}

export function setAnswerStyle(style: AnswerStyle) {
  try { localStorage.setItem(KEY, style); } catch { /* private mode */ }
}
