import React from 'react';
import { useScrollMemory } from '../lib/useScrollMemory';

interface ScrollAreaProps {
  /** Identity of the list, so each one keeps its own place. */
  id: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * A scroll container that remembers where it was.
 *
 * Tab content is mounted conditionally, so every scroller in the app is thrown
 * away on the way out and rebuilt at the top on the way back. Wrapping them
 * here means the position survives without each view having to think about it.
 */
export const ScrollArea: React.FC<ScrollAreaProps> = ({ id, className, children }) => {
  const ref = useScrollMemory<HTMLDivElement>(id);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
};
