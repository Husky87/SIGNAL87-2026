/**
 * Light / Dark / System appearance for the workspace. Dark is the default
 * (matching the landing page); Light is one click away in the sidebar.
 *
 * The choice is kept in localStorage and applied as data-theme="light|dark" on
 * <html>. index.html applies it before the first paint so there is no flash;
 * this module keeps it in sync afterwards (including when the Mac switches
 * between light and dark while "System" is chosen). The landing page has its
 * own always-dark design and is unaffected. Document pages stay white.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'signal87-theme';
const listeners = new Set<(pref: ThemePreference, resolved: ResolvedTheme) => void>();
let mediaQuery: MediaQueryList | null = null;
let lightThemeColor: string | null = null;

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref !== 'system') return pref;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(pref: ThemePreference) {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  // Light keeps index.html's status-bar colour (the landing page is always dark
  // and the bar is translucent); only dark swaps it for the workspace's near-black.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    if (lightThemeColor === null) lightThemeColor = meta.getAttribute('content');
    meta.setAttribute('content', resolved === 'dark' ? '#0B0E0C' : lightThemeColor ?? '#0B0E0C');
  }
  listeners.forEach((fn) => fn(pref, resolved));
}

export function setThemePreference(pref: ThemePreference) {
  try { localStorage.setItem(STORAGE_KEY, pref); } catch { /* private mode: still applies for this session */ }
  apply(pref);
}

export function subscribeTheme(fn: (pref: ThemePreference, resolved: ResolvedTheme) => void): () => void {
  listeners.add(fn);
  fn(getThemePreference(), resolveTheme(getThemePreference()));
  return () => listeners.delete(fn);
}

/** Call once at startup. */
export function initTheme() {
  apply(getThemePreference());
  mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  mediaQuery?.addEventListener?.('change', () => {
    if (getThemePreference() === 'system') apply('system');
  });
}
