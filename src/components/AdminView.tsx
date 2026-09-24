import React, { useEffect, useState } from 'react';
import { UserRound, Users, ShieldCheck, Palette, Sparkles, ChevronRight, Brain, Sun, Moon, Monitor } from 'lucide-react';
import { getThemePreference, setThemePreference, subscribeTheme, ThemePreference } from '../lib/theme';
import { AnswerStyle, getAnswerStyle, setAnswerStyle } from '../lib/answerStyle';
import { MemoryPanel } from './MemoryPanel';
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

/** Light / Dark / System. Applies instantly and is remembered on this device. */
const ThemePicker: React.FC = () => {
  const [pref, setPref] = useState<ThemePreference>(getThemePreference());
  useEffect(() => subscribeTheme((p) => setPref(p)), []);
  const options: Array<{ value: ThemePreference; label: string; icon: React.ReactNode }> = [
    { value: 'light', label: 'Light', icon: <Sun size={15} /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={15} /> },
    { value: 'system', label: 'System', icon: <Monitor size={15} /> }
  ];
  return (
    <div className="s87-theme-picker" role="group" aria-label="Appearance">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={pref === o.value} onClick={() => setThemePreference(o.value)}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
};

/** Conversational (default) or Direct answers. */
const AnswerStylePicker: React.FC = () => {
  const [style, setStyle] = useState<AnswerStyle>(getAnswerStyle());
  const choose = (next: AnswerStyle) => { setAnswerStyle(next); setStyle(next); };
  return (
    <div>
      <span className="block text-sm">Answer style</span>
      <div className="s87-theme-picker mt-3" role="group" aria-label="Answer style">
        <button type="button" aria-pressed={style === 'conversational'} onClick={() => choose('conversational')}>Conversational</button>
        <button type="button" aria-pressed={style === 'direct'} onClick={() => choose('direct')}>Direct</button>
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {style === 'direct'
          ? 'Answers lead with the facts and their sources. No pleasantries or follow-up offers.'
          : 'Answers are friendly and may suggest a useful next step.'}
      </p>
    </div>
  );
};

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
        <details>
          <summary className="s87-settings-row"><Brain /><span><strong>Memory</strong><small>Facts Signal87 remembers about you</small></span><ChevronRight size={15} /></summary>
          <div className="s87-settings-detail"><MemoryPanel /></div>
        </details>
        <button type="button" onClick={onOpenTeam} className="s87-settings-row"><Users /><span><strong>Team</strong><small>Members and workspace access</small></span><ChevronRight size={15} /></button>
        <details>
          <summary className="s87-settings-row"><Sparkles /><span><strong>Answer preferences</strong><small>Choose your response profile</small></span><ChevronRight size={15} /></summary>
          <div className="s87-settings-detail"><AnswerStylePicker /><label htmlFor="response-profile" className="mt-6 block text-sm">Response profile</label><select id="response-profile" value={selectedModel} onChange={event => onChangeModel(event.target.value)} className="mt-3 w-full max-w-sm rounded-lg border border-[var(--rule)] bg-[var(--surface)] px-3 py-3"><option value="gemini-3.6-flash">Signal87 Standard</option><option value="gemini-2.5-pro">Signal87 Deep</option><option value="gemini-3.5-flash-lite">Signal87 Fast</option></select></div>
        </details>
        <details>
          <summary className="s87-settings-row"><Palette /><span><strong>Appearance</strong><small>Light, dark, or match your device</small></span><ChevronRight size={15} /></summary>
          <div className="s87-settings-detail"><ThemePicker /><p className="mt-3 text-xs text-[var(--muted)]">System follows your device’s light or dark setting. Document pages always stay white, like paper. The workspace also respects your device’s reduced-motion preference.</p></div>
        </details>
        <details>
          <summary className="s87-settings-row"><ShieldCheck /><span><strong>Privacy &amp; security</strong><small>Policies and account protection</small></span><ChevronRight size={15} /></summary>
          <div className="s87-settings-detail flex flex-wrap gap-3"><button type="button" onClick={onOpenPrivacy} className="rounded-lg border border-[var(--rule)] px-4 hover:bg-[var(--raised)]">Privacy policy</button><button type="button" onClick={onOpenTerms} className="rounded-lg border border-[var(--rule)] px-4 hover:bg-[var(--raised)]">Terms of service</button></div>
        </details>
      </div>
    </div>
  </div>
);
