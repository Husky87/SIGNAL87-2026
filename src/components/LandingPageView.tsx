import React from 'react';
import { Signal87LandingShell } from './Signal87LandingShell';
import { NavTab } from './Sidebar';

interface LandingPageViewProps {
  onOpenEmailAuth: (mode?: 'signup' | 'signin') => void;
  onOpenPrivacy: () => void;
  onOpenBlog: () => void;
  onOpenMedia: () => void;
  onSelectTab: (tab: NavTab) => void;
}

/**
 * Compatibility wrapper for the existing App.tsx contract.
 *
 * Keeping this component in place lets the new landing shell replace the
 * previous landing view without changing routing, authentication, or the
 * parent application's callback interface.
 */
export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenEmailAuth,
  onSelectTab,
}) => (
  <Signal87LandingShell
    onOpenEmailAuth={onOpenEmailAuth}
    onSelectTab={onSelectTab}
  />
);
