import React, { useState } from 'react';
import { Settings, Users, ShieldCheck, Key, CreditCard, Sparkles, Plus } from 'lucide-react';
import { OrgStats } from '../types';

interface AdminViewProps {
  stats: OrgStats;
  selectedModel: string;
  onChangeModel: (model: string) => void;
  onSignOut?: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ stats: _stats, selectedModel, onChangeModel, onSignOut }) => {
  const [activeTab, setActiveTab] = useState<'account' | 'team' | 'apikeys'>('account');

  return (
    <div className="min-h-full bg-[var(--bg)] px-5 py-8 text-[var(--ink)] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-[var(--rule)] pb-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]"><Settings size={14} className="text-[var(--teal)]" /> Settings</div>
              <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.055em] sm:text-[40px]">Workspace settings</h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[var(--ink-2)]">Manage account access, team permissions, billing, and Signal87 AI routing.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 text-[11px] font-medium text-[var(--ink-2)]"><ShieldCheck size={14} className="text-[var(--ok)]" /> Secure workspace</div>
          </div>

          <div className="mt-7 flex gap-2 overflow-x-auto pb-1">
            {[
              ['account', 'Account & billing', CreditCard],
              ['team', 'Team & access', Users],
              ['apikeys', 'AI & API', Key]
            ].map(([id, label, Icon]) => (
              <button
                key={id as string}
                type="button"
                onClick={() => setActiveTab(id as 'account' | 'team' | 'apikeys')}
                className={`flex min-h-[42px] shrink-0 items-center gap-2 rounded-full border px-4 text-[12px] font-medium ${activeTab === id ? 'border-[var(--teal-soft)] bg-[var(--teal-soft)] text-[var(--teal)]' : 'border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--raised)]'}`}
              >
                <Icon size={14} /> {label as string}
              </button>
            ))}
          </div>
        </header>

        {activeTab === 'account' && (
          <div className="mt-8 space-y-4">
            <section className="rounded-2xl border border-[var(--rule)] bg-[var(--surface)] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Current plan</div>
                  <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-[-0.035em]">Enterprise workspace <Sparkles size={17} className="text-[var(--teal)]" /></h2>
                  <p className="mt-2 max-w-xl text-[13px] leading-6 text-[var(--ink-2)]">Dedicated workspace, secure document processing, and OpenAI-primary AI with Gemini fallback.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => alert('Billing portal is ready to be connected.')} className="min-h-[42px] rounded-full bg-[var(--ink)] px-4 text-[12px] font-medium text-white hover:opacity-90">Manage billing</button>
                  {onSignOut && <button type="button" onClick={onSignOut} className="min-h-[42px] rounded-full border border-[var(--rule)] bg-[var(--surface)] px-4 text-[12px] font-medium text-[var(--ink-2)] hover:bg-[var(--raised)]">Sign out</button>}
                </div>
              </div>
              <div className="mt-6 grid gap-3 border-t border-[var(--rule-2)] pt-5 sm:grid-cols-4">
                {[['Status','Active'],['Monthly quota','100M tokens'],['Active seats','4 seats'],['Renewal','August 27, 2026']].map(([label,value]) => <div key={label}><div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{label}</div><div className="mt-1 text-[13px] font-medium text-[var(--ink)]">{value}</div></div>)}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--rule)] bg-[var(--surface)] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">AI routing</h3><p className="mt-1 text-[12px] leading-5 text-[var(--ink-2)]">Provider routing is fixed for reliability: OpenAI first, Gemini second.</p></div><div className="rounded-full bg-[var(--teal-soft)] px-3 py-1.5 text-[10px] font-semibold text-[var(--teal)]">OpenAI → Gemini</div></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--teal)]/30 bg-[var(--teal-soft)]/60 p-4"><div className="flex items-center justify-between"><span className="text-[13px] font-semibold">OpenAI / GPT</span><span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--teal)]">Primary</span></div><p className="mt-2 text-[12px] leading-5 text-[var(--ink-2)]">Primary engine for chat, analysis, research, comparison, and document workflows.</p></div>
                <div className="rounded-2xl border border-[var(--rule)] bg-[var(--bg)] p-4"><div className="flex items-center justify-between"><span className="text-[13px] font-semibold">Google Gemini</span><span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted)]">Fallback</span></div><p className="mt-2 text-[12px] leading-5 text-[var(--ink-2)]">Automatically used when the primary OpenAI request cannot be completed.</p></div>
              </div>
              <label className="mt-5 block text-[11px] font-medium text-[var(--muted)]">Workspace response profile</label>
              <select value={selectedModel} onChange={(e) => onChangeModel(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--rule)] bg-[var(--surface)] px-3 py-3 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--teal)] sm:max-w-sm">
                <option value="gemini-3.6-flash">Signal87 Standard</option>
                <option value="gemini-2.5-pro">Signal87 Deep</option>
                <option value="gemini-3.5-flash-lite">Signal87 Fast</option>
              </select>
              <p className="mt-2 text-[11px] text-[var(--muted)]">This preference affects the requested response profile; provider order remains OpenAI first and Gemini second.</p>
            </section>
          </div>
        )}

        {activeTab === 'team' && (
          <section className="mt-8 rounded-2xl border border-[var(--rule)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-sm font-semibold">Team & access</h2><p className="mt-1 text-[12px] text-[var(--ink-2)]">Manage workspace members and permissions.</p></div><button type="button" onClick={() => alert('Invite workflow is ready to be connected.')} className="flex min-h-[42px] items-center gap-2 rounded-full bg-[var(--ink)] px-4 text-[12px] font-medium text-white hover:opacity-90"><Plus size={14} /> Invite member</button></div>
            <div className="mt-5 divide-y divide-[var(--rule-2)]">{[
              ['Michael Benezra','michael@signal87.ai','Admin','Active'],['Jessica Smith','jessica@signal87.ai','Member','Active'],['David Park','david@signal87.ai','Member','Active'],['Jamie Lee','jamie@signal87.ai','Member','Active'],['Ryan Wilson','ryan@signal87.ai','Member','Active']
            ].map(([name,email,role,status]) => <div key={email} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><div className="text-[13px] font-semibold">{name}</div><div className="mt-1 text-[11px] text-[var(--muted)]">{email}</div></div><div className="flex items-center gap-3 text-[11px] text-[var(--ink-2)]"><span>{role}</span><span className="flex items-center gap-1.5 text-[var(--ok)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--ok)]" />{status}</span></div></div>)}</div>
          </section>
        )}

        {activeTab === 'apikeys' && (
          <section className="mt-8 rounded-2xl border border-[var(--rule)] bg-[var(--surface)] p-5 sm:p-6"><h2 className="text-sm font-semibold">AI & API access</h2><p className="mt-1 text-[12px] text-[var(--ink-2)]">Provider credentials stay server-side and are never exposed in the workspace UI.</p><div className="mt-5 rounded-2xl border border-[var(--rule)] bg-[var(--bg)] p-5"><div className="flex items-start gap-3"><Key size={17} className="mt-0.5 text-[var(--teal)]" /><div><div className="text-[13px] font-semibold">Secure provider configuration</div><p className="mt-2 text-[12px] leading-6 text-[var(--ink-2)]">Signal87 uses private server environment variables for OpenAI and Google Gemini. No provider API key is displayed or stored in the browser settings.</p></div></div></div></section>
        )}
      </div>
    </div>
  );
};