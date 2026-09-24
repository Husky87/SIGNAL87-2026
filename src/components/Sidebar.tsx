import React, { useState, useRef, useEffect } from 'react';
import {
  Home,
  Users,
  FolderOpen,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Plus,
  StickyNote,
  FolderPlus,
  Bookmark,
  Settings,
  Upload,
  Clock,
  Star,
  Share2,
  Trash2,
  LogOut,
  Sun,
  Moon
} from 'lucide-react';
import { resolveTheme, getThemePreference, setThemePreference, subscribeTheme } from '../lib/theme';
import { User } from '../lib/firebase';
import { getTrialStatus } from '../lib/trial';
import { isAdminEmail } from '../lib/admins';
import { Signal87Logo } from './Signal87Logo';

export type NavTab =
  | 'documents'
  | 'research'
  | 'admin'
  | 'dashboard'
  | 'compare'
  | 'team'
  | 'organization'
  | 'saved'
  | 'privacy'
  | 'terms';

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
  onOpenUpload?: () => void;
  onSignOut?: () => void;
  filesView?: FilesView;
  onSelectFilesView?: (view: FilesView) => void;
  onOpenNewFolderModal?: () => void;
  onOpenNewNote?: () => void;
}

const FILES_SUB_ITEMS: { id: FilesView; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'workspace', label: 'My Workspace', icon: FolderOpen },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'shared', label: 'Shared', icon: Share2 },
  { id: 'trash', label: 'Trash', icon: Trash2 },
];

type NewAction = 'ask' | 'note' | 'folder' | 'upload';

const NEW_MENU_ITEMS: {
  id: NewAction;
  label: string;
  hint: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { id: 'ask', label: 'Ask a question', hint: 'Start a new thread', icon: Search },
  { id: 'note', label: 'New note', hint: 'Write something down', icon: StickyNote },
  { id: 'folder', label: 'New folder', hint: 'Organise your files', icon: FolderPlus },
  { id: 'upload', label: 'Upload files', hint: 'PDF, DOCX, XLSX, CSV', icon: Upload },
];

/**
 * One-click switch between dark (the default) and light, always visible in the
 * sidebar so light mode is easy to find. Settings → Appearance also offers System.
 */
const ThemeToggle: React.FC<{ compact: boolean }> = ({ compact }) => {
  const [resolved, setResolved] = useState(resolveTheme(getThemePreference()));
  useEffect(() => subscribeTheme((_pref, r) => setResolved(r)), []);
  const next = resolved === 'dark' ? 'light' : 'dark';
  const label = next === 'light' ? 'Light mode' : 'Dark mode';
  const Icon = next === 'light' ? Sun : Moon;
  if (compact) {
    return (
      <button type="button" onClick={() => setThemePreference(next)} title={`Switch to ${label.toLowerCase()}`} aria-label={`Switch to ${label.toLowerCase()}`}
        className="mx-auto flex items-center justify-center w-11 h-11 rounded-full border border-[var(--rule)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--raised)] cursor-pointer">
        <Icon size={16} />
      </button>
    );
  }
  return (
    <button type="button" onClick={() => setThemePreference(next)} aria-label={`Switch to ${label.toLowerCase()}`}
      className="w-full flex items-center gap-2.5 px-3 min-h-[40px] rounded-full border border-[var(--rule)] bg-[var(--surface)] text-[12.5px] font-medium text-[var(--ink)] hover:bg-[var(--raised)] cursor-pointer"
      style={{ fontFamily: 'var(--sans, inherit)' }}>
      <Icon size={15} className="text-[var(--teal)]" />
      <span className="flex-1 text-left">{label}</span>
      <span className="text-[10.5px] text-[var(--muted)]">{resolved === 'dark' ? 'Dark on' : 'Light on'}</span>
    </button>
  );
};

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
  onSignOut,
  filesView = 'workspace',
  onSelectFilesView,
  onOpenNewFolderModal,
  onOpenNewNote,
}) => {
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  // Dismiss the way a menu is expected to: click away, or Escape.
  //
  // Matched by attribute rather than by a ref, because this component renders
  // its nav twice — once for the desktop rail and once for the mobile drawer.
  // A single ref would only ever point at whichever copy mounted last, so
  // clicking inside the other one would dismiss the menu under the pointer.
  useEffect(() => {
    if (!newMenuOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest?.('[data-new-menu]')) setNewMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNewMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [newMenuOpen]);

  const navItems: {
    id: NavTab | 'new' | 'upload' | 'recent' | 'starred';
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'research', label: 'Ask', icon: Search },
    { id: 'documents', label: 'Files', icon: FolderOpen },
    { id: 'saved', label: 'Notes', icon: StickyNote },
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'admin', label: 'Settings', icon: Settings },
  ];

  const handleNewThread = () => {
    if (onNewSession) onNewSession();
    onSelectTab('research');
    if (onCloseMobileMenu) onCloseMobileMenu();
  };

  const runNewAction = (action: NewAction) => {
    if (action === 'ask') {
      handleNewThread();
      return;
    }

    if (action === 'upload') {
      if (onOpenUpload) onOpenUpload();
    } else if (action === 'note') {
      // The editor lives in Saved, so land there before asking for a new note.
      if (onOpenNewNote) onOpenNewNote();
      else {
        onSelectTab('saved');
        window.dispatchEvent(new CustomEvent('open-new-note'));
      }
    } else if (action === 'folder') {
      // Likewise, the folder modal belongs to the file library.
      if (onOpenNewFolderModal) onOpenNewFolderModal();
      else {
        onSelectTab('documents');
        window.dispatchEvent(new CustomEvent('open-new-folder-modal'));
      }
    }

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
  const isAdmin = isAdminEmail(currentUser?.email);
  const trialStatus = currentUser && !isAdmin ? getTrialStatus(currentUser) : null;

  const renderNavItem = (item: { id: NavTab | 'new' | 'upload' | 'recent' | 'starred'; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }) => {
    const Icon = item.icon;
    const isNew = item.id === 'new';
    const isUpload = item.id === 'upload';
    const isActive = item.id === 'recent' || item.id === 'starred'
      ? currentTab === 'documents' && filesView === item.id
      : item.id === 'documents'
        ? currentTab === 'documents' && filesView === 'workspace'
        : item.id === currentTab || (item.id === 'admin' && currentTab === 'organization');

    // New opens a menu rather than firing one hidden action. It used to start a
    // question thread immediately, so creating a note or a folder from here was
    // not reachable at all on desktop.
    if (isNew) {
      return (
        <div key={item.id} data-new-menu className="relative">
          <button
            type="button"
            onClick={() => setNewMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={newMenuOpen}
            title="Create something new"
            className={`w-full rounded-full px-4 py-2.5 text-[13px] font-semibold flex items-center gap-3 transition-all text-left cursor-pointer border bg-[var(--surface)] border-[var(--rule)] text-[var(--ink)] hover:bg-[var(--raised)] text-white ${
              collapsed && !mobileMenuOpen ? 'justify-center px-0 rounded-full w-11 h-11 mx-auto' : ''
            }`}
          >
            <Icon size={16} className="flex-shrink-0 text-[var(--teal)]" />
            {(!collapsed || mobileMenuOpen) && <span>{item.label}</span>}
          </button>

          {newMenuOpen && (
            <div
              role="menu"
              aria-label="Create new"
              className="absolute left-0 top-full mt-2 z-50 min-w-[13rem] rounded-2xl border border-[var(--rule)] bg-[var(--card)] p-1.5 shadow-xl"
            >
              {NEW_MENU_ITEMS.map(({ id, label, icon: ItemIcon, hint }) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setNewMenuOpen(false);
                    runNewAction(id);
                  }}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] text-[var(--ink-2)] hover:bg-[var(--raised)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                >
                  <ItemIcon size={16} className="flex-shrink-0 text-[var(--slate)]" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium truncate">{label}</span>
                    <span className="block text-[11px] text-[var(--slate)] truncate">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => {
          if (isUpload) {
            if (onOpenUpload) onOpenUpload();
            if (onCloseMobileMenu) onCloseMobileMenu();
          } else if (item.id === 'recent' || item.id === 'starred' || item.id === 'documents') {
            onSelectFilesView?.(item.id === 'documents' ? 'workspace' : item.id);
            onSelectTab('documents');
            onCloseMobileMenu?.();
          } else {
            onSelectTab(item.id as NavTab);
            if (onCloseMobileMenu) onCloseMobileMenu();
          }
        }}
        aria-current={isActive ? 'page' : undefined}
        title={isUpload ? 'Upload a document' : undefined}
        className={`w-full rounded-full px-4 py-2.5 text-[13px] font-medium flex items-center gap-3 transition-all text-left cursor-pointer border ${
 isActive
 ? 'bg-[var(--accent-soft)] border-transparent text-[var(--accent-ink)] font-semibold'
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
  };

  const sidebarContent = (
    <div className="s87-sidebar flex flex-col justify-between h-full overflow-y-auto bg-[var(--paper)] text-[var(--ink)] select-none p-4 space-y-5">
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

        {/* Upload is the platform's front door: first thing under the logo, on every page. */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => { onOpenUpload?.(); onCloseMobileMenu?.(); }}
            title="Upload files"
            aria-label="Upload files"
            className={`w-full rounded-full px-4 py-3 text-[13.5px] font-semibold flex items-center gap-3 transition-all cursor-pointer bg-[var(--teal)] text-white shadow-sm hover:opacity-90 ${
              collapsed && !mobileMenuOpen ? 'justify-center px-0 w-11 h-11 mx-auto' : ''
            }`}
          >
            <Upload size={17} className="flex-shrink-0" />
            {(!collapsed || mobileMenuOpen) && <span>Upload files</span>}
          </button>
          <div className="s87-new-secondary">{renderNavItem({ id: 'new', label: 'Create new', icon: Plus })}</div>
        </div>

        <nav aria-label="Workspace" className="space-y-1">
          {navItems.map(renderNavItem)}
          {(!collapsed || mobileMenuOpen) && <details className="pt-3 text-[12px] text-[var(--muted)]">
            <summary className="cursor-pointer px-4 py-2">More file options</summary>
            {FILES_SUB_ITEMS.filter(item => item.id === 'shared' || item.id === 'trash').map(item => <button key={item.id} type="button" onClick={() => { onSelectFilesView?.(item.id); onSelectTab('documents'); onCloseMobileMenu?.(); }} className="flex w-full items-center gap-3 px-4 py-2 hover:bg-[var(--raised)]"><item.icon size={15} />{item.label}</button>)}
          </details>}
        </nav>
      </div>

      {/* Footer Info */}
      <div
        className="pt-2 border-t border-[var(--rule)] text-[10px] text-[var(--slate)] font-mono"
        style={{ fontFamily: 'var(--mono)' }}
      >
        {!collapsed || mobileMenuOpen ? (
          <div className="space-y-2 px-1">
            <div className="flex items-center justify-between">
              <span>Signal87 Platform</span>
              {trialStatus ? (
                <span className={trialStatus.daysRemaining <= 1 ? 'text-[var(--warn)] font-bold' : 'text-[var(--verify)] font-bold'}>
                  {trialStatus.daysRemaining}D LEFT IN TRIAL
                </span>
              ) : (
                <span className="text-[var(--verify)] font-bold">ACTIVE</span>
              )}
            </div>
            <ThemeToggle compact={false} />
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-full text-[12px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--raised)] cursor-pointer"
              >
                <LogOut size={14} />
                Sign out
              </button>
            )}
          </div>
        ) : (
          <div className="text-center space-y-2">
            <ThemeToggle compact />
            {onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                className="mx-auto flex items-center justify-center w-11 h-11 rounded-full text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--raised)] cursor-pointer"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            ) : (
              <div className="font-bold text-[8px] text-[var(--accent)]">DOCS</div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Left Rail */}
      <aside
        className={`hidden md:flex flex-shrink-0 bg-[var(--paper)] h-full flex-col justify-between border-r border-[var(--rule-2)] transition-all duration-200 relative z-20 ${
 collapsed ? 'w-20' : 'w-56'
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
