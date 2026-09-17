import React, { useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { User } from '../lib/firebase';

export const TeamView: React.FC<{ currentUser?: User | null }> = ({ currentUser }) => {
  const [search, setSearch] = useState('');
  const name = currentUser?.displayName || 'Your account';
  const email = currentUser?.email || '';
  const visible = `${name} ${email}`.toLowerCase().includes(search.trim().toLowerCase());
  const initials = name.split(' ').map(part => part[0]).slice(0, 2).join('');

  return (
    <div className="s87-page min-h-full bg-[var(--bg)] text-[var(--ink)]">
      <div className="s87-column">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="s87-page-title">Team</h1><p className="s87-page-description">Your workspace and collaborators.</p></div>
          <button type="button" disabled aria-describedby="team-availability" className="flex items-center gap-2 rounded-lg bg-[var(--surface-2)] px-4 text-[13px] text-[var(--muted)] cursor-not-allowed"><UserPlus size={15} /> Invite member</button>
        </header>
        <p id="team-availability" className="mt-5 text-[12px] leading-5 text-[var(--muted)]">This is your personal workspace. Team invitations are not available yet.</p>
        <label className="s87-field mt-6 flex items-center gap-2 px-4 py-3"><Search size={16} className="text-[var(--muted)]" /><input aria-label="Search members" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search members..." className="min-w-0 flex-1 text-sm outline-none" /></label>
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-[var(--rule)] py-3 text-[12px] text-[var(--muted)]"><span>Name</span><span>Status</span></div>
        {currentUser && visible ? <div className="flex items-center justify-between gap-4 border-b border-[var(--rule-2)] py-5">
          <div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-semibold">{initials}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{name} <span className="font-normal text-[var(--muted)]">(you)</span></p><p className="mt-1 truncate text-xs text-[var(--muted)]">{email}</p></div></div>
          <span className="shrink-0 text-xs text-[var(--ok)]">● Active</span>
        </div> : <p className="py-10 text-center text-sm text-[var(--muted)]">No members match your search.</p>}
      </div>
    </div>
  );
};
