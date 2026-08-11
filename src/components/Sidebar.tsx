import React, { useState } from 'react';
import {
  FolderOpen,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Plus,
  Bookmark,
  Settings,
  Upload,
  Clock,
  Star,
  Share2,
  Trash2,
} from 'lucide-react';
import { User } from '../lib/firebase';
import { getTrialStatus } from '../lib/trial';
import { Signal87Logo } from './Signal87Logo';

export type NavTab =
  | 'documents'
  | 'research'
  | 'traces'
  | 'admin'
  | 'dashboard'
  | 'projects'
  | 'compare'
  | 'reports'
  | 'searches'
  | 'team'
  | 'organization'
  | 'saved';

export type FilesView = 'workspace' | 'recent' | 'starred' | 'shared' | 'trash';

export interface ChatSessionSummary {
  id: string;
  title: string;
  timestamp: string;
  preview?: string;
}

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  documentCount: number;
  projectCount: number;
  mobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
  currentUser?: User | null;
  onNewSession?: () => void;
  recentSessions?: ChatSessionSummary[];
  activeSessionId?: string | null;
  onSelectSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  onOpenDrivePicker?: () => void;
  onOpenUpload?: () => void;
  filesView?: FilesView;
  onSelectFilesView?: (view: FilesView) => void;
}

const FILES_SUB_ITEMS: { id: FilesView; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'workspace', label: 'My Workspace', icon: FolderOpen },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'shared', label: 'Shared', icon: Share2 },
  { id: 'trash', label: 'Trash', icon: Trash2 },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  mobileMenuOpen = false,
  onCloseMobileMenu,
  currentUser,
  onNewSession,
  onOpenUpload,
  filesView = 'workspace',
  onSelectFilesView,
}) => {
  const [filesExpanded, setFilesExpanded] = useState(true);

  const navItems: {
    id: NavTab | 'new' | 'upload';
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }[] = [
    { id: 'new', label: 'New', icon: Plus },
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'research', label: 'Ask', icon: Search },
    { id: 'saved', label: 'Saved', icon: Bookmark },
    { id: 'admin', label: 'Settings', icon: Settings },
  ];

  const handleNewThread = () => {
    if (onNewSession) onNewSession();
    onSelectTab('research');
    if (onCloseMobileMenu) onCloseMobileMenu();
  };

  const userInitials = currentUser?.displayName
    ? currentUser.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'BW';

  // Everyone is on the free trial until Stripe billing is wired up — this
  // footer status should switch to reflect real plan state once that lands.
  const trialStatus = currentUser ? getTrialStatus(currentUser) : null;

  const renderNavItem = (item: { id: NavTab | 'new' | 'upload'; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }) => {
    const Icon = item.icon;
    const isNew = item.id === 'new';
    const isUpload = item.id === 'upload';
    const isActive =
      !isNew &&
      !isUpload &&
      ((item.id === 'research' && currentTab === 'research') ||
        (item.id === 'saved' && currentTab === 'saved') ||
        (item.id === 'admin' &&
          (currentTab === 'admin' || currentTab === 'organization')));

    return (
      <button
        key={item.id}
        onClick={() => {
          if (isNew) {
            handleNewThread();
          } else if (isUpload) {
            if (onOpenUpload) onOpenUpload();
            if (onCloseMobileMenu) onCloseMobileMenu();
          } else {
            onSelectTab(item.id as NavTab);
            if (onCloseMobileMenu) onCloseMobileMenu();
          }
        }}
        title={isNew ? 'Start a new question' : isUpload ? 'Upload a document' : undefined}
        className={`w-full rounded-full px-4 py-2.5 text-[13px] font-medium flex items-center gap-3 transition-all text-left cursor-pointer border ${
 isNew
 ? 'bg-[var(--teal)] hover:opacity-90 border-transparent text-white font-semibold'
 : isActive
 ? 'bg-[var(--accent-soft)] border-transparent text-[var(--accent-ink)] font-semibold'
 : 'bg-transparent border-transparent text-[var(--ink-2)] hover:bg-[var(--raised)] hover:text-[var(--ink)]'
 } ${collapsed && !mobileMenuOpen ? 'justify-center px-0 rounded-full w-11 h-11 mx-auto' : ''}`}
      >
        <Icon
          size={16}
          className={`flex-shrink-0 ${
 isNew ? 'text-white' : isActive ? 'text-[var(--accent)]' : 'text-[var(--slate)]'
 }`}
        />
        {(!collapsed || mobileMenuOpen) && <span>{item.label}</span>}
      </button>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full bg-[var(--paper)] text-[var(--ink)] select-none p-4 space-y-5">
      <div className="space-y-5">
        {/* Workspace Title Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--rule)] min-h-[44px]">
          {!collapsed || mobileMenuOpen ? (
            <button
              onClick={() => {
                onSelectTab('dashboard');
                if (onCloseMobileMenu) onCloseMobileMenu();
              }}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none cursor-pointer text-left"
              title="Go to Homepage"
            >
              <Signal87Logo size={28} showText={true} />
            </button>
          ) : (
            <button
              onClick={() => onSelectTab('dashboard')}
              className="flex items-center justify-center w-full hover:opacity-80 transition-opacity focus:outline-none cursor-pointer"
              title="Go to Homepage"
            >
              <Signal87Logo size={24} showText={false} />
            </button>
          )}

          <div className="flex items-center gap-1.5">
            {collapsed && !mobileMenuOpen ? null : (
              <div className="w-7 h-7 rounded-full bg-[var(--surface-2)] text-[var(--ink)] font-bold flex items-center justify-center text-[10px]">
                {userInitials}
              </div>
            )}

            {/* Desktop Collapse Toggle */}
            <button
              onClick={onToggleCollapse}
              className="hidden md:flex p-1.5 text-[var(--slate)] hover:text-[var(--ink)] hover:bg-[var(--raised)] rounded-full transition-colors cursor-pointer"
              title={collapsed ? 'Expand rail' : 'Collapse rail'}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            {mobileMenuOpen && (
              <button
                onClick={onCloseMobileMenu}
                className="md:hidden p-1.5 text-[var(--slate)] hover:text-[var(--ink)] hover:bg-[var(--raised)] rounded-full transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Navigation: New, Upload, Ask, Files (tree), Saved, Settings */}
        <nav className="space-y-1 pt-1">
          {navItems.slice(0, 3).map((item) => renderNavItem(item))}

          {/* Files — expandable tree: My Workspace / Recent / Starred / Shared / Trash */}
          <div>
            <button
              onClick={() => {
                if (collapsed && !mobileMenuOpen) {
                  if (onSelectFilesView) onSelectFilesView('workspace');
                  onSelectTab('documents');
                  if (onCloseMobileMenu) onCloseMobileMenu();
                } else {
                  setFilesExpanded((prev) => !prev);
                }
              }}
              className={`w-full rounded-full px-4 py-2.5 text-[13px] font-medium flex items-center gap-3 transition-all text-left cursor-pointer border bg-transparent border-transparent ${
 currentTab === 'documents'
 ? 'text-[var(--ink)] font-semibold'
 : 'text-[var(--ink-2)] hover:bg-[var(--raised)] hover:text-[var(--ink)]'
 } ${collapsed && !mobileMenuOpen ? 'justify-center px-0 rounded-full w-11 h-11 mx-auto' : ''}`}
            >
              <FolderOpen size={16} className={`flex-shrink-0 ${currentTab === 'documents' ? 'text-[var(--accent)]' : 'text-[var(--slate)]'}`} />
              {(!collapsed || mobileMenuOpen) && (
                <>
                  <span className="flex-1">Files</span>
                  <ChevronDown
                    size={14}
                    className={`text-[var(--slate)] transition-transform ${filesExpanded ? '' : '-rotate-90'}`}
                  />
                </>
              )}
            </button>

            {filesExpanded && (!collapsed || mobileMenuOpen) && (
              <div className="mt-0.5 ml-4 pl-3 border-l border-[var(--rule)] space-y-0.5">
                {FILES_SUB_ITEMS.map((sub) => {
                  const SubIcon = sub.icon;
                  const isSubActive = currentTab === 'documents' && filesView === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => {
                        if (onSelectFilesView) onSelectFilesView(sub.id);
                        onSelectTab('documents');
                        if (onCloseMobileMenu) onCloseMobileMenu();
                      }}
                      className={`w-full rounded-full px-3 py-2 text-[12.5px] font-medium flex items-center gap-2.5 transition-all text-left cursor-pointer ${
 isSubActive
 ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)] font-semibold'
 : 'text-[var(--ink-2)] hover:bg-[var(--raised)] hover:text-[var(--ink)]'
 }`}
                    >
                      <SubIcon size={14} className={`flex-shrink-0 ${isSubActive ? 'text-[var(--accent)]' : 'text-[var(--slate)]'}`} />
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {navItems.slice(3).map((item) => renderNavItem(item))}
        </nav>
      </div>

      {/* Footer Info */}
      <div
        className="pt-2 border-t border-[var(--rule)] text-[10px] text-[var(--slate)] font-mono"
        style={{ fontFamily: 'var(--mono)' }}
      >
        {!collapsed || mobileMenuOpen ? (
          <div className="flex items-center justify-between px-1">
            <span>Signal87 Platform</span>
            {trialStatus ? (
              <span className={trialStatus.daysRemaining <= 1 ? 'text-[var(--warn)] font-bold' : 'text-[var(--verify)] font-bold'}>
                {trialStatus.daysRemaining}D LEFT IN TRIAL
              </span>
            ) : (
              <span className="text-[var(--verify)] font-bold">ACTIVE</span>
            )}
          </div>
        ) : (
          <div className="text-center font-bold text-[8px] text-[var(--accent)]">DOCS</div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Left Rail */}
      <aside
        className={`hidden md:flex flex-shrink-0 bg-[var(--paper)] h-full flex-col justify-between border-r border-transparent transition-all duration-200 relative z-20 ${
 collapsed ? 'w-20' : 'w-64'
 }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-40"
          onClick={onCloseMobileMenu}
        />
      )}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[var(--paper)] border-r border-[var(--rule)] text-[var(--ink)] p-0 transform transition-transform duration-200 ${
 mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
 }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};
