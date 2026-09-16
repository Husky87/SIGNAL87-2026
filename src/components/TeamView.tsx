import React, { useMemo, useState } from 'react';
import { Search, UserPlus, ShieldCheck, MoreHorizontal, Mail } from 'lucide-react';

const MEMBERS = [
  { initials: 'MB', name: 'Michael Benezra', email: 'michael@signal87.ai', role: 'Admin', status: 'Active' },
  { initials: 'JS', name: 'Jessica Smith', email: 'jessica@signal87.ai', role: 'Member', status: 'Active' },
  { initials: 'DP', name: 'David Park', email: 'david@signal87.ai', role: 'Member', status: 'Active' },
  { initials: 'JL', name: 'Jamie Lee', email: 'jamie@signal87.ai', role: 'Member', status: 'Active' },
  { initials: 'RW', name: 'Ryan Wilson', email: 'ryan@signal87.ai', role: 'Member', status: 'Active' }
];

export const TeamView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredMembers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return MEMBERS;
    return MEMBERS.filter((member) => `${member.name} ${member.email} ${member.role}`.toLowerCase().includes(q));
  }, [searchTerm]);

  return (
    <main className="min-h-full bg-[var(--bg)] px-5 py-8 text-[var(--ink)] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-[var(--rule)] pb-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]"><ShieldCheck size={14} className="text-[var(--teal)]" /> Team</div>
              <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.055em] sm:text-[40px]">Manage your team and permissions.</h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[var(--ink-2)]">Invite collaborators, review access, and keep your workspace organized.</p>
            </div>
            <button type="button" onClick={() => alert('Invite workflow is ready to be connected.')} className="flex min-h-[42px] items-center gap-2 rounded-full bg-[var(--teal)] px-4 text-[12px] font-medium text-white hover:opacity-90"><UserPlus size={14} /> Invite member</button>
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-[var(--rule)] bg-[var(--surface)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--rule)] px-5 py-4 sm:px-6">
            <div><h2 className="text-sm font-semibold">Workspace members</h2><p className="mt-1 text-[11px] text-[var(--muted)]">{MEMBERS.length} members · access is scoped to this workspace</p></div>
            <div className="flex h-10 w-full max-w-xs items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--bg)] px-3"><Search size={14} className="text-[var(--muted)]" /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search members..." className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--muted)]" /></div>
          </div>

          <div className="divide-y divide-[var(--rule-2)]">
            {filteredMembers.map((member) => (
              <div key={member.email} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--teal-soft)] text-[11px] font-semibold text-[var(--teal)]">{member.initials}</div>
                  <div className="min-w-0"><div className="truncate text-[13px] font-semibold">{member.name}</div><div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-[var(--muted)]"><Mail size={11} /> {member.email}</div></div>
                </div>
                <div className="flex items-center gap-5 text-[11px] text-[var(--ink-2)]"><span>{member.role}</span><span className="flex items-center gap-1.5 text-[var(--ok)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--ok)]" />{member.status}</span><button type="button" className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--ink)]" aria-label={`More options for ${member.name}`}><MoreHorizontal size={16} /></button></div>
              </div>
            ))}
          </div>

          {filteredMembers.length === 0 && <div className="px-6 py-12 text-center text-[13px] text-[var(--muted)]">No team members match your search.</div>}
        </section>
      </div>
    </main>
  );
};