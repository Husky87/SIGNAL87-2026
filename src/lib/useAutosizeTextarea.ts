import { useLayoutEffect, useRef } from 'react';

/** Grow with text and available width, then scroll within the height limit. */
export function useAutosizeTextarea(value: string, maxHeight: number, layoutKey?: boolean) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input) return;
    let lastWidth = input.clientWidth;
    const resize = () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
    };
    resize();
    const observer = new ResizeObserver(() => {
      if (input.clientWidth !== lastWidth) {
        lastWidth = input.clientWidth;
        resize();
      }
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [value, maxHeight, layoutKey]);
  return ref;
}
