export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Builds the message array the model actually receives.
 *
 * Everything the model is allowed to reason from — attached file text, the
 * selected repository documents, and the notices naming what could not be read —
 * is assembled by the caller into `groundedPrompt`. That string has to arrive as
 * the final user turn, because the final user turn is the question being asked.
 *
 * The caller used to pass `messages` through verbatim whenever it was non-empty
 * and fall back to `groundedPrompt` only when it was absent. The composer always
 * sends a conversation history, so the fallback never ran once and the document
 * context was discarded before the request left the server. The model received a
 * bare question, and answered — correctly, given what it was shown — that no
 * document was attached.
 */
export function buildChatMessages(options: {
  systemInstruction: string;
  messages?: unknown;
  groundedPrompt: string;
}): ChatTurn[] {
  const { systemInstruction, messages, groundedPrompt } = options;

  const raw: any[] = Array.isArray(messages) ? messages : [];
  const history: ChatTurn[] = raw
    .filter(
      (m: any) =>
        m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant')
    )
    .map((m: any) => ({ role: m.role, content: m.content }));

  // The trailing user turn is the same question `groundedPrompt` already carries.
  // Keeping both would ask it twice, and the ungrounded copy would be the one
  // sitting closest to the model's answer.
  if (history.length > 0 && history[history.length - 1].role === 'user') {
    history.pop();
  }

  return [
    { role: 'system', content: systemInstruction },
    ...history,
    { role: 'user', content: groundedPrompt }
  ];
}
