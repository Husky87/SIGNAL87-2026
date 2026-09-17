import type { ChatMessage } from '../types';

export interface ChatApiResponse {
  text: string;
  citations?: ChatMessage['citations'];
  verificationTrace?: ChatMessage['verificationTrace'];
  reasoningSteps?: string[];
}

export async function requestChat(
  payload: Record<string, unknown>,
  getToken: () => Promise<string>,
  options: { fetchImpl?: typeof fetch; tokenTimeoutMs?: number; requestTimeoutMs?: number } = {}
): Promise<ChatApiResponse> {
  const tokenTimeoutMs = options.tokenTimeoutMs ?? 20000;
  const requestTimeoutMs = options.requestTimeoutMs ?? 75000;
  let tokenTimer: ReturnType<typeof setTimeout> | undefined;
  const token = await Promise.race([
    getToken(),
    new Promise<never>((_, reject) => {
      tokenTimer = setTimeout(() => reject(new Error('Sign-in timed out. Please sign in again.')), tokenTimeoutMs);
    })
  ]).finally(() => clearTimeout(tokenTimer));

  const controller = new AbortController();
  const requestTimer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await (options.fetchImpl ?? fetch)('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      let detail = body.slice(0, 300);
      try {
        const parsed = JSON.parse(body);
        detail = String(parsed.details || parsed.error || detail);
      } catch { /* The response was plain text. */ }
      throw new Error(`status ${response.status}${detail ? ` — ${detail}` : ''}`);
    }
    const data = await response.json() as ChatApiResponse;
    if (typeof data?.text !== 'string' || !data.text.trim()) {
      throw new Error('The assistant returned an empty answer. Please try again.');
    }
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The answer timed out. Please try again.');
    throw error;
  } finally {
    clearTimeout(requestTimer);
  }
}
