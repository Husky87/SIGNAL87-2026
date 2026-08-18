import React from 'react';
import { Users, Shield, Building, Mail, CheckCircle2, Award, ExternalLink } from 'lucide-react';
import { OrgStats } from '../types';

interface OrganizationViewProps {
  stats: OrgStats;
}

export const OrganizationView: React.FC<OrganizationViewProps> = ({ stats }) => {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 bg-[#131314] text-[#e3e3e3] min-h-screen w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#37393b]">
        <div>
          <h1 className="text-2xl font-bold text-[#e3e3e3] tracking-tight flex items-center gap-2">
            <Building size={28} className="text-[#7dd3fc]" /> Organization & Workspace Collaboration
          </h1>
          <p className="text-xs text-[#c4c7c5]">
            Signal87 AI Enterprise Tenant Workspace setup, role permissions, and active team seats.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-[13px] text-[#c4c7c5]">
          <Award size={15} /> Enterprise plan · Unlimited storage
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#1e1f20] border border-[#37393b] rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-[#e3e3e3]">Organization Overview</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-[#131314] border border-[#37393b] rounded-xl space-y-1">
                <span className="text-[10px] text-[#c4c7c5] font-semibold uppercase">Active Users</span>
                <div className="text-xl font-bold text-[#e3e3e3]">{stats.activeUsers} Seats</div>
              </div>

              <div className="p-4 bg-[#131314] border border-[#37393b] rounded-xl space-y-1">
                <span className="text-[10px] text-[#c4c7c5] font-semibold uppercase">Repositories</span>
                <div className="text-xl font-bold text-[#e3e3e3]">{stats.totalDocs} Files</div>
              </div>

              <div className="p-4 bg-[#131314] border border-[#37393b] rounded-xl space-y-1">
                <span className="text-[10px] text-[#c4c7c5] font-semibold uppercase">Security Tier</span>
                <div className="text-xs font-bold text-[var(--ok)] pt-1">Enterprise High</div>
              </div>
            </div>
          </div>

          <div className="bg-[#1e1f20] border border-[#37393b] rounded-2xl p-6">
            <h2 className="text-[11px] font-medium text-[#c4c7c5] uppercase pb-2" style={{ letterSpacing: '0.09em' }}>
              Sign-in options
            </h2>

            <div>
              <div className="py-3.5 border-b border-[#37393b] flex items-center justify-between text-[13.5px]">
                <div>
                  <h4 className="text-[#e3e3e3]">Google Workspace</h4>
                  <span className="text-[12px] text-[#c4c7c5]">Domain: @signal87.ai</span>
                </div>
                <span className="text-[12px] text-[#c4c7c5]">Connected</span>
              </div>

              <div className="py-3.5 last:border-b-0 flex items-center justify-between text-[13.5px]">
                <div>
                  <h4 className="text-[#e3e3e3]">Microsoft Azure AD</h4>
                  <span className="text-[12px] text-[#c4c7c5]">Single sign-on</span>
                </div>
                <span className="text-[12px] text-[#c4c7c5]">Connected</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#1e1f20] text-[#e3e3e3] p-6 rounded-2xl border border-[#37393b] space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Shield size={18} className="text-[var(--ok)]" /> Your workspace stays private
            </h3>
            <p className="text-xs text-[#c4c7c5] leading-relaxed">
              Every document, conversation, and report stays inside your own organization. No other company using Signal87 can ever see or reach your data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
