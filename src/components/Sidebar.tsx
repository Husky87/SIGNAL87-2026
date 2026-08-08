import React from 'react';
import {
  FolderOpen,
  Search,
  Activity,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
  Home,
} from 'lucide-react';
import { User } from '../lib/firebase';
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
  | 'organization';

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
}

const GooglePlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 36 36" className="flex-shrink-0 animate-in zoom-in-50 duration-200">
    <path fill="#34A853" d="M16 16v14h4V20z" />
    <path fill="#4285F4" d="M30 16H20v4h10z" />
    <path fill="#FBBC05" d="M6 16h10v4H6z" />
    <path fill="#EA4335" d="M20 16V6h-4v10z" />
  </svg>
);

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
}) => {
  const navItems: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'documents', label: 'Documents', icon: FolderOpen },
    { id: 'research', label: 'AI Research Chat', icon: Search },
    { id: 'traces', label: 'Recent Activity', icon: Activity },
    { id: 'admin', label: 'Storage & Account', icon: UserIcon },
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
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] text-[var(--card)] font-bold flex items-center justify-center text-[10px] font-mono shadow-xs">
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

        {/* Action Buttons: New Thread & Upload */}
        <div className="space-y-3 pt-1">
          <button
            onClick={handleNewThread}
            className={`flex items-center justify-center gap-3 bg-[var(--card)] hover:bg-[var(--raised)] text-[var(--ink)] border border-[var(--rule)] transition-all cursor-pointer shadow-md hover:shadow-lg rounded-full px-5 py-3 font-semibold text-sm w-full md:w-auto ${
              collapsed && !mobileMenuOpen ? 'p-3 rounded-full w-12 h-12' : ''
            }`}
            title="Start a new chat thread"
          >
            <GooglePlusIcon />
            {(!collapsed || mobileMenuOpen) && <span className="font-medium pr-1 text-[13px]">New thread</span>}
          </button>

          <button
            onClick={() => {
              if (onOpenUpload) onOpenUpload();
              if (onCloseMobileMenu) onCloseMobileMenu();
            }}
            className={`flex items-center justify-center gap-3 bg-[var(--card)] hover:bg-[var(--raised)] text-[var(--ink-2)] hover:text-[var(--ink)] border border-[var(--rule)] transition-all cursor-pointer shadow-xs rounded-full px-5 py-2.5 font-semibold text-xs w-full md:w-auto ${
              collapsed && !mobileMenuOpen ? 'p-2.5 rounded-full w-11 h-11' : ''
            }`}
            title="Upload a document"
          >
            <Upload size={14} className="text-[var(--accent)] flex-shrink-0" />
            {(!collapsed || mobileMenuOpen) && <span className="font-medium pr-1">Upload file</span>}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1 pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              (item.id === 'research' && currentTab === 'research') ||
              (item.id === 'documents' && currentTab === 'documents') ||
              (item.id === 'traces' && currentTab === 'traces') ||
              (item.id === 'admin' &&
                (currentTab === 'admin' || currentTab === 'organization'));

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobileMenu) onCloseMobileMenu();
                }}
                className={`w-full rounded-full px-4 py-2.5 text-[13px] font-medium flex items-center gap-3 transition-all text-left cursor-pointer border ${
                  isActive
                    ? 'bg-[var(--accent-soft)] border-transparent text-[var(--accent-ink)] font-semibold shadow-2xs'
                    : 'bg-transparent border-transparent text-[var(--ink-2)] hover:bg-[var(--raised)] hover:text-[var(--ink)]'
                } ${collapsed && !mobileMenuOpen ? 'justify-center px-0 rounded-full w-11 h-11 mx-auto' : ''}`}
              >
                <Icon
                  size={16}
                  className={`flex-shrink-0 ${
                    isActive ? 'text-[var(--accent)]' : 'text-[var(--slate)]'
                  }`}
                />
                {(!collapsed || mobileMenuOpen) && <span>{item.label}</span>}
              </button>
            );
          })}
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
            <span className="text-[var(--verify)] font-bold">ACTIVE</span>
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
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[var(--paper)] border-r border-[var(--rule)] text-[var(--ink)] p-0 transform transition-transform duration-200 shadow-xl ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};
