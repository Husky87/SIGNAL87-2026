/**
 * Chat session list helpers (the "Recent" list on Home and in the sidebar).
 *
 * Sessions live in this browser's localStorage: a list under `sessions`, and
 * each session's messages under `signal87_chat_<uid>_<sessionId>`. A startup
 * race used to overwrite the saved list with a single empty "New Research
 * Session" on every page load, so Recent always looked empty even though every
 * conversation's messages were still stored. These helpers rebuild the list
 * from what is actually stored and keep titles and times accurate.
 */
export interface StoredSession {
  id: string;
  title: string;
  timestamp: string;
  /** Epoch ms of the latest message; drives ordering and the relative time label. */
  updatedAt?: number;
}

interface StoredMessage { id?: string; role?: string; text?: string }

export const PLACEHOLDER_TITLES = new Set(['New Research Session', 'New Chat']);
const TITLE_CHARS = 60;

/** Epoch ms embedded in ids like `s_1726950000000` or `msg-1726950000000`. */
export function msFromId(id?: string): number | undefined {
  const m = String(id || '').match(/(\d{12,14})/);
  return m ? Number(m[1]) : undefined;
}

export function titleFromMessages(messages: StoredMessage[]): string | undefined {
  const first = messages.find((m) => m.role === 'user' && typeof m.text === 'string' && m.text.trim());
  if (!first?.text) return undefined;
  const text = first.text.replace(/\s+/g, ' ').trim();
  return text.length > TITLE_CHARS ? `${text.slice(0, TITLE_CHARS).trimEnd()}…` : text;
}

export function lastActivity(messages: StoredMessage[]): number | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const ms = msFromId(messages[i].id);
    if (ms) return ms;
  }
  return undefined;
}

/** "Just now", "12m ago", "3h ago", "Yesterday", "Sep 21". */
export function formatRelative(ms: number | undefined, now = Date.now()): string | undefined {
  if (!ms) return undefined;
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  const today = new Date(now);
  const then = new Date(ms);
  const sameDay = today.toDateString() === then.toDateString();
  if (sameDay) return `${hours}h ago`;
  const yesterday = new Date(now - 86400000);
  if (yesterday.toDateString() === then.toDateString()) return 'Yesterday';
  return then.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Rebuilds the session list from storage: keeps listed sessions, re-adds any
 * session whose messages are stored but which fell off the list, fills in
 * titles for sessions still named "New Research Session", and orders newest first.
 */
export function recoverSessions(
  listed: StoredSession[],
  storedChats: Array<{ id: string; messages: StoredMessage[] }>
): StoredSession[] {
  const byId = new Map<string, StoredSession>();
  for (const s of listed) if (s && s.id) byId.set(s.id, { ...s });
  for (const chat of storedChats) {
    if (!Array.isArray(chat.messages)) continue;
    const title = titleFromMessages(chat.messages);
    const updatedAt = lastActivity(chat.messages) ?? msFromId(chat.id);
    const existing = byId.get(chat.id);
    if (existing) {
      if (title && PLACEHOLDER_TITLES.has(existing.title)) existing.title = title;
      if (updatedAt && (!existing.updatedAt || updatedAt > existing.updatedAt)) existing.updatedAt = updatedAt;
    } else if (title) {
      byId.set(chat.id, { id: chat.id, title, timestamp: '', updatedAt });
    }
  }
  // A titled session whose messages are gone (emptied by an old save bug) would
  // open as a blank page from Recent, so it isn't listed. New untitled sessions stay.
  const withMessages = new Set(storedChats.filter((c) => Array.isArray(c.messages) && c.messages.length).map((c) => c.id));
  for (const [id, session] of byId) {
    if (!PLACEHOLDER_TITLES.has(session.title) && !withMessages.has(id)) byId.delete(id);
  }
  return [...byId.values()].sort((a, b) => (b.updatedAt ?? msFromId(b.id) ?? 0) - (a.updatedAt ?? msFromId(a.id) ?? 0));
}

/** Reads every stored conversation for this user from localStorage. */
export function readStoredChats(uid: string): Array<{ id: string; messages: StoredMessage[] }> {
  const prefix = `signal87_chat_${uid}_`;
  const chats: Array<{ id: string; messages: StoredMessage[] }> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      try {
        const messages = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(messages) && messages.length) chats.push({ id: key.slice(prefix.length), messages });
      } catch { /* skip a corrupt entry */ }
    }
  } catch { /* storage unavailable */ }
  return chats;
}
