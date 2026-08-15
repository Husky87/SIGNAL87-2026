import { useCallback, useEffect, useRef } from 'react';

/**
 * Remembers where a list was scrolled to, per key.
 *
 * Tab content is mounted conditionally, so leaving Files and coming back threw
 * the scroller away and rebuilt it at the top — and an effect explicitly reset
 * the scroll position on every tab change besides. Scrolling a long library,
 * opening a document, then going back put you at the top of the list again,
 * which is the one thing a native app never does.
 *
 * Restoring once on mount is not enough: the list is usually still empty on the
 * first frame, so the assignment clamps to zero. The position is re-applied as
 * the content grows, until it takes or the user scrolls — whichever is first,
 * because fighting a deliberate scroll is worse than losing the position.
 */
const positions = new Map<string, number>();

/** Long enough for a library to arrive, short enough not to lurch later. */
const SETTLE_MS = 1200;

export function useScrollMemory<T extends HTMLElement>(key: string) {
  const elementRef = useRef<T | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const attach = useCallback(
    (node: T | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      elementRef.current = node;
      if (!node) return;

      const target = positions.get(key) ?? 0;
      let userHasScrolled = false;
      let frame = 0;

      const remember = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => positions.set(key, node.scrollTop));
      };

      // A wheel, touch or key scroll is the user taking over; a programmatic
      // restore is not, so only real input cancels further restoring.
      const takeOver = () => {
        userHasScrolled = true;
      };

      node.addEventListener('scroll', remember, { passive: true });
      node.addEventListener('wheel', takeOver, { passive: true });
      node.addEventListener('touchstart', takeOver, { passive: true });
      node.addEventListener('keydown', takeOver);

      let observer: ResizeObserver | null = null;
      let stopAt = 0;

      if (target > 0) {
        node.scrollTop = target;

        stopAt = Date.now() + SETTLE_MS;
        const reapply = () => {
          if (userHasScrolled || Date.now() > stopAt) {
            observer?.disconnect();
            observer = null;
            return;
          }
          if (Math.abs(node.scrollTop - target) > 1 && node.scrollHeight > node.clientHeight) {
            node.scrollTop = target;
          }
        };

        observer = new ResizeObserver(reapply);
        observer.observe(node);
        if (node.firstElementChild) observer.observe(node.firstElementChild);
      }

      cleanupRef.current = () => {
        cancelAnimationFrame(frame);
        observer?.disconnect();
        // Capture the final position before the node goes away.
        positions.set(key, node.scrollTop);
        node.removeEventListener('scroll', remember);
        node.removeEventListener('wheel', takeOver);
        node.removeEventListener('touchstart', takeOver);
        node.removeEventListener('keydown', takeOver);
      };
    },
    [key]
  );

  useEffect(() => () => cleanupRef.current?.(), []);

  return attach;
}

/** Forgets a remembered position — for when a list's contents change wholesale. */
export function forgetScrollPosition(key: string): void {
  positions.delete(key);
}
