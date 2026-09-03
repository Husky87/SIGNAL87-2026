import React, { useState } from 'react';
import {
  Settings,
  Cpu,
  Users,
  ShieldCheck,
  Key,
  CreditCard,
  Sparkles,
  Copy,
  Check,
  Plus,
  RefreshCw
} from 'lucide-react';
import { OrgStats } from '../types';

interface AdminViewProps {
  stats: OrgStats;
  selectedModel: string;
  onChangeModel: (model: string) => void;
  onSignOut?: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  stats,
  selectedModel,
  onChangeModel,
  onSignOut
}) => {
  const [activeTab, setActiveTab] = useState<'account' | 'team' | 'apikeys'>('account');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 bg-[#131314] text-[#e3e3e3] min-h-[100dvh] w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#37393b]">
        <div>
          <h1 className="text-2xl font-extrabold text-[#e3e3e3] tracking-tight flex items-center gap-2">
            <Settings size={26} className="text-[#e3e3e3]" /> Settings & Administration
          </h1>
          <p className="text-xs text-[#c4c7c5] mt-0.5">
            Manage your Enterprise Subscription, member permissions, API keys, and model engine routing.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#004a77]/40 border border-[#004a77] text-[#7dd3fc] px-3 py-1.5 rounded-xl text-xs font-semibold">
          <ShieldCheck size={16} className="text-[#7dd3fc]" /> Enterprise Tier • Active
        </div>
      </div>

      {/* Admin Tab Navigation */}
      <div className="flex border-b border-[#37393b] gap-2 sm:gap-6">
        <button
          onClick={() => setActiveTab('account')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
 activeTab === 'account' ? 'border-[#1a73e8] text-[#7dd3fc] font-extrabold' : 'border-transparent text-[#c4c7c5] hover:text-[#e3e3e3]'
 }`}
        >
          <CreditCard size={16} /> Account & Subscription
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
 activeTab === 'team' ? 'border-[#1a73e8] text-[#7dd3fc] font-extrabold' : 'border-transparent text-[#c4c7c5] hover:text-[#e3e3e3]'
 }`}
        >
          <Users size={16} /> Team & Access
        </button>
        <button
          onClick={() => setActiveTab('apikeys')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
 activeTab === 'apikeys' ? 'border-[#1a73e8] text-[#7dd3fc] font-extrabold' : 'border-transparent text-[#c4c7c5] hover:text-[#e3e3e3]'
 }`}
        >
          <Key size={16} /> API Keys
        </button>
      </div>

      {/* TAB 1: Account & Subscription */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          {/* Active Plan Overview Card */}
          <div className="bg-[#1e1f20] text-[#e3e3e3] rounded-2xl p-6 border border-[#37393b] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#37393b] pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#7dd3fc] uppercase tracking-widest block">
                  CURRENT PLAN
                </span>
                <h2 className="text-xl font-extrabold text-[#e3e3e3] tracking-tight flex items-center gap-2 mt-0.5">
                  Enterprise Unlimited Tier <Sparkles size={18} className="text-amber-400" />
                </h2>
                <p className="text-xs text-[#c4c7c5] mt-1">
                  Dedicated vector database instance, zero data retention, and multi-provider AI fallback.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => alert('Billing Portal: Your Enterprise plan is active with unlimited seats.')}
                  className="px-4 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Manage Billing & Invoices
                </button>
                {onSignOut && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="px-4 py-2 bg-transparent border border-[#37393b] hover:bg-[#28292a] text-[#e3e3e3] font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Sign out
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
              <div>
                <span className="text-[10px] text-[#c4c7c5] block font-mono">STATUS</span>
                <span className="font-bold text-[#7dd3fc]">Active • Auto-renews</span>
              </div>
              <div>
                <span className="text-[10px] text-[#c4c7c5] block font-mono">MONTHLY QUOTA</span>
                <span className="font-bold text-[#e3e3e3] font-mono">100,000,000 Tokens</span>
              </div>
              <div>
                <span className="text-[10px] text-[#c4c7c5] block font-mono">ACTIVE SEATS</span>
                <span className="font-bold text-[#e3e3e3]">4 of Unlimited Seats</span>
              </div>
              <div>
                <span className="text-[10px] text-[#c4c7c5] block font-mono">RENEWAL DATE</span>
                <span className="font-bold text-[#c4c7c5]">August 27, 2026</span>
              </div>
            </div>
          </div>

          {/* Model Engine Routing Selection */}
          <div className="bg-[#1e1f20] border border-[#37393b] rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#e3e3e3]">Signal87 Model Engine Routing</h3>
              <p className="text-xs text-[#c4c7c5]">
                Choose the default AI model engine for processing queries and multi-document analysis.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => onChangeModel('gemini-3.6-flash')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ${
 selectedModel === 'gemini-3.6-flash'
 ? 'border-[#1a73e8] bg-[#004a77]/30 ring-1 ring-[#1a73e8]'
 : 'border-[#37393b] bg-[#28292a] hover:bg-[#37393b]'
 }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#e3e3e3] text-xs sm:text-sm">Signal87 Standard Engine</span>
                  <span className="text-[12px] text-[#c4c7c5]">Fast, low latency</span>
                </div>
                <p className="text-xs text-[#c4c7c5] leading-relaxed">
                  Optimized for instant OCR text extraction, document classification, auto-summarization, and standard Q&A.
                </p>
              </div>

              <div
                onClick={() => onChangeModel('gemini-2.5-pro')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ${
 selectedModel === 'gemini-2.5-pro'
 ? 'border-[#1a73e8] bg-[#004a77]/30 ring-1 ring-[#1a73e8]'
 : 'border-[#37393b] bg-[#28292a] hover:bg-[#37393b]'
 }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#e3e3e3] text-xs sm:text-sm flex items-center gap-1">
                    Signal87 Deep Engine <Sparkles size={14} className="text-amber-400" />
                  </span>
                  <span className="text-[12px] text-[#c4c7c5]">Deep reasoning</span>
                </div>
                <p className="text-xs text-[#c4c7c5] leading-relaxed">
                  High-capacity long-context model for complex multi-document comparative analysis, legal drafting, and policy research.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Team & Access */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          <div className="bg-[#1e1f20] border border-[#37393b] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[#e3e3e3]">Organization Members & Role Permissions</h3>
                <p className="text-xs text-[#c4c7c5]">
                  Manage access privileges, legal review roles, and active workspace seats.
                </p>
              </div>
              <button
                onClick={() => alert('Invite member link copied to clipboard!')}
                className="px-3.5 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={14} /> Invite Member
              </button>
            </div>

            <div className="divide-y divide-[#28292a]">
              {[
                { email: 'ceo@signal87.ai', name: 'Michael Benezra (CEO)', role: 'Workspace Owner / Admin', status: 'Active' },
                { email: 'arch@signal87.ai', name: 'Michael Chavira (Chief Architect)', role: 'Admin & System Owner', status: 'Active' },
                { email: 'senate_liaison@signal87.ai', name: 'Government Liaison', role: 'Senior Analyst', status: 'Active' },
                { email: 'legal@signal87.ai', name: 'Legal Counsel', role: 'Reviewer', status: 'Active' }
              ].map((u, idx) => (
                <div key={idx} className="py-3.5 flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-bold text-[#e3e3e3] text-sm">{u.name}</h4>
                    <span className="text-[#c4c7c5] font-mono text-[11px]">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] text-[#c4c7c5]">
                      {u.role}
                    </span>
                    <span className="text-[12px] text-[#c4c7c5]">
                      {u.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: API Keys */}
      {activeTab === 'apikeys' && (
        <div className="bg-[#1e1f20] border border-[#37393b] rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-[#e3e3e3]">API Key Credentials & Service Integrations</h3>
              <p className="text-xs text-[#c4c7c5] mt-0.5">
                Generate production secrets for integrating Signal87 document memory into internal legal management workflows.
              </p>
            </div>
            <button
              onClick={() => alert('New Production API Key Generated')}
              className="px-3.5 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={14} /> Create API Key
            </button>
          </div>

          <div className="space-y-3">
            {[
              { name: 'Production Backend Server Key', key: 'sig_live_98a72f012b8941c890a2', created: 'July 12, 2026', scope: 'Full Memory Read/Write' },
              { name: 'Legal Review Automation Pipeline', key: 'sig_live_44e18c991b023190ab77', created: 'July 20, 2026', scope: 'Read-Only Citations' },
              { name: 'Development & Test Sandbox', key: 'sig_test_10d8a83271bc99401fe3', created: 'July 25, 2026', scope: 'Sandbox Environment' }
            ].map((k) => (
              <div key={k.key} className="p-4 bg-[#28292a] border border-[#37393b] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#e3e3e3]">{k.name}</span>
                    <span className="text-[10px] bg-[#004a77]/50 text-[#7dd3fc] px-2 py-0.2 rounded font-mono font-bold border border-[#004a77]">
                      {k.scope}
                    </span>
                  </div>
                  <span className="font-mono text-[#c4c7c5] block">{k.key.slice(0, 12)}••••••••••••••••</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyKey(k.key)}
                    className="px-3 py-1.5 bg-[#1e1f20] border border-[#37393b] hover:bg-[#37393b] text-[#e3e3e3] font-semibold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === k.key ? <Check size={13} className="text-[#7dd3fc]" /> : <Copy size={13} />}
                    <span>{copiedKey === k.key ? 'Copied' : 'Copy Key'}</span>
                  </button>
                  <button
                    onClick={() => alert('API Key rotated successfully.')}
                    className="p-1.5 text-[#c4c7c5] hover:text-[#e3e3e3] transition-colors cursor-pointer"
                    title="Rotate Key"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

