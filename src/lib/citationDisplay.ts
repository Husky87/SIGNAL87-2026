/**
 * Whether Ask answers show their [1], [2] citation numbers. Off by default:
 * answers read as clean prose, and every cited sentence is still traceable by
 * hovering or tapping it (or its source chip). Teams that want visible footnotes
 * can turn the numbers back on. Exports always include them. Stored per device.
 */
const KEY = 'signal87-citation-numbers';
const EVENT = 'signal87-citation-numbers';

export function getShowCitationNumbers(): boolean {
  try { return localStorage.getItem(KEY) === 'on'; } catch { return false; }
}

export function setShowCitationNumbers(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* no window (tests) */ }
}

/** Calls `listener` whenever the setting changes, in this tab or another. Returns an unsubscribe function. */
export function subscribeCitationNumbers(listener: (on: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onChange = () => listener(getShowCitationNumbers());
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) onChange(); };
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
