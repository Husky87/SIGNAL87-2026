import React from 'react';
import { Users, Shield, Building, Mail, CheckCircle2, Award, ExternalLink } from 'lucide-react';
import { OrgStats } from '../types';

interface OrganizationViewProps {
  stats: OrgStats;
}

export const OrganizationView: React.FC<OrganizationViewProps> = ({ stats }) => {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 bg-[var(--bg)] text-[var(--ink)] min-h-[100dvh] w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--rule)]">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight flex items-center gap-2">
            <Building size={28} className="text-[var(--accent-ink)]" /> Organization & Workspace Collaboration
          </h1>
          <p className="text-xs text-[var(--ink-2)]">
            Signal87 AI Enterprise Tenant Workspace setup, role permissions, and active team seats.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-[13px] text-[var(--ink-2)]">
          <Award size={15} /> Enterprise plan · Unlimited storage
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-[var(--ink)]">Organization Overview</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-[var(--bg)] border border-[var(--rule)] rounded-xl space-y-1">
                <span className="text-[10px] text-[var(--ink-2)] font-semibold uppercase">Active Users</span>
                <div className="text-xl font-bold text-[var(--ink)]">{stats.activeUsers} Seats</div>
              </div>

              <div className="p-4 bg-[var(--bg)] border border-[var(--rule)] rounded-xl space-y-1">
                <span className="text-[10px] text-[var(--ink-2)] font-semibold uppercase">Repositories</span>
                <div className="text-xl font-bold text-[var(--ink)]">{stats.totalDocs} Files</div>
              </div>

              <div className="p-4 bg-[var(--bg)] border border-[var(--rule)] rounded-xl space-y-1">
                <span className="text-[10px] text-[var(--ink-2)] font-semibold uppercase">Security Tier</span>
                <div className="text-xs font-bold text-[var(--ok)] pt-1">Enterprise High</div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-2xl p-6">
            <h2 className="text-[11px] font-medium text-[var(--ink-2)] uppercase pb-2" style={{ letterSpacing: '0.09em' }}>
              Sign-in options
            </h2>

            <div>
              <div className="py-3.5 border-b border-[var(--rule)] flex items-center justify-between text-[13.5px]">
                <div>
                  <h4 className="text-[var(--ink)]">Google Workspace</h4>
                  <span className="text-[12px] text-[var(--ink-2)]">Domain: @signal87.ai</span>
                </div>
                <span className="text-[12px] text-[var(--ink-2)]">Connected</span>
              </div>

              <div className="py-3.5 last:border-b-0 flex items-center justify-between text-[13.5px]">
                <div>
                  <h4 className="text-[var(--ink)]">Microsoft Azure AD</h4>
                  <span className="text-[12px] text-[var(--ink-2)]">Single sign-on</span>
                </div>
                <span className="text-[12px] text-[var(--ink-2)]">Connected</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[var(--surface)] text-[var(--ink)] p-6 rounded-2xl border border-[var(--rule)] space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Shield size={18} className="text-[var(--ok)]" /> Your workspace stays private
            </h3>
            <p className="text-xs text-[var(--ink-2)] leading-relaxed">
              Every document, conversation, and report stays inside your own organization. No other company using Signal87 can ever see or reach your data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
