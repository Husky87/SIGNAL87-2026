import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import {
  AccountProfile,
  COMPANY_SIZE_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  INDUSTRY_OPTIONS,
  REFERRAL_OPTIONS,
  ROLE_OPTIONS,
  TEAM_SIZE_OPTIONS,
  USE_CASE_OPTIONS,
  VOLUME_OPTIONS,
  loadAccountProfile,
  profileCompletion,
  saveAccountProfile
} from '../lib/accountProfile';

interface AccountProfilePanelProps {
  displayName?: string | null;
  email?: string | null;
  /** Called after a successful save with the new completion percentage. */
  onSaved?: (completion: number) => void;
}

const fieldClass = 'mt-1.5 w-full min-h-[44px] rounded-lg border border-[var(--rule)] bg-[var(--surface)] px-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--teal)] focus:outline-none';
const labelClass = 'block text-[13px] font-medium text-[var(--ink)]';

/**
 * Settings → Account: an optional, richer profile. Everything is optional and
 * saved together. Role, company and industry also make Ask's answers more relevant.
 */
export const AccountProfilePanel: React.FC<AccountProfilePanelProps> = ({ displayName, email, onSaved }) => {
  const [profile, setProfile] = useState<AccountProfile>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void loadAccountProfile().then((p) => {
      if (cancelled) return;
      setProfile({ fullName: displayName || undefined, ...(p || {}) });
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [displayName]);

  const completion = useMemo(() => profileCompletion(profile), [profile]);
  const set = <K extends keyof AccountProfile>(key: K, value: AccountProfile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setStatus('idle');
  };
  const toggle = (key: 'useCases' | 'documentTypes', option: string) => {
    const current = profile[key] || [];
    set(key, current.includes(option) ? current.filter((x) => x !== option) : [...current, option]);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const saved = await saveAccountProfile(profile);
      setProfile(saved);
      setStatus('saved');
      onSaved?.(profileCompletion(saved));
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Could not save your profile. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const text = (key: keyof AccountProfile, label: string, placeholder = '', type = 'text', autoComplete?: string) => (
    <div>
      <label htmlFor={`profile-${key}`} className={labelClass}>{label}</label>
      <input
        id={`profile-${key}`}
        type={type}
        autoComplete={autoComplete}
        value={(profile[key] as string) || ''}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value as never)}
        className={fieldClass}
      />
    </div>
  );
  const select = (key: keyof AccountProfile, label: string, options: string[]) => (
    <div>
      <label htmlFor={`profile-${key}`} className={labelClass}>{label}</label>
      <select
        id={`profile-${key}`}
        value={(profile[key] as string) || ''}
        onChange={(e) => set(key, (e.target.value || undefined) as never)}
        className={fieldClass}
      >
        <option value="">Choose…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  const chips = (key: 'useCases' | 'documentTypes', label: string, options: string[]) => (
    <fieldset>
      <legend className={labelClass}>{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = (profile[key] || []).includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(key, o)}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${
                on ? 'border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--teal)] font-medium' : 'border-[var(--rule)] text-[var(--ink-2)] hover:bg-[var(--raised)]'
              }`}
            >
              {on && <Check size={13} />}{o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
  const section = (title: string, children: React.ReactNode) => (
    <section className="space-y-4 border-t border-[var(--rule)] pt-5">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{title}</h3>
      {children}
    </section>
  );

  if (!loaded) {
    return <div className="flex items-center gap-2 text-sm text-[var(--muted)]"><Loader2 size={15} className="animate-spin" /> Loading your profile…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[14px] font-medium text-[var(--ink)]">Your profile is {completion}% complete</p>
          <p className="text-[12px] text-[var(--muted)] break-all">{email}</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion} aria-label="Profile completion">
          <div className="h-full rounded-full bg-[var(--teal)] transition-[width] duration-300" style={{ width: `${completion}%` }} />
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--muted)]">
          All optional. Your role, company and industry help Signal87 tailor answers to your work, and the rest helps us build what you need. We never sell your information.
        </p>
      </div>

      {section('About you', (
        <div className="grid gap-4 sm:grid-cols-2">
          {text('fullName', 'Full name', '', 'text', 'name')}
          {text('preferredName', 'What should we call you?', 'e.g. Mike', 'text', 'nickname')}
          {text('jobTitle', 'Job title', 'e.g. General Counsel', 'text', 'organization-title')}
          {select('role', 'Role', ROLE_OPTIONS)}
          {text('location', 'City / region', 'e.g. Boston, MA', 'text', 'address-level2')}
          {text('linkedin', 'LinkedIn profile', 'linkedin.com/in/…', 'url')}
        </div>
      ))}

      {section('Your organization', (
        <div className="grid gap-4 sm:grid-cols-2">
          {text('company', 'Company', '', 'text', 'organization')}
          {text('website', 'Company website', 'example.com', 'url')}
          {select('industry', 'Industry', INDUSTRY_OPTIONS)}
          {select('companySize', 'Company size', COMPANY_SIZE_OPTIONS)}
          {select('teamSize', 'People who would use Signal87', TEAM_SIZE_OPTIONS)}
        </div>
      ))}

      {section('How you use Signal87', (
        <>
          {chips('useCases', 'What do you use it for?', USE_CASE_OPTIONS)}
          {chips('documentTypes', 'What kinds of documents?', DOCUMENT_TYPE_OPTIONS)}
          <div className="grid gap-4 sm:grid-cols-2">
            {select('documentsPerMonth', 'Documents you review per month', VOLUME_OPTIONS)}
            {select('referralSource', 'How did you hear about us?', REFERRAL_OPTIONS)}
          </div>
          <div>
            <label htmlFor="profile-goals" className={labelClass}>What would make Signal87 most valuable for you?</label>
            <textarea
              id="profile-goals"
              rows={3}
              maxLength={1000}
              value={profile.goals || ''}
              onChange={(e) => set('goals', e.target.value)}
              className={`${fieldClass} py-2.5 leading-relaxed`}
            />
          </div>
        </>
      ))}

      {section('Contact', (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {text('phone', 'Phone (optional)', '', 'tel', 'tel')}
          </div>
          <label className="flex items-start gap-3 text-[13.5px] text-[var(--ink)]">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--teal)]" checked={!!profile.productUpdates} onChange={(e) => set('productUpdates', e.target.checked)} />
            <span>Email me product updates and tips</span>
          </label>
          <label className="flex items-start gap-3 text-[13.5px] text-[var(--ink)]">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--teal)]" checked={!!profile.researchCalls} onChange={(e) => set('researchCalls', e.target.checked)} />
            <span>I’m open to a short call to share feedback</span>
          </label>
        </>
      ))}

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--rule)] pt-5">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--teal)] px-6 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          Save profile
        </button>
        {status === 'saved' && <span role="status" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ok,#16a34a)]"><Check size={14} /> Saved</span>}
        {status === 'error' && <span role="alert" className="text-[13px] text-[#c0392b]">{error}</span>}
      </div>
    </div>
  );
};
