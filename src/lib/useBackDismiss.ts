import { useEffect, useRef } from 'react';

/**
 * Lets the back gesture close an overlay.
 *
 * Installed to a home screen the app runs standalone, with no browser back
 * button and no address bar. On Android the hardware back button is then the
 * only back affordance there is — and with nothing listening for it, pressing
 * back with a modal or drawer open **left the app entirely** rather than
 * closing the thing on top. Every native app closes the sheet first.
 *
 * While an overlay is open a history entry stands in for it, so back pops that
 * entry instead of leaving.
 */

interface OverlayEntry {
  dismiss: () => void;
}

/**
 * Open overlays, oldest first.
 *
 * popstate is a window event, so a per-overlay listener means one back press is
 * delivered to every open overlay at once — opening a drawer, then a modal on
 * top of it, and pressing back closed both. Dismissal is therefore routed
 * through one listener that only ever wakes the entry on top.
 */
const overlayStack: OverlayEntry[] = [];

/**
 * Back presses this module issued itself, to consume the entry standing in for
 * an overlay that was closed by tapping its X. Without this, that programmatic
 * back would be read as a user gesture and would dismiss the overlay beneath.
 */
let selfIssuedBacks = 0;

let listenerAttached = false;

function handlePopState() {
  if (selfIssuedBacks > 0) {
    selfIssuedBacks--;
    return;
  }
  overlayStack.pop()?.dismiss();
}

function ensureListener() {
  if (listenerAttached || typeof window === 'undefined') return;
  window.addEventListener('popstate', handlePopState);
  listenerAttached = true;
}

export function useBackDismiss(isOpen: boolean, onDismiss: () => void): void {
  const entryRef = useRef<OverlayEntry | null>(null);
  // Read at pop time rather than captured, so a re-rendered closure is not stale.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!isOpen || entryRef.current) return;

    const entry: OverlayEntry = {
      dismiss: () => {
        // Already popped off both the stack and history — the cleanup effect
        // below must not then try to consume an entry that is gone.
        entryRef.current = null;
        dismissRef.current();
      }
    };

    entryRef.current = entry;
    overlayStack.push(entry);
    ensureListener();
    window.history.pushState({ s87Overlay: true }, '');
  }, [isOpen]);

  useEffect(() => {
    if (isOpen || !entryRef.current) return;

    // Closed from the UI, so the entry standing in for it is still on the
    // stack. Leaving it there would mean back needs pressing once per overlay
    // ever opened before it did anything visible.
    const entry = entryRef.current;
    entryRef.current = null;

    const index = overlayStack.indexOf(entry);
    if (index !== -1) overlayStack.splice(index, 1);

    selfIssuedBacks++;
    window.history.back();
  }, [isOpen]);

  // Unmounting while open is the same as closing from the UI.
  useEffect(() => {
    return () => {
      const entry = entryRef.current;
      if (!entry) return;
      entryRef.current = null;
      const index = overlayStack.indexOf(entry);
      if (index !== -1) overlayStack.splice(index, 1);
      selfIssuedBacks++;
      window.history.back();
    };
  }, []);
}
