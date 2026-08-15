/**
 * Exercises the real useBackDismiss hook against nested overlays, and records
 * the history length so a leaked or double-consumed entry is visible.
 */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useBackDismiss } from '../src/lib/useBackDismiss';

function Harness() {
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(false);

  useBackDismiss(drawer, () => setDrawer(false));
  useBackDismiss(modal, () => setModal(false));

  (window as any).__state = () => ({ drawer, modal, len: window.history.length });

  return (
    <div>
      <button data-testid="open-drawer" onClick={() => setDrawer(true)}>open drawer</button>
      <button data-testid="open-modal" onClick={() => setModal(true)}>open modal</button>
      <button data-testid="close-drawer" onClick={() => setDrawer(false)}>close drawer</button>
      <button data-testid="close-modal" onClick={() => setModal(false)}>close modal</button>
      <div data-testid="drawer">{drawer ? 'drawer-open' : 'drawer-closed'}</div>
      <div data-testid="modal">{modal ? 'modal-open' : 'modal-closed'}</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
