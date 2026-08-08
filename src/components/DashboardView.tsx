import React from 'react';
import {
  FileText,
  FolderGit2,
  HardDrive,
  ArrowUpRight,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Layers
} from 'lucide-react';
import { DocumentItem, Project, OrgStats } from '../types';
import { NavTab } from './Sidebar';

interface DashboardViewProps {
  documents: DocumentItem[];
  projects: Project[];
  stats: OrgStats;
  onSelectTab: (tab: NavTab) => void;
  onOpenUpload: () => void;
  onSelectDocument: (doc: DocumentItem) => void;
  onSelectProject: (proj: Project) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  documents,
  projects,
  stats,
  onSelectTab,
  onOpenUpload,
  onSelectDocument,
  onSelectProject
}) => {
  const storagePercentage = Math.round((stats.storageUsedBytes / stats.storageCapacityBytes) * 100);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-5 bg-[var(--paper)] text-[var(--ink)] min-h-screen w-full max-w-full overflow-x-hidden">
      {/* Hero Welcome Banner */}
      <div className="bg-[var(--card)] border border-[var(--rule)] rounded-xl p-5 sm:p-6 lg:p-7 relative overflow-hidden shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 rounded-full text-[10px] font-mono font-bold tracking-wide">
              <Sparkles size={11} /> SIGNAL87 FOR ENTERPRISE MEMORY
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--ink)] tracking-tight leading-tight" style={{ fontFamily: 'var(--serif)' }}>
              Your document memory, available in every chat.
            </h1>
            <p className="text-[var(--ink-2)] text-xs sm:text-sm leading-relaxed max-w-[65ch]">
              Ask Signal87 for any answer you have already verified. Find the exact table, calculation, person, amount, citation, or source without rebuilding the analysis.
            </p>

            {/* MCP Endpoint Box */}
            <div className="pt-1 flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => onSelectTab('research')}
                className="px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
              >
                <span>Connect MCP Assistant</span>
                <ArrowUpRight size={14} />
              </button>

              <div className="flex items-center gap-2 px-3 py-2 bg-[var(--raised)] border border-[var(--rule)] rounded-lg text-xs font-mono text-[var(--ink)] min-h-[44px]">
                <span className="text-[var(--ink-2)] font-semibold uppercase text-[9px]">MCP Endpoint</span>
                <span className="font-bold text-[var(--accent)]">signal87.ai/mcp</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-[var(--ink-2)] font-medium pt-1">
              <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-[var(--accent)]" /> OAuth 2.1 + PKCE</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-[var(--accent)]" /> Read-only access</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-[var(--accent)]" /> Evidence links preserved</span>
            </div>
          </div>

          {/* Right Card Mockup Preview */}
          <div className="w-full lg:w-80 bg-[var(--paper)] text-[var(--ink)] p-4 rounded-xl border border-[var(--rule)] shadow-xs space-y-2.5 flex-shrink-0">
            <div className="flex items-center justify-between pb-1.5 border-b border-[var(--rule)]">
              <span className="text-xs font-bold tracking-tight text-[var(--ink)]">Signal87 Memory</span>
              <span className="text-[9px] bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 px-2 py-0.5 rounded-full font-mono font-bold">Connected</span>
            </div>
            <p className="text-[11px] text-[var(--ink-2)] font-medium">
              Search your private document intelligence and retrieve complete evidence-backed answers.
            </p>
            <div className="p-2 bg-[var(--card)] rounded-lg border border-[var(--rule)] space-y-0.5">
              <span className="text-[9px] text-[var(--accent)] font-mono flex items-center gap-1 font-semibold">
                <Sparkles size={9} /> SEARCHING SIGNAL87
              </span>
              <p className="text-[10px] font-bold text-[var(--ink)]">Found 3 relevant saved analyses</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Document Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--rule)] flex items-center justify-between shadow-2xs">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-[var(--ink-2)]">Repository Documents</span>
            <div className="text-xl font-bold text-[var(--ink)]">{stats.totalDocs}</div>
            <span className="text-[10px] text-[var(--accent)] font-semibold flex items-center gap-1">
              <CheckCircle2 size={11} /> 100% AI Indexed
            </span>
          </div>
          <div className="w-10 h-10 bg-[var(--raised)] text-[var(--accent)] rounded-xl flex items-center justify-center flex-shrink-0">
            <FileText size={18} />
          </div>
        </div>

        <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--rule)] flex items-center justify-between shadow-2xs">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-[var(--ink-2)]">Active Workspaces</span>
            <div className="text-xl font-bold text-[var(--ink)]">{stats.activeProjects}</div>
            <span className="text-[10px] text-[var(--ink-2)] font-medium">Cross-functional folders</span>
          </div>
          <div className="w-10 h-10 bg-[var(--raised)] text-[var(--accent)] rounded-xl flex items-center justify-center flex-shrink-0">
            <FolderGit2 size={18} />
          </div>
        </div>

        <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--rule)] flex items-center justify-between shadow-2xs">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-[var(--ink-2)]">Vector Embeddings</span>
            <div className="text-xl font-bold text-[var(--ink)]">{stats.totalEmbeddings.toLocaleString()}</div>
            <span className="text-[10px] text-[var(--ink-2)] font-mono">signal87-embedding-v2</span>
          </div>
          <div className="w-10 h-10 bg-[var(--raised)] text-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <Layers size={18} />
          </div>
        </div>

        <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--rule)] flex items-center justify-between shadow-2xs">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-[var(--ink-2)]">Storage Usage</span>
            <div className="text-xl font-bold text-[var(--ink)]">
              {(stats.storageUsedBytes / 1000000).toFixed(0)} MB
            </div>
            <div className="w-24 bg-[var(--raised)] h-1 rounded-full overflow-hidden mt-1">
              <div className="bg-[var(--accent)] h-full rounded-full" style={{ width: `${storagePercentage}%` }} />
            </div>
          </div>
          <div className="w-10 h-10 bg-[var(--raised)] text-[var(--ink-2)] rounded-xl flex items-center justify-center flex-shrink-0">
            <HardDrive size={18} />
          </div>
        </div>
      </div>

      {/* Main Dashboard Sections */}
      <div className="space-y-4 sm:space-y-5">
        {/* Recent Projects & Recent Uploads */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Projects */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--rule)] p-4 sm:p-5 space-y-3 flex flex-col justify-between shadow-2xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-[var(--rule-2)]">
                <div>
                  <h2 className="text-sm font-bold text-[var(--ink)] uppercase tracking-wider font-mono text-[11px]">Recent Projects</h2>
                  <p className="text-[11px] text-[var(--ink-2)]">Organized team intelligence folders</p>
                </div>
                <button
                  onClick={() => onSelectTab('projects')}
                  className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer min-h-[44px] sm:min-h-0"
                >
                  View All ({projects.length}) <ChevronRight size={13} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projects.slice(0, 2).map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => onSelectProject(proj)}
                    className="p-3 rounded-lg border border-[var(--rule)] hover:border-[var(--accent)] hover:ring-2 hover:ring-[var(--accent)]/15 transition-all cursor-pointer bg-[var(--raised)]/40 hover:bg-[var(--raised)]/80 group flex flex-col justify-between min-h-[140px]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent-ink)] font-mono border border-[var(--accent)]/20">
                          {proj.category || 'Legal'}
                        </span>
                        <span className="text-[9px] text-[var(--ink-2)] font-mono">{proj.documentIds?.length || 0} Docs</span>
                      </div>
                      <h3 className="font-bold text-[var(--ink)] text-xs mt-1.5 group-hover:text-[var(--accent)] transition-colors truncate">
                        {proj.name}
                      </h3>
                      <p className="text-[11px] text-[var(--ink-2)] line-clamp-2 mt-1 leading-snug">{proj.description || 'Secure intelligence folder for shared organization knowledge.'}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[var(--rule)] flex items-center justify-between">
                      <div className="flex -space-x-1">
                        {(proj.teamMembers || [
                          { name: 'Admin', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=32&h=32&fit=crop&crop=faces' },
                          { name: 'Lead Analyst', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=faces' }
                        ]).map((m, idx) => (
                          <img
                            key={idx}
                            src={m.avatar}
                            alt={m.name}
                            className="w-4.5 h-4.5 rounded-full border border-[var(--card)] object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-[var(--ink-2)] font-medium">Updated 1d ago</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Document Uploads */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--rule)] p-4 sm:p-5 space-y-3 flex flex-col justify-between shadow-2xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-[var(--rule-2)]">
                <div>
                  <h2 className="text-sm font-bold text-[var(--ink)] uppercase tracking-wider font-mono text-[11px]">Recent Uploads</h2>
                  <p className="text-[11px] text-[var(--ink-2)]">Latest parsed & structured documents</p>
                </div>
                <button
                  onClick={() => onSelectTab('documents')}
                  className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer min-h-[44px] sm:min-h-0"
                >
                  Library ({documents.length}) <ChevronRight size={13} />
                </button>
              </div>

              <div className="divide-y divide-[var(--rule-2)]">
                {documents.slice(0, 4).map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => onSelectDocument(doc)}
                    className="py-2 flex items-center justify-between hover:bg-[var(--raised)] px-2 rounded-lg transition-colors cursor-pointer group min-h-[44px]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-[var(--raised)] text-[var(--ink)] flex items-center justify-center font-bold text-[10px] uppercase group-hover:bg-[var(--accent)] group-hover:text-white transition-colors flex-shrink-0">
                        {doc.type}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-[var(--ink)] text-xs group-hover:text-[var(--accent)] transition-colors truncate">
                          {doc.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[var(--ink-2)]">{(doc.sizeBytes / 1000000).toFixed(1)} MB</span>
                          <span className="text-[10px] text-[var(--rule)]">•</span>
                          <span className="text-[10px] text-[var(--ink-2)]">{doc.category}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[9px] font-semibold text-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.5 rounded border border-[var(--accent)]/30 flex items-center gap-1 font-mono">
                        <CheckCircle2 size={9} /> AI READY
                      </span>
                      <ChevronRight size={14} className="text-[var(--rule)] group-hover:text-[var(--ink-2)]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
