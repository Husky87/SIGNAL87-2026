/** Pure parsing for memory requests; kept free of Firebase so it can be tested anywhere. */

/**
 * Recognises explicit memory requests. Only clear, imperative forms count, so
 * "remember when we discussed X?" is treated as an ordinary question.
 */
export function parseMemoryCommand(message: string): { type: 'remember' | 'forget'; text: string } | null {
  const m = message.trim();
  if (m.length > 400 || m.endsWith('?')) return null;
  const remember = m.match(/^(?:please\s+)?(?:remember|keep in mind|save to memory)(?:\s+that)?[:,]?\s+(.{3,})$/i);
  if (remember) return { type: 'remember', text: remember[1] };
  const forget = m.match(/^(?:please\s+)?(?:forget|remove from memory)(?:\s+(?:that|about))?[:,]?\s+(.{2,})$/i);
  if (forget) return { type: 'forget', text: forget[1] };
  return null;
}
