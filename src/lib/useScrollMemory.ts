import { useCallback, useEffect, useRef } from 'react';

const positions = new Map<string, number>();
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
      const takeOver = () => { userHasScrolled = true; };

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

        // Do not make list rendering depend on ResizeObserver. Firefox profiles
        // and embedded browsers can disable the API; the scroll position still
        // works without the delayed re-application pass.
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(reapply);
          observer.observe(node);
          if (node.firstElementChild) observer.observe(node.firstElementChild);
        }
      }

      cleanupRef.current = () => {
        cancelAnimationFrame(frame);
        observer?.disconnect();
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

export function forgetScrollPosition(key: string): void {
  positions.delete(key);
}
