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

        <div className="flex items-center gap-2 bg-[#004a77]/40 border border-[#004a77] text-[#7dd3fc] px-3.5 py-1.5 rounded-xl text-xs font-semibold">
          <Award size={16} className="text-[#7dd3fc]" /> Enterprise Plan (Unlimited Storage)
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#1e1f20] border border-[#37393b] rounded-2xl p-6 shadow-xs space-y-4">
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
                <div className="text-xs font-bold text-emerald-400 pt-1">Enterprise High</div>
              </div>
            </div>
          </div>

          <div className="bg-[#1e1f20] border border-[#37393b] rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#e3e3e3]">SSO & OAuth Provider Status</h2>

            <div className="space-y-3">
              <div className="p-3.5 bg-[#131314] border border-[#37393b] rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#004a77] text-white font-bold flex items-center justify-center">
                    G
                  </div>
                  <div>
                    <h4 className="font-bold text-[#e3e3e3]">Google Workspace OAuth</h4>
                    <span className="text-[10px] text-[#c4c7c5]">Domain: @signal87.ai</span>
                  </div>
                </div>
                <span className="text-emerald-400 font-bold text-[10px] bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                  Connected
                </span>
              </div>

              <div className="p-3.5 bg-[#131314] border border-[#37393b] rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-900 text-indigo-200 font-bold flex items-center justify-center">
                    MS
                  </div>
                  <div>
                    <h4 className="font-bold text-[#e3e3e3]">Microsoft Azure AD SSO</h4>
                    <span className="text-[10px] text-[#c4c7c5]">Enterprise Single Sign-On</span>
                  </div>
                </div>
                <span className="text-emerald-400 font-bold text-[10px] bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                  Connected
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#1e1f20] text-[#e3e3e3] p-6 rounded-2xl border border-[#37393b] space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Shield size={18} className="text-emerald-400" /> Your workspace stays private
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
