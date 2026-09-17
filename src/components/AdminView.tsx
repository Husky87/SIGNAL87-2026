import React from 'react';
import { UserRound, Users, ShieldCheck, Palette, Sparkles, ChevronRight } from 'lucide-react';
import { OrgStats } from '../types';
import { User } from '../lib/firebase';

interface AdminViewProps {
  stats: OrgStats;
  currentUser?: User | null;
  selectedModel: string;
  onChangeModel: (model: string) => void;
  onSignOut?: () => void;
  onOpenTeam: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUser, selectedModel, onChangeModel, onSignOut, onOpenTeam, onOpenPrivacy, onOpenTerms }) => (
  <div className="s87-page min-h-full bg-[var(--bg)] text-[var(--ink)]">
    <div className="s87-column">
      <h1 className="s87-page-title">Settings</h1>
      <p className="s87-page-description">Your workspace, your control.</p>
      <div className="mt-7">
        <details>
          <summary className="s87-settings-row"><UserRound /><span><strong>Account</strong><small>Profile and sign-in</small></span><ChevronRight size={15} /></summary>
          <div className="s87-settings-detail"><p className="font-medium text-[var(--ink)]">{currentUser?.displayName || 'Your account'}</p><p className="mt-1 break-all">{currentUser?.email}</p>{onSignOut && <button type="button" onClick={onSignOut} className="mt-4 rounded-lg border border-[var(--rule)] px-4 text-sm hover:bg-[var(--raised)]">Sign out</button>}</div>
        </details>
        <button type="button" onClick={onOpenTeam} className="s87-settings-row"><Users /><span><strong>Team</strong><small>Members and workspace access</small></span><ChevronRight size={15} /></button>
        <details>
          <summary className="s87-settings-row"><Sparkles /><span><strong>Answer preferences</strong><small>Choose your response profile</small></span><ChevronRight size={15} /></summary>
          <div className="s87-settings-detail"><label htmlFor="response-profile" className="block text-sm">Response profile</label><select id="response-profile" value={selectedModel} onChange={event => onChangeModel(event.target.value)} className="mt-3 w-full max-w-sm rounded-lg border border-[var(--rule)] bg-[var(--surface)] px-3 py-3"><option value="gemini-3.6-flash">Signal87 Standard</option><option value="gemini-2.5-pro">Signal87 Deep</option><option value="gemini-3.5-flash-lite">Signal87 Fast</option></select></div>
        </details>
        <details>
          <summary className="s87-settings-row"><Palette /><span><strong>Appearance</strong><small>Theme and display</small></span><ChevronRight size={15} /></summary>
          <div className="s87-settings-detail">Light theme · System typography<p className="mt-2 text-xs text-[var(--muted)]">The workspace adapts to your screen and respects your device’s reduced motion preference.</p></div>
        </details>
        <details>
          <summary className="s87-settings-row"><ShieldCheck /><span><strong>Privacy &amp; security</strong><small>Policies and account protection</small></span><ChevronRight size={15} /></summary>
          <div className="s87-settings-detail flex flex-wrap gap-3"><button type="button" onClick={onOpenPrivacy} className="rounded-lg border border-[var(--rule)] px-4 hover:bg-[var(--raised)]">Privacy policy</button><button type="button" onClick={onOpenTerms} className="rounded-lg border border-[var(--rule)] px-4 hover:bg-[var(--raised)]">Terms of service</button></div>
        </details>
      </div>
    </div>
  </div>
);
