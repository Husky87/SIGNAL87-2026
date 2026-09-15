import React, { useState } from 'react';
import {
  Settings,
  Users,
  ShieldCheck,
  Key,
  CreditCard,
  Sparkles,
  Plus
} from 'lucide-react';
import { OrgStats } from '../types';

interface AdminViewProps {
  stats: OrgStats;
  selectedModel: string;
  onChangeModel: (model: string) => void;
  onSignOut?: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  stats: _stats,
  selectedModel,
  onChangeModel,
  onSignOut
}) => {
  const [activeTab, setActiveTab] = useState<'account' | 'team' | 'apikeys'>('account');

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 bg-[#131314] text-[#e3e3e3] min-h-[100dvh] w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#37393b]">
        <div>
          <h1 className="text-2xl font-extrabold text-[#e3e3e3] tracking-tight flex items-center gap-2">
            <Settings size={26} className="text-[#e3e3e3]" /> Settings & Administration
          </h1>
          <p className="text-xs text-[#c4c7c5] mt-0.5">
            Manage your subscription, member permissions, API access, and Signal87 AI routing.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#004a77]/40 border border-[#004a77] text-[#7dd3fc] px-3 py-1.5 rounded-xl text-xs font-semibold">
          <ShieldCheck size={16} /> Enterprise Tier • Active
        </div>
      </div>

      <div className="flex border-b border-[#37393b] gap-2 sm:gap-6">
        <button onClick={() => setActiveTab('account')} className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${activeTab === 'account' ? 'border-[#1a73e8] text-[#7dd3fc]' : 'border-transparent text-[#c4c7c5] hover:text-[#e3e3e3]'}`}>
          <CreditCard size={16} /> Account & Subscription
        </button>
        <button onClick={() => setActiveTab('team')} className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${activeTab === 'team' ? 'border-[#1a73e8] text-[#7dd3fc]' : 'border-transparent text-[#c4c7c5] hover:text-[#e3e3e3]'}`}>
          <Users size={16} /> Team & Access
        </button>
        <button onClick={() => setActiveTab('apikeys')} className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${activeTab === 'apikeys' ? 'border-[#1a73e8] text-[#7dd3fc]' : 'border-transparent text-[#c4c7c5] hover:text-[#e3e3e3]'}`}>
          <Key size={16} /> API Access
        </button>
      </div>

      {activeTab === 'account' && (
        <div className="space-y-6">
          <div className="bg-[#1e1f20] text-[#e3e3e3] rounded-2xl p-6 border border-[#37393b] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#37393b] pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#7dd3fc] uppercase tracking-widest block">CURRENT PLAN</span>
                <h2 className="text-xl font-extrabold text-[#e3e3e3] tracking-tight flex items-center gap-2 mt-0.5">Enterprise Unlimited Tier <Sparkles size={18} className="text-amber-400" /></h2>
                <p className="text-xs text-[#c4c7c5] mt-1">Dedicated workspace, secure document processing, and OpenAI-primary AI with Gemini fallback.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => alert('Billing Portal: Your Enterprise plan is active with unlimited seats.')} className="px-4 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold text-xs rounded-xl transition-all cursor-pointer">Manage Billing & Invoices</button>
                {onSignOut && <button type="button" onClick={onSignOut} className="px-4 py-2 bg-transparent border border-[#37393b] hover:bg-[#28292a] text-[#e3e3e3] font-bold text-xs rounded-xl transition-all cursor-pointer">Sign out</button>}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
              <div><span className="text-[10px] text-[#c4c7c5] block font-mono">STATUS</span><span className="font-bold text-[#7dd3fc]">Active • Auto-renews</span></div>
              <div><span className="text-[10px] text-[#c4c7c5] block font-mono">MONTHLY QUOTA</span><span className="font-bold text-[#e3e3e3] font-mono">100,000,000 Tokens</span></div>
              <div><span className="text-[10px] text-[#c4c7c5] block font-mono">ACTIVE SEATS</span><span className="font-bold text-[#e3e3e3]">4 of Unlimited Seats</span></div>
              <div><span className="text-[10px] text-[#c4c7c5] block font-mono">RENEWAL DATE</span><span className="font-bold text-[#c4c7c5]">August 27, 2026</span></div>
            </div>
          </div>

          <div className="bg-[#1e1f20] border border-[#37393b] rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#e3e3e3]">Signal87 AI Routing</h3>
              <p className="text-xs text-[#c4c7c5]">Signal87 uses OpenAI as the primary AI provider. Google Gemini is the automatic fallback. There is no Grok/xAI provider.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-[#1a73e8] bg-[#004a77]/30 ring-1 ring-[#1a73e8] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#e3e3e3] text-xs sm:text-sm">OpenAI / GPT — Primary</span>
                  <span className="text-[12px] text-[#7dd3fc]">Primary</span>
                </div>
                <p className="text-xs text-[#c4c7c5] leading-relaxed">Primary engine for Signal87 queries, analysis, research, and document workflows.</p>
              </div>
              <div className="p-4 rounded-2xl border border-[#37393b] bg-[#28292a] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#e3e3e3] text-xs sm:text-sm">Google Gemini — Fallback</span>
                  <span className="text-[12px] text-[#c4c7c5]">Automatic backup</span>
                </div>
                <p className="text-xs text-[#c4c7c5] leading-relaxed">Used automatically only when the primary OpenAI request cannot be completed.</p>
              </div>
            </div>
            <div className="rounded-xl border border-[#37393b] bg-[#28292a] px-4 py-3 text-xs text-[#c4c7c5]">
              <span className="font-semibold text-[#e3e3e3]">Routing is provider-controlled.</span> The model selector no longer changes the provider order. Current UI selection: <span className="font-mono text-[#7dd3fc]">{selectedModel || 'OpenAI / GPT'}</span>.
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-6">
          <div className="bg-[#1e1f20] border border-[#37393b] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between"><div><h3 className="text-sm font-extrabold text-[#e3e3e3]">Organization Members & Role Permissions</h3><p className="text-xs text-[#c4c7c5]">Manage access privileges and active workspace seats.</p></div><button onClick={() => alert('Invite member link copied to clipboard!')} className="px-3.5 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"><Plus size={14} /> Invite Member</button></div>
            <div className="divide-y divide-[#28292a]">
              {[{ email: 'ceo@signal87.ai', name: 'Michael Benezra (CEO)', role: 'Workspace Owner / Admin', status: 'Active' }, { email: 'arch@signal87.ai', name: 'Michael Chavira (Chief Architect)', role: 'Admin & System Owner', status: 'Active' }, { email: 'senate_liaison@signal87.ai', name: 'Government Liaison', role: 'Senior Analyst', status: 'Active' }, { email: 'legal@signal87.ai', name: 'Legal Counsel', role: 'Reviewer', status: 'Active' }].map((u, idx) => (
                <div key={idx} className="py-3.5 flex items-center justify-between text-xs"><div><h4 className="font-bold text-[#e3e3e3] text-sm">{u.name}</h4><span className="text-[#c4c7c5] font-mono text-[11px]">{u.email}</span></div><div className="flex items-center gap-3"><span className="text-[13px] text-[#c4c7c5]">{u.role}</span><span className="text-[12px] text-[#c4c7c5]">{u.status}</span></div></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'apikeys' && (
        <div className="bg-[#1e1f20] border border-[#37393b] rounded-2xl p-6 space-y-6">
          <div><h3 className="text-sm font-extrabold text-[#e3e3e3]">API Access</h3><p className="text-xs text-[#c4c7c5] mt-0.5">Provider credentials are stored server-side and are never displayed or copied from this screen.</p></div>
          <div className="rounded-2xl border border-[#37393b] bg-[#28292a] p-5">
            <div className="flex items-start gap-3"><Key size={18} className="mt-0.5 text-[#7dd3fc]" /><div><h4 className="font-bold text-sm text-[#e3e3e3]">Server-side provider configuration</h4><p className="mt-2 text-xs leading-6 text-[#c4c7c5]">OpenAI and Google Gemini credentials are configured as private server environment variables. Signal87 does not expose provider API keys in the browser or settings UI.</p><p className="mt-3 text-xs text-[#7dd3fc] font-semibold">No Grok/xAI credentials are used by Signal87.</p></div></div>
          </div>
        </div>
      )}
    </div>
  );
};
