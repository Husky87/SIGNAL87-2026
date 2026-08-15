/**
 * A tall list wrapped in the real useScrollMemory, mounted and unmounted the way
 * a tab switch does, so a lost position shows up as a lost position.
 */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useScrollMemory } from '../src/lib/useScrollMemory';

function List({ listKey, slow }: { listKey: string; slow: boolean }) {
  const ref = useScrollMemory<HTMLDivElement>(listKey);
  // slow=true mimics a library that arrives after the first frame, which is
  // when a naive restore clamps to zero against an empty container.
  const [rows, setRows] = useState(slow ? 0 : 120);
  React.useEffect(() => {
    if (slow) {
      const t = setTimeout(() => setRows(120), 250);
      return () => clearTimeout(t);
    }
  }, [slow]);
  return (
    <div ref={ref} data-testid="scroller" style={{ height: 300, overflowY: 'auto' }}>
      <div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ height: 40 }}>row {i}</div>
        ))}
      </div>
    </div>
  );
}

function Harness() {
  const [tab, setTab] = useState<'a' | 'b'>('a');
  const [slow, setSlow] = useState(false);
  (window as any).__scrollTop = () =>
    document.querySelector('[data-testid="scroller"]')?.scrollTop ?? -1;
  return (
    <div>
      <button data-testid="to-a" onClick={() => setTab('a')}>A</button>
      <button data-testid="to-b" onClick={() => setTab('b')}>B</button>
      <button data-testid="slow-on" onClick={() => setSlow(true)}>slow</button>
      {tab === 'a' && <List listKey="list-a" slow={slow} />}
      {tab === 'b' && <div data-testid="other">other tab</div>}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
